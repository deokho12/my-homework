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
  tags: string[];
  address: string;
  introduction: string;
  events: string[];
}

export interface Doctor {
  id: string;
  name: string;
  title: string;
  specialty: string;
  hospitalId: string;
  photo: string;
  procedureIds: ProcedureId[];
  rating: number;
  reviewCount: number;
  consultCount: number;
  isCertified: boolean;
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

export interface ConsultRequest {
  id: string;
  hospitalId: string;
  procedureId: ProcedureId | null;
  name: string;
  phone: string;
  preferredTime: string;
  message: string;
  createdAt: string;
}
