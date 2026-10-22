/**
 * 세부 시술 31개 (2026-10-21 요청 14 — 13종에서 늘었고 옛 id 6개는 사라졌다).
 *
 * 선언 순서 = 화면 순서 = `GET /procedures` 응답 순서 (분야 순서 × 분야 안 순서).
 * 값과 순서의 원본은 `backend/prisma/seed/data/procedures.ts` 이고, 계약은
 * `docs/api/openapi.yaml` 의 `ProcedureId` 다.
 *
 * 옛 id (`implant`·`orthodontics`·`cavity`·`gum-disease`·`tmj`·`botox`)는 **서버가 받지
 * 않는다.** 이미 발급된 주소·브라우저 저장소의 옛 값은 `features/procedure/taxonomy.ts`
 * 의 별칭 표 하나가 푼다.
 */
export type ProcedureId =
  | 'implant-general'
  | 'bone-graft'
  | 'sinus-lift'
  | 'implant-denture'
  | 'scaling'
  | 'fluoride'
  | 'sealant'
  | 'halitosis'
  | 'clear-aligner'
  | 'lingual-braces'
  | 'bracket-braces'
  | 'partial-ortho'
  | 'resin'
  | 'inlay'
  | 'onlay'
  | 'crown'
  | 'root-canal'
  | 'laminate'
  | 'whitening'
  | 'gum-contouring'
  | 'gum-treatment'
  | 'periodontal-surgery'
  | 'gum-graft'
  | 'tmj-treatment'
  | 'splint'
  | 'bruxism-device'
  | 'snoring-device'
  | 'bruxism-botox'
  | 'masseter-botox'
  | 'wisdom-tooth'
  | 'general-extraction';

