import { ApiError } from '@/lib/apiClient';
import { pageLocalRows, readCollection, writeCollection } from '@/lib/localCollection';
import type { AppNotification, NotificationAudience, Paged } from '@/types/domain';

/**
 * 알림함.
 *
 * **지금은 `lib/localCollection.ts`(localStorage)를 읽고 쓴다. 백엔드가 생기면 각 함수의
 * 본문만 `apiRequest('<경로>')` 로 갈아끼우면 되고, 시그니처와 화면 코드는 바뀌지 않는다.**
 *
 * | 함수 | 대응 엔드포인트 |
 * |---|---|
 * | `fetchNotifications` | `GET /notifications?audience=...` |
 * | `fetchUnreadNotificationCount` | `GET /notifications/unread-count?audience=...` |
 * | `markNotificationAsRead` | `PATCH /notifications/{notificationId}/read` |
 * | `markAllNotificationsAsRead` | `POST /notifications/read-all` |
 *
 * **`audience` 는 역할이 아니라 알림함(mailbox)이다.** 역할은 셋이지만 화면은
 * `/notifications` 와 `/admin/notifications` 둘뿐이라 알림함도 둘이다.
 *
 * **알림을 만드는 함수는 여기 없다.** 알림은 상담 접수·상태 변경의 부수효과로만 생기고,
 * 그 임시 구현은 `features/consult/api/consultApi.ts` 안에 `서버 전환 시 삭제` 표시와 함께 있다.
 *
 * **로컬 구현이 계약과 다른 점:** 수신자 스코프가 없다. 계정과 무관하게 `audience` 로만
 * 갈리므로, 관리자가 상태를 바꾸면 그 사용자 알림이 관리자 자신의 알림함에도 보인다
 * (`docs/features/known-issues.md`). 서버가 `userId` 로 보내는 것이 그 결함의 해결책이다.
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

function inAudience(audience: NotificationAudience) {
  return (notification: AppNotification) => notification.audience === audience;
}

function unreadCountFor(audience: NotificationAudience): number {
  return readCollection('notifications').filter(
    (notification) => notification.audience === audience && !notification.isRead
  ).length;
}

/** `GET /notifications`. 최신순. */
export async function fetchNotifications(
  audience: NotificationAudience,
  filters: NotificationFilters = {}
): Promise<NotificationList> {
  const rows = readCollection('notifications')
    .filter(inAudience(audience))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { ...pageLocalRows(rows, filters.page, filters.pageSize), unreadCount: unreadCountFor(audience) };
}

/**
 * `GET /notifications/unread-count`.
 *
 * 목록과 분리된 이유: 배지는 거의 모든 화면에서 필요한데, 관리자 알림 문구에는 고객 이름이
 * 들어 있어(`김민준님이 상담을 신청했어요`) 배지 하나 때문에 개인정보를 받아올 수는 없다.
 */
export async function fetchUnreadNotificationCount(
  audience: NotificationAudience
): Promise<UnreadNotificationCount> {
  return { audience, unreadCount: unreadCountFor(audience) };
}

/**
 * `PATCH /notifications/{notificationId}/read`. 멱등 — 이미 읽은 알림이어도 성공이다.
 * 읽음을 되돌리는 경로는 계약에도 화면에도 없다.
 */
export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const rows = readCollection('notifications');
  const target = rows.find((notification) => notification.id === id);

  if (!target) {
    // 계약은 이 404 의 `code` 를 예시로 고정하지 않았다. 서버가 다른 이름을 쓰게 되면
    // 여기만 맞추면 된다 — 어느 화면도 이 코드로 분기하지 않는다 (읽음 처리는 조용히 실패한다).
    throw new ApiError({ status: 404, code: 'NOTIFICATION_NOT_FOUND', message: '알림을 찾을 수 없어요' });
  }

  if (target.isRead) return target;

  const updated: AppNotification = { ...target, isRead: true };

  writeCollection(
    'notifications',
    rows.map((notification) => (notification.id === id ? updated : notification))
  );

  return updated;
}

/**
 * `POST /notifications/read-all`.
 *
 * `audience` 가 **필수**인 이유: `모두 읽음` 은 한쪽 알림함만 처리해야 하고 반대쪽의 안 읽은
 * 표시는 그대로 남아야 한다. 생략을 허용하면 그 규칙이 우연히 깨진다.
 */
export async function markAllNotificationsAsRead(audience: NotificationAudience): Promise<MarkAllReadResult> {
  const rows = readCollection('notifications');
  const markedCount = rows.filter(
    (notification) => notification.audience === audience && !notification.isRead
  ).length;

  writeCollection(
    'notifications',
    rows.map((notification) =>
      notification.audience === audience ? { ...notification, isRead: true } : notification
    )
  );

  return { audience, markedCount, unreadCount: 0 };
}
