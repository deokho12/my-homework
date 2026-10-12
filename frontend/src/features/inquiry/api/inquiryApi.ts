import {
  ANSWER_CONTENT_LONG_MESSAGE,
  ANSWER_CONTENT_MAX,
  ANSWER_CONTENT_MIN,
  ANSWER_CONTENT_SHORT_MESSAGE,
} from '@/features/inquiry/schemas/inquiryAnswerSchema';
import {
  INQUIRY_CONTENT_LONG_MESSAGE,
  INQUIRY_CONTENT_MAX,
  INQUIRY_CONTENT_MIN,
  INQUIRY_CONTENT_SHORT_MESSAGE,
  INQUIRY_TOPIC_REQUIRED_MESSAGE,
} from '@/features/inquiry/schemas/inquirySchema';
import { inquiryStatus, isPubliclyVisible } from '@/features/inquiry/inquiryVisibility';
import { ApiError } from '@/lib/apiClient';
import {
  nextLocalId,
  pageLocalRows,
  readCollection,
  writeCollection,
  type StoredHospitalInquiry,
} from '@/lib/localCollection';
import { useAuthStore } from '@/store/useAuthStore';
import {
  isInquiryTopic,
  type AppNotification,
  type HospitalInquiryAnswer,
  type InquiryStatus,
  type InquiryTopic,
  type Paged,
} from '@/types/domain';
import { maskPersonName } from '@/utils/pii';

/**
 * 병원 문의 — 접수·조회·답변.
 *
 * **지금은 `lib/localCollection.ts`(localStorage)를 읽고 쓴다. 백엔드가 생기면 각 함수의
 * 본문만 `apiRequest('<경로>')` 로 갈아끼우면 되고, 시그니처와 화면 코드는 바뀌지 않는다.**
 *
 * | 함수 | 대응 엔드포인트 |
 * |---|---|
 * | `createHospitalInquiry` | `POST /hospital-inquiries` |
 * | `fetchHospitalInquiries` | `GET /hospital-inquiries` |
 * | `fetchHospitalInquirySummary` | `GET /hospital-inquiries/summary` |
 * | `fetchHospitalInquiryById` | `GET /hospital-inquiries/{inquiryId}` |
 * | `answerHospitalInquiry` | `POST /hospital-inquiries/{inquiryId}/answer` |
 * | `fetchMyInquiries` | `GET /me/inquiries` |
 * | `fetchPublicHospitalInquiries` | `GET /hospitals/{hospitalId}/inquiries` |
 *
 * 에러는 서버가 쓸 코드·문구를 그대로 던진다 (`HOSPITAL_INQUIRY_NOT_FOUND`,
 * `OPERATOR_CANNOT_ANSWER`, `INQUIRY_ALREADY_ANSWERED`, `VALIDATION_FAILED` + `details[]`).
 * 화면은 `isApiError(error) && error.code === '...'` 로 분기하므로 서버 전환 뒤에도 그대로다.
 *
 * **상태와 공개 노출은 저장하지 않는다.** 둘 다 순수 함수가 판정한다
 * (`inquiryVisibility.ts`) — 서버의 `hospital/inquiry-visibility.ts` 와 같은 규칙이고,
 * 같은 판정을 두 곳에 두지 않기 위해 목록·요약·공개 목록이 전부 그 둘을 부른다.
 *
 * **로컬 구현이 계약과 다른 점:**
 * - **인가가 진짜가 아니다.** 역할·담당 병원은 토큰이 아니라 스토어의 현재 사용자
 *   (`currentUser()`)에서 온다. 스코프 판정 자체는 계약대로 흉내 낸다 — `hospital_admin`
 *   은 `managedHospitalIds`, `operator` 는 전체, 범위 밖 단건은 `404`, `operator` 답변은
 *   `403 OPERATOR_CANNOT_ANSWER`. 브라우저에서 스토어를 고치면 뚫리지만, 그것은 서버가
 *   생겨야 닫히는 구멍이다.
 * - **병원 존재를 확인하지 않는다.** `POST` 의 `404 HOSPITAL_NOT_FOUND` 를 던질 수 없다 —
 *   병원은 서버 리소스라 저장소에 목록이 없다. 작성 화면이 병원 조회에 성공한 뒤에만
 *   폼을 그리므로 실제 경로에서는 걸릴 일이 없다.
 * - **문의자 이름(`askerDisplayName`)과 병원 이름(`hospitalName`)을 행에 적어 둔다.**
 *   계약은 둘 다 조인으로 얻고 **스냅샷 컬럼을 두지 않는다** (§4: 계정 이름이 바뀌면 바뀐
 *   이름의 마스킹이 보이는 것이 맞다). 로컬에는 `users`·`hospitals` 테이블이 없어 작성
 *   시점의 값을 적는다 — 계정·병원 이름이 바뀌어도 옛 이름이 남는 것이 차이다.
 *   `hospitalName` 은 답변 알림 문구(`{병원명} · …`)에도 필요하다.
 * - **마스킹은 서버 몫이지만 여기서 한다** (`utils/pii.ts` 의 공용 함수). 화면은 마스킹된
 *   값만 받는다 — 원본 이름이 투영 밖으로 나가는 경로를 만들지 않기 위해서다.
 * - **알림에 수신자가 없다.** 답변 알림은 `audience: 'user'` 로만 저장되고, 로컬 알림함은
 *   계정을 가르지 않아 **다른 계정으로 로그인해도 보인다**
 *   (`features/notification/api/notificationApi.ts` 가 적은 기존 결함과 같은 것이다).
 *   서버가 `userId` 로 보내면 사라진다 — 여기서 범위를 넓혀 고치지 않는다.
 * - **거절 문구는 폼과 한 벌이다.** 길이·주제 문구는 `schemas/` 의 상수(계약의
 *   `details[].message` 그대로)를 양쪽이 함께 쓴다 — 폼이 막는 문장과 여기서 던지는
 *   문장이 갈리면 같은 입력에 두 가지 말이 보인다 (`consultRequestSchema` 의
 *   `INVALID_PHONE_MESSAGE` 와 같은 규약).
 */