export interface Procedure {
  id: ProcedureId;
  name: string;
  emoji: string;
  shortDescription: string;
  description: string;
  /** 이 시술이 속한 분야 9개 중 하나 (계약 `ProcedureCategoryId`). */
  categoryId: string;
  /**
   * **`준비중` 의 반대.** 앱에 노출되는 병원 중 이 시술을 하는 곳이 1곳 이상이면 `true` 다
   * — 서버가 매 요청 집계한다 (계약 §22.3). 저장된 컬럼이 아니므로 화면이 캐시해 두면
   * 방금 한 저장이 반영되지 않는다 (`useProcedures` 가 `staleTime` 을 두지 않는 이유).
   */
  isAvailable: boolean;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface BusinessHourEntry {
  day: string;
  hours: string;
  isClosed?: boolean;
}

export interface HospitalFeatures {
  /** 전담코디네이터 */
  coordinator: boolean;
  /** 무통마취 */
  painlessAnesthesia: boolean;
  /** 디지털진료 */
  digitalCare: boolean;
  /** 주차가능 */
  parking: boolean;
  /** 야간상담 */
  nightConsult: boolean;
  /** CCTV설치 */
  cctv: boolean;
}

/**
 * 광고 노출 판정. 서버가 `Asia/Seoul` 기준으로 계산해 내려준다
 * (`backend/src/hospital/sponsorship.ts` 와 같은 규칙).
 */
export interface SponsorshipState {
  /** 광고 기간 중인가. `광고` 배지의 조건. */
  isActive: boolean;
  /** 상단 노출 자격이 있는가. 기간 + 평점 3.5 + (지정 시) 카테고리. 정렬은 서버가 이미 끝냈다. */
  isPlacementEligible: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  specialty: string;
  region: string;
  latitude: number;
  longitude: number;
  thumbnail: string;
  images: string[];
  procedureIds: ProcedureId[];
  priceRange: PriceRange;
  rating: number;
  reviewCount: number;
  consultCount: number;
  consultAvailable: boolean;
  businessHours: BusinessHourEntry[];
  /** "찾아오시는 길" free-text directions (nearest subway/landmark etc). */
  directions: string;
  features: HospitalFeatures;
  /** Same-day prosthetics capability (implant crown/denture milled in-house) — a hospital attribute, not a procedure category. */
  isOneDay: boolean;
  /** Editorially curated pick, surfaced under the "추천" filter. */
  isRecommended: boolean;
  /** Paid placement. Category-scoped, ranked, and time-boxed — the active-window/eligibility rules live on the server, see backend/src/hospital/sponsorship.ts. */
  isSponsored: boolean;
  sponsoredCategories: ProcedureId[];
  /** Lower ranks surface first among sponsored hospitals within the same category. Null when not sponsored. */
  sponsoredRank: number | null;
  /** ISO date ('YYYY-MM-DD'). Null when not sponsored. */
  sponsoredStartDate: string | null;
  /** ISO date ('YYYY-MM-DD'). Null when not sponsored. */
  sponsoredEndDate: string | null;
  tags: string[];
  address: string;
  introduction: string;
  events: string[];
  /**
   * 서버가 계산한다 (`backend/src/hospital/sponsorship.ts`). 사용자 화면(탐색·병원 카드·
   * 병원 상세)은 이 값을 그대로 쓴다 — 기기 시계로 광고 기간을 다시 계산하지 않는다.
   * 클라이언트 계산 규칙은 없다(규칙은 서버 한 곳에만 있다).
   */
  sponsorship: SponsorshipState;
  /** 병원 카드의 `OO전문의 상주` 배지. 서버가 계산한다. 없으면 null. */
  representativeSpecialty: DentalSpecialty | null;
  /** 지도 반경 조회에서만 온다. */
  distanceKm?: number;
}

export type DentalSpecialty =
  | '치과보철전문의'
  | '치과교정전문의'
  | '구강악안면외과전문의'
  | '치주과전문의'
  | '소아치과전문의'
  | '통합치의학과전문의'
  | '구강악안면방사선과전문의'
  | '일반의';

export const DENTAL_SPECIALTIES: DentalSpecialty[] = [
  '치과보철전문의',
  '치과교정전문의',
  '구강악안면외과전문의',
  '치주과전문의',
  '소아치과전문의',
  '통합치의학과전문의',
  '구강악안면방사선과전문의',
  '일반의',
];

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface Doctor {
  id: string;
  name: string;
  title: string;
  /** 승인 전에는 응답에 없다 (미승인 전공 주장은 공개되지 않는다). 표시용은 `visibleSpecialty`. */
  specialty?: DentalSpecialty;
  hospitalId: string;
  photo: string;
  procedureIds: ProcedureId[];
  /** 비로그인이면 null. 전문의 상세의 평점 잠금이 서버 응답이 됐다 — `?? 0` 으로 덮지 않는다. */
  rating: number | null;
  reviewCount: number;
  consultCount: number;
  /** Uploaded certificate/license image or PDF URL. Null until the hospital admin uploads one. */
  certificateUrl: string | null;
  verificationStatus: VerificationStatus;
  /** Set by the operator when verificationStatus is 'rejected'; explains what needs fixing. */
  rejectionReason: string | null;
  isRecommended: boolean;
  yearsOfExperience: number;
  /** "경력 및 활동" bullet list shown on the doctor detail screen. */
  career: string[];
  /** 표시해도 되는 전공. `일반의` → 항상 노출, 그 밖은 `isVerifiedSpecialist` 일 때만. 서버 계산 필드. */
  visibleSpecialty: DentalSpecialty | null;
  /**
   * `전문의` 배지 조건: `verificationStatus === 'approved' && specialty !== '일반의' &&
   * verifiedSpecialty === specialty`. 승인 후 전공을 바꾼 전문의는 `verifiedSpecialty` 가
   * 옛 전공에 머물러 있어 이 조건이 거짓이 된다(재검수 전까지 배지를 잃는다) — 서버 계산
   * 필드이며 클라이언트는 재계산하지 않고 이 값을 그대로 신뢰해야 한다.
   */
  isVerifiedSpecialist: boolean;
}

/**
 * 관리자 시야 (`PUT /hospitals/{id}/doctors`, `PATCH /doctors/{id}`,
 * `GET /doctors/verification-queue`, `PUT /doctors/{id}/verification` 응답).
 *
 * 공개 `Doctor` 와 달리 `certificateUrl`/`rejectionReason` 을 포함하고, `specialty` 가
 * 검수 상태와 무관하게 **항상** 실린다 — 검수 화면은 승인 전 전공 주장을 직접 판단해야 한다.
 *
 * ⚠ 이 시야를 얻을 수 있는 경로가 제한적이다: 기존 전문의의 `certificateUrl`/`specialty` 원본을
 * 다시 읽을 GET 이 없다 (`GET /hospitals/{id}/doctors` 는 공개 `Doctor` 뿐이다). 이 타입의 값은
 * 방금 그 자신이 보낸 `PUT`/`PATCH`/검수 응답에서만 얻을 수 있다 — 병원 폼을 다시 열면 사라진다.
 */
export interface DoctorAdminView extends Omit<Doctor, 'specialty'> {
  specialty: DentalSpecialty;
}

/** `GET /doctors/verification-queue` 항목. 검수 화면이 소속 병원 이름·제출 시각까지 함께 받는다. */
export interface VerificationQueueItem extends DoctorAdminView {
  hospitalName: string;
  submittedAt: string | null;
}

export interface Review {
  id: string;
  hospitalId: string;
  procedureId: ProcedureId;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
  photos?: string[];
}

export interface Promotion {
  id: string;
  hospitalId: string;
  procedureId: ProcedureId;
  title: string;
  originalPrice: number;
  salePrice: number;
  badge: string;
}

export interface GuideContent {
  id: string;
  title: string;
  summary: string;
  thumbnail: string;
  /** Related procedure category, also used to filter the "상담받기" CTA on the tip detail screen. */
  procedureId: ProcedureId;
  /** Body text, paragraphs separated by a blank line (\n\n). */
  content: string;
  author: string;
  createdAt: string;
  relatedHospitals?: string[];
}

export interface QAAnswer {
  id: string;
  authorName: string;
  isDentist: boolean;
  content: string;
  createdAt: string;
}

export interface QAPost {
  id: string;
  title: string;
  content: string;
  procedureId: ProcedureId;
  authorName: string;
  createdAt: string;
  viewCount: number;
  answers: QAAnswer[];
}

export type AuthProvider = 'email' | 'google' | 'kakao';

/**
 * 역할 3개. `docs/decisions/0001-roles-and-pii.md` 결정 1 이며 백엔드
 * `auth.types.ts` 의 `USER_ROLES` 와 같다. 누적형이다 — `hospital_admin` 은
 * 일반 사용자가 할 수 있는 것을 모두 할 수 있다.
 */
export type UserRole = 'user' | 'hospital_admin' | 'operator';

export const USER_ROLES: UserRole[] = ['user', 'hospital_admin', 'operator'];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as string[]).includes(value);
}

