import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_BASE_URL,
  ApiError,
  apiRequest,
  subscribeToSessionInvalidated,
  isApiError,
} from '@/lib/apiClient';
import { readTokens, writeTokens } from '@/lib/authTokens';

/**
 * HTTP 계층만 가로챈다 (`vi.stubGlobal('fetch', ...)`). 새 의존성(msw 등)을 넣지 않고,
 * 백엔드 서버 없이 회전·재시도 규칙을 검증하기 위한 것이다.
 */
type FetchArgs = [input: string, init?: RequestInit];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorBody(code: string, message: string) {
  return { error: { code, message, requestId: 'req-test' } };
}

function authHeader(init?: RequestInit): string | null {
  return new Headers(init?.headers).get('Authorization');
}

function path(input: string): string {
  return input.startsWith(API_BASE_URL) ? input.slice(API_BASE_URL.length) : input;
}

const EXPIRED = errorBody('ACCESS_TOKEN_EXPIRED', '로그인이 만료되었어요. 다시 로그인해주세요');

beforeEach(() => {
  writeTokens({ accessToken: 'access-old', refreshToken: 'refresh-old' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest — 액세스 토큰 재발급', () => {
  it('401 ACCESS_TOKEN_EXPIRED 면 리프레시한 뒤 원 요청을 재시도한다', async () => {
    const fetchMock = vi.fn(([input, init]: FetchArgs) => {
      if (path(input) === '/auth/refresh') {
        return json(200, { accessToken: 'access-new', refreshToken: 'refresh-new' });
      }

      return authHeader(init) === 'Bearer access-new'
        ? json(200, { id: 'u1', name: '박지영' })
        : json(401, EXPIRED);
    });

    vi.stubGlobal('fetch', (...args: FetchArgs) => Promise.resolve(fetchMock(args)));

    await expect(apiRequest('/auth/me')).resolves.toEqual({ id: 'u1', name: '박지영' });

    // 원 요청(401) → 리프레시 → 원 요청 재시도
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([[input]]) => path(input))).toEqual([
      '/auth/me',
      '/auth/refresh',
      '/auth/me',
    ]);
    // 회전된 새 토큰이 저장된다
    expect(readTokens()).toEqual({ accessToken: 'access-new', refreshToken: 'refresh-new' });
  });

  it('재시도는 1회다 — 재시도까지 401 이면 그대로 실패한다', async () => {
    const fetchMock = vi.fn(([input]: FetchArgs) => {
      if (path(input) === '/auth/refresh') {
        return json(200, { accessToken: 'access-new', refreshToken: 'refresh-new' });
      }

      return json(401, EXPIRED);
    });

    vi.stubGlobal('fetch', (...args: FetchArgs) => Promise.resolve(fetchMock(args)));

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ code: 'ACCESS_TOKEN_EXPIRED' });

    expect(fetchMock.mock.calls.filter(([[input]]) => path(input) === '/auth/me')).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([[input]]) => path(input) === '/auth/refresh')).toHaveLength(1);
  });

  it('동시 요청 3개가 401 을 받아도 리프레시는 1회만 실행된다', async () => {
    // 회전이 두 번 돌면 백엔드가 재사용으로 판정해 계열 전체가 끊긴다 —
    // 이 테스트가 그 사고를 막는 핵심이다.
    let refreshCount = 0;

    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
      if (path(input) === '/auth/refresh') {
        refreshCount += 1;

        // 첫 응답이 늦게 와도(동시 401 이 몰리는 상황) 한 번만 돌아야 한다.
        return new Promise<Response>((resolve) => {
          setTimeout(() => resolve(json(200, { accessToken: 'access-new', refreshToken: 'refresh-new' })), 10);
        });
      }

      return Promise.resolve(
        authHeader(init) === 'Bearer access-new' ? json(200, { ok: path(input) }) : json(401, EXPIRED)
      );
    });

    const results = await Promise.all([
      apiRequest('/notifications'),
      apiRequest('/me/favorites'),
      apiRequest('/me/consult-requests'),
    ]);

    expect(refreshCount).toBe(1);
    expect(results).toEqual([
      { ok: '/notifications' },
      { ok: '/me/favorites' },
      { ok: '/me/consult-requests' },
    ]);
  });

  it('UNAUTHENTICATED 는 재발급을 시도하지 않는다', async () => {
    const fetchMock = vi.fn(([input]: FetchArgs) =>
      path(input) === '/auth/refresh'
        ? json(200, { accessToken: 'access-new', refreshToken: 'refresh-new' })
        : json(401, errorBody('UNAUTHENTICATED', '로그인이 필요해요'))
    );

    vi.stubGlobal('fetch', (...args: FetchArgs) => Promise.resolve(fetchMock(args)));

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
      message: '로그인이 필요해요',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 리프레시 토큰은 건드리지 않는다 — 재발급을 시도조차 하지 않았다
    expect(readTokens()?.refreshToken).toBe('refresh-old');
  });
});

