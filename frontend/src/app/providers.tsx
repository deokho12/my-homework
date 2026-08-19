import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * 모듈 수준 인스턴스로 두는 이유: `useAuthStore` 의 `clearAccountScopedState()` 처럼
 * 훅 밖에서 실행되는 코드도 캐시를 비워야 한다 (useQueryClient 를 쓸 수 없는 위치).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 목 백엔드는 즉시 응답하므로 창 전환마다 다시 부를 이유가 없다.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
