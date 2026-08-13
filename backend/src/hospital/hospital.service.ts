import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/auth.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UsersRepository } from '../auth/users.repository';
import { ApiError } from '../common/errors/api-error';
import { buildPageMeta, paginate } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProcedureRepository } from '../procedure/procedure.repository';
import { boundingBox, haversineKm } from './distance';
import { buildHospitalWhere, orderHospitals } from './hospital.filters';
import { projectHospital } from './hospital.projection';
import type { HospitalResponse } from './hospital.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from './hospital.repository';
import type { CreateHospitalDto, ListHospitalsQuery, ListManagedHospitalsQuery, UpdateHospitalDto } from './hospital.schemas';
import { assertWritableHospitalFields } from './hospital.write';
import { seoulToday } from './sponsorship';

export interface HospitalListResult {
  items: HospitalResponse[];
  meta: PageMeta;
}

/** `GET /admin/hospitals` 응답. `scope` 는 화면이 빈 목록의 문구를 구분하는 근거다. */
export interface AdminHospitalListResult {
  items: HospitalResponse[];
  meta: PageMeta;
  scope: 'managed' | 'all';
}

@Injectable()
export class HospitalService {
  constructor(
    private readonly hospitals: HospitalRepository,
    private readonly procedures: ProcedureRepository,
    private readonly users: UsersRepository,
  ) {}

