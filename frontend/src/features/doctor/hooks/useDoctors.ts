import { useQuery } from '@tanstack/react-query';

import { fetchDoctors, type DoctorFilters } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

export interface UseDoctorsOptions {
  /** 기본 `true`. 다른 모드가 활성일 때(예: 탐색 화면의 병원 모드) 조회를 걸지 않으려면 `false`. */
  enabled?: boolean;
}

export function useDoctors(filters: DoctorFilters = {}, options: UseDoctorsOptions = {}) {
  return useQuery({
    queryKey: queryKeys.doctors.list(filters),
    queryFn: () => fetchDoctors(filters),
    enabled: options.enabled,
  });
}
