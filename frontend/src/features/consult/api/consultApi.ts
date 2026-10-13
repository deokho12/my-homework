import {
  formatVisitAtLong,
} from '@/features/consult/consultDisplay';
import {
  cancelReasonOf,
  classifyEvent,
  nextVisitAt,
  periodRange,
  requiredInputs,
  truncateToMinute,
  type ConsultPeriod,
} from '@/features/consult/lib/transition';
import {
  CONSULT_PHONE_PATTERN,
  INVALID_PHONE_MESSAGE,
} from '@/features/consult/schemas/consultRequestSchema';
import { ApiError } from '@/lib/apiClient';
import {
  nextLocalId,
  pageLocalRows,
  readCollection,
  writeCollection,
  type StoredConsultRequest,
  type StoredConsultStatusChange,
} from '@/lib/localCollection';
import { useAuthStore } from '@/store/useAuthStore';
import {
  CONSULT_STATUSES,
  CONSULT_STATUS_LABEL,
  isConsultCancelReason,
  type AppNotification,
  type ConsultCancelReason,
  type ConsultEvent,
  type ConsultPreferredTime,
  type ConsultRequest,
  type ConsultStatus,
  type ConsultThirdPartyConsent,
  type Paged,
  type ProcedureId,
} from '@/types/domain';
import { maskPersonName, maskPhoneMiddle } from '@/utils/pii';

/**
 * 상담 신청·조회·상태 변경.
 *
 * **지금은 `lib/localCollection.ts`(localStorage)를 읽고 쓴다. 백엔드가 생기면 각 함수의
 * 본문만 `apiRequest('<경로>')` 로 갈아끼우면 되고, 시그니처와 화면 코드는 바뀌지 않는다.**
 *
 * | 함수 | 대응 엔드포인트 |
 * |---|---|
 * | `createConsultRequest` | `POST /consult-requests` |
 * | `fetchConsultRequests` | `GET /consult-requests` |
 * | `fetchConsultRequestById` | `GET /consult-requests/{consultRequestId}` |
 * | `updateConsultStatus` | `PATCH /consult-requests/{consultRequestId}/status` |
 * | `addConsultMemo` | `POST /consult-requests/{consultRequestId}/memos` |
 * | `fetchMyConsultRequests` | `GET /me/consult-requests` |
 *
 * 에러는 서버가 쓸 코드·문구를 그대로 던진다 (`CONSULT_REQUEST_NOT_FOUND`,
 * `PERIOD_FILTER_CONFLICT`, `VALIDATION_FAILED` + `details[]`). 화면은
 * `isApiError(error) && error.code === '...'` 로 분기하므로 서버 전환 뒤에도 그대로 동작한다.
 *
 * **판정 규칙은 여기 없다.** 필수 입력·결과 일시·이벤트 종류·기간 경계·파생 취소 사유는
 * 순수 모듈(`features/consult/lib/transition.ts`)에 있고, 화면의 상태 폼도 같은 함수를 부른다 —
 * 폼이 "저장할 수 있다" 고 판정한 요청을 api 가 `422` 로 막으면 안 된다.
 *
 * **로컬 구현이 계약과 다른 점:**
 * - **인가가 진짜가 아니다.** 역할·담당 병원은 토큰이 아니라 스토어의 현재 사용자에서 온다
 *   (`currentUser()`). 스코프 판정 자체는 계약대로 흉내 낸다 — `hospital_admin` 은
 *   `managedHospitalIds`, `operator` 는 전체(읽기만), 범위 밖 단건은 `404`,
 *   운영자의 상태 변경·메모는 `403`. 브라우저에서 스토어를 고치면 뚫리지만 그것은 서버가
 *   생겨야 닫히는 구멍이다 (`docs/features/known-issues.md`).
 * - **감사 로그가 없다.** 계약은 상세 열람마다 감사 행 1건(`X-Audit-Logged`)을 남기는데,
 *   로컬에는 그 테이블도 서버 시계도 없다. 전체 번호를 본 횟수가 기록되지 않는 것이 차이다.
 * - **`hospitalName` 이 응답에 없다.** 계약은 `ConsultRequest.hospitalName` 을 필수로 요구하지만
 *   병원은 **이미 서버 리소스**라 이 저장소에 이름이 없고, 여기서 채우려면 로컬 api 안에서
 *   병원 조회를 또 해야 한다. 그래서 화면이 병원 id 로 이름을 따로 묻는다
 *   (`features/hospital/useHospitalName` — 마이페이지 상담 내역과 같은 훅, 병원 id 로 캐시 공유).
 *   서버가 이름을 함께 내려주면 그 훅 호출이 사라진다 (`docs/features/known-issues.md`).
 * - **`doctorId` 를 입력으로 받지만 저장하지 않는다** (`ConsultRequest` 에 자리가 없다).
 * - **알림에 수신자가 없다.** 상태 변경 알림은 `audience: 'user'` 로만 저장되고 로컬 알림함은
 *   계정을 가르지 않아 관리자 자신의 알림함에도 보인다 (계약도 현재 결함으로 적어 둔 것이다).
 * - 페이지네이션·정렬은 로컬 배열에서 흉내 낸다 (`pageLocalRows`).
 */

