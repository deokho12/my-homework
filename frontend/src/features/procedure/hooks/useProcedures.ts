import { useQuery } from '@tanstack/react-query';

import { fetchProcedures } from '@/features/procedure/api/procedureApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 13종 고정 마스터 데이터다. 화면 중에 값이 바뀔 일이 없어 `staleTime` 을 무한으로 둔다
 * (서버도 `Cache-Control: public, max-age=3600` + ETag 를 준다).
 */
export function useProcedures() {
  return useQuery({
    queryKey: queryKeys.procedures.all,
    queryFn: fetchProcedures,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
