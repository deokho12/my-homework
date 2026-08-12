import type { ReactNode } from 'react';

import { EmptyState, type EmptyStateProps } from '@/components/EmptyState';
import { ErrorState, type ErrorStateProps } from '@/components/ErrorState';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';
import { ActivityIndicator } from '@/primitives';

export interface QueryStateProps<T> {
  /**
   * `isPending` 이 아니라 `isLoading` 을 받는다. TanStack Query v5 의 `isPending` 은
   * "데이터가 아직 없음"만 뜻하므로 `enabled: false` 인 쿼리는 fetch 를 시작하지 않은 채로도
   * `isPending === true` 다 — `useHospital(undefined)` 같은 경우 로딩 화면이 영구히 걸린다.
   * `isLoading === isPending && isFetching` 이라 "최초 fetch 가 실제로 진행 중"을 뜻한다.
   */
  isLoading: boolean;
  isError: boolean;
  data: T | undefined;
  onRetry?: () => void;
  /** 재조회 중이면 `ErrorState` 의 재시도 버튼을 잠그고 라벨을 바꾼다. */
  isRetrying?: boolean;
  /** 기본 판정: null 이거나 길이 0인 배열. `undefined`/`null` 은 이 함수 전에 이미 걸러진다. */
  isEmpty?: (data: NonNullable<T>) => boolean;
  /**
   * `className` 과 `onRetry` 는 제외한다. 전자는 `QueryState` 가 레이아웃을 소유하고
   * (덮어쓰면 `flex-1` 이 조용히 사라진다), 후자는 `onRetry` prop 이 유일한 지정 경로여야
   * 재시도 배선이 두 갈래로 갈리지 않는다.
   */
  errorState?: Omit<ErrorStateProps, 'className' | 'onRetry'>;
  emptyState: Omit<EmptyStateProps, 'className'>;
  className?: string;
  children: (data: NonNullable<T>) => ReactNode;
}

function defaultIsEmpty<T>(data: NonNullable<T>): boolean {
  return Array.isArray(data) && data.length === 0;
}

/**
 * useQuery 결과의 loading / error / empty / success 네 상태를 한 곳에서 렌더한다.
 * 27개 화면이 같은 문구와 같은 레이아웃을 쓰게 만드는 것이 목적이다.
 */
export function QueryState<T>({
  isLoading,
  isError,
  data,
  onRetry,
  isRetrying,
  isEmpty = defaultIsEmpty,
  errorState,
  emptyState,
  className = 'flex-1',
  children,
}: QueryStateProps<T>) {
  const showSpinner = useDelayedFlag(isLoading);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className={`flex items-center justify-center ${className}`}>
        {showSpinner ? <ActivityIndicator size="large" /> : null}
        <span className="sr-only">불러오는 중이에요</span>
      </div>
    );
  }

  // `isError` 를 data 존재보다 먼저 보면 안 된다. TanStack Query v5 는 refetch 가
  // 실패해도 마지막 성공 `data` 를 유지하고 `status` 만 'error' 로 바꾼다
  // (query-core 의 `isRefetchError = isError && hasData`). 그 경우까지 ErrorState 로
  // 보내면 다 보고 있던 화면이 백그라운드 refetch 실패 한 번에 통째로 사라진다 —
  // 빈 에러 화면보다 낡은 데이터를 유지하는 편이 낫다.
  if (isError && data === undefined) {
    return <ErrorState {...errorState} className={className} onRetry={onRetry} isRetrying={isRetrying} />;
  }

  if (data === undefined || data === null || isEmpty(data)) {
    return <EmptyState {...emptyState} className={className} />;
  }

  return <>{children(data)}</>;
}
