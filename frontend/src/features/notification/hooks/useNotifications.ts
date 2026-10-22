import { useQuery } from '@tanstack/react-query';

import { fetchNotifications, type NotificationFilters } from '@/features/notification/api/notificationApi';
import { useCanReadNotificationMailbox } from '@/features/notification/hooks/useNotificationMailbox';
import { queryKeys } from '@/lib/queryKeys';
import type { NotificationAudience } from '@/types/domain';

/**
 * 알림함 목록. `GET /notifications?audience=...`. 최신순.
 *
 * **그 알림함을 열 자격이 있을 때만 묻는다** (`useCanReadNotificationMailbox`) —
 * 비로그인은 `401`, `user` 역할의 `audience=admin` 은 `403` 이라 물어도 얻을 것이 없다.
 */
export function useNotifications(audience: NotificationAudience, filters: NotificationFilters = {}) {
  const enabled = useCanReadNotificationMailbox(audience);

  return useQuery({
    queryKey: queryKeys.notifications.byAudience(audience, filters),
    queryFn: () => fetchNotifications(audience, filters),
    enabled,
  });
}
