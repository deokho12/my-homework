import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/auth.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ResourceScopeService } from '../auth/scope/resource-scope.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UsersRepository } from '../auth/users.repository';
import { ApiError } from '../common/errors/api-error';
import type { ApiErrorDetail } from '../common/errors/api-error';
import { buildPageMeta } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from '../hospital/hospital.repository';
import { projectConsultForAdmin, projectConsultForOwner } from './consult.projection';
import type { ConsultRequestAdminResponse, ConsultRequestRow, MyConsultRequestResponse } from './consult.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConsultRepository } from './consult.repository';
import type { AuditWriter } from './consult.repository';
import {
  createConsultRequestSchema,
  listConsultRequestsQuerySchema,
  updateConsultStatusSchema,
} from './consult.schemas';
import type {
  CreateConsultMemoDto,
  ListConsultRequestsQuery,
  ListMyConsultRequestsQuery,
} from './consult.schemas';
import { adminConsultNotificationText, consultNotificationText } from './notification-text';
import { normalizePhone, phoneDigits } from './masking';
import {
  cancelReasonOf,
  classifyEvent,
  isConsultCancelReason,
  nextVisitAt,
  periodRange,
  requiredInputs,
  truncateToMinute,
} from './transition';
import type { ConsultCancelReason, ConsultStatus } from './transition';

/**
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: 접수의 **검사 순서**(동의 → 연락처 → 조건), 목록의 기간·시술·검색 필터와
 *  `statusCounts`, `updateStatus` 전면 재작성(필수 입력 → no-op → 부수효과), 투영 축 전달,
 *  `summary` 삭제 — 소비 화면이 없다.)
 *
 * **판정 규칙은 여기 없다.** 필수 입력·결과 일시·이벤트 종류·기간 경계·파생 취소 사유는
 * 순수 모듈 `./transition.ts` 에 있고, 문구는 `./notification-text.ts` 가 만든다 —
 * 프런트의 같은 두 모듈과 **같은 답**을 내야 한다 (AGENTS.md "같은 판정을 두 곳에 두지 않는다").
 */

export type ConsultScope = 'managed' | 'all';

export interface AdminConsultListResult {
  items: ConsultRequestAdminResponse[];
  meta: PageMeta;
  /** `managed` 면 담당 병원만, `all` 이면 전 병원. 화면이 빈 목록의 이유를 구분한다. */
  scope: ConsultScope;
  /** 상태 탭 건수. 모집단은 **지금 걸린 필터에서 `status` 만 뺀 범위**다. */
  statusCounts: Record<ConsultStatus, number> & { total: number };
}

export interface MyConsultListResult {
  items: MyConsultRequestResponse[];
  meta: PageMeta;
}

export interface StatusUpdateResult {
  consult: ConsultRequestAdminResponse;
  /** **이 요청이 이력 행을 만들었는가.** 상태 변경과 일시 변경 모두 `true`, no-op 만 `false`. */
  changed: boolean;
}

/** 감사 행에 들어갈 것. 컨트롤러가 요청 컨텍스트를 붙여 실제로 쓴다. */
export interface ConsultStatusAudit {
  action: 'consult_request.status_change' | 'consult_request.reschedule';
  beforeValue: string | null;
  afterValue: string | null;
}

export type ConsultAuditFactory = (audit: ConsultStatusAudit) => AuditWriter;

/** 클라이언트와 서버가 **같은 패턴**으로 검사한다 (계약 `ConsultRequestCreateRequest.phone`). */
const CONSULT_PHONE_PATTERN = /^01[016789]-?\d{3,4}-?\d{4}$/;
const INVALID_PHONE_MESSAGE = '휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요';

