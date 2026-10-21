import { useMemo } from 'react';

import { buildProcedureAvailability, type ProcedureAvailability } from '@/features/procedure/availability';
import { useProcedures } from '@/features/procedure/hooks/useProcedures';

/**
 * `준비중` 판정을 화면에 꽂는 유일한 훅. 판정 자체는 `availability.ts` 의 순수 함수다.
 *
 * 쿼리가 하나(`queryKeys.procedures.all`)뿐이라 여러 화면이 같이 써도 요청은 한 번이고,
 * 병원 저장이 그 쿼리를 무효화하면 배지가 함께 갱신된다 (계약 §22.5).
 */
export function useProcedureAvailability(): ProcedureAvailability {
  const { data } = useProcedures();

  return useMemo(() => buildProcedureAvailability(data), [data]);
}
