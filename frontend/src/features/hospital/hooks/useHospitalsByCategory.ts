import type { HospitalFilters } from '@/features/hospital/api/hospitalApi';
import { useHospitals } from '@/features/hospital/hooks/useHospitals';
import {
  selectionToListFilters,
  type CategorySelection,
} from '@/features/procedure/lib/categoryListFilters';

/** 분야·세부·추천을 뺀 나머지 필터. 그 셋은 `selection` 이 정한다. */
export type HospitalCategoryBaseFilters = Omit<
  HospitalFilters,
  'procedureId' | 'categoryId' | 'recommended'
>;

export interface UseHospitalsByCategoryOptions {
  /** 기본 `true`. 다른 모드가 활성일 때(예: 탐색 화면의 의사 모드) 조회를 걸지 않으려면 `false`. */
  enabled?: boolean;
}

/**
 * 분야/세부 시술로 병원 목록을 받는다. 탐색 화면과 카테고리 화면이 **같은 훅**을 쓴다.
 *
 * `useHospitals` 를 감싸기만 하므로 새 queryKey 가 생기지 않는다 — 같은 필터면 두 화면이
 * 같은 캐시를 공유한다. 선택 → 서버 파라미터 변환은 `selectionToListFilters`(순수 함수)
 * 한 곳에 있다 (전문의 목록도 같은 함수를 쓴다).
 */
export function useHospitalsByCategory(
  selection: CategorySelection,
  baseFilters: HospitalCategoryBaseFilters,
  options: UseHospitalsByCategoryOptions = {}
) {
  const filters: HospitalFilters = { ...baseFilters, ...selectionToListFilters(selection) };

  return useHospitals(filters, options);
}