function validationFailed(detail: ApiErrorDetail): ApiError {
  return new ApiError('VALIDATION_FAILED', { details: [detail] });
}

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
   * 상담 신청. **검사 순서가 계약이다** (`docs/api/README.md` §9) —
   * **동의 → 연락처 형식 → 그 밖의 입력 → 접수 조건.**
   *
   * 그래서 본문을 zod 로 먼저 통과시키지 않는다. 동의 없이 들어온 요청이
   * `INVALID_PHONE_FORMAT` 으로 거절되면 화면이 가리킬 칸이 달라진다 — 프런트의 흉내 구현
   * (`createConsultRequest`)이 이 순서이고, 서버가 그와 다르면 화면 코드가 바뀌어야 한다.
   *
   * 접수 조건 넷은 **지금 화면에만 있어서** `/consult/:hospitalId` 로 직접 들어오면 통과한다:
   * 병원 존재(`404`) · 상담 마감(`409`) · 지목 전문의 소속(`422`) · 취급 시술(`422`).
   */
  async create(body: unknown, actor: AuthenticatedUser): Promise<MyConsultRequestResponse> {
    assertThirdPartyConsent(body);
    assertPhoneFormat(body);

    const dto = new ZodValidationPipe(createConsultRequestSchema).transform(body);
    const hospital = await this.hospitals.findById(dto.hospitalId);

    if (hospital === null) {
      throw new ApiError('HOSPITAL_NOT_FOUND');
    }

    if (!hospital.consultAvailable) {
      throw new ApiError('CONSULT_CLOSED');
    }

    const doctorId = dto.doctorId ?? null;

    if (doctorId !== null) {
      // 전문의 → 병원 매핑을 여기서 다시 만들지 않는다 — `HospitalScopeGuard` 가 쓰는 것과
      // 같은 함수다 (soft delete 된 전문의를 "없는 것" 으로 보는 규칙까지 공유한다).
      const owningHospitalId = await this.scope.findOwningHospitalId('doctor', doctorId);

      if (owningHospitalId !== dto.hospitalId) {
        throw new ApiError('DOCTOR_NOT_AT_HOSPITAL');
      }
    }

    const procedureId = dto.procedureId ?? null;

    // `null` 은 화면의 기본 선택지 `잘 모르겠어요` 라 검증을 건너뛴다 (계약).
    if (procedureId !== null && !hospital.procedures.some((item) => item.procedureId === procedureId)) {
      throw new ApiError('PROCEDURE_NOT_OFFERED');
    }

    const name = dto.name.trim();
    const phone = normalizePhone(dto.phone.trim());
    const notification = adminConsultNotificationText(name);

    const id = await this.consults.create({
      userId: actor.id,
      hospitalId: dto.hospitalId,
      doctorId,
      procedureId,
      name,
      phone,
      phoneDigits: phoneDigits(phone),
      preferredTime: dto.preferredTime,
      message: dto.message,
      consentNoticeVersion: dto.thirdPartyConsent.noticeVersion,
      notificationTitle: notification.title,
      notificationMessage: notification.message,
    });

    return projectConsultForOwner(await this.loadOrThrow(id));
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

  // ------------------------------------------------------------------ 관리자

  /**
   * 담당 범위. `operator` 는 전 병원, `hospital_admin` 은 담당 병원만이다.
   *
   * **길이가 아니라 역할로 분기한다.** 담당 미배정 담당자와 운영자는 둘 다 `hospital_admins`
   * 행이 0개라, 길이로 나누면 미배정 담당자가 전 병원을 보게 된다.
   */
  private async adminScope(
    actor: AuthenticatedUser,
    hospitalIdFilter?: string,
  ): Promise<{ where: Prisma.ConsultRequestWhereInput; scope: ConsultScope }> {
    const scope: ConsultScope = actor.role === 'operator' ? 'all' : 'managed';
    const where: Prisma.ConsultRequestWhereInput = {};

    if (scope === 'managed') {
      const managedIds = await this.users.findManagedHospitalIds(actor.id);

      if (hospitalIdFilter !== undefined && !managedIds.includes(hospitalIdFilter)) {
        // **담당 밖 병원을 콕 집어 요청하면 `403` 이다.** 병원은 공개 리소스라
        // `GET /hospitals/{id}` 로 누구나 존재를 확인할 수 있어서, 숨겨도 얻는 것이 없다.
        // 상담 **단건**을 404 로 가리는 것과는 다른 판정이다 — 그건 상담 id 가 고객
        // 개인정보와 1:1 이라서다 (계약이 두 경우를 의도적으로 나눴다).
        throw new ApiError('HOSPITAL_NOT_MANAGED');
      }

      where.hospitalId = hospitalIdFilter === undefined ? { in: managedIds } : hospitalIdFilter;
    } else if (hospitalIdFilter !== undefined) {
      where.hospitalId = hospitalIdFilter;
    }

    return { where, scope };
  }

  /**
   * 관리자 목록. **목록과 탭 숫자가 같은 질의에서 나온다** — 별도 조회로 두면 두 숫자가
   * 서로 다른 시점을 가리켜 목록과 탭이 어긋난다 (계약).
   *
   * 본문은 zod 가 아니라 여기서 한 번 더 읽는다(`period` + `createdFrom/To` 충돌) —
   * 화면 버그이지 사용자 입력 오류가 아니라서 필드 단위 `details` 를 쓰지 않는다.
   */
  async listForAdmin(
    rawQuery: unknown,
    actor: AuthenticatedUser,
  ): Promise<AdminConsultListResult> {
    const query = new ZodValidationPipe(listConsultRequestsQuerySchema).transform(rawQuery);

    if (query.period !== undefined && (query.createdFrom !== undefined || query.createdTo !== undefined)) {
      throw new ApiError('PERIOD_FILTER_CONFLICT');
    }

    const { where, scope } = await this.adminScope(actor, query.hospitalId);
    // 상태를 뺀 모집단. 탭을 눌러도 다른 탭의 숫자가 흔들리면 안 된다 (계약).
    const baseWhere = { ...where, ...buildFilters(query, scope, new Date()) };
    const listWhere: Prisma.ConsultRequestWhereInput =
      query.status && query.status.length > 0 ? { ...baseWhere, status: { in: query.status } } : baseWhere;

    const [rows, totalItems, statusCounts] = await Promise.all([
      this.consults.findMany(listWhere, {
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.consults.count(listWhere),
      this.consults.countByStatus(baseWhere),
    ]);

    return {
      // **목록은 두 역할 모두 번호를 가린다** — 건별 열람 기록을 남기지 않는 자원이라
      // 전체 번호가 실리면 무기록 대량 반출이 성립한다 (계약 2026-10-13).
      items: rows.map((row) => projectConsultForAdmin(row, actor.role, 'list')),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
      scope,
      statusCounts,
    };
  }

  /** 담당 여부는 `HospitalScopeGuard` 가 이미 판정했다 — 여기서 다시 조회하지 않는다. */
  async getForAdmin(consultRequestId: string, actor: AuthenticatedUser): Promise<ConsultRequestAdminResponse> {
    // **전체 번호가 있는 유일한 자리다** (담당 `hospital_admin` 에게만). 그래서 컨트롤러가
    // 이 호출 뒤에 감사 행을 남긴다 (결정 3).
    return projectConsultForAdmin(await this.loadOrThrow(consultRequestId), actor.role, 'detail');
  }

  /**
   * 상태 변경 · 예약 일시 변경.
   *
   * 순서가 규칙이다: **필수 입력 검사 → no-op 판정 → 부수효과.** `예약확정` 건에 일시 없이
   * `예약확정` 을 다시 보내는 것은 "바꿀 것이 없는 요청" 이 아니라 **값을 빠뜨린 요청**이다.
   *
   * 세 값(`status`·`visitAt`·`cancelReason`)이 모두 그대로면 이력도 알림도 감사도 만들지
   * 않는다 — 목록의 빠른 버튼을 오탭해 중복 알림이 나가는 것을 막는 계약이고, 요청 후의
   * 상태가 요청자가 원한 상태와 같으므로 오류로 다루지 않는다.
   *
   * **응답은 no-op 이든 아니든 목록 투영이다** (계약 `ConsultRequest` 의 마스킹 표 마지막 줄,
   * 2026-10-22). 전체 번호를 실으면 **감사 행을 만들지 않는 no-op PATCH** 로 담당 상담 전 건의
   * 번호를 기록 없이 모을 수 있다. 쓰기 응답을 읽는 화면은 `statusHistory`·`visitAt` 만 쓴다 —
   * 전체 번호가 필요하면 기록이 남는 `GET /consult-requests/{id}` 로 간다.
   */
  async updateStatus(
    consultRequestId: string,
    rawBody: unknown,
    actor: AuthenticatedUser,
    auditFactory: ConsultAuditFactory,
  ): Promise<StatusUpdateResult> {
    const dto = new ZodValidationPipe(updateConsultStatusSchema).transform(rawBody);
    const row = await this.loadOrThrow(consultRequestId);
    const status = dto.status as ConsultStatus;

    const required = requiredInputs(status);
    const currentVisitAt = row.visitAt?.toISOString() ?? null;
    const resolvedVisitAt = nextVisitAt(status, currentVisitAt, dto.visitAt);

    if (required.includes('visitAt') && resolvedVisitAt === null) {
      throw validationFailed({ field: 'visitAt', code: 'VISIT_AT_REQUIRED', message: '확정 일시를 입력해주세요' });
    }

    // 없을 때와 모르는 코드일 때의 **코드가 다르다** — 하나로 뭉개면 다른 클라이언트가
    // "고르지 않았다" 로 잘못 안내한다 (계약 2026-10-22).
    if (required.includes('cancelReason') && (dto.cancelReason === undefined || dto.cancelReason === null)) {
      throw validationFailed({
        field: 'cancelReason',
        code: 'CANCEL_REASON_REQUIRED',
        message: '취소 사유를 선택해주세요',
      });
    }

    if (required.includes('cancelReason') && !isConsultCancelReason(dto.cancelReason)) {
      throw validationFailed({
        field: 'cancelReason',
        code: 'INVALID_CANCEL_REASON',
        message: '취소 사유를 다시 선택해주세요',
      });
    }

    // 사유는 취소 이벤트 행에만 저장된다 — 다른 상태로 갈 때 보낸 값은 무시한다.
    const cancelReason: ConsultCancelReason | null =
      status === 'cancelled' && isConsultCancelReason(dto.cancelReason) ? dto.cancelReason : null;

    const event = classifyEvent(
      {
        status: row.status as ConsultStatus,
        visitAt: truncateToMinute(currentVisitAt),
        cancelReason: cancelReasonOf(row.status, row.statusChanges),
      },
      { status, visitAt: resolvedVisitAt, cancelReason },
    );

    if (event === 'noop') {
      return { consult: projectConsultForAdmin(row, actor.role, 'list'), changed: false };
    }

    const text = consultNotificationText({
      event,
      status,
      visitAt: resolvedVisitAt,
      cancelReason,
      // 알림 문구의 병원 이름은 **서버가 조인해** 얻는다 (계약 2026-10-22).
      hospitalName: row.hospital?.name ?? null,
    });

    await this.consults.updateStatus({
      consultRequestId,
      status,
      event,
      visitAt: resolvedVisitAt === null ? null : new Date(resolvedVisitAt),
      cancelReason,
      changedByUserId: actor.id,
      requesterUserId: row.userId,
      notificationTitle: text.title,
      notificationMessage: text.message,
      // 일시 변경에 특례가 없다 — 이 칸이 "이벤트" 가 아니라 **변경 후 상태**라서다 (DB §15.2).
      notificationConsultStatus: status,
      writeAudit: auditFactory(
        event === 'reschedule'
          ? {
              // `action` 이 갈린다 — before/after 에 들어가는 것이 상태가 아니라 일시다 (§4).
              action: 'consult_request.reschedule',
              beforeValue: truncateToMinute(currentVisitAt),
              afterValue: resolvedVisitAt,
            }
          : { action: 'consult_request.status_change', beforeValue: row.status, afterValue: status },
      ),
    });

    return {
      consult: projectConsultForAdmin(await this.loadOrThrow(consultRequestId), actor.role, 'list'),
      changed: true,
    };
  }

  async addMemo(
    consultRequestId: string,
    dto: CreateConsultMemoDto,
    actor: AuthenticatedUser,
    writeAudit: AuditWriter,
  ): Promise<ConsultRequestAdminResponse> {
    await this.loadOrThrow(consultRequestId);
    await this.consults.addMemo(consultRequestId, dto.content.trim(), actor.id, writeAudit);

    // 쓰기 응답은 **목록 투영**이다 — 위 `updateStatus` 머리말과 같은 이유다.
    return projectConsultForAdmin(await this.loadOrThrow(consultRequestId), actor.role, 'list');
  }

  private async loadOrThrow(consultRequestId: string): Promise<ConsultRequestRow> {
    const row = await this.consults.findById(consultRequestId);

    if (row === null) {
      throw new ApiError('CONSULT_REQUEST_NOT_FOUND');
    }

    return row;
  }
}

/**
 * 동의 검사 — **가장 먼저**다. 동의 없는 접수는 저장 자체가 성립하지 않는다.
 *
 * `error.code` 에 그 값이 오고 필드 단위 `details` 는 쓰지 않는다 — 거절 사유가 하나뿐이라
 * 화면은 체크박스 한 곳만 가리키면 된다 (계약).
 */
function assertThirdPartyConsent(body: unknown): void {
  const consent = (body as { thirdPartyConsent?: { agreed?: unknown } } | null)?.thirdPartyConsent;

  if (consent?.agreed !== true) {
    throw new ApiError('THIRD_PARTY_CONSENT_REQUIRED');
  }
}

/** 연락처 형식 — 동의 **다음**, 그 밖의 입력 검사보다 **먼저**. */
function assertPhoneFormat(body: unknown): void {
  const phone = (body as { phone?: unknown } | null)?.phone;
  const value = typeof phone === 'string' ? phone.trim() : '';

  if (!CONSULT_PHONE_PATTERN.test(value)) {
    throw validationFailed({ field: 'phone', code: 'INVALID_PHONE_FORMAT', message: INVALID_PHONE_MESSAGE });
  }
}

/**
 * 상태를 뺀 목록 필터. **목록과 탭 숫자가 같은 판정을 쓴다.**
 *
 * 기간 경계는 순수 함수 `periodRange`(= 프런트와 같은 함수)가 정하고 반열린 구간 `[from, to)`
 * 다. `createdFrom`/`createdTo` 는 임의 구간이라 **양 끝 포함**이다 (계약).
 */
function buildFilters(
  query: ListConsultRequestsQuery,
  scope: ConsultScope,
  now: Date,
): Prisma.ConsultRequestWhereInput {
  const where: Prisma.ConsultRequestWhereInput = {};

  if (query.period !== undefined) {
    const [from, to] = periodRange(query.period, now);

    where.createdAt = { gte: from, lt: to };
  } else if (query.createdFrom !== undefined || query.createdTo !== undefined) {
    where.createdAt = {
      ...(query.createdFrom === undefined ? {} : { gte: new Date(query.createdFrom) }),
      ...(query.createdTo === undefined ? {} : { lte: new Date(query.createdTo) }),
    };
  }

  if (query.procedureId && query.procedureId.length > 0) {
    // 모르는 id 는 `422` 가 아니라 **0건**이다 — 폐기된 옛 id 로 들어온 북마크가 화면을
    // 깨뜨리지 않게 (`GET /hospitals` 와 같은 판단, `backend/README.md`).
    where.procedureId = { in: query.procedureId };
  }

  const q = query.q?.trim() ?? '';

  if (q.length > 0) {
    where.OR = buildSearch(q, scope);
  }

  return where;
}

/**
 * 검색 — 이름 부분일치 **OR** 번호 숫자. 숫자가 2자 이상일 때만 번호 검색을 함께 건다.
 *
 * **운영자는 뒤 4자리 접미 일치뿐이다.** 전체 번호 부분일치를 허용하면 "이 번호의 상담이
 * 존재하는가" 를 묻는 오라클이 되어 마스킹이 우회된다. 5자리 이상을 넣어도 에러가 아니라
 * 뒤 4자리만 잘라 비교한다 — 검색은 **결과 없음이 정상 응답**인 자리다 (계약).
 *
 * 마스킹된 값(`010-****-4411`)을 그대로 넣으면 `*` 가 숫자가 아니므로 0건이 정상이다.
 */
function buildSearch(q: string, scope: ConsultScope): Prisma.ConsultRequestWhereInput[] {
  const or: Prisma.ConsultRequestWhereInput[] = [{ name: { contains: q } }];
  const digits = q.replace(/\D/g, '');

  if (digits.length >= 2) {
    or.push(
      scope === 'all'
        ? { phoneDigits: { endsWith: digits.length > 4 ? digits.slice(-4) : digits } }
        : { phoneDigits: { contains: digits } },
    );
  }

  return or;
}
