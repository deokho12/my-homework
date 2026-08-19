import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createConsultRequest, type ConsultRequestCreateInput } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 상담 접수. `POST /consult-requests`.
 *
 * 알림까지 무효화하는 이유: 접수는 **그 병원 담당자에게 `audience=admin` 알림을 만드는**
 * 부수효과를 갖는다 (계약이 이 엔드포인트의 책임으로 명시한다). 관리자 알림함과 종 배지가
 * 낡은 숫자를 들고 있지 않게 함께 깬다.
 */
export function useCreateConsultRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConsultRequestCreateInput) => createConsultRequest(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
