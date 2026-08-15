import { useState } from 'react';
import { Stack, useLocalSearchParams } from '@/navigation';
import { Text, View } from '@/primitives';

import { HospitalForm, type RosterSaveAction } from '@/components/admin/HospitalForm';
import { QueryState } from '@/components/QueryState';
import { useSession } from '@/features/auth/hooks/useSession';
import { useDeleteDoctor, useHospitalDoctors, useReplaceHospitalDoctors, useUpdateDoctor } from '@/features/doctor';
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
  // 기간을 다시 계산하지 않는다. 판정 규칙은 `backend/src/hospital/sponsorship.ts` 한 곳에만 있다.
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
  const updateDoctor = useUpdateDoctor();
  const deleteDoctor = useDeleteDoctor();
  const [fieldErrors, setFieldErrors] = useState<HospitalFieldErrors>({});

  const isLoading = hospitalQuery.isLoading || doctorsQuery.isLoading;
  const isError = hospitalQuery.isError || doctorsQuery.isError;
  const notFound =
    hospitalQuery.isError && isApiError(hospitalQuery.error) && hospitalQuery.error.code === 'HOSPITAL_NOT_FOUND';

  const data: LoadedHospital | undefined =
    hospitalQuery.data && doctorsQuery.data ? { hospital: hospitalQuery.data, doctors: doctorsQuery.data } : undefined;

  /**
   * 로스터 저장. `PUT`(전체 교체, 새 전문의가 있을 때만) 또는 `PATCH`/`DELETE` 여러 건
   * (새 전문의가 없을 때)으로 갈린다 — `HospitalForm` 이 어느 경로인지 이미 판정해서 넘긴다.
   *
   * `patch` 경로는 호출이 여러 개로 늘어난다(전문의 수 × PATCH/DELETE). 조용히 절반만
   * 저장되면 안 되므로 `Promise.allSettled` 로 전부 시도하고, 실패한 항목을 **이름으로**
   * 짚어 알린다 — "일부 실패했습니다" 보다 "OO 전문의를 저장하지 못했어요" 가 낫다.
   */
  const saveRoster = (hospitalId: string, action: RosterSaveAction) => {
    if (action.mode === 'replace') {
      replaceHospitalDoctors.mutate(
        { hospitalId, doctors: action.doctors },
        {
          onSuccess: () => {
            showAlert('저장했어요', '전문의 정보를 저장했어요');
          },
          onError: (error) => {
            showAlert(
              '전문의 정보를 저장하지 못했어요',
              isApiError(error) ? error.message : '잠시 후 다시 시도해주세요'
            );
          },
        }
      );
      return;
    }

    if (action.updates.length === 0 && action.deletions.length === 0) return;

    void (async () => {
      const updateResults = await Promise.allSettled(
        action.updates.map((update) => updateDoctor.mutateAsync({ id: update.id, patch: update.patch }))
      );
      const deleteResults = await Promise.allSettled(
        action.deletions.map((deletion) => deleteDoctor.mutateAsync(deletion.id))
      );

      const failedNames = [
        ...action.updates.filter((_, index) => updateResults[index].status === 'rejected').map((u) => u.name),
        ...action.deletions
          .filter((_, index) => deleteResults[index].status === 'rejected')
          .map((deletion) => `${deletion.name} 삭제`),
      ];

      if (failedNames.length > 0) {
        showAlert(
          '전문의 정보 중 일부를 저장하지 못했어요',
          `${failedNames.join(', ')} — 다시 시도해주세요`
        );
        return;
      }

      showAlert('저장했어요', '전문의 정보를 저장했어요');
    })();
  };

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
              mode="split"
              initial={hospital}
              doctors={doctors}
              canEditRecommended={isOperator}
              fieldErrors={fieldErrors}
              onSaveHospital={(formData) => {
                setFieldErrors({});

                // 병원 필드 저장은 로스터 상태와 완전히 독립이다 — 이 호출은 전문의 로스터를
                // 전혀 건드리지 않고, 로스터의 상태(전공 확인 불가 등)와 무관하게 항상 시도된다.
                updateHospital.mutate(
                  { id: hospital.id, input: formData },
                  {
                    // 로스터 저장과 독립된 액션이라 성공해도 화면을 떠나지 않는다 — 관리자가
                    // 이어서 전문의 로스터도 저장하고 싶을 수 있다.
                    onSuccess: () => {
                      showAlert('저장했어요', '병원 정보를 저장했어요');
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
              onSaveRoster={(action) => saveRoster(hospital.id, action)}
            />
          </View>
        </View>
      )}
    </QueryState>
  );
}