/** `ConsultRequestCreateRequest`. `userId` 는 서버가 토큰에서 채우므로 본문에 없다. */
export interface ConsultRequestCreateInput {
  hospitalId: string;
  /**
   * `전문의 상담신청` 으로 들어온 경우 그 전문의 id.
   *
   * ⚠ **로컬 구현은 이 값을 저장하지 않는다** (`ConsultRequest` 에 자리가 없다).
   */
  doctorId?: string | null;
  procedureId: ProcedureId | null;
  name: string;
  /** 하이픈은 있어도 없어도 된다. 저장 전에 `010-1234-5678` 형태로 정규화된다. */
  phone: string;
  preferredTime: ConsultPreferredTime;
  message: string;
  /**
   * `[필수] 개인정보 제3자 제공 동의` (`ConsultThirdPartyConsentInput`).
   * 동의 시각은 보내지 않는다 — 서버(여기서는 이 함수)가 자기 시계로 찍는다.
   */
  thirdPartyConsent: { agreed: boolean; noticeVersion: string };
}

/** 처리 이력 한 줄의 **관리자 투영** (`ConsultStatusChange`). 모든 키가 항상 있다. */
export interface ConsultStatusChangeView {
  event: ConsultEvent;
  status: ConsultStatus;
  changedAt: string;
  changedByName: string | null;
  /** 이 이벤트 **직후**의 확정 일시 스냅샷. 현재 값이 아니다. */
  visitAt: string | null;
  cancelReason: ConsultCancelReason | null;
  notified: boolean;
}

/**
 * 관리자 시야(`ConsultRequest`). 목록과 상세가 **같은 스키마**이고 `name`·`phone` 의 값과
 * `piiMasked` 만 갈린다 — 마스킹은 값 변환이지 구조 변화가 아니다.
 */
export interface AdminConsultRequest
  extends Omit<ConsultRequest, 'statusHistory' | 'visitAt' | 'thirdPartyConsent'> {
  /**
   * **이 응답에 마스킹된 개인정보 필드가 있는가.** `false` 는 담당 `hospital_admin` 의 상세
   * 응답 하나뿐이다 — 목록은 두 역할 모두 `true` 다. 화면은 역할로 다시 계산하지 않는다.
   */
  piiMasked: boolean;
  visitAt: string | null;
  /** 현재 상태가 `cancelled` 일 때 **가장 최근 취소 이벤트**의 사유. 저장된 컬럼이 아니다. */
  cancelReason: ConsultCancelReason | null;
  statusHistory: ConsultStatusChangeView[];
  thirdPartyConsent: ConsultThirdPartyConsent | null;
}

/** 신청자 이력 한 줄. 관리자 이력과 달리 `event`·`changedByName`·`cancelReason`·`notified` 가 없다. */
export interface MyConsultStatusChange {
  status: ConsultStatus;
  changedAt: string;
  visitAt: string | null;
}