export interface User {
  id: string;
  email: string;
  name: string;
  provider: AuthProvider;
  /** 화면 가드의 근거. 클라이언트 추측이 아니라 `GET /auth/me` 응답에서 온다. */
  role: UserRole;
  /**
   * `hospital_admin` 의 담당 병원. 다른 역할은 빈 배열이다.
   * JWT 클레임이 아니라 매 `GET /auth/me` 응답에서 온다 (담당 해제가 즉시 반영되도록).
   */
  managedHospitalIds: string[];
}

/**
 * 상담 처리 상태 (openapi `ConsultStatus`). **2026-10-13 에 `visited` 가 더해져 5개다.**
 *
 * `booked` 는 **라벨만** `예약완료` → `예약확정` 으로 바뀌었고 저장값은 그대로다 — enum 값
 * 제거는 breaking 이고(`openapi.yaml` §15), `예약완료` 와 `예약확정` 은 같은 사실을 가리키는
 * 두 라벨이지 두 상태가 아니다. 반대로 `내원완료` 는 **새로운 사실**(실제로 왔는가)이라 값이 필요했다.
 */
export type ConsultStatus = 'new' | 'contacted' | 'booked' | 'visited' | 'cancelled';

/** 순서가 곧 상태 탭의 순서다 (`전체` 는 상태가 아니라 "필터 없음" 이라 여기 없다). */
export const CONSULT_STATUSES: ConsultStatus[] = ['new', 'contacted', 'booked', 'visited', 'cancelled'];

export const CONSULT_STATUS_LABEL: Record<ConsultStatus, string> = {
  new: '신규',
  contacted: '연락중',
  booked: '예약확정',
  visited: '내원완료',
  cancelled: '취소',
};

