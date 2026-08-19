import { useQuery } from '@tanstack/react-query';

import { fetchConsultSummary } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

/** 관리자 홈의 숫자 카드 2개. `GET /consult-requests/summary`. */
export function useConsultSummary() {
  return useQuery({
    queryKey: queryKeys.consultRequests.summary,
    queryFn: fetchConsultSummary,
  });
}
