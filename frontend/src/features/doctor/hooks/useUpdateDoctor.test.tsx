import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpdateDoctor } from '@/features/doctor/hooks/useUpdateDoctor';
import { queryKeys } from '@/lib/queryKeys';

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return { Wrapper, invalidateSpy };
}

describe('useUpdateDoctor', () => {
  it('PATCH 를 부르고 전문의·병원 캐시를 함께 무효화한다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1' }));
    const { Wrapper, invalidateSpy } = makeWrapper();

    const { result } = renderHook(() => useUpdateDoctor(), { wrapper: Wrapper });

    result.current.mutate({ id: 'd1', patch: { title: '부원장' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.doctors.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.hospitals.all });
  });
});
