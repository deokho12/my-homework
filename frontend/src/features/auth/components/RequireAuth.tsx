import { ShieldAlert } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { QueryState } from '@/components/QueryState';
import { useSession } from '@/features/auth/hooks/useSession';
import type { UserRole } from '@/types/domain';

export interface RequireAuthProps {
  /**
   * 이 역할 중 하나여야 통과한다. 생략하면 로그인만 요구한다.
   * 라우트별 값은 `src/App.tsx` 의 `ROUTES` 한 곳에 모여 있다.
   */
  roles?: readonly UserRole[];
  children: ReactNode;
}

function deniedDescription(roles: readonly UserRole[] | undefined): string {
  if (roles?.length === 1 && roles[0] === 'operator') {
    return '운영자 계정만 볼 수 있는 화면이에요';
  }

  return '병원 담당자 계정으로 로그인하면 볼 수 있어요';
}

/**
 * 라우트 진입 가드.
 *
 * 세 가지를 구분한다:
 *
 * | 상태 | 동작 |
 * |---|---|
 * | 세션 복원 중 (`GET /auth/me` 진행) | 로딩. **권한 없음으로 판정하지 않는다** |
 * | 비로그인 | 로그인 화면으로 (원래 경로를 `redirect` 로 넘긴다) |
 * | 로그인했지만 역할이 부족 | **리다이렉트하지 않고** `접근 권한이 없어요` 안내만 |
 *
 * 권한 부족을 로그인으로 보내지 않는 이유: 이미 로그인한 사용자를 로그인 화면으로 보내면
 * 로그인 성공 → 같은 라우트 → 다시 로그인 화면의 루프가 된다.
 *
 * 로딩·안내 표시는 `QueryState`(= 지연 스피너 + `EmptyState`)를 그대로 쓴다.
 */
export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { isAuthenticated, isRestoring, hasRole } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const needsLogin = !isRestoring && !isAuthenticated;
  const redirectTo = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (!needsLogin) return;

    navigate(`/auth/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
  }, [needsLogin, navigate, redirectTo]);

  const isAllowed = isAuthenticated && (roles === undefined || hasRole(roles));

  return (
    <QueryState
      isLoading={isRestoring}
      isError={false}
      // `undefined` → EmptyState(안내)가 렌더된다. 통과할 때만 children 을 싣는다 —
      // 자식이 마운트되는 순간 데이터 조회가 시작되므로 판정 전에 렌더하면 안 된다.
      data={isAllowed ? { content: children } : undefined}
      emptyState={
        needsLogin
          ? { icon: ShieldAlert, title: '로그인이 필요해요', description: '로그인 화면으로 이동할게요' }
          : { icon: ShieldAlert, title: '접근 권한이 없어요', description: deniedDescription(roles) }
      }
    >
      {(payload) => payload.content}
    </QueryState>
  );
}
