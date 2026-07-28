export type ProcedureId =
  | 'implant'
  | 'orthodontics'
  | 'laminate'
  | 'splint'
  | 'snoring-device'
  | 'scaling'
  | 'root-canal';

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
  region: string;
  thumbnail: string;
  images: string[];
  procedureIds: ProcedureId[];
  priceRange: PriceRange;
  rating: number;
  reviewCount: number;
  consultAvailable: boolean;
  tags: string[];
  address: string;
  introduction: string;
  events: string[];
}

export interface Review {
  id: string;
  hospitalId: string;
  procedureId: ProcedureId;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface GuideContent {
  id: string;
  title: string;
  summary: string;
  thumbnail: string;
  procedureId: ProcedureId;
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
