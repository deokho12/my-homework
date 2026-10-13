import { useQuery } from '@tanstack/react-query';

import { fetchManagedHospitals, type ManagedHospitalFilters } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * `/admin` 홈의 병원 목록. 응답의 `scope`(`managed` | `all`)로 화면이 빈 목록 문구를 가른다 —
 * 이 훅은 그 값을 그대로 통과시킨다(변형하지 않는다).
 */
export function useManagedHospitals(
  filters: ManagedHospitalFilters = {},
  /**
   * 병원 선택기는 **담당 병원이 2곳 이상일 때만** 이 목록이 필요하다 (이름을 보여주려고
   * 부른다). 1곳이면 선택기 자체가 없으므로 관리자 화면마다 요청을 하나 더 내지 않는다.
   */
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: queryKeys.hospitals.managed(filters),
    queryFn: () => fetchManagedHospitals(filters),
    enabled,
  });
}
