import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addConsultMemo,
  createConsultRequest,
  fetchConsultRequestById,
  fetchConsultRequests,
  fetchMyConsultRequests,
  updateConsultStatus,
  type ConsultRequestCreateInput,
} from '@/features/consult/api/consultApi';
import { ApiError } from '@/lib/apiClient';

/**
 * 상담 api 는 2026-10-22(요청서 15)부터 **전부 HTTP** 다. 판정·마스킹·알림은 서버가 하고
 * (`backend/test/consult*.spec.ts` 가 그쪽을 고정한다), 여기서 고정하는 것은 **배선**이다:
 * 어느 경로를 어떤 메서드로 부르는가, 필터가 쿼리 문자열로 어떻게 나가는가, 응답과 에러를
 * 손대지 않고 그대로 넘기는가.
 *
 * `vi.stubGlobal('fetch', ...)` 수법은 병원·전문의 api 테스트와 같다.
 */
const fetchMock = vi.fn();

function ok(body: unknown, status = 200): Response {
  return {
    ok: true,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function fail(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function emptyList(): Response {
  return ok({
    items: [],
    meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    scope: 'managed',
    statusCounts: { new: 0, contacted: 0, booked: 0, visited: 0, cancelled: 0, total: 0 },
  });
}

function createInput(overrides: Partial<ConsultRequestCreateInput> = {}): ConsultRequestCreateInput {
  return {
    hospitalId: 'h1',
    procedureId: 'implant-general',
    name: '김민준',
    phone: '010-1234-5678',
    preferredTime: '평일 오후',
    message: '상담 원해요',
    thirdPartyConsent: { agreed: true, noticeVersion: '2026-10-12' },
    ...overrides,
  };
}

function calledUrl(index = 0): string {
  return String(fetchMock.mock.calls[index][0]);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createConsultRequest', () => {
  it('POST /consult-requests 로 폼 값을 그대로 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'cr1' }, 201));

    await createConsultRequest(createInput({ doctorId: 'd1' }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/consult-requests$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      hospitalId: 'h1',
      doctorId: 'd1',
      procedureId: 'implant-general',
      name: '김민준',
      phone: '010-1234-5678',
      preferredTime: '평일 오후',
      message: '상담 원해요',
      thirdPartyConsent: { agreed: true, noticeVersion: '2026-10-12' },
    });
  });

  it('동의 시각은 보내지 않는다 — 받는 쪽 시계가 증빙이다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'cr1' }, 201));

    await createConsultRequest(createInput());

    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).thirdPartyConsent).not.toHaveProperty(
      'agreedAt'
    );
  });

  it('접수된 상담(신청자 시야)을 그대로 돌려준다', async () => {
    const body = { id: 'cr1', hospitalId: 'h1', hospitalName: '강남 스마일 치과', status: 'new' };
    fetchMock.mockResolvedValue(ok(body, 201));

    await expect(createConsultRequest(createInput())).resolves.toEqual(body);
  });

  it('동의 없이 보내면 서버의 422 THIRD_PARTY_CONSENT_REQUIRED 를 그대로 던진다', async () => {
    fetchMock.mockResolvedValue(
      fail(422, {
        error: {
          code: 'THIRD_PARTY_CONSENT_REQUIRED',
          message: '개인정보 제3자 제공에 동의해야 상담을 신청할 수 있어요',
        },
      })
    );

    const error = await createConsultRequest(createInput({ thirdPartyConsent: { agreed: false, noticeVersion: 'v' } })).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('THIRD_PARTY_CONSENT_REQUIRED');
  });

  it('연락처 형식 오류의 details[] 도 손대지 않고 넘긴다 — 폼이 그 칸을 짚는다', async () => {
    fetchMock.mockResolvedValue(
      fail(422, {
        error: {
          code: 'VALIDATION_FAILED',
          message: '입력값을 확인해주세요',
          details: [
            {
              field: 'phone',
              code: 'INVALID_PHONE_FORMAT',
              message: '휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요',
            },
          ],
        },
      })
    );

    const error = await createConsultRequest(createInput({ phone: '123' })).catch((caught: unknown) => caught);

    expect((error as ApiError).details?.[0]).toMatchObject({ field: 'phone', code: 'INVALID_PHONE_FORMAT' });
  });

  it('상담을 받지 않는 병원은 409 CONSULT_CLOSED 다', async () => {
    fetchMock.mockResolvedValue(
      fail(409, { error: { code: 'CONSULT_CLOSED', message: '지금은 상담 신청을 받지 않는 병원이에요' } })
    );

    const error = await createConsultRequest(createInput()).catch((caught: unknown) => caught);

    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe('CONSULT_CLOSED');
  });
});

