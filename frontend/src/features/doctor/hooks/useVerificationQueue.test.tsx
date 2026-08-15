import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVerificationQueue } from '@/features/doctor/hooks/useVerificationQueue';
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

describe('useVerificationQueue', () => {
  it('검수 큐 응답을 그대로 전달한다', async () => {
    const body = { items: [{ id: 'd1' }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };
    fetchMock.mockResolvedValue(ok(body));

    const { result } = renderHook(() => useVerificationQueue(), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(body);
  });
});