/**
 * 취소 사유 (openapi `ConsultCancelReason`). `status: cancelled` 로 바꿀 때 **필수**이고,
 * 주고받는 것은 코드뿐이다 — 라벨은 클라이언트가 들고 있는다 (문구를 다듬어도 저장값이 안 깨진다).
 */
export type ConsultCancelReason = 'no_answer' | 'patient_request' | 'procedure_unavailable' | 'duplicate' | 'etc';

/** 순서가 곧 취소 사유 select 의 순서다. */
export const CONSULT_CANCEL_REASONS: ConsultCancelReason[] = [
  'no_answer',
  'patient_request',
  'procedure_unavailable',
  'duplicate',
  'etc',
];

export const CONSULT_CANCEL_REASON_LABEL: Record<ConsultCancelReason, string> = {
  no_answer: '연락이 안 됨',
  patient_request: '환자 요청',
  procedure_unavailable: '진료 불가 시술',
  duplicate: '중복 신청',
  etc: '기타',
};

export function isConsultCancelReason(value: string | undefined | null): value is ConsultCancelReason {
  return value !== undefined && value !== null && (CONSULT_CANCEL_REASONS as string[]).includes(value);
}

/**
 * 희망 연락 시간 (openapi `ConsultPreferredTime`). **값·순서가 곧 화면의 선택지다.**
 *
 * 세 곳(신청 폼 · 폼 스키마 · 계약)이 같은 목록을 써야 해서 `CONSULT_STATUSES` 처럼 한 곳에
 * 모았다. 선택지를 복사해 두면 하나가 늘었을 때 한쪽만 고쳐져 신청 화면과 검증이 어긋난다
 * (`평일 저녁` 추가가 그 경우였다).
 */
export const CONSULT_PREFERRED_TIMES = ['평일 오전', '평일 오후', '평일 저녁', '주말'] as const;

export type ConsultPreferredTime = (typeof CONSULT_PREFERRED_TIMES)[number];

/**
 * 기록된 개인정보 제3자 제공 동의 (openapi `ConsultThirdPartyConsent`).
 * 동의하지 않은 접수는 거절되므로 boolean 이 따로 없다 — **기록의 존재 자체가 동의다.**
 */
export interface ConsultThirdPartyConsent {
  /** 접수를 받아들인 **서버 시계** 기준 시각. 기기 시계는 증빙이 되지 않는다. */
  agreedAt: string;
  /** 동의한 안내문의 버전 (`features/consult/content/thirdPartyConsentNotice.ts`). */
  noticeVersion: string;
}

/**
 * 처리 이력 한 줄 (openapi `ConsultStatusChange`). 이름과 달리 담는 것은 상태 변경이 아니라
 * **처리 이벤트**다 — 예약확정 상태에서 일시만 바꾸는 `reschedule` 도 여기 남는다.
 *
 * **`status`·`changedAt` 외는 전부 선택 필드다.** 이 타입은 응답 투영이 아니라 **판정
 * 함수의 입력 모양**이라서다 — `cancelReasonOf`(`lib/transition.ts`)와 이력 줄 문구
 * (`consultDisplay.ts`)는 값이 하나만 있어도 답을 낼 수 있어야 한다. 서버 응답
 * (`ConsultStatusChangeView`)은 모든 키를 항상 채워 내려준다.
 */
export interface ConsultStatusChange {
  status: ConsultStatus;
  changedAt: string;
  /** 없으면 `status_change` (계약의 기본값). */
  event?: ConsultEvent;
  /** 누가 바꿨는지. 접수 행과 과거 행은 없다. */
  changedByName?: string | null;
  /** **이 이벤트 직후의** 확정 일시 스냅샷. 현재 값이 아니다. */
  visitAt?: string | null;
  /** `status: cancelled` 인 행에만 값이 있다. */
  cancelReason?: ConsultCancelReason | null;
  /**
   * 이 이벤트로 **환자에게 알림이 나갔는지**. 규칙으로 파생하지 않고 저장된 사실을 그대로
   * 내려준다 — 억제 규칙이 생기면 이미 알림을 받은 과거 이력이 소급해 `발송 안 함` 으로 보인다.
   * (저장 쪽은 알림 행을 가리키는 id 를 들고 있다 — `consult_status_changes.notification_id`)
   */
  notified?: boolean;
}

