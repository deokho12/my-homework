import { hasSpecialistBadge } from '../doctor/specialty-badge';
import { computeSponsorship } from './sponsorship';
import type { SponsorshipState } from './sponsorship';

/**
 * 이 투영이 읽는 Prisma 행의 모양. `HOSPITAL_INCLUDE` 로 조회한 결과와 같다.
 *
 * Prisma 가 만든 타입을 그대로 쓰지 않고 여기서 다시 선언하는 이유: 투영을
 * 순수 함수로 테스트하려면 DB 없이 행을 만들 수 있어야 한다.
 */
export interface HospitalRow {
  id: string;
  name: string;
  nameNormalized: string;
  specialty: string | null;
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  thumbnail: string;
  introduction: string;
  directions: string;
  priceMin: number;
  priceMax: number;
  rating: number;
  reviewCount: number;
  consultCount: number;
  consultAvailable: boolean;
  isOneDay: boolean;
  isRecommended: boolean;
  featureCoordinator: boolean;
  featurePainlessAnesthesia: boolean;
  featureDigitalCare: boolean;
  featureParking: boolean;
  featureNightConsult: boolean;
  featureCctv: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  procedures: { procedureId: string }[];
  images: { url: string; sortOrder: number }[];
  tags: { tag: string; sortOrder: number }[];
  eventNotes: { content: string; sortOrder: number }[];
  /** `day` 라벨 컬럼은 **없다.** DB 는 `dayOfWeek`(1=월 … 7=일)만 저장하고 라벨은 앱이 만든다. */
  businessHours: { dayOfWeek: number; hours: string; isClosed: boolean }[];
  sponsorships: { procedureId: string; rank: number; startDate: string; endDate: string }[];
  /** `representativeSpecialty` 계산에만 쓴다. 전체 전문의 정보가 아니라 판정에 필요한 3필드다. */
  doctors: { specialty: string; verifiedSpecialty: string | null; verificationStatus: string }[];
}

/** `BusinessHour.dayOfWeek` 는 1=월 … 7=일이다 (스키마 주석). 인덱스는 `dayOfWeek - 1`. */
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/**
 * 병원 카드의 `OO전문의 상주` 배지에 쓸 전공.
 *
 * 배지 자격 판정은 `doctor/specialty-badge.ts` 의 `hasSpecialistBadge` 를 그대로 쓴다 —
 * `doctor.projection.ts` 의 전문의 배지와 규칙이 갈리면 카드에는 `치과보철전문의 상주` 가
 * 뜨는데 전문의 목록에는 배지가 없는 상태가 된다.
 */
function representativeSpecialty(doctors: HospitalRow['doctors']): string | null {
  return doctors.find((doctor) => hasSpecialistBadge(doctor))?.specialty ?? null;
}

export interface HospitalResponse {
  id: string;
  name: string;
  specialty: string;
  region: string;
  latitude: number;
  longitude: number;
  thumbnail: string;
  images: string[];
  procedureIds: string[];
  priceRange: { min: number; max: number };
  rating: number;
  reviewCount: number;
  consultCount: number;
  consultAvailable: boolean;
  businessHours: { day: string; hours: string; isClosed: boolean }[];
  directions: string;
  features: {
    coordinator: boolean;
    painlessAnesthesia: boolean;
    digitalCare: boolean;
    parking: boolean;
    nightConsult: boolean;
    cctv: boolean;
  };
  isOneDay: boolean;
  isRecommended: boolean;
  isSponsored: boolean;
  sponsoredCategories: string[];
  sponsoredRank: number | null;
  sponsoredStartDate: string | null;
  sponsoredEndDate: string | null;
  tags: string[];
  address: string;
  introduction: string;
  events: string[];
  sponsorship: SponsorshipState;
  /** 병원 카드의 `OO전문의 상주` 배지. 없으면 null. */
  representativeSpecialty: string | null;
  distanceKm?: number;
}

