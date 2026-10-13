import { useQuery } from '@tanstack/react-query';

import { fetchAdminDashboard } from '@/features/admin/api/dashboardApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 대시보드 집계. `GET /admin/dashboard?hospitalId=`.
 *
 * **사이드 메뉴 배지와 대시보드 카드가 같은 훅(= 같은 캐시 키)을 쓴다.** 숫자를 두 번
 * 받으면 그 둘이 어긋날 자리가 생긴다 — 셸은 `statusNew`·`unansweredInquiries` 만 읽고
 * 화면은 전부 읽을 뿐, 출처는 하나다 (`docs/database/README.md` §13.8).
 */
export function useAdminDashboard(hospitalId: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.adminDashboard.byHospital(hospitalId ?? ''),
    queryFn: () => fetchAdminDashboard({ hospitalId: hospitalId as string }),
    // 담당 병원이 없거나 운영자면 부르지 않는다 — 운영자에게는 `403` 이 확정이다.
    enabled: enabled && Boolean(hospitalId),
  });
}
