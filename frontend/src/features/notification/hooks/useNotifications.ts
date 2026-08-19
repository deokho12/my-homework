import { useQuery } from '@tanstack/react-query';

import { fetchNotifications, type NotificationFilters } from '@/features/notification/api/notificationApi';
import { queryKeys } from '@/lib/queryKeys';
import type { NotificationAudience } from '@/types/domain';

/** 알림함 목록. `GET /notifications?audience=...`. 최신순. */
export function useNotifications(audience: NotificationAudience, filters: NotificationFilters = {}) {
  return useQuery({
    queryKey: queryKeys.notifications.byAudience(audience, filters),
    queryFn: () => fetchNotifications(audience, filters),
  });
}
