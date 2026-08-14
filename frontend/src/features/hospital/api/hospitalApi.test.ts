import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createHospital,
  fetchHospitalById,
  fetchHospitals,
  fetchManagedHospitals,
  updateHospital,
  type HospitalWriteInput,
} from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';

/**
 * 병원 조회·쓰기 전부 HTTP 다 — `vi.stubGlobal('fetch', ...)` 로 가로챈다.
 */
const fetchMock = vi.fn();

function baseWriteInput(overrides: Partial<HospitalWriteInput> = {}): HospitalWriteInput {
  return {
    name: '강남 스마일 치과',
    specialty: '',
    region: '서울 강남구',
    address: '서울특별시 강남구 테헤란로 123',
    latitude: 37.5,
    longitude: 127.0,
    thumbnail: '',
    introduction: '',
    priceRange: { min: 100000, max: 200000 },
    tags: [],
    procedureIds: ['implant'],
    consultAvailable: true,
    isOneDay: false,
    businessHours: [],
    directions: '',
    features: {
      coordinator: false,
      painlessAnesthesia: false,
      digitalCare: false,
      parking: false,
      nightConsult: false,
      cctv: false,
    },
    ...overrides,
  };
}

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

describe('fetchHospitals', () => {
  it('필터를 쿼리 파라미터로 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchHospitals({ procedureId: 'implant', sort: 'reviewCount', consultAvailable: true });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('procedureId=implant');
    expect(url).toContain('sort=reviewCount');
    expect(url).toContain('consultAvailable=true');
  });

  it('값이 없는 필터는 보내지 않는다 — 서버가 "지정 안 함" 과 false 를 구분한다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchHospitals({ procedureId: undefined, consultAvailable: undefined });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain('procedureId');
    expect(url).not.toContain('consultAvailable');
  });

  it('items 와 meta 를 그대로 돌려준다', async () => {
    const body = { items: [{ id: 'h1' }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchHospitals()).resolves.toEqual(body);
  });

  it('필터 없이 호출하면 물음표 없는 경로를 부른다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchHospitals();

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/hospitals$/);
  });
});

describe('fetchHospitalById', () => {
  it('상세 경로를 부른다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'h1' }));

    await fetchHospitalById('h1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/hospitals/h1');
  });

  it('찾은 병원을 그대로 돌려준다', async () => {
    const body = { id: 'h1', name: '강남 스마일 치과' };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchHospitalById('h1')).resolves.toEqual(body);
  });

  it('없는 id 면 ApiError(HOSPITAL_NOT_FOUND) 를 던진다 — null 을 돌려주지 않는다', async () => {
    fetchMock.mockResolvedValue(notFound());

    const error = await fetchHospitalById('no-such-id').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HOSPITAL_NOT_FOUND');
    expect((error as ApiError).status).toBe(404);
  });
});

describe('createHospital', () => {
  it('POST /hospitals 로 등록한다 (operator 전용)', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'new-hospital' }));

    await createHospital(baseWriteInput());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/hospitals$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toMatchObject({ name: '강남 스마일 치과' });
  });

  it('doctors 를 함께 보내면 등록과 동시에 소속 전문의를 만든다 (원자적 생성)', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'new-hospital' }));

    await createHospital({ ...baseWriteInput(), doctors: [{ name: '김민준', specialty: '일반의' }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.doctors).toEqual([{ name: '김민준', specialty: '일반의' }]);
  });

  it('등록된 병원을 그대로 돌려준다', async () => {
    const body = { id: 'new-hospital', name: '새로등록한치과' };
    fetchMock.mockResolvedValue(ok(body));

    await expect(createHospital(baseWriteInput())).resolves.toEqual(body);
  });

  it('422 는 그대로 던진다 (예: FIELD_NOT_WRITABLE)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'FIELD_NOT_WRITABLE',
          message: '수정할 수 없는 항목이에요',
          details: [{ field: 'isRecommended', code: 'not_writable', message: '수정할 수 없는 항목이에요' }],
        },
      }),
      text: async () =>
        JSON.stringify({
          error: {
            code: 'FIELD_NOT_WRITABLE',
            message: '수정할 수 없는 항목이에요',
            details: [{ field: 'isRecommended', code: 'not_writable', message: '수정할 수 없는 항목이에요' }],
          },
        }),
    } as Response);

    const error = await createHospital(baseWriteInput()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('FIELD_NOT_WRITABLE');
    expect((error as ApiError).details?.[0]?.field).toBe('isRecommended');
  });
});

describe('updateHospital', () => {
  it('PATCH /hospitals/:id 로 부분 수정한다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'h1' }));

    await updateHospital('h1', baseWriteInput({ name: '수정된치과' }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/hospitals/h1');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toMatchObject({ name: '수정된치과' });
  });

  it('없는 id 면 ApiError(HOSPITAL_NOT_FOUND) 를 던진다', async () => {
    fetchMock.mockResolvedValue(notFound());

    const error = await updateHospital('no-such-id', baseWriteInput()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HOSPITAL_NOT_FOUND');
  });

  it('403 HOSPITAL_NOT_MANAGED 를 그대로 던진다', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { code: 'HOSPITAL_NOT_MANAGED', message: '담당하지 않는 병원이에요' } }),
      text: async () =>
        JSON.stringify({ error: { code: 'HOSPITAL_NOT_MANAGED', message: '담당하지 않는 병원이에요' } }),
    } as Response);

    const error = await updateHospital('h1', baseWriteInput()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HOSPITAL_NOT_MANAGED');
  });
});

describe('fetchManagedHospitals', () => {
  it('GET /admin/hospitals 를 부르고 scope 를 포함한 응답을 그대로 돌려준다', async () => {
    const body = { items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, scope: 'managed' };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchManagedHospitals()).resolves.toEqual(body);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/admin\/hospitals$/);
  });

  it('필터를 쿼리 파라미터로 보낸다', async () => {
    fetchMock.mockResolvedValue(
      ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, scope: 'all' })
    );

    await fetchManagedHospitals({ page: 2, q: '스마일' });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('page=2');
    expect(url).toContain('q=');
  });
});