/* --------------------------------------------------------------------- 타입 */

/** `HospitalInquiryCreateRequest`. `userId` 는 서버가 토큰에서 채우므로 본문에 없다. */
export interface HospitalInquiryCreateInput {
  hospitalId: string;
  /**
   * 서버 전환 시 삭제: 계약에 없는 **로컬 전용 입력**이다. 서버는 `hospitals` 를 조인해
   * 이름을 얻지만 로컬에는 그 테이블이 없어, 병원을 이미 조회한 작성 화면이 넘겨준다.
   */
  hospitalName?: string;
  /** `null` 은 "아직 고르지 않음" 이다 — 기본값이 없어 그대로 보내면 `422` 다. */
  topic: InquiryTopic | null;
  content: string;
  /** 보내지 않으면 `true` (계약의 기본값). */
  isPublic?: boolean;
}

/** `HospitalInquiryAnswerRequest`. `isPublic` 은 **필수이고 기본값이 없다.** */
export interface HospitalInquiryAnswerInput {
  content: string;
  isPublic: boolean;
}

/** 관리자 시야(`HospitalInquiry`). 목록과 상세가 같은 스키마다. */
export interface HospitalInquiry {
  id: string;
  hospitalId: string;
  /**
   * 계약에서는 필수 문자열이다. 로컬은 작성 시점에 받아 둔 이름이고, 없으면 `null` 이다
   * (위 "계약과 다른 점" 참고).
   */
  hospitalName: string | null;
  /** **역할과 무관하게 항상 마스킹된다** (`김*준`). 연락처는 컬럼 자체가 없다. */
  askerName: string;
  topic: InquiryTopic;
  content: string;
  /** 환자가 작성 시점에 고른 공개 여부. */
  isPublic: boolean;
  status: InquiryStatus;
  /** 미답변이면 `null`. **키는 항상 있다.** */
  answer: HospitalInquiryAnswer | null;
  createdAt: string;
}

/**
 * 문의자 시야(`MyHospitalInquiry`). 관리자용과 **다른 투영**이다 — 마스킹된 자기 이름이 없다.
 * 답변의 공개 여부(병원의 선택)는 **담는다** — 그래야 화면이 실제 노출 여부를 `isPubliclyVisible`
 * 로 판정한다 (없으면 "공개로 물었지만 병원이 비공개로 답한" 건을 `공개` 로 잘못 말한다).
 */
