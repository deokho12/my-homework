import { useQuery } from '@tanstack/react-query';

import { fetchHospitals, type HospitalFilters } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

export interface UseHospitalsOptions {
  /** 기본 `true`. 다른 모드가 활성일 때(예: 탐색 화면의 의사 모드) 조회를 걸지 않으려면 `false`. */
  enabled?: boolean;
}

export function useHospitals(filters: HospitalFilters = {}, options: UseHospitalsOptions = {}) {
  return useQuery({
    queryKey: queryKeys.hospitals.list(filters),
    queryFn: () => fetchHospitals(filters),
    enabled: options.enabled,
  });
}
