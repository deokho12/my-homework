import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decideVerification,
  deleteDoctor,
  fetchDoctorById,
  fetchDoctors,
  fetchHospitalDoctors,
  fetchVerificationQueue,
  replaceHospitalDoctors,
  updateDoctor,
} from '@/features/doctor/api/doctorApi';
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

describe('replaceHospitalDoctors', () => {
  it('PUT 으로 병원 소속 전문의를 일괄 교체한다', async () => {
    fetchMock.mockResolvedValue(ok([{ id: 'd1', certificateUrl: null }]));

    await replaceHospitalDoctors('h1', [{ name: '김민준', specialty: '일반의' }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/hospitals/h1/doctors');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ doctors: [{ name: '김민준', specialty: '일반의' }] });
  });

  it('★ 함정1 — certificateUrl 을 건드리지 않은 항목은 요청 본문에 그 키가 없다', async () => {
    fetchMock.mockResolvedValue(ok([]));

    await replaceHospitalDoctors('h1', [{ id: 'd1', name: '김민준', specialty: '일반의' }]);

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as { doctors: Record<string, unknown>[] };
    expect('certificateUrl' in body.doctors[0]).toBe(false);
  });

  it('결과(DoctorAdminView[])를 그대로 돌려준다', async () => {
    const body = [{ id: 'd1', certificateUrl: 'https://example.com/cert.png', rejectionReason: null }];
    fetchMock.mockResolvedValue(ok(body));

    await expect(replaceHospitalDoctors('h1', [])).resolves.toEqual(body);
  });
});

describe('updateDoctor', () => {
  it('PATCH 로 단건 수정한다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1' }));

    await updateDoctor('d1', { title: '부원장' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/doctors/d1');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ title: '부원장' });
  });
});

describe('deleteDoctor', () => {
  it('DELETE 로 삭제한다', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: async () => '',
    } as Response);

    await deleteDoctor('d1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/doctors/d1');
    expect(init?.method).toBe('DELETE');
  });
});

describe('fetchVerificationQueue', () => {
  it('검수 큐를 조회한다', async () => {
    const body = { items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchVerificationQueue()).resolves.toEqual(body);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/doctors\/verification-queue$/);
  });

  it('필터를 쿼리 파라미터로 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchVerificationQueue({ includeGeneralPractitioners: true, status: 'pending' });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('includeGeneralPractitioners=true');
    expect(url).toContain('status=pending');
  });
});

describe('decideVerification', () => {
  it('PUT 으로 승인·반려를 결정한다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1', verificationStatus: 'approved' }));

    await decideVerification('d1', { status: 'approved' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/doctors/d1/verification');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ status: 'approved' });
  });

  it('반려 사유를 함께 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1', verificationStatus: 'rejected' }));

    await decideVerification('d1', { status: 'rejected', rejectionReason: '자격증이 흐려요' });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body).toEqual({ status: 'rejected', rejectionReason: '자격증이 흐려요' });
  });
});
