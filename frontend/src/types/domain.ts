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
  specialty: DentalSpecialty;
  hospitalId: string;
  photo: string;
  procedureIds: ProcedureId[];
  rating: number;
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
