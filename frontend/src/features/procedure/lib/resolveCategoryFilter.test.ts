import { describe, expect, it } from 'vitest';

import {
  filterPageByLegacyIds,
  planToListFilters,
  resolveCategoryFilter,
} from '@/features/procedure/lib/resolveCategoryFilter';
import type { Paged, ProcedureId } from '@/types/domain';

describe('resolveCategoryFilter', () => {
  it('추천', () => {
    expect(resolveCategoryFilter({ kind: 'recommended' })).toEqual({ mode: 'recommended' });
  });

  it('서버 id 가 하나뿐인 대분류는 서버 필터', () => {
    expect(
      resolveCategoryFilter({ kind: 'category', categoryId: 'gum', subProcedureId: null })
    ).toEqual({ mode: 'server', procedureId: 'gum-disease' });
    expect(
      resolveCategoryFilter({ kind: 'category', categoryId: 'implant', subProcedureId: null })
    ).toEqual({ mode: 'server', procedureId: 'implant' });
  });

  it('서버 id 가 둘 이상인 대분류는 클라이언트 필터', () => {
    const plan = resolveCategoryFilter({ kind: 'category', categoryId: 'cavity', subProcedureId: null });
    expect(plan.mode).toBe('client');
    if (plan.mode !== 'client') throw new Error('unreachable');
    expect([...plan.legacyIds]).toEqual(['cavity', 'inlay', 'crown']);
  });

  it('서버 id 가 하나도 없는 대분류는 요청하지 않는다', () => {
    expect(
      resolveCategoryFilter({ kind: 'category', categoryId: 'prevention', subProcedureId: null })
    ).toEqual({ mode: 'empty' });
  });

  it('세부 시술: 서버 id 가 있으면 서버 필터', () => {
    expect(
      resolveCategoryFilter({ kind: 'category', categoryId: 'cavity', subProcedureId: 'crown' })
    ).toEqual({ mode: 'server', procedureId: 'crown' });
  });

  it('세부 시술: 준비중이면 요청하지 않는다', () => {
    expect(
      resolveCategoryFilter({ kind: 'category', categoryId: 'cavity', subProcedureId: 'root-canal' })
    ).toEqual({ mode: 'empty' });
  });
});

describe('planToListFilters', () => {
  it('방식별로 보내는 파라미터가 다르다', () => {
    expect(planToListFilters({ mode: 'recommended' })).toEqual({ recommended: true });
    expect(planToListFilters({ mode: 'server', procedureId: 'crown' })).toEqual({ procedureId: 'crown' });
    expect(planToListFilters({ mode: 'client', legacyIds: new Set(['cavity']) })).toEqual({ pageSize: 100 });
    expect(planToListFilters({ mode: 'empty' })).toEqual({});
  });
});

describe('filterPageByLegacyIds', () => {
  function paged(items: { id: string; procedureIds: ProcedureId[] }[]): Paged<{
    id: string;
    procedureIds: ProcedureId[];
  }> {
    return { items, meta: { page: 1, pageSize: 100, totalItems: items.length, totalPages: 1 } };
  }

  it('교집합이 있는 항목만 남기고 meta 를 다시 센다', () => {
    const page = paged([
      { id: 'h1', procedureIds: ['implant'] },
      { id: 'h2', procedureIds: ['crown'] },
      { id: 'h3', procedureIds: ['cavity', 'gum-disease'] },
    ]);

    const filtered = filterPageByLegacyIds(page, new Set<ProcedureId>(['cavity', 'inlay', 'crown']));

    expect(filtered.items.map((h) => h.id)).toEqual(['h2', 'h3']);
    // 서버가 준 totalItems(3)를 그대로 두면 화면이 "총 3곳"이라 말하고 2장만 그린다.
    expect(filtered.meta.totalItems).toBe(2);
    expect(filtered.meta.totalPages).toBe(1);
  });

  it('하나도 안 남으면 totalPages 는 0', () => {
    const filtered = filterPageByLegacyIds(paged([{ id: 'h1', procedureIds: ['implant'] }]), new Set(['crown']));
    expect(filtered.items).toEqual([]);
    expect(filtered.meta.totalItems).toBe(0);
    expect(filtered.meta.totalPages).toBe(0);
  });

  it('원본 페이지를 변경하지 않는다', () => {
    const page = paged([{ id: 'h1', procedureIds: ['implant'] }]);
    filterPageByLegacyIds(page, new Set(['crown']));
    expect(page.items).toHaveLength(1);
    expect(page.meta.totalItems).toBe(1);
  });
});
