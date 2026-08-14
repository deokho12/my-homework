import type { Hospital } from '@/types/domain';

/**
 * 여러 테스트 파일이 `fetchHospitalById`/`fetchHospitals` HTTP 응답을 스텁하는 데 쓰던
 * 동일한 `baseHospital` 정의를 한 곳으로 모았다 (Task 20 코드 리뷰 fix round 1, item 4).
 * 각 테스트는 여전히 `overrides` 로 자기만의 값을 얹는다 — 공유되는 건 "서버 계산 필드까지
 * 채운 완전한 `Hospital` 스텁" 하나뿐이다.
 */
export function baseHospital(overrides: Partial<Hospital> = {}): Hospital {
  return {
    id: 'h1',
    name: '강남 스마일 치과',
    specialty: '임플란트 전문의원',
    region: '서울 강남구',
    latitude: 37.5006,
    longitude: 127.0364,
    thumbnail: 'https://example.com/thumb.jpg',
    images: [],
    procedureIds: ['implant'],
    priceRange: { min: 900000, max: 1800000 },
    rating: 4.8,
    reviewCount: 312,
    consultCount: 128,
    consultAvailable: true,
    businessHours: [],
    directions: '',
    features: {
      coordinator: true,
      painlessAnesthesia: true,
      digitalCare: true,
      parking: true,
      nightConsult: true,
      cctv: false,
    },
    isOneDay: true,
    isRecommended: true,
    isSponsored: false,
    sponsoredCategories: [],
    sponsoredRank: null,
    sponsoredStartDate: null,
    sponsoredEndDate: null,
    tags: [],
    address: '서울특별시 강남구 테헤란로 123',
    introduction: '',
    events: [],
    sponsorship: { isActive: false, isPlacementEligible: false },
    representativeSpecialty: null,
    ...overrides,
  };
}