/**
 * 신청자 시야 투영(openapi `MyConsultRequest`). 관리자용 `ConsultRequest` 와 달리
 * 내부 메모(`memos`)·취소 사유·알림 여부를 담지 않는다 — 구조가 달라 별도 타입이다.
 */
export interface MyConsultRequest
  extends Omit<ConsultRequest, 'memos' | 'statusHistory' | 'visitAt' | 'thirdPartyConsent'> {
  /**
   * 계약에서는 필수 문자열이지만 **로컬 구현은 항상 `null` 이다.** 병원은 이미 서버
   * 리소스라 로컬 저장소에 이름이 없다. 서버 전환과 함께 값이 채워진다.
   */
  hospitalName: string | null;
  visitAt: string | null;
  /** `status_change` 행만 담는다 — 일시 변경 행은 신청자에게 `예약확정` 중복으로 보인다. */
  statusHistory: MyConsultStatusChange[];
  /** 계약과 같이 **키는 항상 있고 값만 `null` 일 수 있다** (`null` = 동의 절차 도입 이전 접수). */
  thirdPartyConsent: ConsultThirdPartyConsent | null;
}

/** `managed` = 담당 병원만, `all` = 전체 (`operator`). */
export type ConsultScope = 'managed' | 'all';

/** 상태 탭 건수. 모집단은 **지금 걸린 필터에서 `status` 만 뺀 범위**다. */
export type ConsultStatusCounts = Record<ConsultStatus, number> & { total: number };

export interface ConsultRequestFilters {
  page?: number;
  pageSize?: number;
  /**
   * 상태 필터. **반복 파라미터다** — 여러 개를 주면 그것끼리 OR 다
   * (`?status=new&status=contacted`, `procedureId` 와 같은 모양).
   *
   * 대시보드 카드 ②(`처리 대기 = 신규 + 연락중`)와 ④(`예약확정 + 내원완료`)를 목록에서
   * **재현할 유일한 방법**이라 넓혔다 (2026-10-13, additive). `statusCounts` 는 영향을 받지
   * 않는다 — 여전히 **상태만 푼 같은 모집단**에서 전 상태를 센다.
   */
  status?: ConsultStatus | ConsultStatus[];
  hospitalId?: string;
  period?: ConsultPeriod;
  createdFrom?: string;
  createdTo?: string;
  /** 반복 파라미터. 같은 것끼리는 OR, 다른 필터와는 AND. 9개 대분류는 화면이 풀어서 보낸다. */
  procedureId?: ProcedureId[];
  /** 이름 부분일치 **또는** 연락처 숫자. 운영자의 숫자 검색은 뒤 4자리 접미 일치뿐이다. */
  q?: string;
}

/** `GET /consult-requests` 응답. 목록과 탭 숫자가 **같은 질의**에서 나온다. */
export interface ConsultRequestList extends Paged<AdminConsultRequest> {
  scope: ConsultScope;
  statusCounts: ConsultStatusCounts;
}

export interface MyConsultRequestFilters {
  page?: number;
  pageSize?: number;
  status?: ConsultStatus;
}

/** `PATCH /consult-requests/{id}/status` 본문. */
export interface ConsultStatusUpdateInput {
  status: ConsultStatus;
  /** `booked` 일 때 필수 — 없으면 현재 행의 값을 쓴다. 다른 상태로 갈 때 보낸 값은 무시한다. */
  visitAt?: string | null;
  /** `cancelled` 일 때 필수. 다른 상태로 갈 때 보낸 값은 무시한다. */
  cancelReason?: ConsultCancelReason | null;
}

/* --------------------------------------------------------------- 로컬 구현 보조 */

function byCreatedAtDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function consultNotFound(): ApiError {
  return new ApiError({
    status: 404,
    code: 'CONSULT_REQUEST_NOT_FOUND',
    message: '상담 정보를 찾을 수 없어요',
  });
}

function unauthenticated(): ApiError {
  return new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: '로그인이 필요해요' });
}