export interface MyHospitalInquiry {
  id: string;
  hospitalId: string;
  hospitalName: string | null;
  topic: InquiryTopic;
  content: string;
  isPublic: boolean;
  status: InquiryStatus;
  answer: { content: string; answeredAt: string; isPublic: boolean } | null;
  createdAt: string;
}

/** 공개 Q/A 시야(`PublicHospitalInquiry`). **작성자 자리가 아예 없다.** */
export interface PublicHospitalInquiry {
  id: string;
  topic: InquiryTopic;
  content: string;
  createdAt: string;
  /** 목록에 들어온 시점에 이미 답변완료라 `null` 이 아니다. */
  answer: { content: string; answeredAt: string };
}

export type InquiryScope = 'managed' | 'all';

export interface HospitalInquiryFilters {
  page?: number;
  pageSize?: number;
  status?: InquiryStatus;
  hospitalId?: string;
  topic?: InquiryTopic;
}

export interface MyInquiryFilters {
  page?: number;
  pageSize?: number;
  status?: InquiryStatus;
}

export interface PublicInquiryFilters {
  page?: number;
  pageSize?: number;
  topic?: InquiryTopic;
}

/** `GET /hospital-inquiries` 응답. `scope` 로 "담당 병원만" 과 "전체" 를 구분한다. */
export interface HospitalInquiryList extends Paged<HospitalInquiry> {
  scope: InquiryScope;
}

/** `GET /hospitals/{id}/inquiries` 응답. 두 숫자의 **모집단이 다르다.** */
export interface PublicHospitalInquiryList extends Paged<PublicHospitalInquiry> {
  /** `문의 N건` — **환자가 공개로 남긴** 문의 수 (미답변 포함). `meta.totalItems` 와 다르다. */
  publicInquiryCount: number;
}

/** `GET /hospital-inquiries/summary`. 탭 숫자 셋과 관리자 홈 입구가 같은 응답을 쓴다. */
export interface HospitalInquirySummary {
  unanswered: number;
  answered: number;
  total: number;
  scope: InquiryScope;
}

/* --------------------------------------------------------------- 로컬 구현 보조 */

// 서버 전환 시 삭제: 역할·담당 병원·문의자 판정은 서버가 토큰으로 한다.
function currentUser() {
  return useAuthStore.getState().user;
}

function unauthenticated(): ApiError {
  return new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: '로그인이 필요해요' });
}

