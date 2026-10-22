import type { ConsultPeriod } from '@/features/consult/lib/transition';
import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import type {
  ConsultCancelReason,
  ConsultEvent,
  ConsultPreferredTime,
  ConsultRequest,
  ConsultStatus,
  ConsultThirdPartyConsent,
  Paged,
  ProcedureId,
} from '@/types/domain';

/**
 * 상담 신청·조회·상태 변경. **전부 실제 백엔드를 부른다** (2026-10-22, 요청서 15).
 *
 * | 함수 | 엔드포인트 |
 * |---|---|
 * | `createConsultRequest` | `POST /consult-requests` |
 * | `fetchConsultRequests` | `GET /consult-requests` |
 * | `fetchConsultRequestById` | `GET /consult-requests/{consultRequestId}` |
 * | `updateConsultStatus` | `PATCH /consult-requests/{consultRequestId}/status` |
 * | `addConsultMemo` | `POST /consult-requests/{consultRequestId}/memos` |
 * | `fetchMyConsultRequests` | `GET /me/consult-requests` |
 *
 * 에러는 서버가 준 코드·문구를 그대로 던진다 (`ApiError` — `CONSULT_REQUEST_NOT_FOUND`,
 * `PERIOD_FILTER_CONFLICT`, `CONSULT_CLOSED`, `VALIDATION_FAILED` + `details[]`). 화면은
 * `isApiError(error) && error.code === '...'` 로 분기한다.
 *
 * **판정 규칙은 여기 없다.** 필수 입력·결과 일시·이벤트 종류·기간 경계·파생 취소 사유는
 * 순수 모듈(`features/consult/lib/transition.ts`)에 있고 화면의 상태 폼이 그것을 쓴다 —
 * 서버의 같은 이름 모듈(`backend/src/consult/transition.ts`)과 답이 갈리지 않는 것은
 * `features/consult/consultServerRules.sync.test.ts` 가 고정한다.
 *
 * **인가·마스킹·알림은 전부 서버가 한다.** 목록과 **쓰기 응답**은 두 역할 모두 번호를 가리고,
 * 전체 번호가 있는 유일한 자리는 담당 병원 관리자의 상세이며 그 열람은 감사 로그에 남는다. 상태 변경의
 * 환자 알림은 같은 트랜잭션의 부수효과다 (`docs/api/README.md` §9).
 */

