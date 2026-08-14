import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useManagedHospitals } from '@/features/hospital/hooks/useManagedHospitals';
import { queryWrapper } from '@/test/queryWrapper';

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

describe('useManagedHospitals', () => {
  it('GET /admin/hospitals 응답의 scope 를 그대로 전달한다', async () => {
    fetchMock.mockResolvedValue(
      ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, scope: 'managed' })
    );

    const { result } = renderHook(() => useManagedHospitals(), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.scope).toBe('managed');
  });
});
