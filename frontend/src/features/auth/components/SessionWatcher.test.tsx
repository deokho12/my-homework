import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionWatcher } from '@/features/auth/components/SessionWatcher';
import { apiRequest } from '@/lib/apiClient';
import { readTokens, writeTokens } from '@/lib/authTokens';
import { useAuthStore } from '@/store/useAuthStore';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EXPIRED = json(401, {
  error: { code: 'ACCESS_TOKEN_EXPIRED', message: '로그인이 만료되었어요. 다시 로그인해주세요', requestId: 'r' },
});

const REUSED = () =>
  json(401, {
    error: { code: 'REFRESH_TOKEN_REUSED', message: '보안을 위해 로그아웃되었어요. 다시 로그인해주세요', requestId: 'r' },
  });

const ME = {
  id: 'u1',
  email: 'seed-1@molarmolar.example',
  name: '박지영',
  provider: 'email',
  role: 'user',
  managedHospitalIds: [],
};

function renderWatcher() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/mypage']}>
        <SessionWatcher />
        <Routes>
          <Route path="/mypage" element={<div>마이페이지</div>} />
          <Route path="/auth/login" element={<div>로그인 화면</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  useAuthStore.setState({ user: null, status: 'ready' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionWatcher', () => {
  it('저장된 토큰으로 세션을 복원한다', async () => {
    writeTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    vi.stubGlobal('fetch', () => Promise.resolve(json(200, ME)));

    renderWatcher();

    await waitFor(() => {
      expect(useAuthStore.getState().user?.id).toBe('u1');
    });
    expect(screen.getByText('마이페이지')).toBeInTheDocument();
  });

  it('쓰는 중에 세션이 끊기면 로그인 화면으로 보낸다', async () => {
    writeTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    vi.stubGlobal('fetch', () => Promise.resolve(json(200, ME)));

    renderWatcher();

    await waitFor(() => {
      expect(useAuthStore.getState().user?.id).toBe('u1');
    });

    // 이후 요청에서 리프레시가 재사용으로 거절된다
    vi.stubGlobal('fetch', (input: string) =>
      Promise.resolve(String(input).endsWith('/auth/refresh') ? REUSED() : EXPIRED)
    );

    await act(async () => {
      await apiRequest('/notifications').catch(() => null);
    });

    await waitFor(() => {
      expect(screen.getByText('로그인 화면')).toBeInTheDocument();
    });
    expect(useAuthStore.getState().user).toBeNull();
    expect(readTokens()).toBeNull();
  });

  it('부팅 복원 실패는 조용히 비우고 로그인 화면으로 보내지 않는다', async () => {
    // 낡은 토큰이 남은 방문자가 홈을 열었을 때 튕기지 않아야 한다.
    writeTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    vi.stubGlobal('fetch', (input: string) =>
      Promise.resolve(String(input).endsWith('/auth/refresh') ? REUSED() : EXPIRED)
    );

    renderWatcher();

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('ready');
    });
    expect(useAuthStore.getState().user).toBeNull();
    expect(readTokens()).toBeNull();
    expect(screen.getByText('마이페이지')).toBeInTheDocument();
    expect(screen.queryByText('로그인 화면')).not.toBeInTheDocument();
  });
});
