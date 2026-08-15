import { useMutation, useQueryClient } from '@tanstack/react-query';

import { decideVerification, type VerificationDecisionInput } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 승인/반려 결정. `PUT /doctors/:id/verification`. `operator` 전용.
 * 승인 즉시 `전문의` 배지·병원의 `representativeSpecialty` 가 바뀔 수 있어 병원 캐시도 깬다.
 */
export function useDecideVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: VerificationDecisionInput }) =>
      decideVerification(id, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
    },
  });
}
