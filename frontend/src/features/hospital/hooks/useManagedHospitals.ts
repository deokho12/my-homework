import { useQuery } from '@tanstack/react-query';

import { fetchManagedHospitals, type ManagedHospitalFilters } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * `/admin` 홈의 병원 목록. 응답의 `scope`(`managed` | `all`)로 화면이 빈 목록 문구를 가른다 —
 * 이 훅은 그 값을 그대로 통과시킨다(변형하지 않는다).
 */
export function useManagedHospitals(filters: ManagedHospitalFilters = {}) {
  return useQuery({
    queryKey: queryKeys.hospitals.managed(filters),
    queryFn: () => fetchManagedHospitals(filters),
  });
}
