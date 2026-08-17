import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/auth.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ResourceScopeService } from '../auth/scope/resource-scope.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UsersRepository } from '../auth/users.repository';
import { ApiError } from '../common/errors/api-error';
import { buildPageMeta } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from '../hospital/hospital.repository';
import { projectConsultForAdmin, projectConsultForOwner } from './consult.projection';
import type { ConsultRequestAdminResponse, MyConsultRequestResponse } from './consult.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConsultRepository } from './consult.repository';
import type {
  CreateConsultMemoDto,
  CreateConsultRequestDto,
  ListConsultRequestsQuery,
  ListMyConsultRequestsQuery,
  UpdateConsultStatusDto,
} from './consult.schemas';
import { normalizePhone } from './masking';
import { CONSULT_STATUS_LABEL, seoulMonthStart } from './summary';

export interface AdminConsultListResult {
  items: ConsultRequestAdminResponse[];
  meta: PageMeta;
  /** `managed` 면 담당 병원만, `all` 이면 전 병원. 화면이 빈 목록의 이유를 구분한다. */
  scope: 'managed' | 'all';
}

export interface MyConsultListResult {
  items: MyConsultRequestResponse[];
  meta: PageMeta;
}

export interface StatusUpdateResult {
  consult: ConsultRequestAdminResponse;
  /** 부수효과(이력·알림)가 실제로 일어났는가. 같은 상태 재지정이면 `false`. */
  changed: boolean;
}

export interface ConsultSummaryResult {
  newThisMonth: number;
  pending: number;
  timezone: string;
  calculatedAt: string;
}

const SEOUL = 'Asia/Seoul';

@Injectable()
export class ConsultService {
  constructor(
    private readonly consults: ConsultRepository,
    private readonly hospitals: HospitalRepository,
    private readonly scope: ResourceScopeService,
    private readonly users: UsersRepository,
  ) {}

  // ------------------------------------------------------------------ 신청자

  /**
   * 상담 신청.
   *
   * 서버가 네 가지를 검사한다. 지금은 전부 화면에만 있어서 주소로 직접 들어가면 통과한다:
   * 1. 병원 존재 — `404`
   * 2. **상담 마감** — `409 CONSULT_CLOSED` (화면은 버튼만 막는다)
   * 3. 지목한 전문의가 그 병원 소속인가 — `422`
   * 4. 고른 시술을 그 병원이 취급하는가 — `422`
   *
   * `doctorId` 를 실제로 저장한다 — 지금은 저장되지 않아 관리자가 어느 전문의를
   * 지목했는지 알 수 없다(known-issues).
   */
  async create(dto: CreateConsultRequestDto, actor: AuthenticatedUser): Promise<MyConsultRequestResponse> {
    const hospital = await this.hospitals.findById(dto.hospitalId);

    if (hospital === null) {
      throw new ApiError('HOSPITAL_NOT_FOUND');
    }

    if (!hospital.consultAvailable) {
      throw new ApiError('CONSULT_CLOSED');
    }

    const doctorId = dto.doctorId ?? null;

    if (doctorId !== null) {
      const owningHospitalId = await this.scope.findOwningHospitalId('doctor', doctorId);

      if (owningHospitalId !== dto.hospitalId) {
        throw new ApiError('DOCTOR_NOT_AT_HOSPITAL');
      }
    }

    const procedureId = dto.procedureId ?? null;

    if (procedureId !== null && !hospital.procedures.some((item) => item.procedureId === procedureId)) {
      throw new ApiError('PROCEDURE_NOT_OFFERED');
    }

    const name = dto.name.trim();
    const id = await this.consults.create({
      userId: actor.id,
      hospitalId: dto.hospitalId,
      doctorId,
      procedureId,
      name,
      phone: normalizePhone(dto.phone.trim()),
      preferredTime: dto.preferredTime,
      message: dto.message,
      // 계약(`createConsultRequest`)과 시드 알림이 쓰는 문구 그대로. 같은 알림함에서
      // 시드 데이터와 실제 접수 알림의 제목이 갈리면 안 된다.
      notificationTitle: '새로운 상담 신청',
      notificationMessage: `${name}님이 상담을 신청했어요`,
    });

    return this.getMine(id, actor);
  }

