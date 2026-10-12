import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  answerHospitalInquiry,
  type HospitalInquiryAnswerInput,
} from '@/features/inquiry/api/inquiryApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 답변 등록. `POST /hospital-inquiries/{id}/answer`.
 *
 * 두 캐시를 깬다:
 * - `inquiries.all` — 목록·상세뿐 아니라 탭 숫자(요약)와 병원 상세의 공개 Q/A 까지.
 * - `notifications.all` — 답변은 문의자에게 `audience=user` 알림을 만든다.
 */
export function useAnswerInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: HospitalInquiryAnswerInput }) =>
      answerHospitalInquiry(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
