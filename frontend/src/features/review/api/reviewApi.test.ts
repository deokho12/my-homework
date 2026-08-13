import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchHospitalReviews } from '@/features/review/api/reviewApi';
import { ApiError } from '@/lib/apiClient';

const fetchMock = vi.fn();

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

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchHospitalReviews', () => {
  it('병원별 후기 경로를 부른다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchHospitalReviews('h1');

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/hospitals\/h1\/reviews$/);
  });

  it('procedureId 필터를 쿼리 파라미터로 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchHospitalReviews('h1', { procedureId: 'implant' });

    expect(String(fetchMock.mock.calls[0][0])).toContain('procedureId=implant');
  });

  it('items 와 meta 를 그대로 돌려준다', async () => {
    const body = { items: [{ id: 'r1' }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchHospitalReviews('h1')).resolves.toEqual(body);
  });

  it('없는 병원이면 ApiError(HOSPITAL_NOT_FOUND) 를 던진다', async () => {
    fetchMock.mockResolvedValue(notFound());

    const error = await fetchHospitalReviews('no-such-hospital').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HOSPITAL_NOT_FOUND');
  });
});
