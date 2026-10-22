import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import type { AppNotification, NotificationAudience, Paged } from '@/types/domain';

/**
 * 알림함. **전부 실제 백엔드를 부른다** (2026-10-22, 요청서 15).
 *
 * | 함수 | 엔드포인트 |
 * |---|---|
 * | `fetchNotifications` | `GET /notifications?audience=...` |
 * | `fetchUnreadNotificationCount` | `GET /notifications/unread-count?audience=...` |
 * | `markNotificationAsRead` | `PATCH /notifications/{notificationId}/read` |
 * | `markAllNotificationsAsRead` | `POST /notifications/read-all` |
 *
 * **`audience` 는 역할이 아니라 알림함(mailbox)이다.** 역할은 셋이지만 화면은
 * `/notifications` 와 `/admin/notifications` 둘뿐이라 알림함도 둘이다. `audience=user` 는
 * 세 역할 모두 부를 수 있고, `audience=admin` 은 담당자·운영자만이다 (`user` 는 `403`).
 * 훅이 역할을 보고 아예 묻지 않는다 (`hooks/useNotifications.ts`).
 *
 * **모든 경로가 로그인을 요구한다** — 비로그인은 `401` 이다. 종 배지 훅도 로그인했을 때만
 * 조회한다 (`hooks/useUnreadNotificationCount.ts`).
 *
 * **알림을 만드는 함수는 여기 없다.** 알림은 상담 접수·상태 변경의 부수효과로만 서버 안에서
 * 생기고, 만드는 공개 엔드포인트는 계약에 아예 없다 (`docs/api/README.md` §9).
 */

/**
 * 계약에는 `isRead`·`type` 필터도 있지만 어느 화면도 보내지 않아 여기 두지 않는다.
 * 필요해지는 날 계약에 이미 있는 이름 그대로 추가하면 된다.
 */
export interface NotificationFilters {
  page?: number;
  pageSize?: number;
}

/** `GET /notifications` 응답. `unreadCount` 는 페이지네이션과 무관한 그 알림함의 전체 값이다. */
export interface NotificationList extends Paged<AppNotification> {
  unreadCount: number;
}

/** `GET /notifications/unread-count` 응답. */
export interface UnreadNotificationCount {
  audience: NotificationAudience;
  unreadCount: number;
}

/** `POST /notifications/read-all` 응답. */
export interface MarkAllReadResult {
  audience: NotificationAudience;
  /** 이번 호출로 읽음이 된 개수. */
  markedCount: number;
  /** 처리 후 남은 안 읽은 개수. 항상 0 이다. */
  unreadCount: number;
}

/** `GET /notifications`. 최신순. 받는 사람이 나인 알림만 온다 (서버가 토큰으로 스코프한다). */
export function fetchNotifications(
  audience: NotificationAudience,
  filters: NotificationFilters = {}
): Promise<NotificationList> {
  return apiRequest<NotificationList>(`/notifications${toSearchParams({ audience, ...filters })}`);
}

/**
 * `GET /notifications/unread-count`.
 *
 * 목록과 분리된 이유: 배지는 거의 모든 화면에서 필요한데, 관리자 알림 문구에는 고객 이름이
 * 들어 있어(`김민준님이 상담을 신청했어요`) 배지 하나 때문에 개인정보를 받아올 수는 없다.
 */
export function fetchUnreadNotificationCount(
  audience: NotificationAudience
): Promise<UnreadNotificationCount> {
  return apiRequest<UnreadNotificationCount>(`/notifications/unread-count${toSearchParams({ audience })}`);
}

/**
 * `PATCH /notifications/{notificationId}/read`. 멱등 — 이미 읽은 알림이어도 성공이다.
 * 읽음을 되돌리는 경로는 계약에도 화면에도 없다.
 *
 * 내 알림이 아니면 `404 NOTIFICATION_NOT_FOUND` 다 (`403` 이 아니다 — "목록에 없는 알림" 과
 * "없는 알림" 을 구분해 줄 이유가 없다). 어느 화면도 이 코드로 분기하지 않는다.
 */
export function markNotificationAsRead(id: string): Promise<AppNotification> {
  return apiRequest<AppNotification>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

/**
 * `POST /notifications/read-all`.
 *
 * `audience` 가 **필수**인 이유: `모두 읽음` 은 한쪽 알림함만 처리해야 하고 반대쪽의 안 읽은
 * 표시는 그대로 남아야 한다. 생략을 허용하면 그 규칙이 우연히 깨진다.
 */
export function markAllNotificationsAsRead(audience: NotificationAudience): Promise<MarkAllReadResult> {
  return apiRequest<MarkAllReadResult>('/notifications/read-all', { method: 'POST', body: { audience } });
}
