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
      // 병원·의료진이 바뀌면 대시보드의 `병원 정보 완성도` 도 바뀐다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard.all });
    },
  });
}
