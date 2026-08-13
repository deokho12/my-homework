import { Injectable } from '@nestjs/common';

import { ApiError } from '../common/errors/api-error';
import { buildPageMeta, paginate } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
import { boundingBox, haversineKm } from './distance';
import { buildHospitalWhere, orderHospitals } from './hospital.filters';
import { projectHospital } from './hospital.projection';
import type { HospitalResponse } from './hospital.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from './hospital.repository';
import type { ListHospitalsQuery } from './hospital.schemas';
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
}
