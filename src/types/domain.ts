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
  | 'tmj';

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
  procedureId: ProcedureId;
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

export interface User {
  id: string;
  email: string;
  name: string;
  provider: AuthProvider;
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
