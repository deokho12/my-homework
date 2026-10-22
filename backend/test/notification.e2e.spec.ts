import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_ACCOUNTS, bearer, createTestApp, logIn } from './support/app';
import type { Session } from './support/app';

/**
 * 알림함 e2e.
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: `consultStatus`·`relatedResource` 단정 추가, `?type=inquiry-answer` 가 422 가
 *  아님, 읽음이 **수신자별**이라는 단정, 404 코드 이름 고정.)
 *
 * 요청서 15 가 닫는 🔴 이 여기 있다 — **알림이 계정별로 나뉜다.** 지금 화면은 로그인한 아무
 * 계정이나 모든 알림을 본다. 서버는 내 수신자 행에서만 출발하므로 구조적으로 남의 알림이
 * 섞일 수 없어야 한다.
 */
describe('알림 (e2e)', () => {
  let app: INestApplication;
  let user: Session;
  /** 환자 B — A 와 **다른 건수·다른 문구**를 봐야 한다 (docs §12.13-E). */
  let otherUser: Session;
  let adminH1: Session;
  let adminH2: Session;
  let operator: Session;

  beforeAll(async () => {
    app = await createTestApp();
    [user, otherUser, adminH1, adminH2, operator] = await Promise.all([
      logIn(app, SEED_ACCOUNTS.user),
      logIn(app, 'seed-2@molarmolar.example'),
      logIn(app, SEED_ACCOUNTS.adminH1),
      logIn(app, SEED_ACCOUNTS.adminH2),
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

  const idsOf = (body: { items: { id: string }[] }): string[] => body.items.map((item) => item.id).sort();

  describe('GET /notifications — 인증과 알림함 접근', () => {
    it('토큰이 없으면 401 이다 (지금은 비로그인도 알림이 보인다)', async () => {
      const response = await get('/api/v1/notifications?audience=user');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('audience 는 필수이고 모르는 값은 거절한다', async () => {
      expect((await get('/api/v1/notifications', user.accessToken)).status).toBe(422);
      expect((await get('/api/v1/notifications?audience=everyone', user.accessToken)).status).toBe(422);
    });

    it('★ 일반 사용자는 관리자 알림함을 열 수 없다 (문구에 고객 이름이 있다)', async () => {
      const response = await get('/api/v1/notifications?audience=admin', user.accessToken);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('병원 담당자는 관리자 알림함과 본인 알림함을 모두 연다', async () => {
      expect((await get('/api/v1/notifications?audience=admin', adminH1.accessToken)).status).toBe(200);
      // 담당자도 개인으로서 상담을 신청한다 — 본인 알림함이 필요하다.
      expect((await get('/api/v1/notifications?audience=user', adminH1.accessToken)).status).toBe(200);
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
      const response = await get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken);

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items.every((item: { audience: string }) => item.audience === 'user')).toBe(true);
    });

    it('★ 환자 A 의 알림이 환자 B 에게 보이지 않는다 (요청서의 확인 항목)', async () => {
      const [mine, theirs] = await Promise.all([
        get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken),
        get('/api/v1/notifications?audience=user&pageSize=100', otherUser.accessToken),
      ]);

      // 둘 다 공지 2건은 함께 받지만 상담 알림은 겹치지 않는다.
      const consultIdsOf = (body: { items: { id: string; type: string }[] }) =>
        body.items.filter((item) => item.type === 'consult-status').map((item) => item.id);

      expect(idsOf(mine.body)).not.toEqual(idsOf(theirs.body));
      expect(consultIdsOf(mine.body).length).toBeGreaterThan(0);
      expect(consultIdsOf(theirs.body).length).toBeGreaterThan(0);
      expect(consultIdsOf(mine.body).some((id) => consultIdsOf(theirs.body).includes(id))).toBe(false);
    });

    it('★ 담당 병원이 다른 두 담당자의 관리자 알림함이 겹치지 않는다', async () => {
      const [h1, h2] = await Promise.all([
        get('/api/v1/notifications?audience=admin&pageSize=100', adminH1.accessToken),
        get('/api/v1/notifications?audience=admin&pageSize=100', adminH2.accessToken),
      ]);
      const consultOnly = (body: { items: { id: string; relatedResource: string | null }[] }) =>
        body.items.filter((item) => item.relatedResource === 'consultRequest').map((item) => item.id);

      expect(consultOnly(h1.body).some((id) => consultOnly(h2.body).includes(id))).toBe(false);
      // 시드의 접수 알림은 상담과 1:1 이다 — h1 상담 6건, h2 상담 2건. (같은 실행의 상담 e2e 가
      // h1 에 상담을 더 만들므로 하한으로만 단정한다 — 테스트 DB 는 실행당 한 번만 새로 만든다.)
      expect(consultOnly(h1.body).length).toBeGreaterThanOrEqual(6);
      expect(consultOnly(h2.body)).toHaveLength(2);
    });
  });

  describe('응답 모양', () => {
    it('계약이 요구하는 키를 모두 담는다 (consultStatus·relatedResource 포함)', async () => {
      const response = await get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken);
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
      // 값은 nullable 이지만 **키는 항상 있다** — 없는 것과 null 이 섞이면 화면이 구분할 수 없다.
      for (const key of ['consultStatus', 'relatedId', 'relatedResource']) {
        expect(item).toHaveProperty(key);
      }
    });

    it('★ relatedResource 는 camelCase 다 (저장은 snake_case)', async () => {
      const response = await get('/api/v1/notifications?audience=admin&pageSize=100', adminH1.accessToken);
      const consult = response.body.items.find(
        (item: { relatedResource: string | null }) => item.relatedResource !== null,
      );

      expect(consult.relatedResource).toBe('consultRequest');
      expect(response.body.items.every((item: { relatedResource: unknown }) =>
        [null, 'consultRequest', 'hospital', 'doctor', 'promotion', 'hospitalInquiry'].includes(
          item.relatedResource as string,
        ),
      )).toBe(true);
    });

    it('★ 상담 알림은 consultStatus 를 싣고 공지는 null 이다', async () => {
      const response = await get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken);
      const consult = response.body.items.find((item: { type: string }) => item.type === 'consult-status');
      const announcement = response.body.items.find((item: { type: string }) => item.type !== 'consult-status');

      expect(consult.consultStatus).toEqual(expect.any(String));
      expect(announcement.consultStatus).toBeNull();
    });

    it('★ 목록이 안 읽은 전체 개수를 함께 준다 (배지를 위해 한 번 더 부르지 않게)', async () => {
      const [list, count] = await Promise.all([
        get('/api/v1/notifications?audience=user&pageSize=1', user.accessToken),
        get('/api/v1/notifications/unread-count?audience=user', user.accessToken),
      ]);

      expect(list.body.unreadCount).toBe(count.body.unreadCount);
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

    it('★ ?type=inquiry-answer 는 422 가 아니다 — 아직 그 값이 없을 뿐이다 (요청서 16)', async () => {
      const response = await get(
        '/api/v1/notifications?audience=user&type=inquiry-answer',
        user.accessToken,
      );

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
      // 종류 필터를 걸어도 배지 숫자는 알림함 전체 기준이다.
      expect(response.body.unreadCount).toBeGreaterThan(0);
    });

    it('?type 과 ?isRead 필터가 알림함 조건을 유지한다', async () => {
      const response = await get(
        '/api/v1/notifications?audience=user&type=consult-status&isRead=false&pageSize=100',
        user.accessToken,
      );

      expect(
        response.body.items.every(
          (item: { audience: string; type: string; isRead: boolean }) =>
            item.audience === 'user' && item.type === 'consult-status' && !item.isRead,
        ),
      ).toBe(true);
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
      expect((await get('/api/v1/notifications/unread-count?audience=admin', user.accessToken)).status).toBe(
        403,
      );
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    const markRead = (id: string, session: Session) =>
      request(app.getHttpServer())
        .patch(`/api/v1/notifications/${id}/read`)
        .set('Authorization', bearer(session.accessToken));

    it('★ 남의 알림은 404 다 — 없는 알림과 구분되지 않고 코드가 고정이다', async () => {
      const theirs = await get('/api/v1/notifications?audience=admin&pageSize=100', adminH1.accessToken);
      const notMine = theirs.body.items[0]?.id;

      expect(notMine).toBeDefined();

      const [foreign, missing] = await Promise.all([markRead(notMine, user), markRead('does-not-exist', user)]);

      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
      expect(foreign.body.error.message).toBe(missing.body.error.message);
    });

    it('읽음 처리하면 isRead 가 true 가 되고, 다시 불러도 그대로다 (멱등)', async () => {
      const list = await get('/api/v1/notifications?audience=user&pageSize=100', otherUser.accessToken);
      const target = list.body.items.find((item: { isRead: boolean }) => !item.isRead).id;

      const first = await markRead(target, otherUser);
      const second = await markRead(target, otherUser);

      expect(first.status).toBe(200);
      expect(first.body.isRead).toBe(true);
      expect(second.status).toBe(200);
      expect(second.body.isRead).toBe(true);
    });

    it('★ 한 알림 행을 여러 계정이 받고, 읽음은 수신 행(계정)별이다', async () => {
      const [mine, theirs] = await Promise.all([
        get('/api/v1/notifications?audience=user&pageSize=100', user.accessToken),
        get('/api/v1/notifications?audience=user&pageSize=100', otherUser.accessToken),
      ]);
      const announcement = mine.body.items.find((item: { type: string }) => item.type !== 'consult-status');

      // 같은 **행**이 두 알림함에 함께 보인다 (fan-out). 상담 알림은 반대로 겹치지 않는다.
      expect(theirs.body.items.some((item: { id: string }) => item.id === announcement.id)).toBe(true);

      // 그런데 읽음은 각자의 `notification_recipients.read_at` 이다. 내 상담 알림을 읽어도
      // 다른 계정의 안 읽은 개수는 **한 건도** 움직이지 않는다.
      const target = mine.body.items.find((item: { isRead: boolean }) => !item.isRead).id;
      const theirCountBefore = await get(
        '/api/v1/notifications/unread-count?audience=user',
        otherUser.accessToken,
      );

      expect(await markRead(target, user)).toMatchObject({ status: 200 });
      // 애초에 남의 알림함에는 그 행이 없다 (수신자 스코프).
      expect(theirs.body.items.some((item: { id: string }) => item.id === target)).toBe(false);

      const theirCountAfter = await get(
        '/api/v1/notifications/unread-count?audience=user',
        otherUser.accessToken,
      );

      expect(theirCountAfter.body.unreadCount).toBe(theirCountBefore.body.unreadCount);
      expect(announcement.isRead).toBe(true);
    });
  });

  describe('POST /notifications/read-all', () => {
    const readAll = (audience: string, session: Session) =>
      request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', bearer(session.accessToken))
        .send({ audience });

    it('★ 한쪽 알림함만 처리하고 반대쪽은 건드리지 않는다', async () => {
      const before = await get('/api/v1/notifications/unread-count?audience=admin', adminH2.accessToken);

      const result = await readAll('user', adminH2);

      expect(result.body).toEqual({ audience: 'user', markedCount: expect.any(Number), unreadCount: 0 });

      const [userAfter, adminAfter] = await Promise.all([
        get('/api/v1/notifications/unread-count?audience=user', adminH2.accessToken),
        get('/api/v1/notifications/unread-count?audience=admin', adminH2.accessToken),
      ]);

      expect(userAfter.body.unreadCount).toBe(0);
      expect(adminAfter.body.unreadCount).toBe(before.body.unreadCount);
    });

    it('★ 다시 부르면 markedCount 가 0 이고 여전히 200 이다 (멱등)', async () => {
      await readAll('admin', adminH2);
      const again = await readAll('admin', adminH2);

      expect(again.status).toBe(200);
      expect(again.body).toEqual({ audience: 'admin', markedCount: 0, unreadCount: 0 });
    });

    it('★ 한 계정의 모두 읽음이 다른 계정의 알림함을 건드리지 않는다', async () => {
      const before = await get('/api/v1/notifications/unread-count?audience=admin', adminH1.accessToken);

      await readAll('admin', adminH2);

      const after = await get('/api/v1/notifications/unread-count?audience=admin', adminH1.accessToken);

      expect(after.body.unreadCount).toBe(before.body.unreadCount);
      expect(after.body.unreadCount).toBeGreaterThan(0);
    });

    it('audience 가 없으면 거절한다 (생략을 허용하면 반대쪽까지 지워질 수 있다)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', bearer(user.accessToken))
        .send({});

      expect(response.status).toBe(422);
    });

    it('일반 사용자는 관리자 알림함을 모두 읽음 처리할 수 없다', async () => {
      expect((await readAll('admin', user)).status).toBe(403);
    });
  });
});