function forbidden(): ApiError {
  return new ApiError({ status: 403, code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없어요' });
}

function inquiryNotFound(): ApiError {
  return new ApiError({
    status: 404,
    code: 'HOSPITAL_INQUIRY_NOT_FOUND',
    message: '문의를 찾을 수 없어요',
  });
}

function validationFailed(field: string, code: string, message: string): ApiError {
  return new ApiError({
    status: 422,
    code: 'VALIDATION_FAILED',
    message: '입력값을 확인해주세요',
    details: [{ field, code, message }],
  });
}

function byCreatedAtDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * 관리자 시야 한 건. **로컬 전용 필드를 떼고 이름을 마스킹한다** —
 * 원본 이름이 투영 밖으로 나가는 경로를 만들지 않는다.
 */
function toHospitalInquiry(stored: StoredHospitalInquiry): HospitalInquiry {
  return {
    id: stored.id,
    hospitalId: stored.hospitalId,
    hospitalName: stored.hospitalName ?? null,
    askerName: maskPersonName(stored.askerDisplayName ?? ''),
    topic: stored.topic,
    content: stored.content,
    isPublic: stored.isPublic,
    status: inquiryStatus(stored),
    answer: stored.answer,
    createdAt: stored.createdAt,
  };
}

function toMyHospitalInquiry(stored: StoredHospitalInquiry): MyHospitalInquiry {
  return {
    id: stored.id,
    hospitalId: stored.hospitalId,
    hospitalName: stored.hospitalName ?? null,
    topic: stored.topic,
    content: stored.content,
    isPublic: stored.isPublic,
    status: inquiryStatus(stored),
    answer: stored.answer
      ? { content: stored.answer.content, answeredAt: stored.answer.answeredAt, isPublic: stored.answer.isPublic }
      : null,
    createdAt: stored.createdAt,
  };
}

function toPublicHospitalInquiry(stored: StoredHospitalInquiry): PublicHospitalInquiry {
  // `isPubliclyVisible` 를 통과한 행만 여기 온다 — 답변이 없을 수 없다.
  const answer = stored.answer as HospitalInquiryAnswer;

  return {
    id: stored.id,
    topic: stored.topic,
    content: stored.content,
    createdAt: stored.createdAt,
    answer: { content: answer.content, answeredAt: answer.answeredAt },
  };
}

/**
 * 관리자 스코프. 역할에 따라 **보이는 모집단과 `scope` 가 함께** 정해진다
 * (`GET /consult-requests`·`GET /admin/hospitals` 와 같은 모양, §3 의 세 번째 사례).
 */
function adminScopedRows(hospitalId?: string): { rows: StoredHospitalInquiry[]; scope: InquiryScope } {
  const user = currentUser();

  if (!user) throw unauthenticated();
  if (user.role !== 'hospital_admin' && user.role !== 'operator') throw forbidden();

  const all = readCollection('inquiries');

  if (user.role === 'operator') {
    return { rows: hospitalId ? all.filter((row) => row.hospitalId === hospitalId) : all, scope: 'all' };
  }

  // 담당 병원 밖을 물으면 `403 HOSPITAL_NOT_MANAGED` 다 — **병원 존재는 공개 정보라
  // 숨기지 않는다.** 문의 단건(`/{id}`)이 `404` 인 것과 이유가 다르다.
  if (hospitalId !== undefined && !user.managedHospitalIds.includes(hospitalId)) {
    throw new ApiError({
      status: 403,
      code: 'HOSPITAL_NOT_MANAGED',
      message: '담당하지 않는 병원이에요',
    });
  }

  const managed = all.filter((row) =>
    hospitalId === undefined ? user.managedHospitalIds.includes(row.hospitalId) : row.hospitalId === hospitalId
  );

  return { rows: managed, scope: 'managed' };
}

/**
 * 본문 길이 검사. 접수와 답변이 같은 경계값(5~1000자)을 쓰고 문구만 다르다.
 *
 * **경계값도 문구도 폼 스키마와 같은 상수에서 온다** — 폼이 막는 문장과 여기서 던지는
 * 문장이 갈리면, 같은 입력에 두 가지 말이 보이고 서버 전환 때 어느 쪽이 맞는지 알 수 없다.
 */
const CONTENT_RULES = {
  inquiry: {
    min: INQUIRY_CONTENT_MIN,
    max: INQUIRY_CONTENT_MAX,
    short: INQUIRY_CONTENT_SHORT_MESSAGE,
    long: INQUIRY_CONTENT_LONG_MESSAGE,
  },
  answer: {
    min: ANSWER_CONTENT_MIN,
    max: ANSWER_CONTENT_MAX,
    short: ANSWER_CONTENT_SHORT_MESSAGE,
    long: ANSWER_CONTENT_LONG_MESSAGE,
  },
} as const;

function assertContentLength(content: string, kind: 'inquiry' | 'answer'): string {
  const trimmed = content.trim();
  const rule = CONTENT_RULES[kind];

  if (trimmed.length < rule.min) {
    throw validationFailed('content', 'CONTENT_TOO_SHORT', rule.short);
  }

  if (trimmed.length > rule.max) {
    throw validationFailed('content', 'CONTENT_TOO_LONG', rule.long);
  }

  return trimmed;
}

/** 알림 본문에 싣는 답변 미리보기. 60자를 넘으면 `…` 를 붙인다 (§9). */
const NOTIFICATION_PREVIEW_MAX = 60;

function answerPreview(content: string): string {
  return content.length > NOTIFICATION_PREVIEW_MAX
    ? `${content.slice(0, NOTIFICATION_PREVIEW_MAX)}…`
    : content;
}

// 서버 전환 시 삭제: 알림 생성은 서버 몫
//
// 답변 등록(`POST /hospital-inquiries/{id}/answer`)의 **부수효과로** 서버가 알림을 만든다 —
// 알림을 만드는 공개 엔드포인트는 계약에 아예 없다 (`consultApi.ts` 와 같은 임시 구현).
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
 * `POST /hospital-inquiries`. 응답은 문의자 시야(`MyHospitalInquiry`)다 —
 * 완료 화면과 `내 문의 보기` 가 목록을 다시 조회하지 않아도 되게 전체 투영을 돌려준다.
 *
 * **부수효과가 없다.** 새 문의가 들어와도 관리자 알림을 만들지 않는다 (배지는 미답변 수다).
 */
export async function createHospitalInquiry(input: HospitalInquiryCreateInput): Promise<MyHospitalInquiry> {
  const user = currentUser();
  if (!user) throw unauthenticated();

  if (!isInquiryTopic(input.topic)) {
    throw validationFailed('topic', 'TOPIC_REQUIRED', INQUIRY_TOPIC_REQUIRED_MESSAGE);
  }

  const content = assertContentLength(input.content, 'inquiry');

  const stored: StoredHospitalInquiry = {
    id: nextLocalId('inquiry'),
    hospitalId: input.hospitalId,
    hospitalName: input.hospitalName,
    topic: input.topic,
    // 저장은 **trim 한 값**으로 한다 (계약).
    content,
    isPublic: input.isPublic ?? true,
    answer: null,
    createdAt: new Date().toISOString(),
    // 서버 전환 시 삭제: 문의자와 그 이름은 서버가 토큰·조인으로 알아낸다.
    ownerUserId: user.id,
    askerDisplayName: user.name,
  };

  writeCollection('inquiries', [stored, ...readCollection('inquiries')]);

  return toMyHospitalInquiry(stored);
}

/**
 * `GET /me/inquiries`. 최신순. **공개·비공개, 미답변·답변완료 전부 보인다** — 본인 것이다.
 *
 * 지금 로그인한 계정이 남긴 것만 돌려준다. 주인이 적혀 있지 않은 행은 **누구의 것도 아니다**
 * (`fetchMyConsultRequests` 와 같은 판단). 비로그인이면 빈 목록이다 (서버라면 `401` 인 자리).
 */
export async function fetchMyInquiries(filters: MyInquiryFilters = {}): Promise<Paged<MyHospitalInquiry>> {
  const user = currentUser();
  const rows = (user === null ? [] : [...readCollection('inquiries')])
    .filter((row) => row.ownerUserId === user?.id)
    .sort(byCreatedAtDesc)
    .filter((row) => (filters.status ? inquiryStatus(row) === filters.status : true))
    .map(toMyHospitalInquiry);

  return pageLocalRows(rows, filters.page, filters.pageSize);
}

/** `GET /hospital-inquiries`. 관리자 문의 화면의 목록. 접수 최신순. */
export async function fetchHospitalInquiries(
  filters: HospitalInquiryFilters = {}
): Promise<HospitalInquiryList> {
  const { rows, scope } = adminScopedRows(filters.hospitalId);

  const items = [...rows]
    .sort(byCreatedAtDesc)
    .filter((row) => (filters.status ? inquiryStatus(row) === filters.status : true))
    .filter((row) => (filters.topic ? row.topic === filters.topic : true))
    .map(toHospitalInquiry);

  return { ...pageLocalRows(items, filters.page, filters.pageSize), scope };
}

/**
 * `GET /hospital-inquiries/summary`. 탭 숫자 셋과 관리자 홈 입구가 쓰는 같은 응답.
 *
 * `status` 목록의 `meta.totalItems` 와 **항상 같아야 한다** — 그래서 같은 순수 함수
 * (`inquiryStatus`)로 센다.
 */
export async function fetchHospitalInquirySummary(hospitalId?: string): Promise<HospitalInquirySummary> {
  const { rows, scope } = adminScopedRows(hospitalId);

  const unanswered = rows.filter((row) => inquiryStatus(row) === 'unanswered').length;

  return { unanswered, answered: rows.length - unanswered, total: rows.length, scope };
}

/**
 * `GET /hospital-inquiries/{inquiryId}`.
 *
 * **담당 병원 밖이거나 없는 문의면 `404` 다 (`403` 이 아니다).** `403` 을 주면 id 대입으로
 * "이 병원에 비공개 문의가 몇 건 있다" 가 샌다.
 */
export async function fetchHospitalInquiryById(id: string): Promise<HospitalInquiry> {
  const { rows } = adminScopedRows();
  const found = rows.find((row) => row.id === id);

  if (!found) throw inquiryNotFound();

  return toHospitalInquiry(found);
}

/**
 * `POST /hospital-inquiries/{inquiryId}/answer`. **담당 `hospital_admin` 전용.**
 *
 * - `operator` → `403 OPERATOR_CANNOT_ANSWER` (조회는 되는데 쓰기는 안 되는 비대칭이다 —
 *   운영자가 대신 답하면 그 병원이 하지 않은 말이 병원 이름으로 남는다)
 * - 범위 밖·없는 문의 → `404`
 * - 이미 답변된 문의 → `409 INQUIRY_ALREADY_ANSWERED` (**수정이 없다**)
 *
 * **부수효과 — 문의자에게 알림 1건.** 실패하면 알림도 나가지 않는다.
 */
export async function answerHospitalInquiry(
  id: string,
  input: HospitalInquiryAnswerInput
): Promise<HospitalInquiry> {
  const user = currentUser();

  if (!user) throw unauthenticated();
  if (user.role === 'operator') {
    throw new ApiError({
      status: 403,
      code: 'OPERATOR_CANNOT_ANSWER',
      message: '운영자는 병원을 대신해 답변할 수 없어요',
    });
  }
  if (user.role !== 'hospital_admin') throw forbidden();

  const all = readCollection('inquiries');
  const target = all.find((row) => row.id === id && user.managedHospitalIds.includes(row.hospitalId));

  if (!target) throw inquiryNotFound();

  // `answered_at IS NULL` 조건부 쓰기의 자리. 두 번째 답변은 막히고 알림도 한 번만 나간다.
  if (target.answer !== null) {
    throw new ApiError({
      status: 409,
      code: 'INQUIRY_ALREADY_ANSWERED',
      message: '이미 답변한 문의예요. 답변 수정은 아직 지원하지 않아요',
    });
  }

  if (typeof input.isPublic !== 'boolean') {
    throw validationFailed('isPublic', 'ANSWER_PUBLIC_REQUIRED', '이 답변을 공개할지 선택해주세요');
  }

  const content = assertContentLength(input.content, 'answer');
  const updated: StoredHospitalInquiry = {
    ...target,
    answer: {
      content,
      // 병원이 고른 값을 **그대로** 적는다. 환자가 비공개로 물었어도 덮어쓰지 않는다 —
      // 노출은 두 값의 AND 로 따로 판정한다 (파생값을 저장하면 둘이 어긋난다).
      isPublic: input.isPublic,
      answeredAt: new Date().toISOString(),
    },
  };

  writeCollection(
    'inquiries',
    all.map((row) => (row.id === id ? updated : row))
  );

  // 서버 전환 시 삭제: 알림 생성은 서버 몫
  createLocalNotification({
    audience: 'user',
    type: 'inquiry-answer',
    title: '문의에 답변이 왔어요',
    // 문구에 문의자 이름을 넣지 않는다 — 받는 사람이 본인이라 쓸모가 없고,
    // 이름이 박히는 순간 마스킹 경계가 하나 더 생긴다.
    message: `${updated.hospitalName ?? '병원'} · ${answerPreview(content)}`,
    relatedId: updated.id,
  });

  return toHospitalInquiry(updated);
}

/**
 * `GET /hospitals/{hospitalId}/inquiries`. 병원 상세의 공개 Q/A. **인증이 필요 없다.**
 *
 * 노출 조건은 순수 함수 하나다 (`isPubliclyVisible`). 정렬은 접수순이 아니라
 * **답이 달린 순**(`answeredAt DESC`)이어야 새 답변이 위로 올라온다.
 */
export async function fetchPublicHospitalInquiries(
  hospitalId: string,
  filters: PublicInquiryFilters = {}
): Promise<PublicHospitalInquiryList> {
  const rows = readCollection('inquiries')
    .filter((row) => row.hospitalId === hospitalId)
    .filter((row) => (filters.topic ? row.topic === filters.topic : true));

  const visible = rows
    .filter(isPubliclyVisible)
    .sort(
      (a, b) => new Date(b.answer?.answeredAt ?? 0).getTime() - new Date(a.answer?.answeredAt ?? 0).getTime()
    )
    .map(toPublicHospitalInquiry);

  return {
    ...pageLocalRows(visible, filters.page, filters.pageSize),
    // `문의 N건` 의 모집단은 **환자가 공개로 남긴 문의**다 (미답변 포함). 전체를 세면
    // "문의 40건인데 Q/A 는 3개" 가 비공개 37건을 말해 준다.
    publicInquiryCount: rows.filter((row) => row.isPublic).length,
  };
}
