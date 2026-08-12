import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * renderHook 용 wrapper. 테스트에서는 재시도를 끈다 —
 * 켜져 있으면 에러 케이스가 통과 대신 타임아웃으로 실패한다.
 */
export function queryWrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
