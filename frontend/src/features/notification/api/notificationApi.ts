import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import type { AppNotification, NotificationAudience, Paged } from '@/types/domain';

/**
 * 알림 API.
 *
 * `audience` 는 **역할이 아니라 알림함**이다 — 화면이 `/notifications` 와
 * `/admin/notifications` 둘뿐이라 값도 둘이다. 서버는 내 수신자 행에서만 출발하므로
 * 남의 알림이 섞이지 않는다.
 *
 * 생성 API 는 **없다.** 알림은 상담 접수·상태 변경·전문의 검수의 부수효과로만 생긴다.
 */

export interface ListNotificationsParams {
  audience: NotificationAudience;
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}

export async function fetchNotifications(params: ListNotificationsParams): Promise<Paged<AppNotification>> {
  const query = toSearchParams({
    audience: params.audience,
    page: params.page,
    pageSize: params.pageSize,
    isRead: params.isRead,
  });

  return apiRequest<Paged<AppNotification>>(`/notifications${query}`);
}

export interface UnreadCountResponse {
  audience: NotificationAudience;
  unreadCount: number;
}

export async function fetchUnreadCount(audience: NotificationAudience): Promise<UnreadCountResponse> {
  return apiRequest<UnreadCountResponse>(`/notifications/unread-count?audience=${audience}`);
}

export async function markNotificationAsRead(notificationId: string): Promise<AppNotification> {
  return apiRequest<AppNotification>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
  });
}

export interface MarkAllReadResponse {
  audience: NotificationAudience;
  updated: number;
}

/**
 * `audience` 는 **필수**다. 한쪽 알림함만 처리해야 하고 반대쪽의 안 읽은 표시는
 * 그대로 남아야 한다 — 생략을 허용하면 그 규칙이 우연히 깨진다.
 */
export async function markAllNotificationsAsRead(
  audience: NotificationAudience
): Promise<MarkAllReadResponse> {
  return apiRequest<MarkAllReadResponse>('/notifications/read-all', {
    method: 'POST',
    body: { audience },
  });
}
