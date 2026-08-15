import { useAuthStore } from '@/store/useAuthStore';
import type { User, UserRole } from '@/types/domain';

export interface Session {
  user: User | null;
  isAuthenticated: boolean;
  /**
   * 저장된 토큰으로 `GET /auth/me` 를 부르는 중. **이 값이 true 인 동안은 권한을 판정하면
   * 안 된다** — 새로고침마다 관리자가 튕긴다.
   */
  isRestoring: boolean;
  /** 관리자 화면 진입 자격 (`hospital_admin` 또는 `operator`). */
  isHospitalAdmin: boolean;
  /** 운영자 전용 화면 진입 자격. */
  isOperator: boolean;
  hasRole: (roles: readonly UserRole[]) => boolean;
}

/** 화면·가드가 역할을 보는 유일한 창구. `user.role` 을 직접 비교하지 않는다. */
export function useSession(): Session {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const role = user?.role ?? null;

  return {
    user,
    isAuthenticated: user !== null,
    isRestoring: status === 'restoring',
    isHospitalAdmin: role === 'hospital_admin' || role === 'operator',
    isOperator: role === 'operator',
    hasRole: (roles) => (role === null ? false : roles.includes(role)),
  };
}
