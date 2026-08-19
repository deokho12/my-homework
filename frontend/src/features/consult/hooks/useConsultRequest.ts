import { useQuery } from '@tanstack/react-query';

import { fetchConsultRequestById } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

/** `/admin/consultations/:id`. `GET /consult-requests/{id}`. */
export function useConsultRequest(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.consultRequests.detail(id ?? ''),
    queryFn: () => fetchConsultRequestById(id as string),
    enabled: Boolean(id),
  });
}
