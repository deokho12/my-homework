import { describe, expect, it } from 'vitest';

import { CATEGORY_IDS } from '@/features/procedure/taxonomy';
import { DENTAL_SPECIALTIES } from '@/types/domain';
import { CATEGORY_SPECIALTIES, isSpecialtyForCategory } from '@/utils/specialty';

describe('CATEGORY_SPECIALTIES', () => {
  it('키가 대분류 9개와 정확히 같다', () => {
    expect(new Set(Object.keys(CATEGORY_SPECIALTIES))).toEqual(new Set(CATEGORY_IDS));
  });

  it('모든 대분류가 전공을 최소 하나 가지고, 전부 실재하는 전공이다', () => {
    for (const categoryId of CATEGORY_IDS) {
      const specialties = CATEGORY_SPECIALTIES[categoryId];
      expect(specialties.length).toBeGreaterThanOrEqual(1);
      for (const specialty of specialties) {
        expect(DENTAL_SPECIALTIES).toContain(specialty);
      }
    }
  });
});

describe('isSpecialtyForCategory', () => {
  it('충치치료는 보철과 통합치의학 둘 다 인정한다', () => {
    // 대분류 하나에 보철(크라운·인레이)과 보존(레진·신경치료)이 함께 들어가서 복수다.
    expect(isSpecialtyForCategory('cavity', '통합치의학과전문의')).toBe(true);
    expect(isSpecialtyForCategory('cavity', '치과보철전문의')).toBe(true);
  });

  it('임플란트는 구강악안면외과만 인정한다', () => {
    expect(isSpecialtyForCategory('implant', '치과보철전문의')).toBe(false);
    expect(isSpecialtyForCategory('implant', '구강악안면외과전문의')).toBe(true);
  });

  it('일반의는 어느 대분류에서도 강조되지 않는다', () => {
    for (const categoryId of CATEGORY_IDS) {
      expect(isSpecialtyForCategory(categoryId, '일반의')).toBe(false);
    }
  });
});
