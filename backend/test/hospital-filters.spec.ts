import { describe, expect, it } from 'vitest';

import { orderHospitals } from '../src/hospital/hospital.filters';
import type { HospitalResponse } from '../src/hospital/hospital.projection';

function hospital(overrides: Partial<HospitalResponse>): HospitalResponse {
  return {
    id: 'h1',
    rating: 4,
    reviewCount: 10,
    consultCount: 5,
    sponsoredRank: null,
    sponsorship: { isActive: false, isPlacementEligible: false },
    ...overrides,
  } as HospitalResponse;
}

describe('orderHospitals', () => {
  it('기본은 평점 내림차순이다', () => {
    const result = orderHospitals(
      [hospital({ id: 'a', rating: 4.1 }), hospital({ id: 'b', rating: 4.9 })],
      { sort: 'rating', sponsoredFirst: false }
    );

    expect(result.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('동점이면 id 오름차순으로 안정 정렬한다', () => {
    const result = orderHospitals(
      [hospital({ id: 'h3', rating: 4.5 }), hospital({ id: 'h1', rating: 4.5 }), hospital({ id: 'h2', rating: 4.5 })],
      { sort: 'rating', sponsoredFirst: false }
    );

    expect(result.map((item) => item.id)).toEqual(['h1', 'h2', 'h3']);
  });

  it('reviewCount·consultCount 정렬을 지원한다', () => {
    const items = [
      hospital({ id: 'a', reviewCount: 5, consultCount: 90 }),
      hospital({ id: 'b', reviewCount: 50, consultCount: 1 }),
    ];

    expect(orderHospitals(items, { sort: 'reviewCount', sponsoredFirst: false })[0].id).toBe('b');
    expect(orderHospitals(items, { sort: 'consultCount', sponsoredFirst: false })[0].id).toBe('a');
  });

  it('자격 있는 광고를 sponsoredRank 오름차순으로 맨 앞에 놓는다', () => {
    const result = orderHospitals(
      [
        hospital({ id: 'plain', rating: 5.0 }),
        hospital({
          id: 'ad2',
          rating: 3.6,
          sponsoredRank: 2,
          sponsorship: { isActive: true, isPlacementEligible: true },
        }),
        hospital({
          id: 'ad1',
          rating: 3.6,
          sponsoredRank: 1,
          sponsorship: { isActive: true, isPlacementEligible: true },
        }),
      ],
      { sort: 'rating', sponsoredFirst: true }
    );

    expect(result.map((item) => item.id)).toEqual(['ad1', 'ad2', 'plain']);
  });

  it('자격이 없는 광고는 당겨지지 않는다', () => {
    const result = orderHospitals(
      [
        hospital({ id: 'plain', rating: 5.0 }),
        hospital({
          id: 'ad',
          rating: 3.4,
          sponsoredRank: 1,
          sponsorship: { isActive: true, isPlacementEligible: false },
        }),
      ],
      { sort: 'rating', sponsoredFirst: true }
    );

    expect(result.map((item) => item.id)).toEqual(['plain', 'ad']);
  });

  it('필터가 없으면(sponsoredFirst=false) 광고를 당기지 않는다 — 계약 규칙 4', () => {
    const result = orderHospitals(
      [
        hospital({ id: 'plain', rating: 5.0 }),
        hospital({
          id: 'ad',
          rating: 4.9,
          sponsoredRank: 1,
          sponsorship: { isActive: true, isPlacementEligible: true },
        }),
      ],
      { sort: 'rating', sponsoredFirst: false }
    );

    expect(result.map((item) => item.id)).toEqual(['plain', 'ad']);
  });
});
