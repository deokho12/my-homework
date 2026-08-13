import { describe, expect, it } from 'vitest';

import { computeSponsorship, seoulToday } from '../src/hospital/sponsorship';
import type { SponsorshipInput } from '../src/hospital/sponsorship';

function input(overrides: Partial<SponsorshipInput> = {}): SponsorshipInput {
  return {
    isSponsored: true,
    sponsoredCategories: ['implant'],
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    rating: 4.5,
    ...overrides,
  };
}

describe('computeSponsorship', () => {
  it('기간 안이면 isActive 다', () => {
    expect(computeSponsorship(input(), { today: '2026-08-13' }).isActive).toBe(true);
  });

  it('시작일·종료일 당일도 포함이다', () => {
    expect(computeSponsorship(input(), { today: '2026-07-01' }).isActive).toBe(true);
    expect(computeSponsorship(input(), { today: '2026-09-30' }).isActive).toBe(true);
  });

  it('기간 밖이면 isActive 가 아니다', () => {
    expect(computeSponsorship(input(), { today: '2026-06-30' }).isActive).toBe(false);
    expect(computeSponsorship(input(), { today: '2026-10-01' }).isActive).toBe(false);
  });

  it('광고 계약이 없으면 기간과 무관하게 false 다', () => {
    const result = computeSponsorship(
      input({ isSponsored: false, startDate: null, endDate: null }),
      { today: '2026-08-13' }
    );

    expect(result).toEqual({ isActive: false, isPlacementEligible: false });
  });

  it('평점 3.5 미만은 상단 노출 자격이 없다 — 배지는 유지된다', () => {
    const result = computeSponsorship(input({ rating: 3.4 }), {
      today: '2026-08-13',
      procedureId: 'implant',
    });

    expect(result.isActive).toBe(true);
    expect(result.isPlacementEligible).toBe(false);
  });

  it('평점 3.5 정확히는 자격이 있다 (경계 포함)', () => {
    const result = computeSponsorship(input({ rating: 3.5 }), {
      today: '2026-08-13',
      procedureId: 'implant',
    });

    expect(result.isPlacementEligible).toBe(true);
  });

  it('지정한 시술이 광고 카테고리에 없으면 자격이 없다', () => {
    const result = computeSponsorship(input(), { today: '2026-08-13', procedureId: 'orthodontics' });

    expect(result.isPlacementEligible).toBe(false);
  });

  it('procedureId 를 지정하지 않으면(추천 탭) 카테고리를 보지 않는다', () => {
    const result = computeSponsorship(input(), { today: '2026-08-13' });

    expect(result.isPlacementEligible).toBe(true);
  });
});

describe('seoulToday', () => {
  it('UTC 자정 직후를 서울 기준 같은 날로 본다', () => {
    // 2026-08-13T00:30Z = 서울 09:30 같은 날
    expect(seoulToday(new Date('2026-08-13T00:30:00.000Z'))).toBe('2026-08-13');
  });

  it('UTC 로 전날 늦은 시각이 서울에서는 다음 날이다', () => {
    // 2026-08-12T15:30Z = 서울 2026-08-13 00:30
    expect(seoulToday(new Date('2026-08-12T15:30:00.000Z'))).toBe('2026-08-13');
  });
});