function forbidden(): ApiError {
  return new ApiError({ status: 403, code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없어요' });
}

function validationFailed(field: string, code: string, message: string): ApiError {
  return new ApiError({
    status: 422,
    code: 'VALIDATION_FAILED',
    message: '입력값을 확인해주세요',
    details: [{ field, code, message }],
  });
}

// 서버 전환 시 삭제: 역할·담당 병원·"내 것" 판정은 서버가 토큰 주체로 한다
//
// 로컬 저장소는 한 브라우저를 여러 계정이 함께 쓴다. 토큰을 읽을 서버가 없으니 그 자리에
// 스토어의 현재 사용자를 끼운다 — **이 파일에서만 쓴다.**
function currentUser() {
  return useAuthStore.getState().user;
}

function currentUserId(): string | null {
  return currentUser()?.id ?? null;
}

/**
 * 관리자 스코프. 역할에 따라 **보이는 모집단과 `scope` 가 함께** 정해진다
 * (`GET /hospital-inquiries` 와 같은 모양).
 */
function adminScopedRows(hospitalId?: string): { rows: StoredConsultRequest[]; scope: ConsultScope } {
  const user = currentUser();

  if (!user) throw unauthenticated();
  if (user.role !== 'hospital_admin' && user.role !== 'operator') throw forbidden();

  const all = readCollection('consultRequests');

  if (user.role === 'operator') {
    return { rows: hospitalId ? all.filter((row) => row.hospitalId === hospitalId) : all, scope: 'all' };
  }

  // 담당 병원 밖을 물으면 `403 HOSPITAL_NOT_MANAGED` 다 — **병원 존재는 공개 정보라 숨기지 않는다.**
  // 상담 단건(`/{id}`)이 `404` 인 것과 이유가 다르다 (상담 id 는 고객 개인정보와 1:1 이다).
  if (hospitalId !== undefined && !user.managedHospitalIds.includes(hospitalId)) {
    throw new ApiError({ status: 403, code: 'HOSPITAL_NOT_MANAGED', message: '담당하지 않는 병원이에요' });
  }

  const managed = all.filter((row) =>
    hospitalId === undefined ? user.managedHospitalIds.includes(row.hospitalId) : row.hospitalId === hospitalId
  );

  return { rows: managed, scope: 'managed' };
}

/** 상태를 바꾸거나 메모를 쓸 수 있는 주체 — **담당 병원 관리자뿐이다** (운영자는 `403`). */
function writableRow(id: string): { rows: StoredConsultRequest[]; target: StoredConsultRequest } {
  const user = currentUser();

  if (!user) throw unauthenticated();
  // 운영자가 상태를 바꾸면 고객에게 `예약확정` 알림이 가는데 실제로 예약한 병원은 모르는 상태가 된다.
  if (user.role !== 'hospital_admin') throw forbidden();

  const rows = readCollection('consultRequests');
  const target = rows.find((row) => row.id === id && user.managedHospitalIds.includes(row.hospitalId));

  if (!target) throw consultNotFound();

  return { rows, target };
}

/* --------------------------------------------------------------- 투영 */

/** 저장 행 → 계약의 이력 한 줄. **계약 확장 이전 행의 빈 자리를 여기서 채운다.** */
function toStatusChangeView(stored: StoredConsultStatusChange): ConsultStatusChangeView {
  return {
    event: stored.event ?? 'status_change',
    status: stored.status,
    changedAt: stored.changedAt,
    changedByName: stored.changedByName ?? null,
    visitAt: stored.visitAt ?? null,
    cancelReason: stored.cancelReason ?? null,
    // 저장 쪽은 알림 행을 가리키는 id 를 들고 있고, 투영에는 boolean 만 내려간다.
    notified: stored.notified ?? Boolean(stored.notificationId),
  };
}

interface Projection {
  /** 이름까지 가리는가 (`operator`). */
  maskName: boolean;
  /** 번호를 가리는가. 목록은 역할과 무관하게 `true` 다. */
  maskPhone: boolean;
}

/**
 * 저장 구조 → 계약의 `ConsultRequest`.
 *
 * 로컬 전용 필드(`ownerUserId`)를 떼고, 계약에서 필수 + nullable 인 자리의 **키를 항상 채운다**
 * (`visitAt`·`cancelReason`·`thirdPartyConsent`). 키가 없는 것과 `null` 인 것이 섞이면
 * "기록이 없다" 와 "아직 안 내려준다" 를 구분할 수 없다.
 */
function toAdminConsultRequest(stored: StoredConsultRequest, projection: Projection): AdminConsultRequest {
  const { ownerUserId: _ownerUserId, statusHistory, ...rest } = stored;

  return {
    ...rest,
    name: projection.maskName ? maskPersonName(stored.name) : stored.name,
    phone: projection.maskPhone ? maskPhoneMiddle(stored.phone) : stored.phone,
    piiMasked: projection.maskName || projection.maskPhone,
    visitAt: stored.visitAt ?? null,
    cancelReason: cancelReasonOf(stored.status, statusHistory),
    statusHistory: statusHistory.map(toStatusChangeView),
    thirdPartyConsent: stored.thirdPartyConsent ?? null,
  };
}

/** 관리자용 저장 구조에서 신청자 시야만 떼어낸다. */
function toMyConsultRequest(stored: StoredConsultRequest): MyConsultRequest {
  const { ownerUserId: _ownerUserId, memos: _memos, statusHistory, ...rest } = stored;

  return {
    ...rest,
    visitAt: stored.visitAt ?? null,
    statusHistory: statusHistory
      .filter((change) => (change.event ?? 'status_change') === 'status_change')
      .map((change) => ({ status: change.status, changedAt: change.changedAt, visitAt: change.visitAt ?? null })),
    thirdPartyConsent: stored.thirdPartyConsent ?? null,
    hospitalName: null,
  };
}

/** 표기 차이로 목록 검색·중복 대조가 어긋나지 않게 `010-1234-5678` 한 형태로 모은다. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  const middle = digits.slice(3, -4);

  return `${head}-${middle}-${tail}`;
}

// 서버 전환 시 삭제: 알림 생성은 서버 몫
//
// 상담 접수(`POST /consult-requests`)와 상태 변경(`PATCH .../status`)의 **부수효과로**
// 서버가 알림을 만든다 — 알림을 만드는 공개 엔드포인트는 계약에 아예 없다.
function createLocalNotification(input: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): string {
  const notification: AppNotification = {
    ...input,
    id: nextLocalId('notif'),
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  writeCollection('notifications', [notification, ...readCollection('notifications')]);

  return notification.id;
}

/* --------------------------------------------------------------- 목록 필터 */

/** 이 상담이 지금 걸린 (상태를 뺀) 필터에 걸리는가. 목록과 탭 숫자가 **같은 판정**을 쓴다. */
function matchesFilters(
  row: StoredConsultRequest,
  filters: ConsultRequestFilters,
  scope: ConsultScope,
  now: Date
): boolean {
  const createdAt = new Date(row.createdAt).getTime();

  if (filters.period) {
    const [from, to] = periodRange(filters.period, now);
    // 반열린 구간 `[from, to)`.
    if (createdAt < from.getTime() || createdAt >= to.getTime()) return false;
  }

  if (filters.createdFrom && createdAt < new Date(filters.createdFrom).getTime()) return false;
  if (filters.createdTo && createdAt > new Date(filters.createdTo).getTime()) return false;

  if (filters.procedureId && filters.procedureId.length > 0) {
    if (row.procedureId === null || !filters.procedureId.includes(row.procedureId)) return false;
  }

  const q = filters.q?.trim() ?? '';

  if (q.length > 0 && !matchesQuery(row, q, scope)) return false;

  return true;
}

/**
 * 검색 — 이름 부분일치 **OR** 번호 숫자. 숫자가 2자 이상일 때만 번호 검색을 함께 건다.
 *
 * **운영자는 뒤 4자리 접미 일치뿐이다.** 전체 번호 부분일치를 허용하면 "이 번호의 상담이
 * 존재하는가" 를 묻는 오라클이 되어 마스킹이 우회된다. 5자리 이상을 넣어도 에러가 아니라
 * 뒤 4자리만 잘라 비교한다 — 검색은 **결과 없음이 정상 응답**인 자리다.
 */
function matchesQuery(row: StoredConsultRequest, q: string, scope: ConsultScope): boolean {
  if (row.name.includes(q)) return true;

  const digits = q.replace(/\D/g, '');
  if (digits.length < 2) return false;

  const phoneDigits = row.phone.replace(/\D/g, '');

  if (scope === 'all') return phoneDigits.endsWith(digits.length > 4 ? digits.slice(-4) : digits);

  return phoneDigits.includes(digits);
}

function countByStatus(rows: StoredConsultRequest[]): ConsultStatusCounts {
  const counts = Object.fromEntries(
    CONSULT_STATUSES.map((status) => [status, rows.filter((row) => row.status === status).length])
  ) as Record<ConsultStatus, number>;

  // `total` 을 따로 내려주는 이유: 화면이 다섯 수를 더하는 순간 그 덧셈이 또 하나의 판정 지점이 된다.
  return { ...counts, total: rows.length };
}

/* --------------------------------------------------------------------- 오퍼레이션 */

/**
 * `POST /consult-requests`. 응답은 신청자 시야(`MyConsultRequest`)다 — 접수 화면은
 * 결과를 화면에 쓰지 않지만, 계약이 정한 형태를 그대로 반환해 둔다.
 */
export async function createConsultRequest(input: ConsultRequestCreateInput): Promise<MyConsultRequest> {
  // 동의가 먼저다 — 동의 없는 접수는 **저장 자체가 성립하지 않는다**.
  if (!input.thirdPartyConsent?.agreed) {
    throw new ApiError({
      status: 422,
      code: 'THIRD_PARTY_CONSENT_REQUIRED',
      message: '개인정보 제3자 제공에 동의해야 상담을 신청할 수 있어요',
    });
  }

  const phone = input.phone.trim();

  if (!CONSULT_PHONE_PATTERN.test(phone)) {
    throw validationFailed('phone', 'INVALID_PHONE_FORMAT', INVALID_PHONE_MESSAGE);
  }

  const now = new Date().toISOString();
  const request: StoredConsultRequest = {
    id: nextLocalId('consult'),
    hospitalId: input.hospitalId,
    procedureId: input.procedureId,
    name: input.name,
    phone: normalizePhone(phone),
    preferredTime: input.preferredTime,
    message: input.message,
    createdAt: now,
    status: 'new',
    visitAt: null,
    // 접수 행에는 행위자도 알림도 없다 — 환자가 스스로 한 일이다.
    statusHistory: [{ event: 'status_change', status: 'new', changedAt: now }],
    // `agreedAt` 은 **받는 쪽 시계**다 (계약: 기기 시계는 증빙이 되지 않는다).
    thirdPartyConsent: { agreedAt: now, noticeVersion: input.thirdPartyConsent.noticeVersion },
    memos: [],
    // 서버 전환 시 삭제: 신청자는 서버가 토큰에서 알아낸다
    ownerUserId: currentUserId() ?? undefined,
  };

  writeCollection('consultRequests', [request, ...readCollection('consultRequests')]);

  // 서버 전환 시 삭제: 알림 생성은 서버 몫
  createLocalNotification({
    audience: 'admin',
    type: 'consult-status',
    title: '새로운 상담 신청',
    message: `${request.name}님이 상담을 신청했어요`,
    relatedId: request.id,
  });

  return toMyConsultRequest(request);
}

/**
 * `GET /consult-requests`. 관리자 상담 목록. 신청일시 최신순.
 *
 * **목록은 두 역할 모두 번호를 가린다** — 목록은 건별 열람 기록을 남기지 않는 자원이라
 * 전체 번호가 실리면 무기록 대량 반출이 성립한다. 전체 번호는 상세 한 곳에만 있다.
 *
 * `statusCounts` 는 **상태만 푼 같은 모집단**에서 센다. 별도 조회로 두면 두 숫자가 서로 다른
 * 시점을 가리켜 목록과 탭이 어긋난다.
 *
 * `status` 가 여러 개면 그것끼리 OR 다 — 그때는 계약의 등식
 * (`status 필터를 건 요청의 meta.totalItems === statusCounts[그 상태]`)이 **값이 하나일 때로
 * 좁혀진다.** `statusCounts` 는 변함없이 전 상태를 내려준다.
 */
export async function fetchConsultRequests(filters: ConsultRequestFilters = {}): Promise<ConsultRequestList> {
  if (filters.period && (filters.createdFrom || filters.createdTo)) {
    throw new ApiError({
      status: 422,
      code: 'PERIOD_FILTER_CONFLICT',
      message: '기간 조건은 한 가지 방식으로만 보낼 수 있어요',
    });
  }

  const { rows, scope } = adminScopedRows(filters.hospitalId);
  const now = new Date();
  const matched = rows.filter((row) => matchesFilters(row, filters, scope, now));
  // 같은 파라미터끼리는 OR 다. 값이 하나뿐인 기존 요청은 그대로 동작한다.
  const statuses = filters.status === undefined ? null : [filters.status].flat();
  const items = matched
    .filter((row) => (statuses ? statuses.includes(row.status) : true))
    .sort(byCreatedAtDesc)
    .map((row) => toAdminConsultRequest(row, { maskName: scope === 'all', maskPhone: true }));

  return {
    ...pageLocalRows(items, filters.page, filters.pageSize),
    scope,
    statusCounts: countByStatus(matched),
  };
}

/**
 * `GET /consult-requests/{consultRequestId}`.
 *
 * **전체 번호가 있는 유일한 자리다** (담당 `hospital_admin` 에게만). 없는 상담과 담당 병원
 * 밖의 상담을 구분하지 않고 `404 CONSULT_REQUEST_NOT_FOUND` 를 던진다 — `403` 을 주면
 * id 를 대입해 "이 상담이 존재한다" 를 알아내는 열거 경로가 된다.
 */
export async function fetchConsultRequestById(id: string): Promise<AdminConsultRequest> {
  const { rows, scope } = adminScopedRows();
  const found = rows.find((row) => row.id === id);

  if (!found) throw consultNotFound();

  const maskAll = scope === 'all';

  return toAdminConsultRequest(found, { maskName: maskAll, maskPhone: maskAll });
}

/**
 * `GET /me/consult-requests`. 최신순.
 *
 * **지금 로그인한 계정이 접수한 건만 돌려준다.** 주인이 적혀 있지 않은 행(시드·예전 브라우저
 * 데이터)은 **누구의 것도 아니다**. 비로그인이면 빈 목록이다 (서버라면 `401` 인 자리).
 */
export async function fetchMyConsultRequests(
  filters: MyConsultRequestFilters = {}
): Promise<Paged<MyConsultRequest>> {
  const userId = currentUserId();
  const rows = (userId === null ? [] : [...readCollection('consultRequests')])
    .filter((request) => request.ownerUserId === userId)
    .sort(byCreatedAtDesc)
    .filter((request) => (filters.status ? request.status === filters.status : true))
    .map(toMyConsultRequest);

  return pageLocalRows(rows, filters.page, filters.pageSize);
}

/**
 * `PATCH /consult-requests/{consultRequestId}/status` — 상태 변경과 **예약 일시 변경**.
 *
 * 순서가 규칙이다: **필수 입력 검사 → no-op 판정 → 부수효과.** `예약확정` 건에 일시 없이
 * `예약확정` 을 다시 보내는 것은 "바꿀 것이 없는 요청" 이 아니라 **값을 빠뜨린 요청**이다.
 *
 * 세 값(`status`, `visitAt`, `cancelReason`)이 모두 그대로면 이력도 알림도 만들지 않는다 —
 * 오탭으로 중복 알림이 나가는 것을 막는 계약이고, 요청 후의 상태가 요청자가 원한 상태와
 * 같으므로 오류로 다루지 않는다.
 */
export async function updateConsultStatus(
  id: string,
  input: ConsultStatusUpdateInput
): Promise<AdminConsultRequest> {
  const { rows, target } = writableRow(id);
  const actorName = currentUser()?.name ?? null;

  const required = requiredInputs(input.status);
  const resolvedVisitAt = nextVisitAt(input.status, target.visitAt ?? null, input.visitAt);

  if (required.includes('visitAt') && resolvedVisitAt === null) {
    throw validationFailed('visitAt', 'VISIT_AT_REQUIRED', '확정 일시를 입력해주세요');
  }

  // 계약: 없으면 `CANCEL_REASON_REQUIRED`, 목록에 없는 코드면 형식 오류(`VALIDATION_FAILED`). 화면은 select 라
  // 뒤의 경우에 닿지 않지만, 두 오류를 한 코드로 뭉개면 다른 클라이언트가 "고르지 않았다" 로 잘못 안내한다.
  if (required.includes('cancelReason') && (input.cancelReason === undefined || input.cancelReason === null)) {
    throw validationFailed('cancelReason', 'CANCEL_REASON_REQUIRED', '취소 사유를 선택해주세요');
  }
  if (required.includes('cancelReason') && !isConsultCancelReason(input.cancelReason)) {
    throw validationFailed('cancelReason', 'INVALID_CANCEL_REASON', '취소 사유를 다시 선택해주세요');
  }

  // 사유는 취소 이벤트 행에만 저장된다 — 다른 상태로 갈 때 보낸 값은 무시한다.
  const cancelReason = input.status === 'cancelled' ? (input.cancelReason ?? null) : null;
  const current = {
    status: target.status,
    visitAt: truncateToMinute(target.visitAt ?? null),
    cancelReason: cancelReasonOf(target.status, target.statusHistory),
  };
  const event = classifyEvent(current, { status: input.status, visitAt: resolvedVisitAt, cancelReason });
  const detail: Projection = { maskName: false, maskPhone: false };

  if (event === 'noop') return toAdminConsultRequest(target, detail);

  const changedAt = new Date().toISOString();
  const visitLabel = formatVisitAtLong(resolvedVisitAt);

  // 서버 전환 시 삭제: 알림 생성은 서버 몫 (상태 변경 트랜잭션의 부수효과다)
  const notificationId = createLocalNotification({
    audience: 'user',
    type: 'consult-status',
    ...(event === 'reschedule'
      ? { title: '예약 일시 변경', message: `예약 일시가 '${visitLabel}'(으)로 변경되었어요` }
      : {
          title: '상담 상태 변경',
          message: `상담 상태가 '${CONSULT_STATUS_LABEL[input.status]}'(으)로 변경되었어요`,
        }),
    relatedId: id,
  });

  const updated: StoredConsultRequest = {
    ...target,
    status: input.status,
    visitAt: resolvedVisitAt,
    statusHistory: [
      ...target.statusHistory,
      {
        event,
        // `reschedule` 행의 상태는 그 시점의 상태(`booked`)다 — 행이 스스로를 설명한다.
        status: input.status,
        changedAt,
        changedByName: actorName,
        visitAt: resolvedVisitAt,
        cancelReason,
        notificationId,
      },
    ],
  };

  writeCollection(
    'consultRequests',
    rows.map((row) => (row.id === id ? updated : row))
  );

  return toAdminConsultRequest(updated, detail);
}

/** `POST /consult-requests/{consultRequestId}/memos`. 메모는 신청자에게 내려가지 않는다. */
export async function addConsultMemo(id: string, content: string): Promise<AdminConsultRequest> {
  const { rows, target } = writableRow(id);

  const updated: StoredConsultRequest = {
    ...target,
    memos: [...target.memos, { id: nextLocalId('memo'), content, createdAt: new Date().toISOString() }],
  };

  writeCollection(
    'consultRequests',
    rows.map((row) => (row.id === id ? updated : row))
  );

  return toAdminConsultRequest(updated, { maskName: false, maskPhone: false });
}
