import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateDoctor, type DoctorUpdateInput } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

/** 전문의 단건 수정. `PATCH /doctors/:id`. 병원 배지·조건 칩에 영향을 줄 수 있어 병원 캐시도 깬다. */
export function useUpdateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DoctorUpdateInput }) => updateDoctor(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
    },
  });
}
