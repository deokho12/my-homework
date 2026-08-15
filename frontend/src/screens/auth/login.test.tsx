import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginScreen from '@/screens/auth/login';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 입력 칸에 연결된 오류 문구(`aria-describedby`)를 읽는다 — "필드 아래" 를 구조로 검증한다. */
function fieldError(label: string): string | null {
  const input = screen.getByLabelText(label);
  const describedBy = input.getAttribute('aria-describedby');

  if (!describedBy) return null;

  return document.getElementById(describedBy)?.textContent ?? null;
}

beforeEach(() => {
  useAuthStore.setState({ user: null, status: 'ready' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('로그인 화면 — 폼 검증', () => {
  it('이메일 형식이 틀리면 그 칸 아래에 오류를 표시하고 요청을 보내지 않는다', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(200, {})));

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<LoginScreen />, { route: '/auth/login', path: '/auth/login' });

    await userEvent.type(screen.getByLabelText('이메일'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'pw123456');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(fieldError('이메일')).toBe('이메일 형식이 올바르지 않아요');
    });

    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('비어 있는 칸마다 그 아래에 오류를 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn());

    renderWithProviders(<LoginScreen />, { route: '/auth/login', path: '/auth/login' });

    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(fieldError('이메일')).toBe('이메일을 입력해주세요');
    });
    expect(fieldError('비밀번호')).toBe('비밀번호를 입력해주세요');
  });
});

describe('로그인 화면 — 서버 오류', () => {
  it('422 의 details[].field 를 그 필드 아래에 매핑한다', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        json(422, {
          error: {
            code: 'VALIDATION_FAILED',
            message: '입력값을 확인해주세요',
            details: [{ field: 'password', code: 'TOO_LONG', message: '비밀번호가 너무 길어요' }],
            requestId: 'r1',
          },
        })
      )
    );

    renderWithProviders(<LoginScreen />, { route: '/auth/login', path: '/auth/login' });

    await userEvent.type(screen.getByLabelText('이메일'), 'seed-1@molarmolar.example');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'pw123456');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(fieldError('비밀번호')).toBe('비밀번호가 너무 길어요');
    });
    // 필드에 붙였으므로 폼 전체 오류는 띄우지 않는다
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('필드가 없는 오류(INVALID_CREDENTIALS)는 폼 전체 오류로 서버 문구를 그대로 보여준다', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        json(401, {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '이메일 또는 비밀번호가 올바르지 않아요',
            requestId: 'r1',
          },
        })
      )
    );

    renderWithProviders(<LoginScreen />, { route: '/auth/login', path: '/auth/login' });

    await userEvent.type(screen.getByLabelText('이메일'), 'seed-1@molarmolar.example');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 올바르지 않아요');
    });
    expect(fieldError('이메일')).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
