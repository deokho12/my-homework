import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createHospitalInquiry,
  type HospitalInquiryCreateInput,
} from '@/features/inquiry/api/inquiryApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 문의 접수. `POST /hospital-inquiries`.
 *
 * **알림은 무효화하지 않는다** — 접수에는 부수효과가 없다 (관리자 알림을 만들지 않고,
 * 배지는 요약의 미답변 수다). 대신 `inquiries.all` 하나로 내 문의·관리자 목록·요약·
 * 공개 Q/A 가 함께 깨진다.
 */
export function useCreateInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: HospitalInquiryCreateInput) => createHospitalInquiry(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.all });
    },
  });
}
