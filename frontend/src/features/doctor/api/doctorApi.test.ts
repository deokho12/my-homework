import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchDoctorById, fetchDoctors, fetchHospitalDoctors } from '@/features/doctor/api/doctorApi';
import { ApiError } from '@/lib/apiClient';

/**
 * `vi.stubGlobal('fetch', ...)` 로 가로챈다 (`hospitalApi.test.ts` 와 같은 방식).
 */
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

function notFound(code: string): Response {
  const body = { error: { code, message: '찾을 수 없어요' } };
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

describe('fetchDoctors', () => {
  it('필터를 쿼리 파라미터로 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchDoctors({ hospitalId: 'h1', verifiedSpecialist: true, sort: 'rating' });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('hospitalId=h1');
    expect(url).toContain('verifiedSpecialist=true');
    expect(url).toContain('sort=rating');
  });

  it('값이 없는 필터는 보내지 않는다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchDoctors({ hospitalId: undefined, verifiedSpecialist: undefined });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain('hospitalId');
    expect(url).not.toContain('verifiedSpecialist');
  });

  it('필터 없이 호출하면 물음표 없는 경로를 부른다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchDoctors();

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/doctors$/);
  });

  it('items 와 meta 를 그대로 돌려준다', async () => {
    const body = { items: [{ id: 'd1' }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchDoctors()).resolves.toEqual(body);
  });
});

describe('fetchDoctorById', () => {
  it('상세 경로를 부른다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1' }));

    await fetchDoctorById('d1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/doctors/d1');
  });

  it('없는 id 면 ApiError(DOCTOR_NOT_FOUND) 를 던진다 — null 을 돌려주지 않는다', async () => {
    fetchMock.mockResolvedValue(notFound('DOCTOR_NOT_FOUND'));

    const error = await fetchDoctorById('no-such-id').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('DOCTOR_NOT_FOUND');
    expect((error as ApiError).status).toBe(404);
  });
});

describe('fetchHospitalDoctors', () => {
  it('병원 소속 전문의 경로를 부른다', async () => {
    fetchMock.mockResolvedValue(ok([{ id: 'd1' }, { id: 'd2' }]));

    const result = await fetchHospitalDoctors('h1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/hospitals/h1/doctors');
    expect(result).toEqual([{ id: 'd1' }, { id: 'd2' }]);
  });

  it('없는 병원이면 ApiError(HOSPITAL_NOT_FOUND) 를 던진다', async () => {
    fetchMock.mockResolvedValue(notFound('HOSPITAL_NOT_FOUND'));

    const error = await fetchHospitalDoctors('no-such-hospital').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HOSPITAL_NOT_FOUND');
  });
});