/** 이력 행의 성격 (openapi `ConsultStatusChange.event`). */
export type ConsultEvent = 'status_change' | 'reschedule';

export interface ConsultMemo {
  id: string;
  content: string;
  createdAt: string;
}

export interface ConsultRequest {
  id: string;
  hospitalId: string;
  procedureId: ProcedureId | null;
  name: string;
  phone: string;
  /**
   * 계약은 `ConsultPreferredTime` 4지선다지만 **읽는 쪽에서는 `string` 이다** — 선택지가
   * 늘거나 예전 값이 남아 있어도 화면이 깨지지 않게 (계약 §15 enum 방어 규칙). 새로
   * 접수되는 값은 폼 스키마(`consultRequestSchema`)가 4지선다로 좁힌다.
   */
  preferredTime: string;
  message: string;
  createdAt: string;
  status: ConsultStatus;
  /**
   * 병원이 확정한 **내원 일시**. 초·밀리초는 항상 `0` 이다 (입력 단위가 분).
   *
   * 여기서 선택인 이유는 이 타입이 **두 투영의 공통 뼈대**이기 때문이다 — 응답 타입
   * (`AdminConsultRequest`·`MyConsultRequest`)이 이 자리를 **필수 + nullable** 로 덮어쓴다
   * (계약과 같은 모양). 서버는 키를 항상 채워 내려준다.
   */
  visitAt?: string | null;
  statusHistory: ConsultStatusChange[];
  /**
   * 이 건에 기록된 제3자 제공 동의. `null` 이면 **동의 절차 도입 이전에 접수된 건**이다
   * (거절한 것이 아니다).
   *
   * `visitAt` 과 같은 이유로 여기서만 선택이다 — 응답 타입 두 개가 **필수 + nullable** 로
   * 덮어쓴다.
   */
  thirdPartyConsent?: ConsultThirdPartyConsent | null;
  memos: ConsultMemo[];
}

/* ------------------------------------------------------------------ 병원 문의 */

/**
 * 문의 주제. **기본값이 없다** — 고르지 않으면 접수되지 않는다 (계약 `InquiryTopic`).
 * 칩 순서도 이 배열 순서다.
 */
export const INQUIRY_TOPICS = ['price', 'hours', 'parking', 'procedure', 'etc'] as const;

export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];

/**
 * 라벨 매핑은 **클라이언트가 들고 있는다** (계약은 코드만 주고받는다 — `주차·위치` 의
 * 가운뎃점이 쿼리 파라미터로 오갈 때 깨지지 않게, 그리고 문구를 다듬어도 저장값이
 * 그대로이게).
 */
export const INQUIRY_TOPIC_LABEL: Record<InquiryTopic, string> = {
  price: '가격',
  hours: '진료시간',
  parking: '주차·위치',
  procedure: '시술 방법',
  etc: '기타',
};

export function isInquiryTopic(value: unknown): value is InquiryTopic {
  return typeof value === 'string' && (INQUIRY_TOPICS as readonly string[]).includes(value);
}

/**
 * 주제 라벨. **모르는 코드는 `기타` 로 떨어뜨린다** — 서버가 주제를 늘려도 화면이 빈 칸을
 * 그리거나 터지지 않게 (`docs/api/README.md` §15 의 enum 방어 규칙).
 */
export function inquiryTopicLabel(topic: string): string {
  return isInquiryTopic(topic) ? INQUIRY_TOPIC_LABEL[topic] : INQUIRY_TOPIC_LABEL.etc;
}

/**
 * 문의 상태. **저장된 컬럼이 아니라 파생값이다** — 판정은 순수 함수 하나가 한다
 * (`features/inquiry/inquiryVisibility.ts` 의 `inquiryStatus`).
 */
export const INQUIRY_STATUSES = ['unanswered', 'answered'] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

/** 문의자(환자)에게 보여주는 상태 문구. */
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  unanswered: '답변 대기',
  answered: '답변완료',
};

/**
 * 관리자에게 보여주는 상태 문구. **같은 상태의 다른 호칭이다** — 환자는 기다리는 쪽,
 * 관리자는 답해야 하는 쪽이라 말이 다르다. 색(`INQUIRY_STATUS_TONE`)과 판정은 공유한다.
 */