/** 리포지토리가 쓰는 Prisma include. 투영이 요구하는 관계를 한 곳에 모은다. */
export const HOSPITAL_INCLUDE = {
  procedures: { select: { procedureId: true } },
  images: { select: { url: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
  tags: { select: { tag: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
  eventNotes: { select: { content: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
  businessHours: {
    select: { dayOfWeek: true, hours: true, isClosed: true },
    orderBy: { dayOfWeek: 'asc' },
  },
  sponsorships: { select: { procedureId: true, rank: true, startDate: true, endDate: true } },
  // `representativeSpecialty` 계산용. 삭제된 전문의는 대표가 될 수 없다.
  doctors: {
    where: { deletedAt: null },
    select: { specialty: true, verifiedSpecialty: true, verificationStatus: true },
    orderBy: { id: 'asc' },
  },
} as const;

export interface ProjectHospitalOptions {
  /** `Asia/Seoul` 기준 오늘 (`YYYY-MM-DD`). 광고 기간 판정에 쓴다. */
  today: string;
  /** 지도 반경 조회에서만 채운다. */
  distanceKm?: number;
}

/**
 * DB 행 → 계약 `Hospital`.
 *
 * 광고는 `hospital_sponsorships` 에 **카테고리마다 1행**으로 저장되어 있고, 계약은
 * 그것을 `sponsoredCategories` 배열 + 단일 `sponsoredRank`/기간으로 되돌린다.
 * 한 병원의 광고 행들은 같은 기간·같은 rank 를 공유한다는 전제이며, 시드가 그렇게 넣는다.
 * 여러 행의 값이 갈리면 첫 행을 대표로 쓴다 — 관리 화면에 광고 편집이 없어 갈릴 수 없다.
 *
 * ★ **`isSponsored` 는 원본값이다 — 기간을 반영하지 않는다.**
 *   스키마 주석(`HospitalSponsorship`)은 "오늘이 [startDate, endDate] 안인 행의 존재"로
 *   파생하라고 하고, 계약은 "`sponsoredRank`/`sponsoredStartDate`/`sponsoredEndDate` **원본
 *   필드도 함께 유지한다** (기존 `Hospital` 타입 보존)"고 한다. 두 문서가 갈린다.
 *
 *   **원본 유지를 택한다.** 기간을 반영하면 `isSponsored` 와 `sponsorship.isActive` 가 같은
 *   값이 되어 계산 필드를 따로 둔 의미가 사라지고, 관리자 화면의 `광고 현황 (읽기 전용)`
 *   카드가 "계약은 되어 있으나 기간이 지난" 상태를 표시할 수 없게 된다.
 *   기간 판정이 필요한 곳은 전부 `sponsorship.isActive` 를 쓴다 — 배지도 정렬도 그렇다.
 */
export function projectHospital(row: HospitalRow, options: ProjectHospitalOptions): HospitalResponse {
  const sponsoredCategories = row.sponsorships.map((item) => item.procedureId);
  const lead = row.sponsorships[0] ?? null;
  const isSponsored = row.sponsorships.length > 0;

  const response: HospitalResponse = {
    id: row.id,
    name: row.name,
    // 계약은 `specialty` 를 필수 문자열로 둔다. DB 는 nullable 이므로 빈 문자열로 메운다.
    specialty: row.specialty ?? '',
    region: row.region,
    latitude: row.latitude,
    longitude: row.longitude,
    thumbnail: row.thumbnail,
    images: row.images.map((item) => item.url),
    procedureIds: row.procedures.map((item) => item.procedureId),
    priceRange: { min: row.priceMin, max: row.priceMax },
    rating: row.rating,
    reviewCount: row.reviewCount,
    consultCount: row.consultCount,
    consultAvailable: row.consultAvailable,
    businessHours: row.businessHours.map((item) => ({
      day: DAY_LABELS[item.dayOfWeek - 1] ?? '',
      hours: item.hours,
      isClosed: item.isClosed,
    })),
    directions: row.directions,
    features: {
      coordinator: row.featureCoordinator,
      painlessAnesthesia: row.featurePainlessAnesthesia,
      digitalCare: row.featureDigitalCare,
      parking: row.featureParking,
      nightConsult: row.featureNightConsult,
      cctv: row.featureCctv,
    },
    isOneDay: row.isOneDay,
    isRecommended: row.isRecommended,
    isSponsored,
    sponsoredCategories,
    sponsoredRank: lead?.rank ?? null,
    sponsoredStartDate: lead?.startDate ?? null,
    sponsoredEndDate: lead?.endDate ?? null,
    tags: row.tags.map((item) => item.tag),
    address: row.address,
    introduction: row.introduction,
    events: row.eventNotes.map((item) => item.content),
    representativeSpecialty: representativeSpecialty(row.doctors),
    sponsorship: computeSponsorship(
      { isSponsored, sponsoredCategories, startDate: lead?.startDate ?? null, endDate: lead?.endDate ?? null, rating: row.rating },
      { today: options.today }
    ),
  };

  if (options.distanceKm !== undefined) {
    response.distanceKm = options.distanceKm;
  }

  return response;
}
