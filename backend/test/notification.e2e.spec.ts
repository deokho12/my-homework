import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_ACCOUNTS, bearer, createTestApp, logIn } from './support/app';
import type { Session } from './support/app';

/**
 * 알림함 e2e.
 *
 * 이 조각이 닫는 🔴 이 여기 있다 — **알림이 계정별로 나뉜다.** 지금 화면은 로그인한
 * 아무 계정이나 모든 알림을 본다. 서버는 내 수신자 행에서만 출발하므로 구조적으로
 * 남의 알림이 섞일 수 없어야 한다.
 */
describe('알림 (e2e)', () => {
  let app: INestApplication;
  let user: Session;
  let adminH1: Session;
  let operator: Session;

  beforeAll(async () => {
    app = await createTestApp();
    [user, adminH1, operator] = await Promise.all([
      logIn(app, SEED_ACCOUNTS.user),
      logIn(app, SEED_ACCOUNTS.adminH1),
      logIn(app, SEED_ACCOUNTS.operator),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(path);

    return token ? req.set('Authorization', bearer(token)) : req;
  };

  describe('GET /notifications — 인증과 알림함 접근', () => {
    it('토큰이 없으면 401 이다 (지금은 비로그인도 알림이 보인다)', async () => {
      const response = await get('/api/v1/notifications?audience=user');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('audience 는 필수다', async () => {
      const response = await get('/api/v1/notifications', user.accessToken);

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('모르는 audience 는 거절한다', async () => {
      const response = await get('/api/v1/notifications?audience=everyone', user.accessToken);

      expect(response.status).toBe(422);
    });

    it('★ 일반 사용자는 관리자 알림함을 열 수 없다 (문구에 고객 이름이 있다)', async () => {
      const response = await get('/api/v1/notifications?audience=admin', user.accessToken);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('병원 담당자는 관리자 알림함을 연다', async () => {
      const response = await get('/api/v1/notifications?audience=admin', adminH1.accessToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('병원 담당자도 본인 알림함을 연다 — 담당자도 개인으로서 상담을 신청한다', async () => {
      const response = await get('/api/v1/notifications?audience=user', adminH1.accessToken);

      expect(response.status).toBe(200);
    });

    it('운영자의 관리자 알림함은 비어 있는 것이 정상이다 (수신자로 지정되지 않는다)', async () => {
      const response = await get('/api/v1/notifications?audience=admin', operator.accessToken);

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
      expect(response.body.meta.totalItems).toBe(0);
    });
  });

  describe('★ 수신자 스코프 — 남의 알림이 섞이지 않는다', () => {
    it('사용자 알림함의 모든 항목이 audience=user 다', async () => {
      const response = await get('/api/v1/notifications?audience=user', user.accessToken);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items.every((item: { audience: string }) => item.audience === 'user')).toBe(true);
    });

    it('관리자 알림함의 모든 항목이 audience=admin 다', async () => {
      const response = await get('/api/v1/notifications?audience=admin', adminH1.accessToken);

      expect(response.body.items.every((item: { audience: string }) => item.audience === 'admin')).toBe(true);
    });

    it('★ 두 계정의 사용자 알림 id 집합이 같지 않다 (계정별로 갈렸다는 증거)', async () => {
      const [mine, theirs] = await Promise.all([
        get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken),
        get('/api/v1/notifications?audience=user&pageSize=100', adminH1.accessToken),
      ]);

      const idsOf = (body: { items: { id: string }[] }) => body.items.map((item) => item.id).sort();

      expect(idsOf(mine.body)).not.toEqual(idsOf(theirs.body));
    });
  });

  describe('응답 모양', () => {
    it('계약이 요구하는 필드를 담고, relatedResource 로 종류를 알려준다', async () => {
      const response = await get('/api/v1/notifications?audience=user', user.accessToken);
      const item = response.body.items[0];

      expect(item).toMatchObject({
        id: expect.any(String),
        audience: 'user',
        type: expect.any(String),
        title: expect.any(String),
        message: expect.any(String),
        isRead: expect.any(Boolean),
        createdAt: expect.any(String),
      });
      expect(item).toHaveProperty('relatedId');
      // 지금 관리자 알림함은 relatedId 만 보고 무조건 상담 상세로 보낸다. 이 필드가 그것을 고친다.
      expect(item).toHaveProperty('relatedResource');
    });

    it('개인 알림이라 캐시하지 않는다', async () => {
      const response = await get('/api/v1/notifications?audience=user', user.accessToken);

      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('최신순이다', async () => {
      const response = await get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken);
      const times = response.body.items.map((item: { createdAt: string }) => Date.parse(item.createdAt));

      expect(times).toEqual([...times].sort((a: number, b: number) => b - a));
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('목록의 안 읽은 개수와 같다', async () => {
      const [list, count] = await Promise.all([
        get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken),
        get('/api/v1/notifications/unread-count?audience=user', user.accessToken),
      ]);

      const unreadInList = list.body.items.filter((item: { isRead: boolean }) => !item.isRead).length;

      expect(count.status).toBe(200);
      expect(count.body).toEqual({ audience: 'user', unreadCount: unreadInList });
    });

    it('★ unread-count 가 :notificationId 라우트에 잡히지 않는다', async () => {
      const response = await get('/api/v1/notifications/unread-count?audience=user', user.accessToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unreadCount');
    });

    it('일반 사용자는 관리자 배지를 볼 수 없다', async () => {
      const response = await get('/api/v1/notifications/unread-count?audience=admin', user.accessToken);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('★ 남의 알림은 404 다 — 없는 알림과 구분되지 않는다', async () => {
      const theirs = await get('/api/v1/notifications?audience=admin&pageSize=100', adminH1.accessToken);
      const notMine = theirs.body.items[0]?.id;

      expect(notMine).toBeDefined();

      const [foreign, missing] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/api/v1/notifications/${notMine}/read`)
          .set('Authorization', bearer(user.accessToken)),
        request(app.getHttpServer())
          .patch('/api/v1/notifications/does-not-exist/read')
          .set('Authorization', bearer(user.accessToken)),
      ]);

      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body.error.code).toBe(missing.body.error.code);
      expect(foreign.body.error.message).toBe(missing.body.error.message);
    });

    it('읽음 처리하면 isRead 가 true 가 되고, 다시 불러도 그대로다 (멱등)', async () => {
      const list = await get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken);
      const target = list.body.items[0].id;

      const first = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${target}/read`)
        .set('Authorization', bearer(user.accessToken));

      expect(first.status).toBe(200);
      expect(first.body.isRead).toBe(true);

      const second = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${target}/read`)
        .set('Authorization', bearer(user.accessToken));

      expect(second.status).toBe(200);
      expect(second.body.isRead).toBe(true);
    });
  });

  describe('POST /notifications/read-all', () => {
    it('★ 한쪽 알림함만 처리하고 반대쪽은 건드리지 않는다', async () => {
      const before = await get('/api/v1/notifications/unread-count?audience=admin', adminH1.accessToken);

      await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', bearer(adminH1.accessToken))
        .send({ audience: 'user' });

      const [userAfter, adminAfter] = await Promise.all([
        get('/api/v1/notifications/unread-count?audience=user', adminH1.accessToken),
        get('/api/v1/notifications/unread-count?audience=admin', adminH1.accessToken),
      ]);

      expect(userAfter.body.unreadCount).toBe(0);
      expect(adminAfter.body.unreadCount).toBe(before.body.unreadCount);
    });

    it('audience 가 없으면 거절한다 (생략을 허용하면 반대쪽까지 지워질 수 있다)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', bearer(user.accessToken))
        .send({});

      expect(response.status).toBe(422);
    });

    it('일반 사용자는 관리자 알림함을 모두 읽음 처리할 수 없다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', bearer(user.accessToken))
        .send({ audience: 'admin' });

      expect(response.status).toBe(403);
    });
  });
});
