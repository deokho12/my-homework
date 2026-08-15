import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LEGACY_MOCK_AUTH_KEY, readTokens, writeTokens } from '@/lib/authTokens';
import { useAuthStore } from '@/store/useAuthStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';

interface StubCall {
  path: string;
  method: string;
  body: unknown;
  authorization: string | null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 경로별 응답을 정하는 fetch 스텁. 백엔드 서버 없이 스토어 동작만 검증한다. */
function stubFetch(routes: Record<string, () => Response>): StubCall[] {
  const calls: StubCall[] = [];

  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    const path = String(input).replace(/^.*(\/auth\/|\/legal-documents\/)/, '$1');

    calls.push({
      path,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      authorization: new Headers(init?.headers).get('Authorization'),
    });

    const handler = routes[path];

    if (!handler) return Promise.resolve(json(404, { error: { code: 'NOT_FOUND', message: '없어요', requestId: 'r' } }));

    return Promise.resolve(handler());
  });

  return calls;
}

const SESSION = {
  user: {
    id: 'u1',
    email: 'seed-1@molarmolar.example',
    name: '박지영',
    provider: 'email',
    role: 'user',
    managedHospitalIds: [],
  },
  tokens: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshExpiresIn: 2592000,
  },
};

beforeEach(() => {
  useAuthStore.setState({ user: null, status: 'ready' });
  useFavoritesStore.setState({ hospitalIds: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAuthStore — 로그인', () => {
  it('로그인 성공 시 사용자와 토큰을 저장한다', async () => {
    stubFetch({ '/auth/login': () => json(200, SESSION) });

    const result = await useAuthStore.getState().logIn({ email: 'seed-1@molarmolar.example', password: 'pw' });

    expect(result).toEqual({ ok: true });
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u1', role: 'user', managedHospitalIds: [] });
    expect(readTokens()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('서버 역할을 그대로 쓴다 (관리자 판정의 근거)', async () => {
    stubFetch({
      '/auth/login': () =>
        json(200, { ...SESSION, user: { ...SESSION.user, role: 'operator', managedHospitalIds: [] } }),
    });

    await useAuthStore.getState().logIn({ email: 'ops@molarmolar.example', password: 'pw' });

    expect(useAuthStore.getState().user?.role).toBe('operator');
  });

  it('로그인 실패는 서버 코드와 문구를 그대로 돌려준다', async () => {
    stubFetch({
      '/auth/login': () =>
        json(401, {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '이메일 또는 비밀번호가 올바르지 않아요',
            requestId: 'r1',
          },
        }),
    });

    const result = await useAuthStore.getState().logIn({ email: 'a@b.com', password: 'wrong' });

    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않아요', details: undefined },
    });
    expect(useAuthStore.getState().user).toBeNull();
    expect(readTokens()).toBeNull();
  });

  it('422 의 details 를 화면이 쓸 수 있게 함께 돌려준다', async () => {
    stubFetch({
      '/auth/signup': () =>
        json(422, {
          error: {
            code: 'VALIDATION_FAILED',
            message: '입력값을 확인해주세요',
            details: [{ field: 'email', code: 'INVALID_EMAIL_FORMAT', message: '이메일 형식이 올바르지 않아요' }],
            requestId: 'r1',
          },
        }),
    });

    const result = await useAuthStore.getState().signUp({ name: '박지영', email: 'nope', password: 'pw1234' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.details?.[0]).toEqual({
      field: 'email',
      code: 'INVALID_EMAIL_FORMAT',
      message: '이메일 형식이 올바르지 않아요',
    });
  });

  it('다른 계정으로 로그인하면 앞 계정의 찜을 비운다', async () => {
    useFavoritesStore.setState({ hospitalIds: ['h1', 'h2'] });
    stubFetch({ '/auth/login': () => json(200, SESSION) });

    await useAuthStore.getState().logIn({ email: 'seed-2@molarmolar.example', password: 'pw' });

    expect(useFavoritesStore.getState().hospitalIds).toEqual([]);
  });
});

describe('useAuthStore — 로그아웃', () => {
  it('서버 세션을 폐기하고 로컬을 비운다', async () => {
    writeTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    useAuthStore.setState({ user: { ...SESSION.user, provider: 'email', role: 'user' }, status: 'ready' });

    const calls = stubFetch({ '/auth/logout': () => new Response(null, { status: 204 }) });

    await useAuthStore.getState().logOut();

    expect(calls).toEqual([
      {
        path: '/auth/logout',
        method: 'POST',
        body: { refreshToken: 'refresh-1' },
        authorization: 'Bearer access-1',
      },
    ]);
    expect(useAuthStore.getState().user).toBeNull();
    expect(readTokens()).toBeNull();
  });

  it('찜 목록을 비운다', async () => {
    // 비우지 않으면 다음에 로그인한 계정에 앞 사람의 찜이 그대로 보인다.
    writeTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    useFavoritesStore.setState({ hospitalIds: ['h1', 'h3'] });
    stubFetch({ '/auth/logout': () => new Response(null, { status: 204 }) });

    await useAuthStore.getState().logOut();

    expect(useFavoritesStore.getState().hospitalIds).toEqual([]);
  });

  it('서버 폐기가 실패해도 로컬은 비운다', async () => {
    writeTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    useFavoritesStore.setState({ hospitalIds: ['h1'] });
    stubFetch({
      '/auth/logout': () =>
        json(500, { error: { code: 'INTERNAL_ERROR', message: '일시적인 문제가 발생했어요', requestId: 'r' } }),
    });

    await useAuthStore.getState().logOut();

    expect(useAuthStore.getState().user).toBeNull();
    expect(readTokens()).toBeNull();
    expect(useFavoritesStore.getState().hospitalIds).toEqual([]);
  });
});

describe('useAuthStore — 세션 복원', () => {
  it('저장된 토큰으로 GET /auth/me 를 불러 사용자를 되살린다', async () => {
    writeTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    const calls = stubFetch({
      '/auth/me': () => json(200, { ...SESSION.user, role: 'hospital_admin', managedHospitalIds: ['h1'] }),
    });

    await useAuthStore.getState().restoreSession();

    expect(calls[0]).toMatchObject({ path: '/auth/me', authorization: 'Bearer access-1' });
    expect(useAuthStore.getState()).toMatchObject({ status: 'ready' });
    expect(useAuthStore.getState().user).toMatchObject({ role: 'hospital_admin', managedHospitalIds: ['h1'] });
  });

  it('복원이 실패하면 조용히 비운다', async () => {
    writeTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    stubFetch({
      '/auth/me': () => json(401, { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요해요', requestId: 'r' } }),
    });

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().status).toBe('ready');
    expect(readTokens()).toBeNull();
  });

  it('토큰이 없으면 요청하지 않고 바로 ready 가 된다', async () => {
    const calls = stubFetch({});

    await useAuthStore.getState().restoreSession();

    expect(calls).toEqual([]);
    expect(useAuthStore.getState().status).toBe('ready');
  });
});

describe('useAuthStore — 평문 비밀번호 저장 제거', () => {
  function localStorageDump(): string {
    const entries: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (key) entries.push(`${key}=${window.localStorage.getItem(key) ?? ''}`);
    }

    return entries.join('\n');
  }

  it('가입해도 비밀번호가 저장되지 않는다', async () => {
    stubFetch({ '/auth/signup': () => json(201, SESSION) });

    await useAuthStore
      .getState()
      .signUp({ name: '박지영', email: 'new@molarmolar.example', password: 'plain-text-secret' });

    const dump = localStorageDump();

    expect(dump).not.toContain('plain-text-secret');
    expect(dump).not.toContain('password');
    // 저장되는 것은 토큰뿐이다
    expect(readTokens()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('스토어 상태에 계정 목록이 존재하지 않는다', async () => {
    stubFetch({ '/auth/login': () => json(200, SESSION) });

    await useAuthStore.getState().logIn({ email: 'seed-1@molarmolar.example', password: 'pw' });

    expect(Object.keys(useAuthStore.getState())).not.toContain('accounts');
    expect(JSON.stringify(useAuthStore.getState().user)).not.toContain('password');
  });

  it('목 인증이 남긴 평문 계정 저장을 부팅 시 지운다', async () => {
    window.localStorage.setItem(
      LEGACY_MOCK_AUTH_KEY,
      JSON.stringify({ state: { accounts: [{ email: 'a@b.com', password: 'plain-text-secret' }] } })
    );

    // 모듈을 새로 평가하면(=새 탭에서 앱을 여는 것과 같다) 부팅 시 purge 가 돈다.
    vi.resetModules();
    await import('@/store/useAuthStore');

    expect(window.localStorage.getItem(LEGACY_MOCK_AUTH_KEY)).toBeNull();
  });
});
