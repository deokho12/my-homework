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
      // 취급 시술 체크가 바뀌면 `Procedure.isAvailable` 이 바뀐다 (서버가 매 요청 집계한다) —
      // 홈 격자·탐색 탭의 `준비중` 배지가 방금 한 저장을 바로 반영해야 한다 (계약 §22.5).
      void queryClient.invalidateQueries({ queryKey: queryKeys.procedures.all });
    },
  });
}