describe('apiRequest — 세션 무효화', () => {
  it('REFRESH_TOKEN_REUSED 를 받으면 세션이 비워지고 구독자에게 알린다', async () => {
    vi.stubGlobal('fetch', (input: string) =>
      Promise.resolve(
        path(input) === '/auth/refresh'
          ? json(401, errorBody('REFRESH_TOKEN_REUSED', '보안을 위해 로그아웃되었어요. 다시 로그인해주세요'))
          : json(401, EXPIRED)
      )
    );

    const invalidated: string[] = [];
    const unsubscribe = subscribeToSessionInvalidated((error) => invalidated.push(error.code));

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });

    expect(readTokens()).toBeNull();
    expect(invalidated).toEqual(['REFRESH_TOKEN_REUSED']);

    unsubscribe();
  });

  it('REFRESH_TOKEN_INVALID 도 세션을 비운다', async () => {
    vi.stubGlobal('fetch', (input: string) =>
      Promise.resolve(
        path(input) === '/auth/refresh'
          ? json(401, errorBody('REFRESH_TOKEN_INVALID', '로그인이 만료되었어요. 다시 로그인해주세요'))
          : json(401, EXPIRED)
      )
    );

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALID' });
    expect(readTokens()).toBeNull();
  });

  it('네트워크 오류로 리프레시가 실패하면 세션을 비우지 않는다', async () => {
    // 오프라인일 수 있다. 여기서 토큰을 지우면 연결이 돌아와도 재로그인을 요구하게 된다.
    // (그리고 이 요청은 **재시도하지 않는다** — 회전이 서버에서 이미 성공했을 수 있다)
    vi.stubGlobal('fetch', (input: string) =>
      path(input) === '/auth/refresh'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(json(401, EXPIRED))
    );

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(readTokens()).toEqual({ accessToken: 'access-old', refreshToken: 'refresh-old' });
  });
});

describe('apiRequest — 에러·응답 파싱', () => {
  it('{error:{code,message,details,requestId}} 를 그대로 옮긴다', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        json(422, {
          error: {
            code: 'VALIDATION_FAILED',
            message: '입력값을 확인해주세요',
            details: [{ field: 'email', code: 'INVALID_EMAIL_FORMAT', message: '이메일 형식이 올바르지 않아요' }],
            requestId: '01J9X8V0Q3',
          },
        })
      )
    );

    const error = await apiRequest('/auth/signup', { method: 'POST', auth: false, body: {} }).catch(
      (caught: unknown) => caught
    );

    expect(isApiError(error)).toBe(true);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      message: '입력값을 확인해주세요',
      requestId: '01J9X8V0Q3',
    });
    expect((error as ApiError).details?.[0].field).toBe('email');
  });

  it('204 는 본문 없이 성공으로 처리한다', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 204 })));

    await expect(apiRequest('/auth/logout', { method: 'POST', body: {} })).resolves.toBeUndefined();
  });

  it('토큰이 없으면 Authorization 헤더를 붙이지 않는다', async () => {
    window.localStorage.clear();

    const seen: (string | null)[] = [];

    vi.stubGlobal('fetch', (_input: string, init?: RequestInit) => {
      seen.push(authHeader(init));

      return Promise.resolve(json(200, []));
    });

    await apiRequest('/procedures');

    expect(seen).toEqual([null]);
  });
});
