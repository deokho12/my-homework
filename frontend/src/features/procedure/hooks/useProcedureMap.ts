import { useMemo } from 'react';

import { useProcedures } from '@/features/procedure/hooks/useProcedures';
import type { Procedure } from '@/types/domain';

/**
 * `getProcedureById()` 를 대신한다. 렌더 중 동기 조회라는 성질을 유지하려고 맵으로
 * 들고 있는다 — 서버 쿼리로 바꾸면 비동기가 되어버리는 호출부 18곳을 바꾸지 않기 위해서다.
 *
 * 로딩 중에는 빈 맵이다. 호출부는 `map.get(id)?.name` 처럼 옵셔널로 쓴다.
 */
export function useProcedureMap(): Map<string, Procedure> {
  const { data } = useProcedures();

  return useMemo(() => new Map((data ?? []).map((item) => [item.id, item])), [data]);
}
