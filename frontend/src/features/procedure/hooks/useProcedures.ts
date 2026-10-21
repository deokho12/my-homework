import { useQuery } from '@tanstack/react-query';

import { fetchProcedures } from '@/features/procedure/api/procedureApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 세부 시술 31개. **`staleTime` 을 두지 않는다** (요청 14) — 응답에 `isAvailable` 이 실리면서
 * 이 목록은 "거의 변하지 않는 마스터 데이터" 가 아니게 됐다. 관리자가 시술 체크를 저장하는
 * 순간 값이 바뀌고, 그 저장이 이 쿼리를 무효화한다 (`useUpdateHospital`·`useCreateHospital`).
 *
 * 서버도 같은 이유로 `Cache-Control: no-cache` + ETag 다 (계약 §22.5) — 브라우저 HTTP 캐시가
 * 옛 본문을 돌려주면 쿼리를 무효화해도 소용이 없다. 재검증은 31행 JSON 이라 `304` 로 끝난다.
 */
export function useProcedures() {
  return useQuery({
    queryKey: queryKeys.procedures.all,
    queryFn: fetchProcedures,
  });
}
