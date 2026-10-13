import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateConsultStatus, type ConsultStatusUpdateInput } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 상담 상태 변경·예약 일시 변경. `PATCH /consult-requests/{id}/status`.
 *
 * 세 캐시를 깬다:
 * - `consultRequests.all` — 관리자 목록·상세.
 * - `adminDashboard.all` — 대시보드 숫자와 사이드 배지.
 * - `notifications.all` — 상태 변경은 신청자에게 `audience=user` 알림을 만든다.
 */
export function useUpdateConsultStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConsultStatusUpdateInput }) => updateConsultStatus(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
      // 대시보드 숫자와 사이드 배지(`신규 N`)도 이 변경으로 움직인다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
