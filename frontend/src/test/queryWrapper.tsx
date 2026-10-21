import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * renderHook 용 wrapper. 테스트에서는 재시도를 끈다 —
 * 켜져 있으면 에러 케이스가 통과 대신 타임아웃으로 실패한다.
 *
 * **클라이언트는 `useState` 초기화로 한 번만 만든다.** 본문에서 `new QueryClient()` 를
 * 부르면 리렌더마다 새 캐시가 생겨, 앞 렌더가 받아 둔 데이터가 통째로 사라진다 —
 * `useInfiniteQuery` 의 「더 보기」처럼 **렌더를 거치며 쌓이는** 상태는 그 자리에서 전부
 * 초기화된다 (요청 14 에서 발견).
 */
function QueryWrapper({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** `renderHook({ wrapper })` 가 받는 이름. 컴포넌트 본체는 대문자여야 훅 규칙이 적용된다. */
export const queryWrapper = QueryWrapper;
