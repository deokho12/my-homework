import { ApiError } from '@/lib/apiClient';
import { nextLocalId, pageLocalRows, readCollection, writeCollection } from '@/lib/localCollection';
import {
  CONSULT_STATUS_LABEL,
  type AppNotification,
  type ConsultRequest,
  type ConsultStatus,
  type Paged,
  type ProcedureId,
} from '@/types/domain';

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
 * | `fetchConsultSummary` | `GET /consult-requests/summary` |
 * | `fetchConsultRequestById` | `GET /consult-requests/{consultRequestId}` |
 * | `updateConsultStatus` | `PATCH /consult-requests/{consultRequestId}/status` |
 * | `addConsultMemo` | `POST /consult-requests/{consultRequestId}/memos` |
 * | `fetchMyConsultRequests` | `GET /me/consult-requests` |
 *
 * 에러는 서버가 쓸 코드·문구를 그대로 던진다 (`CONSULT_REQUEST_NOT_FOUND`). 화면은
 * `isApiError(error) && error.code === '...'` 로 분기하므로 서버 전환 뒤에도 그대로 동작한다.
 *
 * **로컬 구현이 계약과 다른 점:**
 * - 인가·스코프가 없다. `hospital_admin` 담당 병원 필터도, `operator` 개인정보 마스킹도 없다.
 * - `userId` 가 없어 `fetchMyConsultRequests` 가 전체를 돌려준다.
 * - `phone` 형식·`procedureId` 취급 여부 검사가 없다 (서버가 `422` 로 막을 몫).
 * - **`doctorId` 를 입력으로 받지만 저장하지 않는다.** `ConsultRequestCreateInput` 에는 자리가
 *   있으나 도메인 타입 `ConsultRequest` 에 필드가 없어, 화면이 값을 채워 보내도 `createConsultRequest`
 *   가 조용히 버린다. 계약(`POST /consult-requests` 의 `doctorId`)은 이 필드를 "전문의 지정 상담이
 *   전달되지 않는다" 결함의 해결책으로 지목하고 있으므로, **서버가 생기기 전에 이 값을 보내도
 *   결함은 그대로다** (`docs/features/known-issues.md` 🟠 "'전문의 상담신청'인데 어느 전문의인지
 *   저장되지 않습니다"). 해결하려면 `ConsultRequest` 에 `doctorId` 를 먼저 추가해야 한다.
 * - **관리자 목록 응답에 계약의 필수 필드 `scope`·`hospitalName`·`piiMasked` 가 없다.**
 *   - `scope` 는 인가가 없어 정할 근거가 없다 (담당 병원만 vs 전체를 가르는 값이다).
 *   - `hospitalName` 대신 화면이 행마다 `useHospital(request.hospitalId)` 로 따로 조회한다
 *     (`screens/admin/consultations/index.tsx`) — **목록 길이만큼 병원 조회가 나간다.** 서버가
 *     이름을 함께 내려주면 그 조회는 사라진다.
 *   - `piiMasked` 가 없어 "연락처는 담당 병원에서만 확인할 수 있어요" 안내나 전화 걸기·복사 잠금
 *     UI 도 없다. 마스킹 자체가 서버 몫이라 로컬에서는 판정할 값이 없다.
 */

/** `ConsultRequestCreateRequest`. `userId` 는 서버가 토큰에서 채우므로 본문에 없다. */
export interface ConsultRequestCreateInput {
  hospitalId: string;
  /**
   * `전문의 상담신청` 으로 들어온 경우 그 전문의 id.
   *
   * ⚠ **로컬 구현은 이 값을 저장하지 않는다** (`ConsultRequest` 에 자리가 없다). 위 "계약과
   * 다른 점" 참고 — 여기에 값을 채워 보내도 지금은 조용히 사라진다.
   */
  doctorId?: string | null;
  procedureId: ProcedureId | null;
  name: string;
  phone: string;
  preferredTime: string;
  message: string;
}

/**
 * 신청자 시야 투영(openapi `MyConsultRequest`). 관리자용 `ConsultRequest` 와 달리
 * 내부 메모(`memos`)를 담지 않는다 — 구조가 다르기 때문에 별도 타입이다.
 */
export interface MyConsultRequest extends Omit<ConsultRequest, 'memos'> {
  /**
   * 계약에서는 필수 문자열이지만 **로컬 구현은 항상 `null` 이다.** 병원은 이미 서버
   * 리소스라 로컬 저장소에 이름이 없다. 서버 전환과 함께 값이 채워진다.
   */
  hospitalName: string | null;
}

export interface ConsultRequestFilters {
  page?: number;
  pageSize?: number;
  status?: ConsultStatus;
}

/** `GET /consult-requests/summary`. 관리자 홈의 숫자 카드 2개. */
export interface ConsultSummary {
  newThisMonth: number;
  pending: number;
  /** 달 경계 계산에 쓴 시간대. 화면이 기준을 표시할 수 있게 명시한다. */
  timezone: string;
  calculatedAt: string;
}

/* --------------------------------------------------------------- 로컬 구현 보조 */

const SEOUL_TIMEZONE = 'Asia/Seoul';

const seoulMonthFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
});

