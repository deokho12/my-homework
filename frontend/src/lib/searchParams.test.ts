import { describe, expect, it } from 'vitest';

import { toSearchParams } from '@/lib/searchParams';

describe('toSearchParams', () => {
  it('값이 있는 필터를 쿼리 문자열로 만든다', () => {
    expect(toSearchParams({ procedureId: 'implant', sort: 'reviewCount' })).toBe(
      '?procedureId=implant&sort=reviewCount'
    );
  });

  it('boolean 값도 그대로 옮긴다 — false 는 "지정 안 함" 과 다르다', () => {
    expect(toSearchParams({ consultAvailable: false })).toBe('?consultAvailable=false');
  });

  it('undefined 인 필터는 보내지 않는다', () => {
    const query = toSearchParams({ procedureId: undefined, consultAvailable: true });
    expect(query).not.toContain('procedureId');
    expect(query).toBe('?consultAvailable=true');
  });

  it('null 인 필터도 보내지 않는다', () => {
    expect(toSearchParams({ q: null })).toBe('');
  });

  it('빈 문자열 필터도 보내지 않는다', () => {
    expect(toSearchParams({ q: '' })).toBe('');
  });

  it('필터가 전부 비면 빈 문자열을 돌려준다 (물음표조차 없다)', () => {
    expect(toSearchParams({})).toBe('');
    expect(toSearchParams({ a: undefined, b: null })).toBe('');
  });

  it('배열은 같은 이름을 반복해 적는다 — 계약의 반복 파라미터', () => {
    expect(toSearchParams({ status: ['new', 'contacted'] })).toBe('?status=new&status=contacted');
  });

  it('빈 배열은 보내지 않는다 ("지정 안 함" 과 같다)', () => {
    expect(toSearchParams({ procedureId: [] })).toBe('');
  });

  it('배열과 단일 값이 섞여도 순서대로 이어 붙인다', () => {
    expect(toSearchParams({ page: 2, status: ['new'] })).toBe('?page=2&status=new');
  });

  it('숫자 필터도 문자열로 직렬화한다', () => {
    expect(toSearchParams({ minDoctorYearsOfExperience: 10, radiusKm: 0.5 })).toBe(
      '?minDoctorYearsOfExperience=10&radiusKm=0.5'
    );
  });
});
