import { useLocalSearchParams } from '@/navigation';

import { QueryState } from '@/components/QueryState';
import { useHospital } from '@/features/hospital';
import { HospitalDetailView } from '@/features/hospital/components/HospitalDetailView';

/**
 * 조회 상태만 다룬다. 렌더는 `HospitalDetailView` 가 맡는다 —
 * `QueryState` 의 `children` 은 콜백이라 그 안에서 훅을 호출할 수 없기 때문이다.
 */
export default function HospitalDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: hospital, isLoading, isError, isFetching, refetch } = useHospital(id);

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      data={hospital}
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
