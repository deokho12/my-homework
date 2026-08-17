import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { SEED_ACCOUNTS, SEED_FIXTURES, bearer, createTestApp, logIn } from './support/app';
import type { Session } from './support/app';

/**
 * 상담 e2e — 접수(신청자)와 처리(관리자).
 *
 * 이 스펙이 고정하는 것 중 넷은 지금 화면에만 있어서 주소로 직접 들어가면 통과하는 규칙이다:
 * 상담 마감, 지목한 전문의의 소속, 취급하지 않는 시술, 연락처 형식.
 *
 * 나머지 핵심은 **시야 분리**다 — 신청자 응답에 내부 메모가 절대 섞이지 않고,
 * 운영자에게는 이름·연락처가 마스킹된다.
 */
describe('상담 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: Session;
  let adminH1: Session;
  let adminH2: Session;
  let operator: Session;

  const H1 = SEED_FIXTURES.hospitalManagedByH1Admin;
  const H2 = SEED_FIXTURES.hospitalNotManagedByH1Admin;
  const CLOSED_HOSPITAL = 'h5';
  const DOCTOR_AT_H1 = SEED_FIXTURES.doctorAtH1;
  const DOCTOR_ELSEWHERE = SEED_FIXTURES.doctorAtH11;
  const PROCEDURE_AT_H1 = 'implant';
  const PROCEDURE_NOT_AT_H1 = 'crown';

  /** 이 스펙이 만든 상담. afterAll 에서 지워 개발 DB 를 원래대로 둔다. */
  const created: string[] = [];

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    hospitalId: H1,
    name: '박서영',
    phone: '01012345678',
    preferredTime: '평일 오전',
    message: '상담 부탁드려요',
    ...overrides,
  });

  async function createConsult(overrides: Record<string, unknown> = {}, session: Session = user) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/consult-requests')
      .set('Authorization', bearer(session.accessToken))
      .send(validBody(overrides));

    if (response.status === 201) created.push(response.body.id);

    return response;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    [user, adminH1, adminH2, operator] = await Promise.all([
      logIn(app, SEED_ACCOUNTS.user),
      logIn(app, SEED_ACCOUNTS.adminH1),
      logIn(app, SEED_ACCOUNTS.adminH2),
      logIn(app, SEED_ACCOUNTS.operator),
    ]);
  });

  afterAll(async () => {
    if (created.length > 0) {
      // 알림·감사 로그는 FK 로 상담에 묶여 있지 않다(문자열 참조라) — 따로 지운다.
      await prisma.notification.deleteMany({
        where: { relatedType: 'consult_request', relatedId: { in: created } },
      });
      await prisma.auditLog.deleteMany({
        where: { targetType: 'consult_request', targetId: { in: created } },
      });
      // 이력·메모는 상담에 cascade 로 묶여 있다.
      await prisma.consultRequest.deleteMany({ where: { id: { in: created } } });
    }

    await app.close();
  });

  // ------------------------------------------------------------------ 접수

  describe('POST /consult-requests', () => {
    it('토큰이 없으면 401 이다', async () => {
      const response = await request(app.getHttpServer()).post('/api/v1/consult-requests').send(validBody());

      expect(response.status).toBe(401);
    });

    it('접수되면 신청자 시야로 돌려주고 이력이 new 하나로 시작한다', async () => {
      const response = await createConsult();

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        hospitalId: H1,
        hospitalName: expect.any(String),
        name: '박서영',
        preferredTime: '평일 오전',
        status: 'new',
      });
      expect(response.body.statusHistory).toEqual([
        { status: 'new', changedAt: expect.any(String) },
      ]);
    });

    it('만든 자원의 위치를 Location 으로 알려준다 (신청자가 볼 수 있는 경로다)', async () => {
      const response = await createConsult();

      expect(response.headers.location).toBe(`/v1/me/consult-requests/${response.body.id}`);
    });

    it('★ 신청자 응답에는 내부 메모가 아예 없다', async () => {
      const response = await createConsult();

      expect(response.body).not.toHaveProperty('memos');
      expect(response.body.statusHistory[0]).not.toHaveProperty('changedByName');
    });

    it('연락처를 저장 형식으로 정규화한다', async () => {
      const response = await createConsult({ phone: '01012345678' });

      expect(response.body.phone).toBe('010-1234-5678');
    });

    it('★ 연락처 형식을 서버가 검사한다 (지금은 화면에만 있어 주소로 직접 들어가면 통과한다)', async () => {
      for (const phone of ['1', 'abc', '없음', '02-123-4567']) {
        const response = await createConsult({ phone });

        expect(response.status).toBe(422);
      }
    });

    it('이름이 공백뿐이면 거절한다', async () => {
      const response = await createConsult({ name: '   ' });

      expect(response.status).toBe(422);
    });

    it('★ 상담 마감인 병원은 서버가 거절한다 (화면은 버튼만 막는다)', async () => {
      const response = await createConsult({ hospitalId: CLOSED_HOSPITAL });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONSULT_CLOSED');
    });

    it('없는 병원은 404 다', async () => {
      const response = await createConsult({ hospitalId: 'h-nope' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    });

    it('★ 지목한 전문의를 실제로 저장한다 (지금은 저장되지 않아 누구를 지목했는지 모른다)', async () => {
      const response = await createConsult({ doctorId: DOCTOR_AT_H1 });

      expect(response.status).toBe(201);
      expect(response.body.doctorId).toBe(DOCTOR_AT_H1);
      expect(response.body.doctorName).toEqual(expect.any(String));
    });

    it('그 병원 소속이 아닌 전문의를 지목하면 거절한다', async () => {
      const response = await createConsult({ doctorId: DOCTOR_ELSEWHERE });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('DOCTOR_NOT_AT_HOSPITAL');
    });

    it('그 병원이 취급하지 않는 시술은 거절한다', async () => {
      const response = await createConsult({ procedureId: PROCEDURE_NOT_AT_H1 });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('PROCEDURE_NOT_OFFERED');
    });

    it('취급하는 시술은 통과하고 이름이 함께 나온다', async () => {
      const response = await createConsult({ procedureId: PROCEDURE_AT_H1 });

      expect(response.status).toBe(201);
      expect(response.body.procedureId).toBe(PROCEDURE_AT_H1);
      expect(response.body.procedureName).toEqual(expect.any(String));
    });

    it('★ 접수되면 그 병원 담당자에게 알림이 간다', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count?audience=admin')
        .set('Authorization', bearer(adminH1.accessToken));

      await createConsult();

      const after = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count?audience=admin')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(after.body.unreadCount).toBe(before.body.unreadCount + 1);
    });

    it('★ 그 알림은 다른 병원 담당자에게 가지 않는다', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count?audience=admin')
        .set('Authorization', bearer(adminH2.accessToken));

      await createConsult();

      const after = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count?audience=admin')
        .set('Authorization', bearer(adminH2.accessToken));

      expect(after.body.unreadCount).toBe(before.body.unreadCount);
    });
  });

  // -------------------------------------------------------------- 내 내역

  describe('GET /me/consult-requests', () => {
    it('내가 낸 상담이 보인다', async () => {
      const { body: made } = await createConsult();

      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?pageSize=100')
        .set('Authorization', bearer(user.accessToken));

      expect(response.status).toBe(200);
      expect(response.body.items.map((item: { id: string }) => item.id)).toContain(made.id);
    });

    it('★ 남의 상담은 목록에 없다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?pageSize=100')
        .set('Authorization', bearer(adminH2.accessToken));

      const ids = response.body.items.map((item: { id: string }) => item.id);

      expect(ids).not.toContain(created[0]);
    });

    it('★ 남의 상담 상세와 없는 상담이 구분되지 않는다', async () => {
      const [foreign, missing] = await Promise.all([
        request(app.getHttpServer())
          .get(`/api/v1/me/consult-requests/${created[0]}`)
          .set('Authorization', bearer(adminH2.accessToken)),
        request(app.getHttpServer())
          .get('/api/v1/me/consult-requests/nope')
          .set('Authorization', bearer(adminH2.accessToken)),
      ]);

      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body.error.code).toBe(missing.body.error.code);
      expect(foreign.body.error.message).toBe(missing.body.error.message);
    });

    it('개인정보라 캐시하지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests')
        .set('Authorization', bearer(user.accessToken));

      expect(response.headers['cache-control']).toBe('no-store');
    });
  });

  // -------------------------------------------------------------- 관리자

  describe('GET /consult-requests — 목록과 범위', () => {
    it('일반 사용자는 볼 수 없다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests')
        .set('Authorization', bearer(user.accessToken));

      expect(response.status).toBe(403);
    });

    it('★ 병원 담당자에게는 담당 병원 상담만 보인다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests?pageSize=100')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(200);
      expect(response.body.scope).toBe('managed');
      expect(
        response.body.items.every((item: { hospitalId: string }) => item.hospitalId === H1),
      ).toBe(true);
    });

    it('운영자에게는 전 병원이 보인다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests?pageSize=100')
        .set('Authorization', bearer(operator.accessToken));

      expect(response.body.scope).toBe('all');
      expect(new Set(response.body.items.map((i: { hospitalId: string }) => i.hospitalId)).size).toBeGreaterThan(1);
    });

    it('★ 담당 밖 병원을 콕 집어 요청하면 403 이다 — 병원은 공개 리소스라 숨기지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/consult-requests?hospitalId=${H2}&pageSize=100`)
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });

    it('담당 병원을 콕 집어 요청하면 그 병원만 나온다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/consult-requests?hospitalId=${H1}&pageSize=100`)
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(200);
      expect(response.body.items.every((item: { hospitalId: string }) => item.hospitalId === H1)).toBe(true);
    });

    it('운영자는 어느 병원이든 집어 볼 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/consult-requests?hospitalId=${H2}&pageSize=100`)
        .set('Authorization', bearer(operator.accessToken));

      expect(response.status).toBe(200);
    });

    it('★ 역할에 따라 본문이 달라지므로 공유 캐시가 섞이지 않게 Vary 를 붙인다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.headers.vary).toBe('Authorization');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('상태로 거른다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests?status=booked&pageSize=100')
        .set('Authorization', bearer(operator.accessToken));

      expect(response.body.items.every((item: { status: string }) => item.status === 'booked')).toBe(true);
    });
  });

  describe('★ 개인정보 마스킹', () => {
    it('담당 병원 담당자는 원본을 본다', async () => {
      const { body: made } = await createConsult({ name: '박서영', phone: '01012345678' });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/consult-requests/${made.id}`)
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ name: '박서영', phone: '010-1234-5678', piiMasked: false });
    });

    it('운영자는 마스킹된 값을 보고 piiMasked 가 true 다', async () => {
      const { body: made } = await createConsult({ name: '박서영', phone: '01012345678' });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/consult-requests/${made.id}`)
        .set('Authorization', bearer(operator.accessToken));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ name: '박*영', phone: '010-****-5678', piiMasked: true });
    });
  });

  describe('GET /consult-requests/:id — 인가', () => {
    it('★ 담당 아닌 병원의 상담과 없는 상담이 구분되지 않는다', async () => {
      const [foreign, missing] = await Promise.all([
        request(app.getHttpServer())
          .get(`/api/v1/consult-requests/${SEED_FIXTURES.consultAtH2}`)
          .set('Authorization', bearer(adminH1.accessToken)),
        request(app.getHttpServer())
          .get(`/api/v1/consult-requests/${SEED_FIXTURES.consultMissing}`)
          .set('Authorization', bearer(adminH1.accessToken)),
      ]);

      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body.error).toMatchObject({ code: missing.body.error.code, message: missing.body.error.message });
    });

    it('★ 열람이 감사 로그에 남는다 (결정 3 — 마스킹되지 않은 개인정보를 본 대가)', async () => {
      const { body: made } = await createConsult();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/consult-requests/${made.id}`)
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(200);
      expect(response.headers['x-audit-logged']).toBe('true');

      const rows = await prisma.auditLog.findMany({
        where: { action: 'consult_request.view', targetId: made.id, actorUserId: adminH1.user.id },
      });

      expect(rows).toHaveLength(1);
      // 담당 병원 담당자는 원본을 봤다 → `pii_masked = false`. 가드가 남긴 범위에서 나온다.
      expect(rows[0]).toMatchObject({ piiMasked: false, hospitalId: H1 });
    });

    it('★ 운영자 열람은 마스킹된 것으로 기록된다', async () => {
      const { body: made } = await createConsult();

      await request(app.getHttpServer())
        .get(`/api/v1/consult-requests/${made.id}`)
        .set('Authorization', bearer(operator.accessToken));

      const rows = await prisma.auditLog.findMany({
        where: { action: 'consult_request.view', targetId: made.id, actorUserId: operator.user.id },
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].piiMasked).toBe(true);
    });

    it('summary 가 상담 id 로 잡히지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/summary')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('newThisMonth');
    });
  });

  describe('GET /consult-requests/summary', () => {
    it('요약 숫자와 기준 시간대를 준다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/summary')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        newThisMonth: expect.any(Number),
        pending: expect.any(Number),
        timezone: 'Asia/Seoul',
        calculatedAt: expect.any(String),
      });
    });

    it('★ 방금 접수한 상담이 이번 달 숫자에 반영된다 (지금 화면은 항상 0 이다)', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/summary')
        .set('Authorization', bearer(adminH1.accessToken));

      await createConsult();

      const after = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/summary')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(after.body.newThisMonth).toBe(before.body.newThisMonth + 1);
      expect(after.body.pending).toBe(before.body.pending + 1);
    });

    it('일반 사용자는 볼 수 없다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/summary')
        .set('Authorization', bearer(user.accessToken));

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /consult-requests/:id/status', () => {
    const patch = (id: string, status: string, session: Session) =>
      request(app.getHttpServer())
        .patch(`/api/v1/consult-requests/${id}/status`)
        .set('Authorization', bearer(session.accessToken))
        .send({ status });

    it('★ 운영자는 읽을 수 있지만 바꿀 수 없다', async () => {
      const { body: made } = await createConsult();

      expect((await patch(made.id, 'contacted', operator)).status).toBe(403);
    });

    it('★ 실제로 바뀌면 X-Status-Changed: true, 같은 상태면 false 다', async () => {
      const { body: made } = await createConsult();

      const changed = await patch(made.id, 'contacted', adminH1);
      const unchanged = await patch(made.id, 'contacted', adminH1);

      expect(changed.headers['x-status-changed']).toBe('true');
      // 본문만으로는 두 응답이 같다 — 이 헤더가 유일한 구분 수단이다.
      expect(unchanged.headers['x-status-changed']).toBe('false');
      expect(unchanged.body.status).toBe(changed.body.status);
    });

    it('상태가 바뀌고 이력이 쌓인다', async () => {
      const { body: made } = await createConsult();

      const response = await patch(made.id, 'contacted', adminH1);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('contacted');
      expect(response.body.statusHistory.map((h: { status: string }) => h.status)).toEqual(['new', 'contacted']);
      expect(response.body.statusHistory[1].changedByName).toEqual(expect.any(String));
    });

    it('★ 같은 상태를 다시 지정하면 이력도 알림도 늘지 않는다 (지금은 오탭 한 번에 둘 다 쌓인다)', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, 'booked', adminH1);

      const unreadBefore = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count?audience=user')
        .set('Authorization', bearer(user.accessToken));

      const again = await patch(made.id, 'booked', adminH1);

      const unreadAfter = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count?audience=user')
        .set('Authorization', bearer(user.accessToken));

      expect(again.status).toBe(200);
      expect(again.body.status).toBe('booked');
      expect(again.body.statusHistory.filter((h: { status: string }) => h.status === 'booked')).toHaveLength(1);
      expect(unreadAfter.body.unreadCount).toBe(unreadBefore.body.unreadCount);
    });

    it('★ 상태가 실제로 바뀌면 신청자에게 알림이 간다', async () => {
      const { body: made } = await createConsult();

      const before = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count?audience=user')
        .set('Authorization', bearer(user.accessToken));

      await patch(made.id, 'contacted', adminH1);

      const after = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count?audience=user')
        .set('Authorization', bearer(user.accessToken));

      expect(after.body.unreadCount).toBe(before.body.unreadCount + 1);
    });

    it('모르는 상태는 거절한다', async () => {
      const { body: made } = await createConsult();

      expect((await patch(made.id, 'done', adminH1)).status).toBe(422);
    });

    it('담당 아닌 병원의 상담은 404 다', async () => {
      expect((await patch(SEED_FIXTURES.consultAtH2, 'contacted', adminH1)).status).toBe(404);
    });
  });

  describe('POST /consult-requests/:id/memos', () => {
    const addMemo = (id: string, content: string, session: Session) =>
      request(app.getHttpServer())
        .post(`/api/v1/consult-requests/${id}/memos`)
        .set('Authorization', bearer(session.accessToken))
        .send({ content });

    it('메모가 추가되고 작성자 이름이 함께 남는다', async () => {
      const { body: made } = await createConsult();

      const response = await addMemo(made.id, '고객에게 연락함', adminH1);

      expect(response.status).toBe(201);
      expect(response.body.memos).toHaveLength(1);
      expect(response.body.memos[0]).toMatchObject({
        content: '고객에게 연락함',
        authorName: expect.any(String),
      });
    });

    it('★ 그 메모는 신청자 응답에 절대 나오지 않는다', async () => {
      const { body: made } = await createConsult();

      await addMemo(made.id, '내부 공유용 메모', adminH1);

      const mine = await request(app.getHttpServer())
        .get(`/api/v1/me/consult-requests/${made.id}`)
        .set('Authorization', bearer(user.accessToken));

      expect(mine.status).toBe(200);
      expect(mine.body).not.toHaveProperty('memos');
      expect(JSON.stringify(mine.body)).not.toContain('내부 공유용 메모');
    });

    it('★ 운영자는 메모를 남길 수 없다 (읽기 전용)', async () => {
      const { body: made } = await createConsult();

      expect((await addMemo(made.id, '운영자 메모', operator)).status).toBe(403);
    });

    it('빈 메모는 거절한다', async () => {
      const { body: made } = await createConsult();

      expect((await addMemo(made.id, '   ', adminH1)).status).toBe(422);
    });
  });
});
