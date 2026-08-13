import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { DOCTOR_INCLUDE } from './doctor.projection';
import type { DoctorRow } from './doctor.projection';
import type { SortField } from '../hospital/hospital.schemas';
import type { DoctorUpsertDto } from './doctor.schemas';
import {
  buildCareerRows,
  buildDoctorCreateFields,
  buildDoctorScalarChanges,
  buildPendingVerificationRow,
  buildProcedureRows,
  needsReverification,
  resolveProcedureIds,
} from './doctor.write';
import type { DoctorSnapshot, DoctorWriteInput } from './doctor.write';

export interface FindManyOptions {
  sort: SortField;
  skip: number;
  take: number;
}

export interface ReplaceRosterContext {
  /** 이 병원의 현재 로스터(soft delete 제외). `id` 있는 요청 항목의 재검수 판정 기준이 된다. */
  existingById: Map<string, DoctorSnapshot>;
  /** `일반의` 신규 항목이 `procedureIds` 를 안 보냈을 때만 쓰는, 병원이 취급하는 시술 전체. */
  hospitalProcedureIds: string[];
}

@Injectable()
export class DoctorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `GET /doctors` 는 스폰서 정렬이 없어 Prisma `skip`/`take` 를 그대로 쓴다
   * (병원 목록과 의도적으로 다르다 — `hospital.repository.ts` 주석 참고).
   */
  async findMany(where: Prisma.DoctorWhereInput, options: FindManyOptions): Promise<DoctorRow[]> {
    return this.prisma.doctor.findMany({
      where,
      include: DOCTOR_INCLUDE,
      orderBy: [{ [options.sort]: 'desc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  /**
   * 페이징 없이 전부 읽는다. `verifiedSpecialist=true` 일 때만 쓴다 — 앱에서
   * `isVerifiedSpecialist` 로 정제하면 `count(where)` 가 틀리므로, 병원 목록과 같은 방식으로
   * 전부 읽고 앱에서 정제·페이징한다 (서비스 주석 참고).
   */
  async findAllSorted(where: Prisma.DoctorWhereInput, sort: SortField): Promise<DoctorRow[]> {
    return this.prisma.doctor.findMany({
      where,
      include: DOCTOR_INCLUDE,
      orderBy: [{ [sort]: 'desc' }, { id: 'asc' }],
    });
  }

  async count(where: Prisma.DoctorWhereInput): Promise<number> {
    return this.prisma.doctor.count({ where });
  }

  async findById(id: string): Promise<DoctorRow | null> {
    return this.prisma.doctor.findFirst({
      where: { id, deletedAt: null },
      include: DOCTOR_INCLUDE,
    });
  }

  async findByHospital(hospitalId: string): Promise<DoctorRow[]> {
    return this.prisma.doctor.findMany({
      where: { hospitalId, deletedAt: null },
      include: DOCTOR_INCLUDE,
      orderBy: { id: 'asc' },
    });
  }

  /** 로스터 교체 대상 병원의 현재 전문의 스냅샷. `id` 있는 요청 항목이 실제로 이 병원 소속인지, 재검수가 필요한지 판정하는 근거다. */
  async findRosterSnapshot(hospitalId: string): Promise<Map<string, DoctorSnapshot>> {
    const rows = await this.prisma.doctor.findMany({
      where: { hospitalId, deletedAt: null },
      select: { id: true, specialty: true, certificateUrl: true },
    });

    return new Map(rows.map((row) => [row.id, { specialty: row.specialty, certificateUrl: row.certificateUrl }]));
  }

  /** `일반의` 신규 항목의 `procedureIds` 유도에 쓰는, 병원이 실제로 취급하는 시술 전체. */
  async findHospitalProcedureIds(hospitalId: string): Promise<string[]> {
    const rows = await this.prisma.hospitalProcedure.findMany({
      where: { hospitalId },
      select: { procedureId: true },
    });

    return rows.map((row) => row.procedureId);
  }

  /** `PATCH /doctors/:doctorId` 재검수 판정에 필요한 최소 스냅샷. soft delete 된 행은 없는 것으로 본다. */
  async findSnapshot(doctorId: string): Promise<DoctorSnapshot | null> {
    return this.prisma.doctor.findFirst({
      where: { id: doctorId, deletedAt: null },
      select: { specialty: true, certificateUrl: true },
    });
  }

  async softDelete(doctorId: string): Promise<void> {
    const now = new Date();

    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: { deletedAt: now, updatedAt: now },
    });
  }

  /**
   * `PUT /hospitals/:hospitalId/doctors` 트랜잭션.
   *
   * 1. 요청 목록에 없는 기존 행을 soft delete 한다(목록 이탈 = 삭제, 물리 삭제가 아니다 —
   *    `ConsultRequest.doctor` 가 `onDelete: SetNull` 이라 물리 삭제하면 그 전문의를 지목한
   *    상담들의 `doctorId` 가 사라진다).
   * 2. `id` 있는 항목을 갱신한다(재검수 규칙 포함).
   * 3. `id` 없는 항목을 신규로 만든다(`pending` + `procedureIds` 미지정이면 전공에서 유도).
   *
   * `hospital.repository.ts` 의 트랜잭션 패턴(자식 테이블 교체, `cuid()` id, 명시적
   * `createdAt`/`updatedAt`)을 그대로 따른다.
   */
  async replaceForHospital(hospitalId: string, items: DoctorUpsertDto[], context: ReplaceRosterContext): Promise<void> {
    const now = new Date();
    const itemIds = items
      .map((item) => item.id)
      .filter((id): id is string => id !== undefined);
    const keepIds = new Set(itemIds);
    const removedIds = [...context.existingById.keys()].filter((id) => !keepIds.has(id));

    await this.prisma.$transaction(async (tx) => {
      if (removedIds.length > 0) {
        await tx.doctor.updateMany({
          where: { id: { in: removedIds } },
          data: { deletedAt: now, updatedAt: now },
        });
      }

      for (const item of items) {
        if (item.id === undefined) {
          await applyDoctorCreate(tx, hospitalId, item, context.hospitalProcedureIds, now);
          continue;
        }

        // 서비스가 이미 `item.id` 가 이 병원 로스터에 있음을 확인했다 (`existingById.has`).
        // 방어선으로 다시 확인한다 — 없으면 이 항목은 조용히 건너뛴다(도달하지 않아야 한다).
        const existing = context.existingById.get(item.id);
        if (existing === undefined) continue;

        await applyDoctorUpdate(tx, item.id, item, existing, now);
      }
    });
  }

  /** `PATCH /doctors/:doctorId`. */
  async update(doctorId: string, input: DoctorWriteInput, existing: DoctorSnapshot): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await applyDoctorUpdate(tx, doctorId, input, existing, now);
    });
  }
}

