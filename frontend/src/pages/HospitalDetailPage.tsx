import { useLocalSearchParams } from '@/navigation';

import { QueryState } from '@/components/QueryState';
import { useHospital } from '@/features/hospital';
import { HospitalDetailView } from '@/features/hospital/components/HospitalDetailView';
import { isApiError } from '@/lib/apiClient';

/**
 * 조회 상태만 다룬다. 렌더는 `HospitalDetailView` 가 맡는다 —
 * `QueryState` 의 `children` 은 콜백이라 그 안에서 훅을 호출할 수 없기 때문이다.
 */
export default function HospitalDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: hospital, error, isLoading, isError, isFetching, refetch } = useHospital(id);

  // 없는 병원은 서버가 404 HOSPITAL_NOT_FOUND 를 준다 (ApiError로 던져진다) — "다시 시도"
  // 를 권할 에러가 아니라 빈 상태다. 그 외 에러(네트워크 오류 등)는 재시도 가능한 에러로 둔다.
  const notFound = isError && isApiError(error) && error.code === 'HOSPITAL_NOT_FOUND';

  return (
    <QueryState
      isLoading={isLoading}
      isError={notFound ? false : isError}
      data={notFound ? null : hospital}
      onRetry={() => {
        void refetch();
      }}
      isRetrying={isError && isFetching}
      emptyState={{ title: '병원 정보를 찾을 수 없어요' }}
      className="flex-1 bg-white"
    >
      {(hospital) => <HospitalDetailView hospital={hospital} />}
    </QueryState>
  );
}
