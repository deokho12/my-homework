import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouterBridge } from '@/navigation';
import SignUpScreen from '@/screens/auth/signup';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 가입 성공 시 화면이 `router.replace`/`router.back` 을 부른다. 그 명령형 API 는
 * `RouterBridge` 가 마운트돼 있어야 동작하므로 함께 렌더한다.
 */
function renderSignUp() {
  return renderWithProviders(
    <>
      <RouterBridge />
      <SignUpScreen />
    </>,
    { route: '/auth/signup', path: '/auth/signup' }
  );
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fieldError(label: string): string | null {
  const input = screen.getByLabelText(label);
  const describedBy = input.getAttribute('aria-describedby');

  if (!describedBy) return null;

  return document.getElementById(describedBy)?.textContent ?? null;
}

const SESSION = {
  user: {
    id: 'u9',
    email: 'new@molarmolar.example',
    name: '박지영',
    provider: 'email',
    role: 'user',
    managedHospitalIds: [],
  },
  tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' },
};

/** 약관 버전 조회(`GET /legal-documents/{slug}`) + 가입 응답을 함께 스텁한다. */
function stubBackend({ legalVersion, signUp }: { legalVersion?: string; signUp: () => Response }) {
  const signUpBodies: unknown[] = [];

  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    const url = String(input);

    if (url.includes('/legal-documents/')) {
      const slug = url.split('/legal-documents/')[1];

      return Promise.resolve(
        legalVersion
          ? json(200, { slug, title: '약관', version: legalVersion, effectiveAt: '2026-01-01T00:00:00.000Z', content: '', contentFormat: 'markdown' })
          : json(404, { error: { code: 'NOT_FOUND', message: '요청한 경로를 찾을 수 없어요', requestId: 'r' } })
      );
    }

    if (url.endsWith('/auth/signup')) {
      signUpBodies.push(typeof init?.body === 'string' ? JSON.parse(init.body) : null);

      return Promise.resolve(signUp());
    }

    return Promise.resolve(json(404, { error: { code: 'NOT_FOUND', message: '없어요', requestId: 'r' } }));
  });

  return signUpBodies;
}

async function fillForm() {
  await userEvent.type(screen.getByLabelText('이름'), '박지영');
  await userEvent.type(screen.getByLabelText('이메일'), 'new@molarmolar.example');
  await userEvent.type(screen.getByLabelText('비밀번호'), 'pw123456');
  await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'pw123456');
}

async function agreeToAll() {
  for (const checkbox of screen.getAllByRole('checkbox')) {
    await userEvent.click(checkbox);
  }
}

beforeEach(() => {
  useAuthStore.setState({ user: null, status: 'ready' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('회원가입 화면', () => {
  it('약관에 동의하지 않으면 제출되지 않고 체크박스 아래에 오류가 붙는다', async () => {
    const bodies = stubBackend({ signUp: () => json(201, SESSION) });

    renderSignUp();

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: '가입하기' }));

    await waitFor(() => {
      expect(fieldError('(필수) 서비스 이용약관에 동의합니다')).toBe('동의가 필요해요');
    });
    expect(bodies).toEqual([]);
  });

  it('비밀번호 확인이 다르면 확인 칸 아래에 오류가 붙는다', async () => {
    stubBackend({ signUp: () => json(201, SESSION) });

    renderSignUp();

    await userEvent.type(screen.getByLabelText('이름'), '박지영');
    await userEvent.type(screen.getByLabelText('이메일'), 'new@molarmolar.example');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'pw123456');
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'pw000000');
    await agreeToAll();
    await userEvent.click(screen.getByRole('button', { name: '가입하기' }));

    await waitFor(() => {
      expect(fieldError('비밀번호 확인')).toBe('비밀번호가 일치하지 않아요');
    });
  });

  it('서버가 내려준 약관 버전을 그대로 실어 보낸다', async () => {
    const bodies = stubBackend({ legalVersion: '1.0', signUp: () => json(201, SESSION) });

    renderSignUp();

    await fillForm();
    await agreeToAll();
    await userEvent.click(screen.getByRole('button', { name: '가입하기' }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      name: '박지영',
      email: 'new@molarmolar.example',
      password: 'pw123456',
      agreedTermsVersions: [
        { slug: 'terms', version: '1.0' },
        { slug: 'privacy', version: '1.0' },
        { slug: 'location', version: '1.0' },
      ],
    });
    expect(useAuthStore.getState().user?.id).toBe('u9');
  });

  it('약관 버전 조회가 실패하면 agreedTermsVersions 를 아예 보내지 않는다', async () => {
    // 없는 버전을 추측해서 보내면 `422 UNKNOWN_TERMS_VERSION` 으로 가입 자체가 막힌다.
    const bodies = stubBackend({ signUp: () => json(201, SESSION) });

    renderSignUp();

    await fillForm();
    await agreeToAll();
    await userEvent.click(screen.getByRole('button', { name: '가입하기' }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).not.toHaveProperty('agreedTermsVersions');
  });

  it('이미 가입된 이메일이면 서버 문구를 그대로 보여준다', async () => {
    stubBackend({
      signUp: () =>
        json(409, {
          error: { code: 'EMAIL_ALREADY_REGISTERED', message: '이미 가입된 이메일이에요', requestId: 'r1' },
        }),
    });

    renderSignUp();

    await fillForm();
    await agreeToAll();
    await userEvent.click(screen.getByRole('button', { name: '가입하기' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('이미 가입된 이메일이에요');
    });
  });
});
