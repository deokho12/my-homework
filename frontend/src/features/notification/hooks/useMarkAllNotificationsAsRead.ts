import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markAllNotificationsAsRead } from '@/features/notification/api/notificationApi';
import { queryKeys } from '@/lib/queryKeys';
import type { NotificationAudience } from '@/types/domain';

/**
 * `모두 읽음`. `POST /notifications/read-all`.
 *
 * 무효화는 `audience` 단위다 — **불필요한 재조회를 줄이기 위해서다.** 이 호출이 바꾸는 것은
 * 그 알림함의 읽음 상태뿐이라, 반대쪽 알림함을 다시 불러도 얻을 새 값이 없다.
 * (무효화는 재조회일 뿐이므로 `all` 을 깨도 반대쪽 읽음 상태가 바뀌지는 않는다.
 * 형제 훅 `useMarkNotificationAsRead` 도 같은 이유로 같은 단위를 쓴다.)
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (audience: NotificationAudience) => markAllNotificationsAsRead(audience),
    onSuccess: (_result, audience) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.byAudience(audience) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(audience) });
    },
  });
}
