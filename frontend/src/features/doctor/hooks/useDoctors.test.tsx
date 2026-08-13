import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDoctors } from '@/features/doctor';
import { queryWrapper } from '@/test/queryWrapper';

/**
 * `fetchDoctors` 가 HTTP 를 부르므로 `vi.stubGlobal('fetch', ...)` 로 가로챈다
 * (`src/features/hospital/hooks/useHospital.test.tsx` 와 같은 방식).
 */
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

describe('useDoctors', () => {
  it('필터가 다르면 캐시가 갈라진다', async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      const items = url.includes('hospitalId=h1') ? [{ id: 'd1' }] : [{ id: 'd2' }];
      return ok({ items, meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 } });
    });

    const a = renderHook(() => useDoctors({ hospitalId: 'h1' }), { wrapper: queryWrapper });
    const b = renderHook(() => useDoctors({ hospitalId: 'h2' }), { wrapper: queryWrapper });

    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    expect(a.result.current.data).not.toBe(b.result.current.data);
    expect(a.result.current.data?.items).toEqual([{ id: 'd1' }]);
    expect(b.result.current.data?.items).toEqual([{ id: 'd2' }]);
  });
});