/** 로스터 항목 갱신 — 스칼라·자식 테이블·재검수 행을 한 트랜잭션 안에서 처리한다. */
async function applyDoctorUpdate(
  tx: Prisma.TransactionClient,
  doctorId: string,
  input: DoctorWriteInput,
  existing: DoctorSnapshot,
  now: Date
): Promise<void> {
  const changes = buildDoctorScalarChanges(input, existing);

  await tx.doctor.update({ where: { id: doctorId }, data: { ...changes, updatedAt: now } });

  if (input.procedureIds !== undefined) {
    await tx.doctorProcedure.deleteMany({ where: { doctorId } });
    if (input.procedureIds.length > 0) {
      await tx.doctorProcedure.createMany({ data: buildProcedureRows(doctorId, input.procedureIds) });
    }
  }

  if (input.career !== undefined) {
    await tx.doctorCareer.deleteMany({ where: { doctorId } });
    if (input.career.length > 0) {
      await tx.doctorCareer.createMany({ data: buildCareerRows(doctorId, input.career) });
    }
  }

  if (needsReverification(input, existing)) {
    const submittedSpecialty = input.specialty ?? existing.specialty;
    const submittedCertificateUrl = input.certificateUrl !== undefined ? input.certificateUrl : existing.certificateUrl;

    await tx.doctorVerification.create({
      data: buildPendingVerificationRow(doctorId, submittedSpecialty, submittedCertificateUrl, now),
    });
  }
}

/** 로스터 항목 신규 — `pending` 상태로 들어가고, `procedureIds` 미지정이면 전공에서 유도한다. */
async function applyDoctorCreate(
  tx: Prisma.TransactionClient,
  hospitalId: string,
  item: DoctorUpsertDto,
  hospitalProcedureIds: string[],
  now: Date
): Promise<void> {
  const fields = buildDoctorCreateFields(item);

  await tx.doctor.create({ data: { ...fields, hospitalId, createdAt: now, updatedAt: now } });

  const procedureIds = resolveProcedureIds(item.specialty, item.procedureIds, hospitalProcedureIds);
  if (procedureIds.length > 0) {
    await tx.doctorProcedure.createMany({ data: buildProcedureRows(fields.id, procedureIds) });
  }

  const careerRows = buildCareerRows(fields.id, item.career ?? []);
  if (careerRows.length > 0) {
    await tx.doctorCareer.createMany({ data: careerRows });
  }

  await tx.doctorVerification.create({
    data: buildPendingVerificationRow(fields.id, item.specialty, item.certificateUrl ?? null, now),
  });
}
