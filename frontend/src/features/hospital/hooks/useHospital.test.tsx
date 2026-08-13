import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHospital, useHospitals } from '@/features/hospital';
import { isApiError, type ApiError } from '@/lib/apiClient';
import { mockDb } from '@/mocks/db';
import { queryWrapper } from '@/test/queryWrapper';

/**
 * `fetchHospitals`/`fetchHospitalById` 가 HTTP 를 부르므로 `vi.stubGlobal('fetch', ...)` 로
 * 가로챈다. 목 DB 는 응답 본문을 채우는 데만 쓴다 (실제 요청 경로는 아니다).
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

function notFound(): Response {
  const body = { error: { code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' } };
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

describe('hospital 조회 훅', () => {
  it('useHospitals 는 loading 을 지나 페이지네이션 응답을 반환한다', async () => {
    const seed = mockDb.read('hospitals');
    fetchMock.mockResolvedValue(
      ok({ items: seed, meta: { page: 1, pageSize: 20, totalItems: seed.length, totalPages: 1 } })
    );

    const { result } = renderHook(() => useHospitals(), { wrapper: queryWrapper });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(seed.length);
    expect(result.current.data?.meta.totalItems).toBe(seed.length);
  });

  it('useHospital 은 id 로 한 건을 반환한다', async () => {
    const target = mockDb.read('hospitals')[0];
    fetchMock.mockResolvedValue(ok(target));

    const { result } = renderHook(() => useHospital(target.id), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe(target.name);
  });

  it('없는 id 는 ApiError(HOSPITAL_NOT_FOUND) 를 error 로 노출한다 (data 는 undefined)', async () => {
    fetchMock.mockResolvedValue(notFound());

    const { result } = renderHook(() => useHospital('no-such-hospital'), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(isApiError(result.current.error)).toBe(true);
    expect((result.current.error as ApiError).code).toBe('HOSPITAL_NOT_FOUND');
  });

  it('id 가 undefined 면 조회를 시작하지 않는다', () => {
    const { result } = renderHook(() => useHospital(undefined), { wrapper: queryWrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
