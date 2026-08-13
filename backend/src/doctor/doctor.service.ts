import { Injectable } from '@nestjs/common';

import { ApiError } from '../common/errors/api-error';
import { buildPageMeta, paginate } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
import { buildDoctorWhere } from './doctor.filters';
import { projectDoctorPublic } from './doctor.projection';
import type { DoctorPublicResponse } from './doctor.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DoctorRepository } from './doctor.repository';
import type { ListDoctorsQuery } from './doctor.schemas';

export interface DoctorListResult {
  items: DoctorPublicResponse[];
  meta: PageMeta;
}

export interface Viewer {
  authenticated: boolean;
}

@Injectable()
export class DoctorService {
  constructor(private readonly doctors: DoctorRepository) {}

  async list(query: ListDoctorsQuery, viewer: Viewer): Promise<DoctorListResult> {
    const where = buildDoctorWhere(query);

    // `verifiedSpecialist=true` 의 잔여 조건(`verifiedSpecialty === specialty`)은 컬럼 간
    // 비교라 Prisma 로 표현할 수 없다. 이 경우에만 전부 읽어 앱에서 정제한 뒤 앱에서
    // 페이징한다 — 그렇지 않으면 `count(where)` 가 앱 필터 이전 값이라 틀린다.
    if (query.verifiedSpecialist === true) {
      const rows = await this.doctors.findAllSorted(where, query.sort);
      const items = rows.map((row) => projectDoctorPublic(row, viewer)).filter((item) => item.isVerifiedSpecialist);

      return {
        items: paginate(items, { page: query.page, pageSize: query.pageSize }),
        meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems: items.length }),
      };
    }

    const [rows, totalItems] = await Promise.all([
      this.doctors.findMany(where, {
        sort: query.sort,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.doctors.count(where),
    ]);

    return {
      items: rows.map((row) => projectDoctorPublic(row, viewer)),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
    };
  }

  async getById(id: string, viewer: Viewer): Promise<DoctorPublicResponse> {
    const row = await this.doctors.findById(id);

    if (row === null) {
      throw new ApiError('DOCTOR_NOT_FOUND');
    }

    return projectDoctorPublic(row, viewer);
  }

  /**
   * 병원 소속 전문의 목록. 병원 존재 확인은 호출부(`HospitalController`)가 한다 —
   * 여기서 하면 `DoctorModule` 이 `HospitalModule` 을 import 해야 해서 순환 참조가 된다.
   */
  async listByHospital(hospitalId: string, viewer: Viewer): Promise<DoctorPublicResponse[]> {
    const rows = await this.doctors.findByHospital(hospitalId);

    return rows.map((row) => projectDoctorPublic(row, viewer));
  }
}
