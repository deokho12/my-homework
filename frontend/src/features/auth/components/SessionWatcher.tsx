import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useSession } from '@/features/auth/hooks/useSession';
import { subscribeToSessionInvalidated } from '@/lib/apiClient';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * 세션의 시작과 끝을 담당한다. 화면을 렌더하지 않는다.
 *
 * 1. **부팅 시 복원** — 저장된 토큰으로 `GET /auth/me`. 실패하면 조용히 비운다.
 * 2. **강제 로그아웃** — 리프레시가 거절되면(`REFRESH_TOKEN_REUSED` / `REFRESH_TOKEN_INVALID`)
 *    상태는 스토어가 비우고, 여기서 로그인 화면으로 보낸다. 라우터 호출을 스토어에 두지 않는
 *    이유는 스토어가 라우터 컨텍스트 밖(모듈 스코프)에 있기 때문이다.
 */
export function SessionWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useSession();

  /**
   * 로그인 상태였다가 끊긴 경우에만 로그인 화면으로 보낸다.
   *
   * 스토어의 구독자가 먼저 상태를 비우므로 알림을 받는 시점에는 이미 `user === null` 이다.
   * 이 플래그가 없으면 **낡은 토큰을 가진 방문자가 홈을 열었을 때도** 로그인 화면으로
   * 튕긴다 (부팅 복원 실패는 조용히 넘어가야 한다).
   */
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (isAuthenticated) wasAuthenticated.current = true;
  }, [isAuthenticated]);

  useEffect(() => {
    // StrictMode 는 이 이펙트를 두 번 실행한다. 스토어가 토큰 유무로 판단하므로
    // 두 번째 호출은 같은 결과를 낼 뿐이고, 응답이 늦게 와도 상태만 다시 쓴다.
    void useAuthStore.getState().restoreSession();
  }, []);

  useEffect(() => {
    return subscribeToSessionInvalidated(() => {
      if (!wasAuthenticated.current) return;

      wasAuthenticated.current = false;

      // 이미 로그인·가입 화면이면 그대로 둔다 (되돌아갈 곳을 잃지 않게).
      if (location.pathname.startsWith('/auth/')) return;

      navigate(`/auth/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`, {
        replace: true,
      });
    });
  }, [navigate, location.pathname, location.search]);

  return null;
}
