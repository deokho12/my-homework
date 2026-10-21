import { describe, expect, it } from 'vitest';

import { selectionToListFilters } from '@/features/procedure/lib/categoryListFilters';

/**
 * 선택 → 서버 파라미터. 이 함수가 곧 "탐색 탭·카테고리 화면이 서버에 무엇을 묻는가" 의
 * 명세다 — 요청 14 로 분야도 서버가 받게 되면서 분기가 셋으로 줄었다.
 */
describe('selectionToListFilters', () => {
  it('추천 탭은 recommended=true', () => {
    expect(selectionToListFilters({ kind: 'recommended' })).toEqual({ recommended: true });
  });

  it('세부 시술을 고르면 procedureId 하나만 간다', () => {
    expect(
      selectionToListFilters({ kind: 'category', categoryId: 'cavity', subProcedureId: 'crown' })
    ).toEqual({ procedureId: 'crown' });
  });

  it('분야 전체는 categoryId 하나만 간다 — 시술 id 로 풀지 않는다', () => {
    expect(selectionToListFilters({ kind: 'category', categoryId: 'cavity', subProcedureId: null })).toEqual({
      categoryId: 'cavity',
    });
  });

  it('준비중 분야·세부도 똑같이 물어본다 (빈 결과는 화면의 빈 상태가 말한다)', () => {
    expect(
      selectionToListFilters({ kind: 'category', categoryId: 'prevention', subProcedureId: null })
    ).toEqual({ categoryId: 'prevention' });
    expect(
      selectionToListFilters({ kind: 'category', categoryId: 'prevention', subProcedureId: 'halitosis' })
    ).toEqual({ procedureId: 'halitosis' });
  });

  it('procedureId 와 categoryId 를 함께 보내지 않는다', () => {
    const filters = selectionToListFilters({
      kind: 'category',
      categoryId: 'cavity',
      subProcedureId: 'crown',
    });

    expect(filters).not.toHaveProperty('categoryId');
    expect(filters).not.toHaveProperty('recommended');
  });
});
