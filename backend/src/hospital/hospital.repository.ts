import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { HOSPITAL_INCLUDE } from './hospital.projection';
import type { HospitalRow } from './hospital.projection';
import type { CreateHospitalDto, UpdateHospitalDto } from './hospital.schemas';
import { buildChildRows, buildCreateFields, buildScalarChanges } from './hospital.write';
import type { HospitalChildRows } from './hospital.write';

@Injectable()
export class HospitalRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 필터에 맞는 병원을 **전부** 읽는다. `skip`/`take` 를 쓰지 않는 이유는
   * 광고 우선 노출이 전역 재정렬이라 페이징 후에 적용할 수 없기 때문이다
   * (계획 Task 6 의 판단 절 참고). 병원 수가 수천이 되면 이 구조를 바꿔야 한다.
   */
  async findMany(where: Prisma.HospitalWhereInput): Promise<HospitalRow[]> {
    return this.prisma.hospital.findMany({
      where,
      include: HOSPITAL_INCLUDE,
      orderBy: { id: 'asc' },
    }) as unknown as Promise<HospitalRow[]>;
  }

  async findById(id: string): Promise<HospitalRow | null> {
    return this.prisma.hospital.findFirst({
      where: { id, deletedAt: null },
      include: HOSPITAL_INCLUDE,
    }) as unknown as Promise<HospitalRow | null>;
  }

  /**
   * `POST /hospitals`. `id`·`createdAt`·`updatedAt` 을 여기서 채운다 —
   * 스키마에 `@default(cuid())`·`@updatedAt` 이 없다 (Global Constraints).
   *
   * 자식 테이블은 트랜잭션 안에서 함께 만든다 — 병원만 만들고 시술이 비면
   * 목록·상세 화면이 빈 시술 배열을 전제하지 않은 곳에서 깨질 수 있다.
   */
  async create(dto: CreateHospitalDto): Promise<string> {
    const id = createId();
    const now = new Date();
    // 자식 테이블 FK 가 필요해 id 를 먼저 만든 뒤에 자식 행을 조립한다
    // (`buildChildRows` 는 순수 함수라 여기서 호출해도 트랜잭션 경계와 무관하다).
    const fields = buildCreateFields(dto);
    const children = buildChildRows(id, dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.hospital.create({
        data: { id, createdAt: now, updatedAt: now, ...fields },
      });

      await writeChildRows(tx, id, children, { replace: false });
    });

    return id;
  }

  /**
   * `PATCH /hospitals/:hospitalId`. **보내지 않은 필드는 건드리지 않는다** — 부분 수정에서
   * 값을 채워 넣지 않은 자식 테이블도 그대로 둔다(`dto` 에 그 키가 없으면 `buildChildRows` 가
   * `undefined` 를 남겨 `writeChildRows` 가 아예 건드리지 않는다).
   */
  async update(id: string, dto: UpdateHospitalDto): Promise<void> {
    const fields = buildScalarChanges(dto);
    const children = buildChildRows(id, dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.hospital.update({
        where: { id },
        data: { ...fields, updatedAt: new Date() },
      });

      await writeChildRows(tx, id, children, { replace: true });
    });
  }
}

/**
 * 자식 테이블 5종을 `dto` 가 보낸 것만 교체한다 (`deleteMany` + `createMany`).
 *
 * `replace=false`(생성) 는 지울 기존 행이 없으므로 `deleteMany` 를 건너뛴다.
 * `replace=true`(수정) 는 보낸 자식만 지우고 다시 넣는다 — 안 보낸 자식은 이 함수가
 * 아예 호출되지 않는다(`children.X === undefined` 라 아래 각 분기가 스킵된다).
 */
async function writeChildRows(
  tx: Prisma.TransactionClient,
  hospitalId: string,
  children: HospitalChildRows,
  options: { replace: boolean },
): Promise<void> {
  if (children.procedures !== undefined) {
    if (options.replace) await tx.hospitalProcedure.deleteMany({ where: { hospitalId } });
    if (children.procedures.length > 0) await tx.hospitalProcedure.createMany({ data: children.procedures });
  }

  if (children.images !== undefined) {
    if (options.replace) await tx.hospitalImage.deleteMany({ where: { hospitalId } });
    if (children.images.length > 0) await tx.hospitalImage.createMany({ data: children.images });
  }

  if (children.tags !== undefined) {
    if (options.replace) await tx.hospitalTag.deleteMany({ where: { hospitalId } });
    if (children.tags.length > 0) await tx.hospitalTag.createMany({ data: children.tags });
  }

  if (children.eventNotes !== undefined) {
    if (options.replace) await tx.hospitalEventNote.deleteMany({ where: { hospitalId } });
    if (children.eventNotes.length > 0) await tx.hospitalEventNote.createMany({ data: children.eventNotes });
  }

  if (children.businessHours !== undefined) {
    if (options.replace) await tx.businessHour.deleteMany({ where: { hospitalId } });
    if (children.businessHours.length > 0) await tx.businessHour.createMany({ data: children.businessHours });
  }
}