describe('fetchConsultRequests', () => {
  it('필터 없이 부르면 물음표 없는 경로다', async () => {
    fetchMock.mockResolvedValue(emptyList());

    await fetchConsultRequests();

    expect(calledUrl()).toMatch(/\/consult-requests$/);
  });

  it('페이지·병원·기간·검색을 쿼리 파라미터로 보낸다', async () => {
    fetchMock.mockResolvedValue(emptyList());

    await fetchConsultRequests({ page: 2, pageSize: 50, hospitalId: 'h1', period: 'thisMonth', q: '민준' });

    const url = calledUrl();
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=50');
    expect(url).toContain('hospitalId=h1');
    expect(url).toContain('period=thisMonth');
    expect(url).toContain(`q=${encodeURIComponent('민준')}`);
  });

  it('상태 여러 개는 반복 파라미터다 — 쉼표로 잇지 않는다', async () => {
    fetchMock.mockResolvedValue(emptyList());

    await fetchConsultRequests({ status: ['new', 'contacted'] });

    expect(calledUrl()).toContain('status=new&status=contacted');
  });

  it('상태 하나도 같은 이름으로 한 번 보낸다', async () => {
    fetchMock.mockResolvedValue(emptyList());

    await fetchConsultRequests({ status: 'booked' });

    expect(calledUrl()).toContain('status=booked');
  });

  it('시술 필터도 반복 파라미터다 (대분류를 화면이 풀어서 보낸다)', async () => {
    fetchMock.mockResolvedValue(emptyList());

    await fetchConsultRequests({ procedureId: ['resin', 'inlay'] });

    expect(calledUrl()).toContain('procedureId=resin&procedureId=inlay');
  });

  it('items·meta·scope·statusCounts 를 그대로 돌려준다 — 화면이 다시 세지 않는다', async () => {
    const body = {
      items: [{ id: 'cr1' }],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      scope: 'all',
      statusCounts: { new: 1, contacted: 0, booked: 0, visited: 0, cancelled: 0, total: 1 },
    };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchConsultRequests()).resolves.toEqual(body);
  });

  it('기간을 두 방식으로 함께 보내면 서버의 422 PERIOD_FILTER_CONFLICT 가 올라온다', async () => {
    fetchMock.mockResolvedValue(
      fail(422, {
        error: { code: 'PERIOD_FILTER_CONFLICT', message: '기간 조건은 한 가지 방식으로만 보낼 수 있어요' },
      })
    );

    const error = await fetchConsultRequests({ period: 'today', createdFrom: '2026-10-01T00:00:00.000Z' }).catch(
      (caught: unknown) => caught
    );

    expect((error as ApiError).code).toBe('PERIOD_FILTER_CONFLICT');
  });

  it('담당하지 않는 병원을 물으면 403 HOSPITAL_NOT_MANAGED 다', async () => {
    fetchMock.mockResolvedValue(
      fail(403, { error: { code: 'HOSPITAL_NOT_MANAGED', message: '담당하지 않는 병원이에요' } })
    );

    const error = await fetchConsultRequests({ hospitalId: 'h9' }).catch((caught: unknown) => caught);

    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).code).toBe('HOSPITAL_NOT_MANAGED');
  });
});

describe('fetchConsultRequestById', () => {
  it('상세 경로를 부른다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'cr1' }));

    await fetchConsultRequestById('cr1');

    expect(calledUrl()).toMatch(/\/consult-requests\/cr1$/);
  });

  it('id 를 URL 인코딩한다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'cr 1' }));

    await fetchConsultRequestById('cr 1');

    expect(calledUrl()).toContain('/consult-requests/cr%201');
  });

  it('없는 상담과 담당 밖 상담 모두 404 CONSULT_REQUEST_NOT_FOUND 다', async () => {
    fetchMock.mockResolvedValue(
      fail(404, { error: { code: 'CONSULT_REQUEST_NOT_FOUND', message: '상담 정보를 찾을 수 없어요' } })
    );

    const error = await fetchConsultRequestById('nope').catch((caught: unknown) => caught);

    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('CONSULT_REQUEST_NOT_FOUND');
  });
});

