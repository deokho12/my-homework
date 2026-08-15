import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHospitalReviews } from '@/features/review';
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

describe('useHospitalReviews', () => {
  it('페이지네이션 응답을 반환한다', async () => {
    fetchMock.mockResolvedValue(
      ok({ items: [{ id: 'r1' }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } })
    );

    const { result } = renderHook(() => useHospitalReviews('h1'), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.meta.totalItems).toBe(1);
  });

  it('필터가 다르면 캐시가 갈라진다', async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      const items = url.includes('procedureId=implant') ? [{ id: 'r-implant' }] : [{ id: 'r-all' }];
      return ok({ items, meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 } });
    });

    const a = renderHook(() => useHospitalReviews('h1'), { wrapper: queryWrapper });
    const b = renderHook(() => useHospitalReviews('h1', { procedureId: 'implant' }), { wrapper: queryWrapper });

    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    expect(a.result.current.data?.items).toEqual([{ id: 'r-all' }]);
    expect(b.result.current.data?.items).toEqual([{ id: 'r-implant' }]);
  });

  it('hospitalId 가 undefined 면 조회를 시작하지 않는다', () => {
    const { result } = renderHook(() => useHospitalReviews(undefined), { wrapper: queryWrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
