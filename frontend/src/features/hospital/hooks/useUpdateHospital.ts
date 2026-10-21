import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateHospital, type HospitalWriteInput } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

/** `/admin/hospital/:id` 의 병원 정보 저장. `PATCH /hospitals/:id`. */
export function useUpdateHospital() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: HospitalWriteInput }) => updateHospital(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
      // 취급 시술 체크가 바뀌면 `Procedure.isAvailable` 이 바뀐다 (서버가 매 요청 집계한다) —
      // 홈 격자·탐색 탭의 `준비중` 배지가 방금 한 저장을 바로 반영해야 한다 (계약 §22.5).
      void queryClient.invalidateQueries({ queryKey: queryKeys.procedures.all });
      // 병원·의료진이 바뀌면 대시보드의 `병원 정보 완성도` 도 바뀐다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard.all });
    },
  });
}
