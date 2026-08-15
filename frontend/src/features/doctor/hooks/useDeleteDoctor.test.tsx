import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeleteDoctor } from '@/features/doctor/hooks/useDeleteDoctor';
import { queryKeys } from '@/lib/queryKeys';

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

describe('useDeleteDoctor', () => {
  it('DELETE 를 부르고 전문의·병원 캐시를 함께 무효화한다', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: async () => '',
    } as Response);
    const { Wrapper, invalidateSpy } = makeWrapper();

    const { result } = renderHook(() => useDeleteDoctor(), { wrapper: Wrapper });

    result.current.mutate('d1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.doctors.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.hospitals.all });
  });
});
