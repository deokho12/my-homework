import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/features/notification/api/notificationApi';
import { ApiError } from '@/lib/apiClient';

/**
 * 알림 api 는 2026-10-22(요청서 15)부터 **전부 HTTP** 다. 수신자 스코프·역할 판정은 서버가
 * 하고(`backend/test/notification.e2e.spec.ts`), 여기서 고정하는 것은 **배선**이다 —
 * `audience` 가 어느 요청에 어떻게 실리는가, 응답을 그대로 넘기는가.
 */
const fetchMock = vi.fn();

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function fail(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function emptyPage(): Response {
  return ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, unreadCount: 0 });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchNotifications', () => {
  it('audience 를 쿼리로 보낸다 — 알림함을 가르는 것은 서버다', async () => {
    fetchMock.mockResolvedValue(emptyPage());

    await fetchNotifications('admin');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/notifications?audience=admin');
  });

  it('페이지 필터를 함께 보낸다', async () => {
    fetchMock.mockResolvedValue(emptyPage());

    await fetchNotifications('user', { pageSize: 100 });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('audience=user');
    expect(url).toContain('pageSize=100');
  });

  it('items·meta·unreadCount 를 그대로 돌려준다', async () => {
    const body = {
      items: [
        {
          id: 'n1',
          audience: 'user',
          type: 'consult-status',
          consultStatus: 'booked',
          title: '상담 예약이 확정됐어요',
          message: '강남 스마일 치과 · 10/9(금) 14:00 방문',
          isRead: false,
          createdAt: '2026-10-22T00:00:00.000Z',
          relatedId: 'cr1',
          relatedResource: 'consultRequest',
        },
      ],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      unreadCount: 1,
    };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchNotifications('user')).resolves.toEqual(body);
  });

  it('user 역할이 관리자 알림함을 물으면 403 이 올라온다 (훅이 미리 막지만 코드는 그대로 던진다)', async () => {
    fetchMock.mockResolvedValue(
      fail(403, { error: { code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없어요' } })
    );

    const error = await fetchNotifications('admin').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
  });
});

describe('fetchUnreadNotificationCount', () => {
  it('배지 전용 경로를 audience 와 함께 부른다', async () => {
    fetchMock.mockResolvedValue(ok({ audience: 'user', unreadCount: 2 }));

    await expect(fetchUnreadNotificationCount('user')).resolves.toEqual({ audience: 'user', unreadCount: 2 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/notifications/unread-count?audience=user');
  });

  it('로그인하지 않았으면 401 이다 — 훅이 그래서 로그인했을 때만 묻는다', async () => {
    fetchMock.mockResolvedValue(fail(401, { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요해요' } }));

    const error = await fetchUnreadNotificationCount('user').catch((caught: unknown) => caught);

    expect((error as ApiError).status).toBe(401);
  });
});

describe('markNotificationAsRead', () => {
  it('PATCH /notifications/{id}/read — 본문이 없다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'n1', audience: 'user', isRead: true }));

    await markNotificationAsRead('n1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/notifications\/n1\/read$/);
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBeUndefined();
  });

  it('읽음이 된 알림을 그대로 돌려준다 — 어느 알림함인지 응답이 알려준다', async () => {
    const body = { id: 'n1', audience: 'admin', isRead: true, relatedResource: 'consultRequest' };
    fetchMock.mockResolvedValue(ok(body));

    await expect(markNotificationAsRead('n1')).resolves.toEqual(body);
  });

  it('내 알림이 아니면 404 NOTIFICATION_NOT_FOUND 다', async () => {
    fetchMock.mockResolvedValue(
      fail(404, { error: { code: 'NOTIFICATION_NOT_FOUND', message: '알림을 찾을 수 없어요' } })
    );

    const error = await markNotificationAsRead('nope').catch((caught: unknown) => caught);

    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('NOTIFICATION_NOT_FOUND');
  });
});

describe('markAllNotificationsAsRead', () => {
  it('audience 를 본문에 싣는다 — 한쪽 알림함만 처리한다', async () => {
    fetchMock.mockResolvedValue(ok({ audience: 'user', markedCount: 2, unreadCount: 0 }));

    const result = await markAllNotificationsAsRead('user');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/notifications\/read-all$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ audience: 'user' });
    expect(result).toEqual({ audience: 'user', markedCount: 2, unreadCount: 0 });
  });
});