/**
 * `2026-07` 형태의 달 키. **기기 시계의 달이 아니라 `Asia/Seoul` 달력 기준이다** —
 * 계약이 요구하는 기준이고, 자정 전후·해외 접속에서 `이번 달 신규 상담` 이 달라지지 않게 한다.
 */
function seoulMonthKey(date: Date): string {
  const parts = seoulMonthFormat.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';

  return `${year}-${month}`;
}

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

/** 관리자용 저장 구조에서 신청자 시야만 떼어낸다. */
function toMyConsultRequest(request: ConsultRequest): MyConsultRequest {
  const { memos: _memos, ...rest } = request;

  return { ...rest, hospitalName: null };
}

// 서버 전환 시 삭제: 알림 생성은 서버 몫
//
// 상담 접수(`POST /consult-requests`)와 상태 변경(`PATCH .../status`)의 **부수효과로**
// 서버가 알림을 만든다 — 알림을 만드는 공개 엔드포인트는 계약에 아예 없다. 그때까지만
// 클라이언트가 대신 쓴다 (예전 `services/notifications.ts` 의 `notifyUser`/`notifyAdmin`).
function createLocalNotification(input: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): void {
  const notification: AppNotification = {
    ...input,
    id: nextLocalId('notif'),
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  writeCollection('notifications', [notification, ...readCollection('notifications')]);
}

/* --------------------------------------------------------------------- 오퍼레이션 */

/**
 * `POST /consult-requests`. 응답은 신청자 시야(`MyConsultRequest`)다 — 접수 화면은
 * 결과를 화면에 쓰지 않지만, 계약이 정한 형태를 그대로 반환해 둔다.
 */
export async function createConsultRequest(input: ConsultRequestCreateInput): Promise<MyConsultRequest> {
  const now = new Date().toISOString();
  const request: ConsultRequest = {
    id: nextLocalId('consult'),
    hospitalId: input.hospitalId,
    procedureId: input.procedureId,
    name: input.name,
    phone: input.phone,
    preferredTime: input.preferredTime,
    message: input.message,
    createdAt: now,
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: now }],
    memos: [],
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

/** `GET /consult-requests`. 관리자 상담 목록. 신청일시 최신순. */
export async function fetchConsultRequests(filters: ConsultRequestFilters = {}): Promise<Paged<ConsultRequest>> {
  const rows = [...readCollection('consultRequests')]
    .sort(byCreatedAtDesc)
    .filter((request) => (filters.status ? request.status === filters.status : true));

  return pageLocalRows(rows, filters.page, filters.pageSize);
}

/**
 * `GET /consult-requests/{consultRequestId}`.
 *
 * 없는 상담은 `null` 이 아니라 `404 CONSULT_REQUEST_NOT_FOUND`(`ApiError`)를 던진다.
 * 소비자는 `isApiError(error) && error.code === 'CONSULT_REQUEST_NOT_FOUND'` 로 "없음"을 분기한다.
 */
export async function fetchConsultRequestById(id: string): Promise<ConsultRequest> {
  const found = readCollection('consultRequests').find((request) => request.id === id);

  if (!found) throw consultNotFound();

  return found;
}

/** `GET /consult-requests/summary`. 개인정보를 담지 않는 숫자 두 개뿐이다. */
export async function fetchConsultSummary(): Promise<ConsultSummary> {
  const now = new Date();
  const thisMonth = seoulMonthKey(now);
  const rows = readCollection('consultRequests');

  return {
    newThisMonth: rows.filter((request) => seoulMonthKey(new Date(request.createdAt)) === thisMonth).length,
    pending: rows.filter((request) => request.status === 'new').length,
    timezone: SEOUL_TIMEZONE,
    calculatedAt: now.toISOString(),
  };
}

/**
 * `GET /me/consult-requests`. 최신순.
 *
 * **로컬 구현은 전체를 돌려준다** — 로컬 상담에는 `userId` 가 없어 "내 것"을 가려낼 근거가
 * 없다. 서버가 토큰 주체로 스코프하는 것이 이 엔드포인트가 생기는 이유다.
 */
export async function fetchMyConsultRequests(filters: ConsultRequestFilters = {}): Promise<Paged<MyConsultRequest>> {
  const rows = [...readCollection('consultRequests')]
    .sort(byCreatedAtDesc)
    .filter((request) => (filters.status ? request.status === filters.status : true))
    .map(toMyConsultRequest);

  return pageLocalRows(rows, filters.page, filters.pageSize);
}

/**
 * `PATCH /consult-requests/{consultRequestId}/status`.
 *
 * **같은 상태로 다시 요청하면 아무 부수효과 없이 현재 리소스를 그대로 돌려준다 (no-op).**
 * 목록의 빠른 상태 버튼은 오탭이 잦은데, 그때마다 이력이 중복으로 쌓이고 신청자에게
 * 중복 알림이 가는 것을 막기 위한 계약이다.
 */
export async function updateConsultStatus(id: string, status: ConsultStatus): Promise<ConsultRequest> {
  const rows = readCollection('consultRequests');
  const target = rows.find((request) => request.id === id);

  if (!target) throw consultNotFound();
  if (target.status === status) return target;

  const changedAt = new Date().toISOString();
  const updated: ConsultRequest = {
    ...target,
    status,
    statusHistory: [...target.statusHistory, { status, changedAt }],
  };

  writeCollection(
    'consultRequests',
    rows.map((request) => (request.id === id ? updated : request))
  );

  // 서버 전환 시 삭제: 알림 생성은 서버 몫
  createLocalNotification({
    audience: 'user',
    type: 'consult-status',
    title: '상담 상태 변경',
    message: `상담 상태가 '${CONSULT_STATUS_LABEL[status]}'(으)로 변경되었어요`,
    relatedId: id,
  });

  return updated;
}

/** `POST /consult-requests/{consultRequestId}/memos`. 메모는 신청자에게 내려가지 않는다. */
export async function addConsultMemo(id: string, content: string): Promise<ConsultRequest> {
  const rows = readCollection('consultRequests');
  const target = rows.find((request) => request.id === id);

  if (!target) throw consultNotFound();

  const updated: ConsultRequest = {
    ...target,
    memos: [...target.memos, { id: nextLocalId('memo'), content, createdAt: new Date().toISOString() }],
  };

  writeCollection(
    'consultRequests',
    rows.map((request) => (request.id === id ? updated : request))
  );

  return updated;
}
