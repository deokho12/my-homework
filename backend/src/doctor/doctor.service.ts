import { Injectable } from '@nestjs/common';

import { ApiError } from '../common/errors/api-error';
import { buildPageMeta, paginate } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProcedureRepository } from '../procedure/procedure.repository';
import { buildDoctorWhere } from './doctor.filters';
import { GENERAL_PRACTITIONER, projectDoctorAdmin, projectDoctorPublic } from './doctor.projection';
import type { DoctorAdminResponse, DoctorPublicResponse } from './doctor.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DoctorRepository } from './doctor.repository';
import { collectExplicitProcedureIds } from './doctor.write';
import type { DoctorUpsertDto, ListDoctorsQuery, UpdateDoctorDto } from './doctor.schemas';

export interface DoctorListResult {
  items: DoctorPublicResponse[];
  meta: PageMeta;
}

export interface Viewer {
  authenticated: boolean;
}

@Injectable()
export class DoctorService {
  constructor(
    private readonly doctors: DoctorRepository,
    private readonly procedures: ProcedureRepository,
  ) {}

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

  /**
   * `PUT /hospitals/:hospitalId/doctors`. 병원 존재·담당 여부는 `HospitalScopeGuard` 가
   * 이미 확인했다(`resource: 'hospital'`) — 여기서 다시 조회하지 않는다.
   *
   * 관리자 시야(`DoctorAdminView`)로 응답한다 — 교체 직후 화면이 자기가 보낸
   * `certificateUrl` 을 그대로 확인해야 한다.
   */
  async replaceForHospital(hospitalId: string, items: DoctorUpsertDto[]): Promise<DoctorAdminResponse[]> {
    const existingById = await this.doctors.findRosterSnapshot(hospitalId);

    // `id` 가 있는데 이 병원 로스터에 없는 항목 — 다른 병원 전문의를 슬쩍 편입시키는 경로를
    // 막는다. 스키마 통과 후의 애플리케이션 검증이라 422 다.
    const unknownIds = items
      .map((item) => item.id)
      .filter((id): id is string => id !== undefined && !existingById.has(id));

    if (unknownIds.length > 0) {
      throw new ApiError('VALIDATION_FAILED', {
        details: unknownIds.map((id) => ({
          field: 'doctors',
          code: 'unknown_doctor_id',
          message: `이 병원 소속이 아닌 전문의예요: ${id}`,
        })),
      });
    }

    await this.assertProceduresExist(collectExplicitProcedureIds(items));

    // 신규 `일반의` 가 `procedureIds` 를 안 보냈을 때만 병원의 시술 전체가 필요하다 —
    // 그 밖의 경우엔 조회 자체를 건너뛴다.
    const needsHospitalProcedures = items.some(
      (item) => item.id === undefined && item.procedureIds === undefined && item.specialty === GENERAL_PRACTITIONER,
    );
    const hospitalProcedureIds = needsHospitalProcedures
      ? await this.doctors.findHospitalProcedureIds(hospitalId)
      : [];

    await this.doctors.replaceForHospital(hospitalId, items, { existingById, hospitalProcedureIds });

    const rows = await this.doctors.findByHospital(hospitalId);

    return rows.map((row) => projectDoctorAdmin(row));
  }

  /** `PATCH /doctors/:doctorId`. `HospitalScopeGuard` 가 존재·담당 여부를 이미 확인했다. */
  async update(doctorId: string, dto: UpdateDoctorDto): Promise<DoctorAdminResponse> {
    const existing = await this.doctors.findSnapshot(doctorId);

    if (existing === null) {
      throw new ApiError('DOCTOR_NOT_FOUND');
    }

    if (dto.procedureIds !== undefined) {
      await this.assertProceduresExist(dto.procedureIds);
    }

    await this.doctors.update(doctorId, dto, existing);

    const row = await this.doctors.findById(doctorId);

    if (row === null) {
      throw new ApiError('DOCTOR_NOT_FOUND');
    }

    return projectDoctorAdmin(row);
  }

  /**
   * `DELETE /doctors/:doctorId`. **soft delete 다** — 물리 삭제하면
   * `ConsultRequest.doctor` 가 `onDelete: SetNull` 이라 그 전문의를 지목한 상담들의
   * `doctorId` 가 전부 사라진다.
   */
  async softDelete(doctorId: string): Promise<void> {
    await this.doctors.softDelete(doctorId);
  }

  /**
   * `procedureIds` 가 실제로 존재하는지 확인한다 (`hospital.service.ts` 의
   * `assertProceduresExist` 와 같은 이유 — FK 위반으로 원인 없는 500 이 되지 않게
   * 트랜잭션 전에 422 로 거절한다). `ProcedureRepository.findExistingIds` 를 그대로
   * 재사용한다 — 같은 검증을 두 곳에 두면 갈린다.
   */
  private async assertProceduresExist(procedureIds: string[]): Promise<void> {
    if (procedureIds.length === 0) return;

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
