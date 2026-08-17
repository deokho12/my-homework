import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/features/notification/api/notificationApi';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/useAuthStore';
import type { NotificationAudience } from '@/types/domain';

/**
 * 관리자 알림함은 담당자·운영자만 열 수 있다. 일반 사용자가 부르면 서버가 403 을 준다
 * (관리자 알림 문구에 고객 이름이 들어 있다) — 아예 요청하지 않도록 여기서 막는다.
 */
function canRead(audience: NotificationAudience, role: string | undefined): boolean {
  if (role === undefined) return false;

  return audience === 'user' || role === 'hospital_admin' || role === 'operator';
}

export function useNotifications(audience: NotificationAudience, pageSize = 50) {
  const role = useAuthStore((state) => state.user?.role);

  return useQuery({
    queryKey: [...queryKeys.notifications.byAudience(audience), { pageSize }],
    queryFn: () => fetchNotifications({ audience, pageSize }),
    enabled: canRead(audience, role),
  });
}

/**
 * 배지 숫자. 목록과 나눈 이유는 계약에 있다 — 배지는 거의 모든 화면에서 필요한데
 * 그때마다 목록 전체(고객 이름이 든 문구)를 받아오는 것은 낭비이자 노출이다.
 */
export function useUnreadNotificationCount(audience: NotificationAudience) {
  const role = useAuthStore((state) => state.user?.role);

  return useQuery({
    queryKey: [...queryKeys.notifications.byAudience(audience), 'unread-count'],
    queryFn: () => fetchUnreadCount(audience),
    enabled: canRead(audience, role),
  });
}

/** 하나 읽음. 서버가 멱등이라 이미 읽은 것에 다시 불러도 안전하다. */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      // 목록과 배지가 함께 바뀐다. 접두사 하나로 둘 다 깬다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (audience: NotificationAudience) => markAllNotificationsAsRead(audience),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
