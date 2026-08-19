import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markNotificationAsRead } from '@/features/notification/api/notificationApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 알림 하나 읽음 처리. `PATCH /notifications/{id}/read`.
 *
 * 목록의 점과 배지 숫자가 함께 달라지므로 둘 다 깨되, **범위는 그 알림이 속한 알림함
 * (`audience`)까지다** — 형제 훅 `useMarkAllNotificationsAsRead` 와 같은 단위다.
 * 반대쪽 알림함은 이 호출로 달라지는 값이 없어 다시 불러도 얻을 것이 없다
 * (불필요한 재조회를 줄인다).
 *
 * 어느 알림함인지는 응답이 알려준다 — 화면이 따로 넘기지 않는다.
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: (notification) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.byAudience(notification.audience) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(notification.audience) });
    },
  });
}
