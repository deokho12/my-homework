import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchDoctors, type DoctorFilters } from '@/features/doctor/api/doctorApi';
import { LIST_PAGE_SIZE, flattenPages, nextPageParam } from '@/lib/pagination';
import { queryKeys } from '@/lib/queryKeys';

export interface UseDoctorsOptions {
  /** 기본 `true`. 다른 모드가 활성일 때(예: 탐색 화면의 병원 모드) 조회를 걸지 않으려면 `false`. */
  enabled?: boolean;
}

/** 의사 목록. `useHospitals` 와 **같은 모양**이다 — 두 목록이 같은 「더 보기」를 쓴다. */
export function useDoctors(filters: DoctorFilters = {}, options: UseDoctorsOptions = {}) {
  const pagedFilters: DoctorFilters = { pageSize: LIST_PAGE_SIZE, ...filters };

  const query = useInfiniteQuery({
    queryKey: queryKeys.doctors.list(pagedFilters),
    queryFn: ({ pageParam }) => fetchDoctors({ ...pagedFilters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    enabled: options.enabled,
  });

  const data = useMemo(() => (query.data ? flattenPages(query.data.pages) : undefined), [query.data]);

  // `useHospitals` 와 같은 이유로 펼치지 않는다 — 읽은 속성만 추적되게 둔다. 두 훅이
  // **같은 필드 집합**을 돌려줘야 한 벌의 호출부(`ListMoreFooter`·`QueryState`)가 모드와
  // 무관하게 돌아간다.
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
