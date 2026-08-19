import { describe, expect, it } from 'vitest';

import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/features/notification/api/notificationApi';
import { isApiError } from '@/lib/apiClient';
import { writeCollection } from '@/lib/localCollection';
import type { AppNotification } from '@/types/domain';

/** 삭제된 `useNotificationStore` 의 동작을 이 계층으로 옮겨 고정한다. */
function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    audience: 'user',
    type: 'consult-status',
    title: '상담 상태 변경',
    message: '메시지',
    isRead: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    relatedId: null,
    ...overrides,
  };
}

describe('fetchNotifications', () => {
  it('audience 로 알림함을 가른다', async () => {
    writeCollection('notifications', [
      notification({ id: 'u1', audience: 'user' }),
      notification({ id: 'a1', audience: 'admin' }),
    ]);

    expect((await fetchNotifications('user')).items.map((item) => item.id)).toEqual(['u1']);
    expect((await fetchNotifications('admin')).items.map((item) => item.id)).toEqual(['a1']);
  });

  it('최신순으로 돌려준다', async () => {
    writeCollection('notifications', [
      notification({ id: 'old', createdAt: '2026-06-01T00:00:00.000Z' }),
      notification({ id: 'new', createdAt: '2026-07-30T00:00:00.000Z' }),
    ]);

    expect((await fetchNotifications('user')).items.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('unreadCount 는 페이지와 무관한 그 알림함의 전체 값이다', async () => {
    writeCollection('notifications', [
      notification({ id: 'a', isRead: false }),
      notification({ id: 'b', isRead: false }),
      notification({ id: 'c', isRead: true }),
      notification({ id: 'd', audience: 'admin', isRead: false }),
    ]);

    const page = await fetchNotifications('user', { pageSize: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.unreadCount).toBe(2);
  });
});

describe('fetchUnreadNotificationCount', () => {
  it('알림함별로 안 읽은 개수를 센다', async () => {
    writeCollection('notifications', [
      notification({ id: 'u1', audience: 'user', isRead: false }),
      notification({ id: 'a1', audience: 'admin', isRead: false }),
      notification({ id: 'a2', audience: 'admin', isRead: false }),
    ]);

    expect(await fetchUnreadNotificationCount('user')).toEqual({ audience: 'user', unreadCount: 1 });
    expect(await fetchUnreadNotificationCount('admin')).toEqual({ audience: 'admin', unreadCount: 2 });
  });
});

describe('markNotificationAsRead', () => {
  it('읽음으로 바꾸고 배지 숫자가 줄어든다', async () => {
    writeCollection('notifications', [notification({ id: 'n1' })]);

    const updated = await markNotificationAsRead('n1');

    expect(updated.isRead).toBe(true);
    expect((await fetchUnreadNotificationCount('user')).unreadCount).toBe(0);
  });

  it('이미 읽은 알림에 다시 불러도 성공이다 (멱등)', async () => {
    writeCollection('notifications', [notification({ id: 'n1', isRead: true })]);

    await expect(markNotificationAsRead('n1')).resolves.toMatchObject({ isRead: true });
  });

  it('없는 알림은 404 를 던진다', async () => {
    writeCollection('notifications', []);

    const error = await markNotificationAsRead('nope').catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(404);
  });
});

describe('markAllNotificationsAsRead', () => {
  it('그 알림함만 처리하고 반대쪽의 안 읽은 표시는 남긴다', async () => {
    writeCollection('notifications', [
      notification({ id: 'u1', audience: 'user', isRead: false }),
      notification({ id: 'u2', audience: 'user', isRead: true }),
      notification({ id: 'a1', audience: 'admin', isRead: false }),
    ]);

    const result = await markAllNotificationsAsRead('user');

    expect(result).toEqual({ audience: 'user', markedCount: 1, unreadCount: 0 });
    expect((await fetchUnreadNotificationCount('admin')).unreadCount).toBe(1);
  });
});
