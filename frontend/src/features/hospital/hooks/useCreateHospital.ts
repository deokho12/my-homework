import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { DoctorUpsertInput } from '@/features/doctor/api/doctorApi';
import { createHospital, type HospitalWriteInput } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

export type CreateHospitalInput = HospitalWriteInput & { doctors?: DoctorUpsertInput[] };

/** `/admin/hospital/new` 의 `등록하기`. `doctors` 를 함께 보내면 원자적으로 생성된다. */
export function useCreateHospital() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateHospitalInput) => createHospital(input),
    onSuccess: () => {
      // 새 병원에 소속 전문의가 함께 생겼을 수 있다 — 전문의 캐시도 함께 깬다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
    },
  });
}