export const ADMIN_INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  unanswered: '미답변',
  answered: '답변완료',
};

/**
 * 등록된 답변. **문의 1건에 1건이고 수정이 없다** — 그래서 배열이 아니라 객체이고
 * `id` 도 `updatedAt` 도 없다 (계약 `HospitalInquiryAnswer`).
 */
export interface HospitalInquiryAnswer {
  content: string;
  /** **병원이 답변 시점에 고른 공개 허용 여부.** 환자의 `isPublic` 과 둘 다 참이어야 공개된다. */
  isPublic: boolean;
  /** 답변 등록 시각. **상태 판정의 유일한 근거**이기도 하다. */
  answeredAt: string;
}

/** Address search result from geocoding — see src/services/geocoding.ts. */
export interface GeocodeResult {
  id: string;
  addressName: string;
  roadAddressName?: string;
  latitude: number;
  longitude: number;
}

/**
 * `inquiry-answer` 는 **병원 문의 답변 알림**이다 (계약 `NotificationType`, 2026-10-12 추가).
 * `POST /hospital-inquiries/{id}/answer` 의 부수효과로만 생기고, 누르면 마이페이지
 * `내 문의` 의 그 문의가 펼쳐진 채 열린다 (`relatedId` = 문의 id).
 */
export type NotificationType = 'consult-status' | 'inquiry-answer' | 'event' | 'system';
export type NotificationAudience = 'user' | 'admin';

/**
 * `relatedId` 가 **무엇의 id 인가** (openapi `AppNotification.relatedResource`).
 *
 * 관리자 알림함의 이동 분기가 이 값이다 — `type` 으로 가르면 접수 알림(`consult-status`)과
 * 전문의 검수 결과 알림(`system`)이 같은 알림함에 섞여 들어오는 것을 다룰 수 없다.
 * 서버는 저장 쪽의 snake_case(`consult_request`)를 투영에서 camelCase 로 바꿔 내리고,
 * **모르는 값은 `null` 로 떨어뜨린다** (이동 대상 없음).
 */
export type NotificationRelatedResource =
  | 'consultRequest'
  | 'hospital'
  | 'doctor'
  | 'promotion'
  | 'hospitalInquiry';

export interface AppNotification {
  id: string;
  audience: NotificationAudience;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  /** Id of the related consult request, hospital, etc. Null for generic notices. */
  relatedId: string | null;
  /**
   * `relatedId` 의 종류. 계약에서 **필수 + nullable** 이다 — 값이 `null` 인 것(갈 곳이 없는
   * 안내 알림)과 키가 없는 것이 섞이면 이동 분기가 조용히 어긋난다.
   */
  relatedResource: NotificationRelatedResource | null;
  /**
   * `type: 'consult-status'` 행의 **변경 후 상태** (`docs/database/README.md` §15).
   * 일시 변경(`reschedule`)이면 `booked` 다. 다른 `type` 은 전부 `null`.
   *
   * 소비자는 **아이콘 판정 하나**다 (`features/notification/notificationDisplay.ts`).
   * 문구는 저장된 `message` 문자열이지, 이 값으로 다시 만들지 않는다 — 다시 만들면
   * 문장을 다듬는 날 과거 알림 문구가 소급해 바뀐다.
   *
   * 서버는 이 키를 **항상** 내려준다(계약에서 필수 + nullable). 여기서 선택 필드로 둔 것은
   * 칸이 생기기 전에 저장된 행이 `null` 로 올라오는 것과 같은 자리를 한 번 더 열어 둔
   * 것이고, 판정 함수가 `undefined` 와 `null` 을 같게 다룬다.
   */
  consultStatus?: ConsultStatus | null;
}

/** 목록 조회 계약의 공통 페이지네이션 모양. `GET /hospitals` 등이 이 모양으로 응답한다. */
export interface Paged<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * `GET /admin/hospitals` 응답. `scope` 로 빈 목록 문구를 가른다 —
 * `managed`(담당 병원만, `hospital_admin`)와 `all`(전 병원, `operator`)은 0건의 의미가 다르다.
 */
export interface ManagedHospitalsResponse extends Paged<Hospital> {
  scope: 'managed' | 'all';
}
