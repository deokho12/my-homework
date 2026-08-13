import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHospitalDoctors } from '@/features/doctor';
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

describe('useHospitalDoctors', () => {
  it('병원 소속 전문의 배열을 그대로 반환한다', async () => {
    fetchMock.mockResolvedValue(ok([{ id: 'd1' }, { id: 'd2' }]));

    const { result } = renderHook(() => useHospitalDoctors('h1'), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('없는 병원이면 ApiError(HOSPITAL_NOT_FOUND) 를 error 로 노출한다', async () => {
    fetchMock.mockResolvedValue(notFound());

    const { result } = renderHook(() => useHospitalDoctors('no-such-hospital'), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isApiError(result.current.error)).toBe(true);
    expect((result.current.error as ApiError).code).toBe('HOSPITAL_NOT_FOUND');
  });

  it('hospitalId 가 undefined 면 조회를 시작하지 않는다', () => {
    const { result } = renderHook(() => useHospitalDoctors(undefined), { wrapper: queryWrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
