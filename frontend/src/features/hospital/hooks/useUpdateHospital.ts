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
    },
  });
}
