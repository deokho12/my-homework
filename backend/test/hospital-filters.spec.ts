import { describe, expect, it } from 'vitest';

import { buildDoctorWhere } from '../src/doctor/doctor.filters';
import type { ListDoctorsQuery } from '../src/doctor/doctor.schemas';
import { buildHospitalWhere, orderHospitals } from '../src/hospital/hospital.filters';
import type { HospitalResponse } from '../src/hospital/hospital.projection';
import type { ListHospitalsQuery } from '../src/hospital/hospital.schemas';
import { publicHospitalWhere } from '../src/hospital/public-visibility';

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

/**
 * 분야·세부 시술 필터 (2026-10-21 요청 14 — docs/api/README.md §22.6).
 *
 * `where` 의 모양을 직접 본다. 결과 개수는 `hospital-list.e2e.spec.ts` 가 실제 DB 로
 * 고정하고, 여기서는 **AND 결합이 정말 둘 다 건다**는 것을 고정한다.
 */
describe('buildHospitalWhere', () => {
  const query = (overrides: Partial<ListHospitalsQuery> = {}): ListHospitalsQuery =>
    ({ page: 1, pageSize: 20, sort: 'rating', ...overrides }) as ListHospitalsQuery;

  it('공개 조건은 publicHospitalWhere() 에서 온다 — 가용성 집계와 같은 함수다', () => {
    expect(buildHospitalWhere(query())).toMatchObject(publicHospitalWhere());
  });

  it('categoryId 는 분야 조인으로 거른다', () => {
    expect(buildHospitalWhere(query({ categoryId: 'prevention' })).AND).toEqual([
      { procedures: { some: { procedure: { categoryId: 'prevention' } } } },
    ]);
  });

  it('procedureId 하나면 요청 14 이전과 같은 조건이다 (회귀)', () => {
    expect(buildHospitalWhere(query({ procedureId: 'scaling' })).AND).toEqual([
      { procedures: { some: { procedureId: 'scaling' } } },
    ]);
  });

  it('둘 다 오면 AND 다 — 한쪽을 조용히 버리지 않는다', () => {
    expect(buildHospitalWhere(query({ categoryId: 'implant', procedureId: 'bone-graft' })).AND).toEqual([
      { procedures: { some: { procedure: { categoryId: 'implant' } } } },
      { procedures: { some: { procedureId: 'bone-graft' } } },
    ]);
  });

  it('시술 조건이 없으면 AND 를 만들지 않는다', () => {
    expect(buildHospitalWhere(query()).AND).toBeUndefined();
  });
});

describe('buildDoctorWhere', () => {
  const query = (overrides: Partial<ListDoctorsQuery> = {}): ListDoctorsQuery =>
    ({ page: 1, pageSize: 20, sort: 'yearsOfExperience', ...overrides }) as ListDoctorsQuery;

  it('categoryId·procedureId 를 병원 목록과 같은 규칙으로 건다', () => {
    expect(buildDoctorWhere(query({ categoryId: 'gum', procedureId: 'gum-treatment' })).AND).toEqual([
      { procedures: { some: { procedure: { categoryId: 'gum' } } } },
      { procedures: { some: { procedureId: 'gum-treatment' } } },
    ]);
  });

  it('시술 조건이 없으면 AND 를 만들지 않는다', () => {
    expect(buildDoctorWhere(query()).AND).toBeUndefined();
  });

  it('소속 병원 조건은 publicHospitalWhere() 에서 온다 — 병원 목록과 같은 함수다', () => {
    expect(buildDoctorWhere(query()).hospital).toEqual({ is: publicHospitalWhere() });
  });

  it('병원 속성 필터는 공개 조건을 대체하지 않고 덧붙인다', () => {
    expect(buildDoctorWhere(query({ oneDay: true, nightConsult: true })).hospital).toEqual({
      is: { ...publicHospitalWhere(), isOneDay: true, featureNightConsult: true },
    });
  });
});