describe('fetchMyConsultRequests', () => {
  it('/me/consult-requests 를 부른다 — 주체는 토큰이 정한다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchMyConsultRequests();

    expect(calledUrl()).toMatch(/\/me\/consult-requests$/);
  });

  it('상태·페이지 필터를 쿼리로 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchMyConsultRequests({ status: 'booked', pageSize: 100 });

    const url = calledUrl();
    expect(url).toContain('status=booked');
    expect(url).toContain('pageSize=100');
  });

  it('병원 이름이 함께 온다 — 줄마다 병원을 조회하지 않는다', async () => {
    const body = {
      items: [{ id: 'cr1', hospitalId: 'h1', hospitalName: '강남 스마일 치과' }],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchMyConsultRequests()).resolves.toEqual(body);
  });
});

describe('updateConsultStatus', () => {
  it('PATCH 로 상태·일시·사유 세 필드만 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'cr1', status: 'booked' }));

    await updateConsultStatus('cr1', { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/consult-requests\/cr1\/status$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({
      status: 'booked',
      visitAt: '2026-10-09T05:00:00.000Z',
    });
  });

  it('취소는 사유를 함께 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'cr1', status: 'cancelled' }));

    await updateConsultStatus('cr1', { status: 'cancelled', cancelReason: 'no_answer' });

    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      status: 'cancelled',
      cancelReason: 'no_answer',
    });
  });

  // 쓰기 응답은 **목록 투영**이다 — 담당자에게도 번호를 가린다(계약 §4, 2026-10-22).
  // no-op `PATCH` 를 반복해 열람 기록 없이 번호를 모으는 경로를 막는 규칙이고, 이 함수는
  // 서버가 준 것을 그대로 올려 보내기만 한다.
  it('바뀐 상담 전체를 그대로 돌려준다 (목록 투영 — 번호는 가려져 온다)', async () => {
    const body = {
      id: 'cr1',
      status: 'booked',
      visitAt: '2026-10-09T05:00:00.000Z',
      phone: '010-****-4411',
      piiMasked: true,
    };
    fetchMock.mockResolvedValue(ok(body));

    await expect(updateConsultStatus('cr1', { status: 'booked' })).resolves.toEqual(body);
  });

  it('필수 입력이 빠지면 서버의 422 가 details[] 와 함께 올라온다', async () => {
    fetchMock.mockResolvedValue(
      fail(422, {
        error: {
          code: 'VALIDATION_FAILED',
          message: '입력값을 확인해주세요',
          details: [{ field: 'visitAt', code: 'VISIT_AT_REQUIRED', message: '확정 일시를 입력해주세요' }],
        },
      })
    );

    const error = await updateConsultStatus('cr1', { status: 'booked' }).catch((caught: unknown) => caught);

    expect((error as ApiError).details?.[0]).toMatchObject({ field: 'visitAt', code: 'VISIT_AT_REQUIRED' });
  });

  it('운영자가 부르면 403 이다 — 상태 변경은 담당 병원 관리자뿐이다', async () => {
    fetchMock.mockResolvedValue(
      fail(403, { error: { code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없어요' } })
    );

    const error = await updateConsultStatus('cr1', { status: 'contacted' }).catch((caught: unknown) => caught);

    expect((error as ApiError).status).toBe(403);
  });
});

describe('addConsultMemo', () => {
  it('POST 로 본문 한 줄만 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'cr1', memos: [{ id: 'm1', content: '통화함' }] }, 201));

    await addConsultMemo('cr1', '통화함');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/consult-requests\/cr1\/memos$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ content: '통화함' });
  });

  it('메모가 붙은 상담 전체를 돌려준다', async () => {
    const body = { id: 'cr1', memos: [{ id: 'm1', content: '통화함', createdAt: '2026-10-22T00:00:00.000Z' }] };
    fetchMock.mockResolvedValue(ok(body, 201));

    await expect(addConsultMemo('cr1', '통화함')).resolves.toEqual(body);
  });

  it('담당 병원 밖의 상담은 404 다', async () => {
    fetchMock.mockResolvedValue(
      fail(404, { error: { code: 'CONSULT_REQUEST_NOT_FOUND', message: '상담 정보를 찾을 수 없어요' } })
    );

    const error = await addConsultMemo('cr9', '메모').catch((caught: unknown) => caught);

    expect((error as ApiError).code).toBe('CONSULT_REQUEST_NOT_FOUND');
  });
});
