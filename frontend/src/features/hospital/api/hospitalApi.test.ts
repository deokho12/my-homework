import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createHospital,
  fetchHospitalById,
  fetchHospitals,
  updateHospital,
} from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';
import { mockDb } from '@/mocks/db';
import type { Hospital } from '@/types/domain';

/**
 * `fetchHospitals`/`fetchHospitalById` 만 HTTP 로 바뀐다 — `vi.stubGlobal('fetch', ...)` 로
 * 가로챈다. `createHospital`/`updateHospital` 은 아직 `mockDb` 를 쓴다(관리자 화면이
 * 이관되는 나중 Task 전까지).
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
  mockDb.reset();
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

describe('createHospital / updateHospital — 아직 mockDb', () => {
  it('updateHospital 이 mockDb 에 쓴 값을 mockDb.read 로 확인할 수 있다', async () => {
    const target = mockDb.read('hospitals')[0];

    await updateHospital(target.id, { name: '수정된치과' });

    const reread = mockDb.read('hospitals').find((hospital) => hospital.id === target.id);
    expect(reread?.name).toBe('수정된치과');
  });

  it('updateHospital 은 다른 병원을 건드리지 않는다', async () => {
    const [first, second] = mockDb.read('hospitals');

    await updateHospital(first.id, { name: '수정된치과' });

    const other = mockDb.read('hospitals').find((hospital) => hospital.id === second.id);
    expect(other?.name).toBe(second.name);
  });

  it('없는 id 를 수정하면 던진다', async () => {
    await expect(updateHospital('no-such-id', { name: 'x' })).rejects.toThrow(
      '병원을 찾을 수 없어요: no-such-id'
    );
  });

  it('createHospital 이 목록 길이를 늘린다', async () => {
    const before = mockDb.read('hospitals').length;
    const seed = mockDb.read('hospitals')[0];

    await createHospital({ ...seed, id: 'new-hospital', name: '새로등록한치과' } as Hospital);

    const after = mockDb.read('hospitals');
    expect(after).toHaveLength(before + 1);
    expect(after.find((hospital) => hospital.id === 'new-hospital')?.name).toBe('새로등록한치과');
  });
});
