import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteDoctor } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

/** 전문의 삭제. `DELETE /doctors/:id`. 되돌릴 수 없다. 병원 배지·조건 칩에 영향을 줄 수 있어 병원 캐시도 깬다. */
export function useDeleteDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDoctor(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
      // 병원·의료진이 바뀌면 대시보드의 `병원 정보 완성도` 도 바뀐다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard.all });
    },
  });
}
