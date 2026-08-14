import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from '@/navigation';
import { Text, View } from '@/primitives';

import { HospitalForm } from '@/components/admin/HospitalForm';
import { QueryState } from '@/components/QueryState';
import { useSession } from '@/features/auth/hooks/useSession';
import { useHospitalDoctors, useReplaceHospitalDoctors } from '@/features/doctor';
import { useHospital, useUpdateHospital } from '@/features/hospital';
import { mapHospitalFieldErrors, type HospitalFieldErrors } from '@/features/hospital/lib/hospitalFieldErrors';
import { useProcedureMap } from '@/features/procedure';
import { isApiError } from '@/lib/apiClient';
import type { Doctor, Hospital, Procedure, ProcedureId } from '@/types/domain';
import { showAlert } from '@/utils/alert';

// 훅은 컴포넌트 본문에서만 부를 수 있으므로, 컴포넌트가 `useProcedureMap()` 으로 얻은
// 맵을 값으로 넘겨받는다 — 이 함수 자체는 훅을 부르지 않는다.
function getSponsorshipStatusText(hospital: Hospital, procedureMap: Map<ProcedureId, Procedure>): string {
  // `sponsorship` 은 서버 계산 필드다(`backend/src/hospital/hospital.projection.ts`) — 기기 시계로
  // 기간을 다시 계산하지 않는다(`src/utils/sponsorship.ts` 는 더 이상 이 화면에서 부르지 않는다).
  if (!hospital.isSponsored || !hospital.sponsorship.isActive) return '현재 진행중인 광고가 없어요';

  const categoryNames = hospital.sponsoredCategories
    .map((procedureId) => procedureMap.get(procedureId)?.name)
    .filter(Boolean)
    .join(', ');

  return `${categoryNames} 카테고리 광고 중 · ${hospital.sponsoredEndDate}까지`;
}

interface LoadedHospital {
  hospital: Hospital;
  doctors: Doctor[];
}

export default function AdminHospitalEditPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const procedureMap = useProcedureMap();
  const { isOperator } = useSession();

  const hospitalQuery = useHospital(id);
  // 병원과 전문의 목록이 **둘 다** 도착한 뒤에만 폼을 마운트한다 — 전문의 목록이 아직 로딩
  // 중인데 빈 배열로 폼을 초기화하면, 그 상태로 저장했을 때 `PUT` 이 "화면에 남은 목록이
  // 정답" 규칙에 따라 실제 로스터 전체를 삭제해버린다.
  const doctorsQuery = useHospitalDoctors(id);

  const updateHospital = useUpdateHospital();
  const replaceHospitalDoctors = useReplaceHospitalDoctors();
  const [fieldErrors, setFieldErrors] = useState<HospitalFieldErrors>({});

  const isLoading = hospitalQuery.isLoading || doctorsQuery.isLoading;
  const isError = hospitalQuery.isError || doctorsQuery.isError;
  const notFound =
    hospitalQuery.isError && isApiError(hospitalQuery.error) && hospitalQuery.error.code === 'HOSPITAL_NOT_FOUND';

  const data: LoadedHospital | undefined =
    hospitalQuery.data && doctorsQuery.data ? { hospital: hospitalQuery.data, doctors: doctorsQuery.data } : undefined;

  return (
    <QueryState
      isLoading={isLoading}
      isError={notFound ? false : isError}
      data={notFound ? null : data}
      onRetry={() => {
        void hospitalQuery.refetch();
        void doctorsQuery.refetch();
      }}
      isRetrying={isError && (hospitalQuery.isFetching || doctorsQuery.isFetching)}
      emptyState={{ title: '병원 정보를 찾을 수 없어요' }}
      className="flex-1 bg-white"
    >
      {({ hospital, doctors }) => (
        <View className="flex-1 bg-white">
          <Stack.Screen options={{ title: '병원 정보 수정' }} />

          <View className="mx-5 mt-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
            <Text className="mb-1 text-sm font-semibold text-neutral-500">광고 현황 (읽기 전용)</Text>
            <Text className="text-sm text-neutral-800">{getSponsorshipStatusText(hospital, procedureMap)}</Text>
            <Text className="mt-1 text-xs text-neutral-400">
              광고 신청·결제 기능은 아직 준비중이에요. 변경이 필요하면 담당팀에 문의해주세요.
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <HospitalForm
              initial={hospital}
              doctors={doctors}
              canEditRecommended={isOperator}
              fieldErrors={fieldErrors}
              submitLabel="저장하기"
              onSubmit={(formData, doctorsPayload) => {
                setFieldErrors({});

                // 병원 폼 저장은 API 호출 2개다 — 하나가 성공하고 다른 하나가 실패할 수 있다.
                // 조용히 절반만 저장되면 안 되므로 각 단계의 실패를 사용자에게 알린다.
                updateHospital.mutate(
                  { id: hospital.id, input: formData },
                  {
                    onSuccess: () => {
                      replaceHospitalDoctors.mutate(
                        { hospitalId: hospital.id, doctors: doctorsPayload },
                        {
                          onSuccess: () => {
                            router.back();
                          },
                          onError: (error) => {
                            showAlert(
                              '병원 정보는 저장됐지만 전문의 정보는 저장하지 못했어요',
                              isApiError(error) ? error.message : '전문의 정보를 다시 저장해주세요'
                            );
                          },
                        }
                      );
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
                        '병원 정보를 저장하지 못했어요',
                        isApiError(error) ? error.message : '잠시 후 다시 시도해주세요'
                      );
                    },
                  }
                );
              }}
            />
          </View>
        </View>
      )}
    </QueryState>
  );
}
