import type { DoctorFilters } from '@/features/doctor/api/doctorApi';
import { useDoctors } from '@/features/doctor/hooks/useDoctors';
import {
  selectionToListFilters,
  type CategorySelection,
} from '@/features/procedure/lib/categoryListFilters';

/** 분야·세부·추천을 뺀 나머지 필터. 그 셋은 `selection` 이 정한다. */
export type DoctorCategoryBaseFilters = Omit<DoctorFilters, 'procedureId' | 'categoryId' | 'recommended'>;

export interface UseDoctorsByCategoryOptions {
  /** 기본 `true`. 다른 모드가 활성일 때(예: 탐색 화면의 병원 모드) 조회를 걸지 않으려면 `false`. */
  enabled?: boolean;
}

/**
 * 분야/세부 시술로 전문의 목록을 받는다. `useHospitalsByCategory` 와 **같은 변환 함수**를
 * 쓴다 — 같은 탭이 두 모드에서 다른 것을 물어보면 안 된다.
 */
export function useDoctorsByCategory(
  selection: CategorySelection,
  baseFilters: DoctorCategoryBaseFilters,
  options: UseDoctorsByCategoryOptions = {}
) {
  const filters: DoctorFilters = { ...baseFilters, ...selectionToListFilters(selection) };

  return useDoctors(filters, options);
}
