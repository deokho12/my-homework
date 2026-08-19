import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addConsultMemo } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 내부 공유용 메모 추가. `POST /consult-requests/{id}/memos`.
 * 메모는 알림을 만들지 않으므로 상담 캐시만 깬다.
 */
export function useAddConsultMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => addConsultMemo(id, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
    },
  });
}
