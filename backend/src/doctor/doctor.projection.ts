import type { Prisma } from '@prisma/client';

import { GENERAL_PRACTITIONER, hasSpecialistBadge } from './specialty-badge';

export { GENERAL_PRACTITIONER } from './specialty-badge';

export interface DoctorRow {
  id: string;
  hospitalId: string;
  name: string;
  nameNormalized: string;
  title: string;
  specialty: string;
  /** 실제로 승인받은 전공. `specialty` 와 다르면 배지 자격을 잃는다. */
  verifiedSpecialty: string | null;
  verificationStatus: string;
  certificateUrl: string | null;
  rejectionReason: string | null;
  photo: string;
  rating: number;
  reviewCount: number;
  consultCount: number;
  yearsOfExperience: number;
  isRecommended: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  procedures: { procedureId: string }[];
  careers: { content: string; sortOrder: number }[];
}

export const DOCTOR_INCLUDE = {
  // 시술 노출 순서는 카탈로그(procedures.sort_order)가 정한다 — 사전순이면 화면 칩이
  // 마스터 목록과 어긋난다. procedureId 는 tiebreaker.
  procedures: {
    select: { procedureId: true },
    orderBy: [{ procedure: { sortOrder: 'asc' } }, { procedureId: 'asc' }],
  },
  // sortOrder 에 유니크 제약이 없어 동점이 가능하다 — id tiebreaker 로 결정성을 만든다.
  careers: {
    select: { content: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.DoctorInclude;

/**
 * `전문의` 배지 조건. 판정 자체는 `specialty-badge.ts` 가 단일 출처로 갖는다 —
 * 병원 카드의 `OO전문의 상주`(hospital.projection)와 같은 규칙이어야 하고,
 * 두 곳에 두면 갈린다 (설계 문서 §4.7).
 */
export function isVerifiedSpecialist(row: DoctorRow): boolean {
  return hasSpecialistBadge(row);
}

/**
 * 화면에 표시해도 되는 전공.
 * `일반의` → 항상 그대로. 그 밖 → 배지 자격이 있을 때만, 아니면 null.
 */
export function visibleSpecialty(row: DoctorRow): string | null {
  if (row.specialty === GENERAL_PRACTITIONER) return GENERAL_PRACTITIONER;

  return isVerifiedSpecialist(row) ? row.specialty : null;
}

export interface DoctorPublicResponse {
  id: string;
  name: string;
  title: string;
  hospitalId: string;
  photo: string;
  procedureIds: string[];
  /** 비로그인이면 null. `reviewCount` 는 잠금 대상이 아니다. */
  rating: number | null;
  reviewCount: number;
  consultCount: number;
  /** 표시 가능할 때만 존재한다. 미승인 전공 주장은 응답에 포함되지 않는다. */
  specialty?: string;
  visibleSpecialty: string | null;
  isVerifiedSpecialist: boolean;
  verificationStatus: string;
  isRecommended: boolean;
  yearsOfExperience: number;
  career: string[];
}

export interface DoctorAdminResponse extends Omit<DoctorPublicResponse, 'specialty' | 'rating'> {
  /** 검수 화면은 미승인 전공을 그대로 봐야 판단할 수 있다. 항상 존재한다. */
  specialty: string;
  rating: number;
  certificateUrl: string | null;
  rejectionReason: string | null;
  /** 검수 큐에서만 채운다. */
  hospitalName?: string;
}

function common(row: DoctorRow): Omit<DoctorPublicResponse, 'rating' | 'specialty'> {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    hospitalId: row.hospitalId,
    photo: row.photo,
    procedureIds: row.procedures.map((item) => item.procedureId),
    reviewCount: row.reviewCount,
    consultCount: row.consultCount,
    visibleSpecialty: visibleSpecialty(row),
    isVerifiedSpecialist: isVerifiedSpecialist(row),
    verificationStatus: row.verificationStatus,
    isRecommended: row.isRecommended,
    yearsOfExperience: row.yearsOfExperience,
    career: [...row.careers].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.content),
  };
}

/**
 * 공개 시야. **`certificateUrl` 과 `rejectionReason` 을 읽지 않는다** — 필드를 빼는 것이
 * 아니라 애초에 참조하지 않는다. 플래그 하나로 두 시야를 만들면 언젠가 기본값이 뒤집혀
 * 자격증 URL 이 공개 응답으로 샌다.
 */
export function projectDoctorPublic(
  row: DoctorRow,
  options: { authenticated: boolean }
): DoctorPublicResponse {
  const response: DoctorPublicResponse = {
    ...common(row),
    // 평점 잠금은 클라이언트 표현이 아니라 서버 응답으로 구현한다 (계약 `getDoctor`).
    rating: options.authenticated ? row.rating : null,
  };

  const visible = visibleSpecialty(row);
  if (visible !== null) {
    response.specialty = row.specialty;
  }

  return response;
}

/** 관리자 시야. 담당 병원 관리자와 운영자만 받는다. */
export function projectDoctorAdmin(
  row: DoctorRow,
  options: { hospitalName?: string } = {}
): DoctorAdminResponse {
  const response: DoctorAdminResponse = {
    ...common(row),
    specialty: row.specialty,
    rating: row.rating,
    certificateUrl: row.certificateUrl,
    rejectionReason: row.rejectionReason,
  };

  if (options.hospitalName !== undefined) {
    response.hospitalName = options.hospitalName;
  }

  return response;
}
