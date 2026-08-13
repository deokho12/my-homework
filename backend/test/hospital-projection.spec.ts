import { describe, expect, it } from 'vitest';

import { projectHospital } from '../src/hospital/hospital.projection';
import type { HospitalRow } from '../src/hospital/hospital.projection';

/** 최소 행. 각 테스트가 필요한 부분만 덮어쓴다. */
function row(overrides: Partial<HospitalRow> = {}): HospitalRow {
  return {
    id: 'h1',
    name: '강남 스마일 치과',
    nameNormalized: '강남 스마일 치과',
    specialty: '임플란트 전문의원',
    region: '서울 강남구',
    address: '서울 강남구 테헤란로 1',
    latitude: 37.5,
    longitude: 127.03,
    thumbnail: 'https://example.test/thumb.jpg',
    introduction: '소개',
    directions: '2번 출구',
    priceMin: 500000,
    priceMax: 1500000,
    rating: 4.8,
    reviewCount: 312,
    consultCount: 90,
    consultAvailable: true,
    isOneDay: true,
    isRecommended: false,
    featureCoordinator: true,
    featurePainlessAnesthesia: false,
    featureDigitalCare: true,
    featureParking: true,
    featureNightConsult: false,
    featureCctv: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    procedures: [{ procedureId: 'implant' }, { procedureId: 'crown' }],
    images: [{ url: 'https://example.test/1.jpg', sortOrder: 0 }],
    tags: [{ tag: '야간진료', sortOrder: 0 }],
    eventNotes: [{ content: '첫 상담 무료', sortOrder: 0 }],
    businessHours: [{ dayOfWeek: 1, hours: '10:00 - 19:00', isClosed: false }],
    sponsorships: [],
    doctors: [],
    ...overrides,
  } as HospitalRow;
}

describe('projectHospital', () => {
  const today = '2026-08-13';

  it('두 컬럼을 priceRange 객체로 되돌린다', () => {
    expect(projectHospital(row(), { today }).priceRange).toEqual({ min: 500000, max: 1500000 });
  });

  it('feature 컬럼 6개를 features 객체로 되돌린다', () => {
    expect(projectHospital(row(), { today }).features).toEqual({
      coordinator: true,
      painlessAnesthesia: false,
      digitalCare: true,
      parking: true,
      nightConsult: false,
      cctv: true,
    });
  });

  it('조인 테이블을 배열 필드로 되돌린다', () => {
    const result = projectHospital(row(), { today });

    expect(result.procedureIds).toEqual(['implant', 'crown']);
    expect(result.images).toEqual(['https://example.test/1.jpg']);
    expect(result.tags).toEqual(['야간진료']);
    expect(result.events).toEqual(['첫 상담 무료']);
    expect(result.businessHours).toEqual([{ day: '월', hours: '10:00 - 19:00', isClosed: false }]);
  });

  it('dayOfWeek 정수를 요일 라벨로 바꾼다 (1=월 … 7=일)', () => {
    const result = projectHospital(
      row({
        businessHours: [
          { dayOfWeek: 6, hours: '10:00 - 14:00', isClosed: false },
          { dayOfWeek: 7, hours: '휴무', isClosed: true },
        ],
      }),
      { today }
    );

    expect(result.businessHours.map((item) => item.day)).toEqual(['토', '일']);
  });

  it('광고가 없으면 isSponsored 는 false 이고 기간 필드는 null 이다', () => {
    const result = projectHospital(row(), { today });

    expect(result.isSponsored).toBe(false);
    expect(result.sponsoredCategories).toEqual([]);
    expect(result.sponsoredRank).toBeNull();
    expect(result.sponsoredStartDate).toBeNull();
    expect(result.sponsoredEndDate).toBeNull();
    expect(result.sponsorship).toEqual({ isActive: false, isPlacementEligible: false });
  });

  it('광고 행을 카테고리 배열과 기간으로 합친다', () => {
    const result = projectHospital(
      row({
        sponsorships: [
          { procedureId: 'implant', rank: 1, startDate: '2026-07-01', endDate: '2026-09-30' },
          { procedureId: 'crown', rank: 1, startDate: '2026-07-01', endDate: '2026-09-30' },
        ],
      }),
      { today }
    );

    expect(result.isSponsored).toBe(true);
    expect(result.sponsoredCategories).toEqual(['implant', 'crown']);
    expect(result.sponsoredRank).toBe(1);
    expect(result.sponsoredStartDate).toBe('2026-07-01');
    expect(result.sponsoredEndDate).toBe('2026-09-30');
  });

  it('distanceKm 는 인자로 받은 값을 그대로 싣고, 없으면 필드가 없다', () => {
    expect(projectHospital(row(), { today, distanceKm: 1.234 }).distanceKm).toBe(1.234);
    expect(projectHospital(row(), { today }).distanceKm).toBeUndefined();
  });

  it('배지 자격이 있는 첫 전문의의 전공을 representativeSpecialty 로 준다', () => {
    const result = projectHospital(
      row({
        doctors: [
          // 미승인 — 대표가 될 수 없다
          { specialty: '치과교정전문의', verifiedSpecialty: null, verificationStatus: 'pending' },
          { specialty: '치과보철전문의', verifiedSpecialty: '치과보철전문의', verificationStatus: 'approved' },
        ],
      }),
      { today }
    );

    expect(result.representativeSpecialty).toBe('치과보철전문의');
  });

  it('일반의만 있으면 representativeSpecialty 는 null 이다', () => {
    const result = projectHospital(
      row({ doctors: [{ specialty: '일반의', verifiedSpecialty: null, verificationStatus: 'approved' }] }),
      { today }
    );

    expect(result.representativeSpecialty).toBeNull();
  });

  it('승인 후 전공이 바뀐 전문의는 대표가 되지 않는다', () => {
    const result = projectHospital(
      row({
        doctors: [
          { specialty: '치과교정전문의', verifiedSpecialty: '치과보철전문의', verificationStatus: 'approved' },
        ],
      }),
      { today }
    );

    expect(result.representativeSpecialty).toBeNull();
  });
});
