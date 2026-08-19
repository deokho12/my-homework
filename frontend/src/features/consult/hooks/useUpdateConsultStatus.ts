import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateConsultStatus } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';
import type { ConsultStatus } from '@/types/domain';

/**
 * 상담 상태 변경. `PATCH /consult-requests/{id}/status`.
 *
 * 두 캐시를 깬다:
 * - `consultRequests.all` — 목록·상세뿐 아니라 관리자 홈의 `처리 대기 중인 상담` 숫자
 *   (`consultRequests.summary`)도 이 접두사 아래에 있다.
 * - `notifications.all` — 상태 변경은 신청자에게 `audience=user` 알림을 만든다.
 */
export function useUpdateConsultStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ConsultStatus }) => updateConsultStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
