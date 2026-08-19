import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/hooks/useSession';
import { fetchUnreadNotificationCount } from '@/features/notification/api/notificationApi';
import { queryKeys } from '@/lib/queryKeys';
import type { NotificationAudience } from '@/types/domain';

/**
 * 종 배지 숫자. `GET /notifications/unread-count?audience=...`.
 *
 * 마이페이지 `🔔 알림함` 줄, 넓은 화면 상단 `🔔`, 관리자 홈의 종이 **같은 숫자**를 보여야
 * 한다 — 그래서 세 곳이 목록을 각자 세지 않고 이 훅 하나를 쓴다.
 *
 * **로그인했을 때만 조회한다.** 알림함은 계정에 딸린 자원이라 비로그인 요청은 서버에서
 * `401` 이 확정인데, 상단바는 로그인 여부와 무관하게 모든 화면에 떠 있다
 * (배지 자체는 원래도 로그인한 사용자에게만 그려진다).
 */
export function useUnreadNotificationCount(audience: NotificationAudience) {
  const { isAuthenticated } = useSession();

  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(audience),
    queryFn: () => fetchUnreadNotificationCount(audience),
    enabled: isAuthenticated,
  });
}
