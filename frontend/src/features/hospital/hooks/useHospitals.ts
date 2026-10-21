import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchHospitals, type HospitalFilters } from '@/features/hospital/api/hospitalApi';
import { LIST_PAGE_SIZE, flattenPages, nextPageParam } from '@/lib/pagination';
import { queryKeys } from '@/lib/queryKeys';

export interface UseHospitalsOptions {
  /** 기본 `true`. 다른 모드가 활성일 때(예: 탐색 화면의 의사 모드) 조회를 걸지 않으려면 `false`. */
  enabled?: boolean;
}

/**
 * 병원 목록. **`useInfiniteQuery` 다** — 「더 보기」가 다음 20곳을 아래에 이어 붙인다.
 *
 * 화면에 주는 `data` 는 여전히 `Paged<Hospital>` 한 장이라(`flattenPages`) QueryState·
 * ResultsHeader·CardGrid 호출부가 바뀌지 않는다. `page` 를 바깥에서 받지 않는 이유는
 * **페이지 상태가 두 군데(화면 state + 쿼리 캐시)에 생기지 않게** 하기 위해서다 — 정렬·칩이
 * 바뀌면 queryKey 가 바뀌어 저절로 1페이지부터 다시 시작한다 (설계 §4).
 */
export function useHospitals(filters: HospitalFilters = {}, options: UseHospitalsOptions = {}) {
  // 호출부가 `pageSize` 를 지정하면(지도 100곳) 그것이 이긴다.
  const pagedFilters: HospitalFilters = { pageSize: LIST_PAGE_SIZE, ...filters };

  const query = useInfiniteQuery({
    queryKey: queryKeys.hospitals.list(pagedFilters),
    queryFn: ({ pageParam }) => fetchHospitals({ ...pagedFilters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    enabled: options.enabled,
  });

  const data = useMemo(() => (query.data ? flattenPages(query.data.pages) : undefined), [query.data]);

  // 펼치기(`...query`)로 돌려주지 않는 이유: TanStack 은 **읽은 속성만** 추적해 그 속성이
  // 바뀔 때만 다시 그린다. 펼치면 전부 읽은 것이 되어 `isFetching` 같은 플래그 하나에도
  // 목록 전체가 다시 그려진다. 그래서 호출부가 실제로 보는 것만 적는다 — 새로 필요해지면
  // 그때 한 줄 늘린다.
  return {
    data,
    isPending: query.isPending,
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
  };
}
