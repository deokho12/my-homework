import { describe, expect, it } from 'vitest';

import { mapHospitalFieldErrors } from '@/features/hospital/lib/hospitalFieldErrors';

describe('mapHospitalFieldErrors', () => {
  it('정확히 일치하는 필드를 매핑한다', () => {
    const result = mapHospitalFieldErrors([
      { field: 'isRecommended', code: 'not_writable', message: '수정할 수 없는 항목이에요' },
    ]);

    expect(result.isRecommended).toBe('수정할 수 없는 항목이에요');
  });

  it('점 표기 하위 경로는 상위 필드에 묶인다', () => {
    const result = mapHospitalFieldErrors([
      { field: 'priceRange.min', code: 'NOT_A_NUMBER', message: '숫자만 입력해주세요' },
    ]);

    expect(result.priceRange).toBe('숫자만 입력해주세요');
  });

  it('알려진 필드가 아니면 아무 칸에도 붙이지 않는다', () => {
    const result = mapHospitalFieldErrors([{ field: 'doctors[0].name', code: 'too_small', message: '이름을 입력해주세요' }]);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('details 가 없으면 빈 객체를 돌려준다', () => {
    expect(mapHospitalFieldErrors(undefined)).toEqual({});
  });
});
