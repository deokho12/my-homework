import { apiRequest } from '@/lib/apiClient';
import type { Procedure } from '@/types/domain';

/**
 * 세부 시술 31종 마스터 데이터 (`GET /procedures`). 서버가 분야 순서 × 분야 안 순서로
 * 고정해 응답한다 (= `taxonomy.ts` 의 `SUB_PROCEDURES` 순서). 클라이언트가 재정렬하지 않는다.
 *
 * 응답의 `isAvailable` 이 `준비중` 판정의 유일한 입력이다 (`features/procedure/availability.ts`).
 */
export function fetchProcedures(): Promise<Procedure[]> {
  return apiRequest<Procedure[]>('/procedures');
}