  async listMine(query: ListMyConsultRequestsQuery, actor: AuthenticatedUser): Promise<MyConsultListResult> {
    const where: Prisma.ConsultRequestWhereInput = { userId: actor.id };

    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [rows, totalItems] = await Promise.all([
      this.consults.findMany(where, { skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.consults.count(where),
    ]);

    return {
      items: rows.map((row) => projectConsultForOwner(row)),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
    };
  }

  /**
   * 내 상담 하나. **남의 상담과 없는 상담을 구분하지 않는다** — 상담 id 가 고객
   * 개인정보와 1:1 이라, 구분하면 id 순차 대입으로 건수가 새어 나간다.
   */
  async getMine(consultRequestId: string, actor: AuthenticatedUser): Promise<MyConsultRequestResponse> {
    const row = await this.consults.findById(consultRequestId);

    if (row === null || row.userId !== actor.id) {
      throw new ApiError('CONSULT_REQUEST_NOT_FOUND');
    }

    return projectConsultForOwner(row);
  }

  // ------------------------------------------------------------------ 관리자

  /**
   * 담당 범위. `operator` 는 전 병원, `hospital_admin` 은 담당 병원만이다.
   *
   * **길이가 아니라 역할로 분기한다.** 담당 미배정 담당자와 운영자는 둘 다
   * `hospital_admins` 행이 0개라, 길이로 나누면 미배정 담당자가 전 병원을 보게 된다
   * (`hospital.service.ts` 의 `listForAdmin` 과 같은 판정).
   */
  private async adminScope(
    actor: AuthenticatedUser,
    hospitalIdFilter?: string,
  ): Promise<{ where: Prisma.ConsultRequestWhereInput; scope: 'managed' | 'all' }> {
    const scope: 'managed' | 'all' = actor.role === 'operator' ? 'all' : 'managed';
    const where: Prisma.ConsultRequestWhereInput = {};

    if (scope === 'managed') {
      const managedIds = await this.users.findManagedHospitalIds(actor.id);

      if (hospitalIdFilter !== undefined && !managedIds.includes(hospitalIdFilter)) {
        // **담당 밖 병원을 콕 집어 요청하면 `403` 이다.** 숨기지 않는다 — 병원은 공개
        // 리소스라 `GET /hospitals/{id}` 로 누구나 존재를 확인할 수 있어서, 빈 목록을
        // 주는 것은 아무것도 감추지 못하면서 "그 병원에 상담이 없다" 는 틀린 인상만 준다.
        // 상담 *상세*를 404 로 가리는 것과는 다른 판정이다 — 그건 상담 id 가 고객
        // 개인정보와 1:1 이라서다 (계약이 두 경우를 의도적으로 나눴다).
        throw new ApiError('HOSPITAL_NOT_MANAGED');
      }

      where.hospitalId = hospitalIdFilter === undefined ? { in: managedIds } : hospitalIdFilter;
    } else if (hospitalIdFilter !== undefined) {
      where.hospitalId = hospitalIdFilter;
    }

    return { where, scope };
  }

  async listForAdmin(
    query: ListConsultRequestsQuery,
    actor: AuthenticatedUser,
  ): Promise<AdminConsultListResult> {
    const { where, scope } = await this.adminScope(actor, query.hospitalId);

    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [rows, totalItems] = await Promise.all([
      this.consults.findMany(where, { skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.consults.count(where),
    ]);

    return {
      items: rows.map((row) => projectConsultForAdmin(row, actor.role)),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
      scope,
    };
  }

  /** 담당 여부는 `HospitalScopeGuard` 가 이미 판정했다 — 여기서 다시 조회하지 않는다. */
  async getForAdmin(consultRequestId: string, actor: AuthenticatedUser): Promise<ConsultRequestAdminResponse> {
    const row = await this.consults.findById(consultRequestId);

    if (row === null) {
      throw new ApiError('CONSULT_REQUEST_NOT_FOUND');
    }

    return projectConsultForAdmin(row, actor.role);
  }

  async summary(actor: AuthenticatedUser): Promise<ConsultSummaryResult> {
    const { where } = await this.adminScope(actor);
    const now = new Date();
    const counts = await this.consults.summaryCounts(where, seoulMonthStart(now));

    return { ...counts, timezone: SEOUL, calculatedAt: now.toISOString() };
  }

  /**
   * 상태 변경. **같은 상태면 아무 일도 하지 않는다(멱등).**
   *
   * 지금은 이미 `예약완료` 인 상담에 `예약완료` 를 다시 눌러도 이력이 쌓이고 알림이 또
   * 간다 — 목록의 빠른 버튼을 오탭하면 쉽게 발생한다(known-issues). 에러로 만들지 않는
   * 이유: 오탭이 실패로 보일 이유가 없고, 결과 상태는 요청한 그대로다.
   */
  async updateStatus(
    consultRequestId: string,
    dto: UpdateConsultStatusDto,
    actor: AuthenticatedUser,
  ): Promise<StatusUpdateResult> {
    const row = await this.consults.findById(consultRequestId);

    if (row === null) {
      throw new ApiError('CONSULT_REQUEST_NOT_FOUND');
    }

    if (row.status === dto.status) {
      // `changed: false` 를 컨트롤러가 `X-Status-Changed` 헤더로 알린다 — 호출자가
      // "오탭이라 아무 일도 안 일어났다" 와 "바뀌었다" 를 구분할 수 있어야 한다.
      return { consult: projectConsultForAdmin(row, actor.role), changed: false };
    }

    const label = CONSULT_STATUS_LABEL[dto.status] ?? dto.status;

    await this.consults.updateStatus({
      consultRequestId,
      status: dto.status,
      changedByUserId: actor.id,
      // 신청자는 방금 읽은 행에 이미 있다 — 같은 값을 다시 조회하지 않는다.
      requesterUserId: row.userId,
      notificationTitle: '상담 상태 변경',
      notificationMessage: `상담 상태가 '${label}'(으)로 변경되었어요`,
    });

    return { consult: await this.getForAdmin(consultRequestId, actor), changed: true };
  }

  async addMemo(
    consultRequestId: string,
    dto: CreateConsultMemoDto,
    actor: AuthenticatedUser,
  ): Promise<ConsultRequestAdminResponse> {
    const row = await this.consults.findById(consultRequestId);

    if (row === null) {
      throw new ApiError('CONSULT_REQUEST_NOT_FOUND');
    }

    await this.consults.addMemo(consultRequestId, dto.content.trim(), actor.id);

    return this.getForAdmin(consultRequestId, actor);
  }
}
