import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateConsultStatus, type ConsultStatusUpdateInput } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 상담 상태 변경·예약 일시 변경. `PATCH /consult-requests/{id}/status`.
 *
 * 두 캐시를 깬다:
 * - `consultRequests.all` — 목록·상세뿐 아니라 관리자 홈의 `처리 대기 중인 상담` 숫자
 *   (`consultRequests.summary`)도 이 접두사 아래에 있다.
 * - `notifications.all` — 상태 변경은 신청자에게 `audience=user` 알림을 만든다.
 */
export function useUpdateConsultStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConsultStatusUpdateInput }) => updateConsultStatus(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
