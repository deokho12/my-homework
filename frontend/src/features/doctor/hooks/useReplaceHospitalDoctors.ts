import { useMutation, useQueryClient } from '@tanstack/react-query';

import { replaceHospitalDoctors, type DoctorUpsertInput } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 병원 폼의 전문의 로스터 저장. `PUT /hospitals/:id/doctors`.
 *
 * 병원 카드의 `representativeSpecialty` 배지와 탐색의 `전문의`·`경력` 조건 칩이 전문의
 * 상태에 걸려 있다 — 전문의 캐시만 깨면 병원 목록이 옛 배지를 계속 보여준다. 병원 캐시도
 * 함께 깬다.
 */
export function useReplaceHospitalDoctors() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ hospitalId, doctors }: { hospitalId: string; doctors: DoctorUpsertInput[] }) =>
      replaceHospitalDoctors(hospitalId, doctors),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
    },
  });
}
