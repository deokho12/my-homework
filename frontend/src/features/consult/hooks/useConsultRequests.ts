import { useQuery } from '@tanstack/react-query';

import { fetchConsultRequests, type ConsultRequestFilters } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

/** `/admin/consultations` 의 상담 목록. `GET /consult-requests`. */
export function useConsultRequests(filters: ConsultRequestFilters = {}) {
  return useQuery({
    queryKey: queryKeys.consultRequests.list(filters),
    queryFn: () => fetchConsultRequests(filters),
  });
}
