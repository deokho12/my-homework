import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

interface Options {
  /** 렌더 시작 URL. `route`에 파라미터가 있으면 `path`도 함께 넘긴다. */
  route?: string;
  /**
   * 라우트 패턴 (예: '/hospital/:id').
   * useLocalSearchParams 가 파라미터를 읽으려면 실제 Route 매칭이 있어야 한다 —
   * MemoryRouter 만 감싸면 params 가 비어 있다.
   */
  path?: string;
}

export function renderWithProviders(ui: ReactElement, { route = '/', path }: Options = {}) {
  // 테스트에서는 재시도를 끈다. 켜져 있으면 에러 케이스가 타임아웃으로 실패한다.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            {path ? <Route path={path} element={children} /> : null}
            <Route path="*" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
