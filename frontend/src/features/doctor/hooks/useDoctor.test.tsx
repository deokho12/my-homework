import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDoctor } from '@/features/doctor';
import { isApiError, type ApiError } from '@/lib/apiClient';
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

function notFound(): Response {
  const body = { error: { code: 'DOCTOR_NOT_FOUND', message: '전문의 정보를 찾을 수 없어요' } };
  return {
    ok: false,
    status: 404,
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

describe('useDoctor', () => {
  it('id 로 한 건을 반환한다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1', name: '김민준' }));

    const { result } = renderHook(() => useDoctor('d1'), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('김민준');
  });

  it('없는 id 는 ApiError(DOCTOR_NOT_FOUND) 를 error 로 노출한다 (data 는 undefined)', async () => {
    fetchMock.mockResolvedValue(notFound());

    const { result } = renderHook(() => useDoctor('no-such-doctor'), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(isApiError(result.current.error)).toBe(true);
    expect((result.current.error as ApiError).code).toBe('DOCTOR_NOT_FOUND');
  });

  it('id 가 undefined 면 조회를 시작하지 않는다', () => {
    const { result } = renderHook(() => useDoctor(undefined), { wrapper: queryWrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  /**
   * 평점 잠금 고정: 비로그인이면 서버가 `rating: null` 을 준다. `?? 0` 으로 덮으면
   * "평점이 0점" 이라는 다른 사실을 주장하게 된다 — 훅은 받은 값을 그대로 옮겨야 한다.
   */
  it('rating 이 null 이면 null 그대로 노출한다 (0 으로 덮지 않는다)', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1', name: '김민준', rating: null, reviewCount: 180 }));

    const { result } = renderHook(() => useDoctor('d1'), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.rating).toBeNull();
    expect(result.current.data?.reviewCount).toBe(180);
  });

  it('rating 이 숫자면 그 숫자를 그대로 노출한다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1', name: '김민준', rating: 4.9, reviewCount: 180 }));

    const { result } = renderHook(() => useDoctor('d1'), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.rating).toBe(4.9);
  });
});
