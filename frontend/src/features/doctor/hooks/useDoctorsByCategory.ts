import { useMemo } from 'react';

import type { DoctorFilters } from '@/features/doctor/api/doctorApi';
import { useDoctors } from '@/features/doctor/hooks/useDoctors';
import {
  filterPageByLegacyIds,
  planToListFilters,
  resolveCategoryFilter,
  type CategorySelection,
} from '@/features/procedure/lib/resolveCategoryFilter';
import type { Doctor, Paged } from '@/types/domain';

/** 대분류·세부·추천을 뺀 나머지 필터. 그 셋은 `selection` 이 정한다. */
export type DoctorCategoryBaseFilters = Omit<DoctorFilters, 'procedureId' | 'recommended' | 'pageSize'>;

export interface UseDoctorsByCategoryOptions {
  /** 기본 `true`. 다른 모드가 활성일 때(예: 탐색 화면의 병원 모드) 조회를 걸지 않으려면 `false`. */
  enabled?: boolean;
}

/** `useHospitalsByCategory` 의 `EMPTY_PAGE` 와 같은 이유로 상수다 — 매 렌더 새 객체면 안 된다. */
const EMPTY_PAGE: Paged<Doctor> = {
  items: [],
  meta: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 },
};

/**
 * 대분류/세부 시술로 전문의 목록을 받는다. `useHospitalsByCategory` 와 같은 규칙을 쓴다
 * (`/doctors?procedureId=` 도 값 하나만 받는다) — 판정은 `resolveCategoryFilter` 한 곳에만 있다.
 */
export function useDoctorsByCategory(
  selection: CategorySelection,
  baseFilters: DoctorCategoryBaseFilters,
  options: UseDoctorsByCategoryOptions = {}
) {
  const categoryId = selection.kind === 'category' ? selection.categoryId : null;
  const subProcedureId = selection.kind === 'category' ? selection.subProcedureId : null;

  const plan = useMemo(
    () =>
      categoryId === null
        ? resolveCategoryFilter({ kind: 'recommended' })
        : resolveCategoryFilter({ kind: 'category', categoryId, subProcedureId }),
    [categoryId, subProcedureId]
  );

  const filters: DoctorFilters = { ...baseFilters, ...planToListFilters(plan) };

  const query = useDoctors(filters, { enabled: (options.enabled ?? true) && plan.mode !== 'empty' });

  const data = useMemo(() => {
    if (plan.mode === 'empty') return EMPTY_PAGE;
    if (plan.mode === 'client' && query.data) return filterPageByLegacyIds(query.data, plan.legacyIds);
    return query.data;
  }, [plan, query.data]);

  return {
    ...query,
    data,
    /** 꺼진 쿼리가 로딩으로 보이지 않는다는 보장 (`useHospitalsByCategory` 와 같은 이유). */
    isLoading: plan.mode === 'empty' ? false : query.isLoading,
    plan,
    filters,
  };
}
