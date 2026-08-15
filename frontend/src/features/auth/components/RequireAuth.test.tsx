import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { useAuthStore } from '@/store/useAuthStore';
import type { User, UserRole } from '@/types/domain';

const ADMIN_ROLES: readonly UserRole[] = ['hospital_admin', 'operator'];
const OPERATOR_ONLY: readonly UserRole[] = ['operator'];

function userWithRole(role: UserRole): User {
  return {
    id: `u-${role}`,
    email: `${role}@molarmolar.example`,
    name: '테스트',
    provider: 'email',
    role,
    managedHospitalIds: role === 'hospital_admin' ? ['h1'] : [],
  };
}

/** 실제 라우트 매칭 위에서 검증한다 — 로그인 화면으로 보내지는지 확인하려면 목적지가 있어야 한다. */
function renderGuardedRoute(
  children: ReactNode,
  { roles, route = '/admin' }: { roles?: readonly UserRole[]; route?: string } = {}
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  function LoginStub() {
    const { search } = useLocation();

    return <div>로그인 화면{search}</div>;
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/admin/*" element={<RequireAuth roles={roles}>{children}</RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={roles}>{children}</RequireAuth>} />
          <Route path="/auth/login" element={<LoginStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  it('비로그인 사용자를 로그인 화면으로 보낸다 (원래 경로를 redirect 로 넘긴다)', () => {
    renderGuardedRoute(<div>상담 목록</div>, { roles: ADMIN_ROLES });

    expect(screen.queryByText('상담 목록')).not.toBeInTheDocument();
    expect(screen.getByText(`로그인 화면?redirect=${encodeURIComponent('/admin')}`)).toBeInTheDocument();
  });

  it('user 역할에게는 접근 권한이 없어요 안내만 띄운다 (로그인으로 보내지 않는다)', () => {
    useAuthStore.setState({ user: userWithRole('user'), status: 'ready' });

    renderGuardedRoute(<div>상담 목록</div>, { roles: ADMIN_ROLES });

    expect(screen.queryByText('상담 목록')).not.toBeInTheDocument();
    expect(screen.getByText('접근 권한이 없어요')).toBeInTheDocument();
    // 로그인 루프를 만들지 않는다
    expect(screen.queryByText(/로그인 화면/)).not.toBeInTheDocument();
  });

  it('hospital_admin 은 운영자 전용 화면에서 접근 권한이 없어요', () => {
    useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });

    renderGuardedRoute(<div>전문의 인증 검수</div>, {
      roles: OPERATOR_ONLY,
      route: '/admin/specialists',
    });

    expect(screen.queryByText('전문의 인증 검수')).not.toBeInTheDocument();
    expect(screen.getByText('접근 권한이 없어요')).toBeInTheDocument();
    expect(screen.getByText('운영자 계정만 볼 수 있는 화면이에요')).toBeInTheDocument();
  });

  it('hospital_admin 은 관리자 화면을 통과한다', () => {
    useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });

    renderGuardedRoute(<div>상담 목록</div>, { roles: ADMIN_ROLES });

    expect(screen.getByText('상담 목록')).toBeInTheDocument();
  });

  it('operator 는 운영자 전용 화면을 통과한다', () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });

    renderGuardedRoute(<div>전문의 인증 검수</div>, {
      roles: OPERATOR_ONLY,
      route: '/admin/specialists',
    });

    expect(screen.getByText('전문의 인증 검수')).toBeInTheDocument();
  });

  it('세션 복원 중에는 권한 없음으로 판정하지 않는다', () => {
    // GET /auth/me 가 끝나기 전에 판정하면 새로고침마다 관리자가 튕긴다.
    useAuthStore.setState({ user: null, status: 'restoring' });

    renderGuardedRoute(<div>상담 목록</div>, { roles: ADMIN_ROLES });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('접근 권한이 없어요')).not.toBeInTheDocument();
    expect(screen.queryByText(/로그인 화면/)).not.toBeInTheDocument();
    // 내용도 아직 렌더하지 않는다 (판정 전에 조회를 시작하지 않게)
    expect(screen.queryByText('상담 목록')).not.toBeInTheDocument();
  });

  it('roles 를 주지 않으면 로그인만 요구한다', () => {
    useAuthStore.setState({ user: userWithRole('user'), status: 'ready' });

    renderGuardedRoute(<div>상담 신청</div>);

    expect(screen.getByText('상담 신청')).toBeInTheDocument();
  });
});
