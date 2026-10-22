import { useSession } from '@/features/auth/hooks/useSession';
import type { NotificationAudience } from '@/types/domain';

/**
 * **이 계정이 그 알림함을 물어도 되는가.** 두 알림함 훅이 `enabled` 에 쓰는 한 판정이다.
 *
 * 서버는 두 가지를 거절한다 (`docs/api/README.md` §9):
 * - 비로그인 → `401` (알림함은 계정에 딸린 자원이다)
 * - `user` 역할의 `audience=admin` → `403` (관리자 알림 문구에 고객 이름이 들어 있다)
 *
 * 라우트 가드(`GUARD_ROLES.admin`)가 관리자 화면을 이미 막고 있지만, **막는 곳과 묻는 곳이
 * 다르면** 가드가 바뀌는 날 조용히 403 이 난다. 묻는 쪽에서도 같은 판정을 한다.
 */
export function useCanReadNotificationMailbox(audience: NotificationAudience): boolean {
  const { isAuthenticated, isHospitalAdmin } = useSession();

  // `isHospitalAdmin` 은 `hospital_admin` 또는 `operator` 다 — 계약이 관리자 알림함을 연 두 역할.
  return audience === 'admin' ? isHospitalAdmin : isAuthenticated;
}
