import { useState } from 'react';
import { router, Stack } from '@/navigation';

import { HospitalForm } from '@/components/admin/HospitalForm';
import { useCreateHospital } from '@/features/hospital';
import { mapHospitalFieldErrors, type HospitalFieldErrors } from '@/features/hospital/lib/hospitalFieldErrors';
import { isApiError } from '@/lib/apiClient';
import { showAlert } from '@/utils/alert';

export default function AdminHospitalNewPage() {
  const createHospital = useCreateHospital();
  const [fieldErrors, setFieldErrors] = useState<HospitalFieldErrors>({});

  return (
    <>
      <Stack.Screen options={{ title: '병원 등록' }} />
      <HospitalForm
        submitLabel="등록하기"
        canEditRecommended
        fieldErrors={fieldErrors}
        onSubmit={(data, doctors) => {
          setFieldErrors({});

          // `doctors` 를 같은 요청에 실어 원자적으로 만든다 — 등록 화면은 아직 hospitalId 가
          // 없어 두 요청으로 나누면 중간 실패 시 전문의 없는 병원이 남는다.
          createHospital.mutate(
            { ...data, doctors },
            {
              onSuccess: () => {
                router.back();
              },
              onError: (error) => {
                if (isApiError(error) && error.details?.length) {
                  const mapped = mapHospitalFieldErrors(error.details);
                  if (Object.keys(mapped).length > 0) {
                    setFieldErrors(mapped);
                    return;
                  }
                }
                showAlert(
                  '병원을 등록하지 못했어요',
                  isApiError(error) ? error.message : '잠시 후 다시 시도해주세요'
                );
              },
            }
          );
        }}
      />
    </>
  );
}
