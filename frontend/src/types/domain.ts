export type ProcedureId =
  | 'implant'
  | 'orthodontics'
  | 'laminate'
  | 'inlay'
  | 'crown'
  | 'whitening'
  | 'wisdom-tooth'
  | 'cavity'
  | 'gum-disease'
  | 'splint'
  | 'snoring-device'
  | 'tmj'
  | 'botox';

export interface Procedure {
  id: ProcedureId;
  name: string;
  emoji: string;
  shortDescription: string;
  description: string;
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
  /** Paid placement. Category-scoped, ranked, and time-boxed — see src/utils/sponsorship.ts for the active-window/eligibility rules. */
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
   * `src/utils/sponsorship.ts`(클라이언트 계산)는 아직 목을 쓰는 관리자 화면에만 남아 있다.
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

export type ConsultStatus = 'new' | 'contacted' | 'booked' | 'cancelled';

export const CONSULT_STATUSES: ConsultStatus[] = ['new', 'contacted', 'booked', 'cancelled'];

export const CONSULT_STATUS_LABEL: Record<ConsultStatus, string> = {
  new: '신규',
  contacted: '연락중',
  booked: '예약완료',
  cancelled: '취소',
};

export interface ConsultStatusChange {
  status: ConsultStatus;
  changedAt: string;
}

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
  preferredTime: string;
  message: string;
  createdAt: string;
  status: ConsultStatus;
  statusHistory: ConsultStatusChange[];
  memos: ConsultMemo[];
}

/** Address search result from geocoding — see src/services/geocoding.ts. */
export interface GeocodeResult {
  id: string;
  addressName: string;
  roadAddressName?: string;
  latitude: number;
  longitude: number;
}

export type NotificationType = 'consult-status' | 'event' | 'system';
export type NotificationAudience = 'user' | 'admin';

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
