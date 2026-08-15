import { useQuery } from '@tanstack/react-query';

import { fetchVerificationQueue, type VerificationQueueFilters } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

/** `/admin/specialists` 의 검수 목록. `operator` 전용. */
export function useVerificationQueue(filters: VerificationQueueFilters = {}) {
  return useQuery({
    queryKey: queryKeys.doctors.verificationQueue(filters),
    queryFn: () => fetchVerificationQueue(filters),
  });
}
