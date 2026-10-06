import { useMemo } from 'react';

import type { HospitalFilters } from '@/features/hospital/api/hospitalApi';
import { useHospitals } from '@/features/hospital/hooks/useHospitals';
import {
  filterPageByLegacyIds,
  planToListFilters,
  resolveCategoryFilter,
  type CategorySelection,
} from '@/features/procedure/lib/resolveCategoryFilter';
import type { Hospital, Paged } from '@/types/domain';

/** 대분류·세부·추천을 뺀 나머지 필터. 그 셋은 `selection` 이 정한다. */
export type HospitalCategoryBaseFilters = Omit<HospitalFilters, 'procedureId' | 'recommended' | 'pageSize'>;

export interface UseHospitalsByCategoryOptions {
  /** 기본 `true`. 다른 모드가 활성일 때(예: 탐색 화면의 의사 모드) 조회를 걸지 않으려면 `false`. */
  enabled?: boolean;
}

/**
 * `mode: 'empty'` 일 때 내려주는 상수. 매번 새 객체를 만들면 소비자의 `useMemo`·
 * `useEffect` 가 영원히 다시 돈다. `pageSize: 0` 은 "페이지를 요청한 적이 없다"는 뜻이다.
 */
const EMPTY_PAGE: Paged<Hospital> = {
  items: [],
  meta: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 },
};

/**
 * 대분류/세부 시술로 병원 목록을 받는다. 탐색 화면과 카테고리 화면이 **같은 훅**을 쓴다.
 *
 * `useHospitals` 를 감싸기만 하므로 새 queryKey 가 생기지 않는다 — 같은 필터면 두 화면이
 * 같은 캐시를 공유한다. 요청을 보낼지, 서버로 거를지, 받아서 거를지는 전부
 * `resolveCategoryFilter`(순수 함수)가 정한다.
 */
export function useHospitalsByCategory(
  selection: CategorySelection,
  baseFilters: HospitalCategoryBaseFilters,
  options: UseHospitalsByCategoryOptions = {}
) {
  // selection 객체는 호출부가 매 렌더 새로 만든다 — 식별자가 아니라 값으로 memo 한다.
  const categoryId = selection.kind === 'category' ? selection.categoryId : null;
  const subProcedureId = selection.kind === 'category' ? selection.subProcedureId : null;

  const plan = useMemo(
    () =>
      categoryId === null
        ? resolveCategoryFilter({ kind: 'recommended' })
        : resolveCategoryFilter({ kind: 'category', categoryId, subProcedureId }),
    [categoryId, subProcedureId]
  );

  const filters: HospitalFilters = { ...baseFilters, ...planToListFilters(plan) };

  // `empty` 면 요청 자체를 보내지 않는다 — 서버가 아는 시술이 없는 선택이라
  // 어떤 파라미터를 보내도 "전체 목록"이 와서 고른 것과 다른 결과가 된다.
  const query = useHospitals(filters, { enabled: (options.enabled ?? true) && plan.mode !== 'empty' });

  const data = useMemo(() => {
    if (plan.mode === 'empty') return EMPTY_PAGE;
    if (plan.mode === 'client' && query.data) return filterPageByLegacyIds(query.data, plan.legacyIds);
    return query.data;
  }, [plan, query.data]);

  return {
    ...query,
    data,
    /**
     * 꺼진 쿼리는 `isPending: true` 로 남는다(TanStack v5: "데이터가 아직 없음"). 화면이
     * 보는 건 `isLoading` 이고 `isLoading === isPending && isFetching` 이라 이미 false 지만,
     * 빈 모드가 로딩으로 보이지 않는다는 보장을 여기서 명시적으로 고정한다.
     */
    isLoading: plan.mode === 'empty' ? false : query.isLoading,
    plan,
    filters,
  };
}