  async list(query: ListHospitalsQuery): Promise<HospitalListResult> {
    const today = seoulToday();
    const hasCoordinates = query.latitude !== undefined && query.longitude !== undefined && query.radiusKm !== undefined;

    const bounds = hasCoordinates
      ? boundingBox({ latitude: query.latitude!, longitude: query.longitude! }, query.radiusKm!)
      : undefined;

    const rows = await this.hospitals.findMany(buildHospitalWhere(query, bounds));

    // 광고 자격 판정에 시술 카테고리가 필요하다. `추천` 탭과 필터 없음은 카테고리를 보지 않는다.
    let items = rows.map((row) =>
      projectHospital(row, {
        today,
        procedureId: query.procedureId,
        distanceKm: hasCoordinates
          ? haversineKm(
              { latitude: query.latitude!, longitude: query.longitude! },
              { latitude: row.latitude, longitude: row.longitude }
            )
          : undefined,
      })
    );

    // bounding box 는 반경의 상위집합이라 모서리 밖이 섞여 있다. 정밀 필터를 여기서 건다.
    if (hasCoordinates) {
      items = items.filter((item) => (item.distanceKm ?? Number.POSITIVE_INFINITY) <= query.radiusKm!);
    }

    // hasVerifiedSpecialist 는 SQL 로 2항(verificationStatus·specialty)까지만 좁혀진다 —
    // Prisma 는 컬럼 간 비교(verifiedSpecialty === specialty)를 표현할 수 없다. 나머지
    // 한 항은 배지 규칙의 단일 출처인 representativeSpecialty(= hasSpecialistBadge)로
    // 앱에서 정제한다. 반경 필터의 bounding box → 하버사인 정밀 필터와 같은 2단 구조다.
    if (query.hasVerifiedSpecialist === true) {
      items = items.filter((item) => item.representativeSpecialty !== null);
    }

    // 계약 규칙 4 — 필터가 없으면 광고를 당기지 않는다.
    const sponsoredFirst = query.procedureId !== undefined || query.recommended === true;
    const ordered = orderHospitals(items, { sort: query.sort, sponsoredFirst });

    return {
      items: paginate(ordered, query),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems: ordered.length }),
    };
  }

  async getById(id: string): Promise<HospitalResponse> {
    const row = await this.hospitals.findById(id);

    if (row === null) {
      throw new ApiError('HOSPITAL_NOT_FOUND');
    }

    return projectHospital(row, { today: seoulToday() });
  }

  /**
   * `GET /admin/hospitals`. 공개 목록(`list`)과 별개 경로다 — 관리자 화면이 공개 목록을
   * 쓰다가 스코프를 잃는 회귀를 구조적으로 막는다 (계획 문서 참고).
   *
   * **분기는 역할로 한다, 담당 목록의 길이로 하지 않는다.** `hospital_admin` 이 아직 담당
   * 병원을 배정받지 못했으면 `findManagedHospitalIds` 가 빈 배열을 주고, `{ id: { in: [] } }`
   * 는 Prisma 에서 0행이다 — 그 담당자는 빈 목록을 받는다(에러가 아니라 정상 상태다).
   * 반대로 빈 배열 길이로 "전체 노출" 로 분기하면 담당 미배정 담당자가 전 병원을 보게 되는
   * 권한 상승이 된다. `operator` 는 `hospital_admins` 행이 원래 없으므로(주석 참고,
   * `UsersRepository.findManagedHospitalIds`) 길이로는 `operator` 와 미배정 담당자를 구분할
   * 수 없다 — 그래서 반드시 `actor.role` 을 본다.
   */
  async listForAdmin(query: ListManagedHospitalsQuery, actor: AuthenticatedUser): Promise<AdminHospitalListResult> {
    const scope: 'managed' | 'all' = actor.role === 'operator' ? 'all' : 'managed';
    const where: Prisma.HospitalWhereInput = { deletedAt: null };

    if (query.q !== undefined && query.q.trim() !== '') {
      where.nameNormalized = { contains: query.q.trim().toLowerCase() };
    }

    if (scope === 'managed') {
      const managedIds = await this.users.findManagedHospitalIds(actor.id);
      where.id = { in: managedIds };
    }

    const rows = await this.hospitals.findMany(where);
    const today = seoulToday();
    const items = rows.map((row) => projectHospital(row, { today }));

    return {
      items: paginate(items, query),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems: items.length }),
      scope,
    };
  }

  /**
   * `POST /hospitals` — `operator` 전용 (컨트롤러의 `@Roles('operator')` 가 보장한다).
   * 광고·집계 필드는 `createHospitalSchema` 에 아예 없어 이 경로로는 보낼 수 없다.
   */
  async create(dto: CreateHospitalDto): Promise<HospitalResponse> {
    await this.assertProceduresExist(dto.procedureIds);

    const id = await this.hospitals.create(dto);

    return this.getById(id);
  }

  /**
   * `PATCH /hospitals/:hospitalId`. `rawBody` 는 zod 검증 **전** 원본이다 — 쓰기 금지
   * 판정은 zod 가 모르는 키까지 봐야 한다 (`assertWritableHospitalFields` 주석 참고).
   */
  async update(
    id: string,
    dto: UpdateHospitalDto,
    rawBody: Record<string, unknown>,
    actor: AuthenticatedUser,
  ): Promise<HospitalResponse> {
    assertWritableHospitalFields(rawBody, actor.role);
    await this.assertProceduresExist(dto.procedureIds);

    await this.hospitals.update(id, dto);

    return this.getById(id);
  }

  /**
   * `procedureIds` 가 실제로 존재하는지 **트랜잭션 시작 전에** 확인한다.
   *
   * 확인 없이 `hospitalProcedure.createMany` 로 바로 넣으면 오타 난 id 하나가 FK 위반이
   * 되고, 이 저장소에는 `PrismaClientKnownRequestError` 매핑이 없어 그대로 `500
   * INTERNAL_ERROR` 로 샌다. 운영자가 원인을 알 수 없는 "서버 오류" 를 받게 되므로
   * 여기서 `422 VALIDATION_FAILED` 로 먼저 거절한다.
   *
   * `procedureIds` 가 dto 에 없으면(부분 수정에서 안 보낸 경우) 검사하지 않는다.
   */
  private async assertProceduresExist(procedureIds: string[] | undefined): Promise<void> {
    if (procedureIds === undefined || procedureIds.length === 0) return;

    const existing = await this.procedures.findExistingIds(procedureIds);
    const missing = procedureIds.filter((id) => !existing.has(id));

    if (missing.length > 0) {
      throw new ApiError('VALIDATION_FAILED', {
        details: missing.map((id) => ({
          field: 'procedureIds',
          code: 'unknown_procedure',
          message: `존재하지 않는 시술이에요: ${id}`,
        })),
      });
    }
  }
}