/** `ConsultRequestCreateRequest`. `userId` 는 서버가 토큰에서 채우므로 본문에 없다. */
export interface ConsultRequestCreateInput {
  hospitalId: string;
  /** `전문의 상담신청` 으로 들어온 경우 그 전문의 id. */
  doctorId?: string | null;
  procedureId: ProcedureId | null;
  name: string;
  /** 하이픈은 있어도 없어도 된다. 서버가 `010-1234-5678` 형태로 정규화해 저장한다. */
  phone: string;
  preferredTime: ConsultPreferredTime;
  message: string;
  /**
   * `[필수] 개인정보 제3자 제공 동의` (`ConsultThirdPartyConsentInput`).
   * 동의 시각은 보내지 않는다 — **받는 쪽 시계**가 증빙이다 (서버가 찍는다).
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
 *
 * 응답에는 `doctorId`·`doctorName`·`procedureName` 도 있지만 **읽는 화면이 없어 적지
 * 않는다** (계약에는 있다 — 필요해지는 날 그 이름 그대로 더하면 된다).
 */
export interface AdminConsultRequest
  extends Omit<ConsultRequest, 'statusHistory' | 'visitAt' | 'thirdPartyConsent'> {
  /** 서버가 `hospitals` 를 조인해 채운다. 병원을 찾지 못하면 `알 수 없는 병원`. */
  hospitalName: string;
  /**
   * **이 응답에 마스킹된 개인정보 필드가 있는가.** `false` 는 담당 `hospital_admin` 의 상세
   * 응답 하나뿐이다 — 목록은 두 역할 모두 `true` 이고, **쓰기 응답(상태 변경·메모 등록)도
   * 목록 투영이라 `true`** 다(계약 §4). 화면은 역할로 다시 계산하지 않는다.
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
  /** 서버가 함께 내려준다 — 내역 한 줄마다 병원을 따로 조회하지 않는다. */
  hospitalName: string;
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

/** `PATCH /consult-requests/{id}/status` 본문. **세 필드뿐이다.** */
export interface ConsultStatusUpdateInput {
  status: ConsultStatus;
  /** `booked` 일 때 필수 — 없으면 현재 행의 값을 쓴다. 다른 상태로 갈 때 보낸 값은 무시한다. */
  visitAt?: string | null;
  /** `cancelled` 일 때 필수. 다른 상태로 갈 때 보낸 값은 무시한다. */
  cancelReason?: ConsultCancelReason | null;
}

/* --------------------------------------------------------------------- 오퍼레이션 */

/**
 * `POST /consult-requests`. 응답은 신청자 시야(`MyConsultRequest`)다.
 *
 * 서버가 **동의 → 연락처 형식 → 그 밖의 조건** 순으로 검사한다 (동의 없는 접수는
 * `422 THIRD_PARTY_CONSENT_REQUIRED`, 상담을 받지 않는 병원은 `409 CONSULT_CLOSED`).
 * 접수 알림(`audience=admin`)은 같은 트랜잭션의 부수효과다.
 */
export function createConsultRequest(input: ConsultRequestCreateInput): Promise<MyConsultRequest> {
  return apiRequest<MyConsultRequest>('/consult-requests', { method: 'POST', body: input });
}

/**
 * `GET /consult-requests`. 관리자 상담 목록. 신청일시 최신순.
 *
 * `statusCounts` 는 **상태만 푼 같은 모집단**에서 센다 — 목록과 탭이 서로 다른 시점을
 * 가리키지 않도록 한 질의에서 함께 나온다.
 */
export function fetchConsultRequests(filters: ConsultRequestFilters = {}): Promise<ConsultRequestList> {
  return apiRequest<ConsultRequestList>(`/consult-requests${toSearchParams({ ...filters })}`);
}

/**
 * `GET /consult-requests/{consultRequestId}`.
 *
 * **전체 번호가 있는 유일한 자리다** (담당 `hospital_admin` 에게만, 열람마다 감사 행 1건).
 * 없는 상담과 담당 병원 밖의 상담은 구분 없이 `404 CONSULT_REQUEST_NOT_FOUND` 다 —
 * `403` 을 주면 id 를 대입해 "이 상담이 존재한다" 를 알아내는 열거 경로가 된다.
 */
export function fetchConsultRequestById(id: string): Promise<AdminConsultRequest> {
  return apiRequest<AdminConsultRequest>(`/consult-requests/${encodeURIComponent(id)}`);
}

/** `GET /me/consult-requests`. 토큰 주체가 접수한 건만, 최신순. 병원 이름이 함께 온다. */
export function fetchMyConsultRequests(
  filters: MyConsultRequestFilters = {}
): Promise<Paged<MyConsultRequest>> {
  return apiRequest<Paged<MyConsultRequest>>(`/me/consult-requests${toSearchParams({ ...filters })}`);
}

/**
 * `PATCH /consult-requests/{consultRequestId}/status` — 상태 변경과 **예약 일시 변경**.
 *
 * 서버가 **필수 입력 검사 → no-op 판정 → 부수효과** 순으로 처리한다. 세 값이 모두 그대로면
 * 이력도 알림도 만들지 않는다(no-op) — 오탭으로 중복 알림이 나가는 것을 막는 계약이다.
 * 환자 알림 문구는 서버가 만든다 (`backend/src/consult/notification-text.ts`).
 *
 * **응답은 목록 투영이다 — 번호가 가려져 온다**(계약 §4). 전체 번호를 다시 보려면 상세를
 * 열어야 하고, 그 열람은 감사 행으로 남는다. 이 응답을 읽는 화면은 `statusHistory`·`visitAt`
 * 만 쓴다.
 */
export function updateConsultStatus(
  id: string,
  input: ConsultStatusUpdateInput
): Promise<AdminConsultRequest> {
  return apiRequest<AdminConsultRequest>(`/consult-requests/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: input,
  });
}

/**
 * `POST /consult-requests/{consultRequestId}/memos`. 메모는 신청자에게 내려가지 않는다.
 * 응답은 상태 변경과 같은 **목록 투영**이다 (번호 마스킹).
 */
export function addConsultMemo(id: string, content: string): Promise<AdminConsultRequest> {
  return apiRequest<AdminConsultRequest>(`/consult-requests/${encodeURIComponent(id)}/memos`, {
    method: 'POST',
    body: { content },
  });
}
