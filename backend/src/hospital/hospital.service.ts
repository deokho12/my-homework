import { Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/errors/api-error';
import { buildPageMeta, paginate } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
import { boundingBox, haversineKm } from './distance';
import { buildHospitalWhere, orderHospitals } from './hospital.filters';
import { projectHospital } from './hospital.projection';
import type { HospitalResponse } from './hospital.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from './hospital.repository';
import type { CreateHospitalDto, ListHospitalsQuery, UpdateHospitalDto } from './hospital.schemas';
import { assertWritableHospitalFields } from './hospital.write';
import { seoulToday } from './sponsorship';

export interface HospitalListResult {
  items: HospitalResponse[];
  meta: PageMeta;
}

@Injectable()
export class HospitalService {
  constructor(private readonly hospitals: HospitalRepository) {}

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
   * `POST /hospitals` — `operator` 전용 (컨트롤러의 `@Roles('operator')` 가 보장한다).
   * 광고·집계 필드는 `createHospitalSchema` 에 아예 없어 이 경로로는 보낼 수 없다.
   */
  async create(dto: CreateHospitalDto): Promise<HospitalResponse> {
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

    await this.hospitals.update(id, dto);

    return this.getById(id);
  }
}
