import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { SEED_ACCOUNTS, SEED_FIXTURES, bearer, createTestApp, logIn } from './support/app';
import type { Session } from './support/app';

/**
 * 상담 e2e — 접수(신청자)와 처리(관리자).
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: 본문에 `thirdPartyConsent` 추가, 옛 시술 id → `implant-general`, 이력의
 *  `visitAt`·`event`·`notified` 키, **목록은 담당자에게도 번호 마스킹**, 전화 상세 코드
 *  `INVALID_PHONE_FORMAT`, `summary` 케이스 삭제, **수동 DB 정리 삭제**(전용 테스트 DB 를
 *  매 실행 다시 만든다 — docs §8.7), 상태 변경·일시 변경·취소 사유·감사 행 단정 추가.)
 *
 * 이 스펙이 고정하는 것 중 다섯은 지금 화면에만 있어서 주소로 직접 들어가면 통과하는
 * 규칙이다: **제3자 제공 동의**, 상담 마감, 지목 전문의의 소속, 취급하지 않는 시술, 연락처 형식.
 *
 * 나머지 핵심은 **시야 분리**다 — 신청자 응답에 내부 메모가 절대 섞이지 않고, 목록에는
 * 역할과 무관하게 전체 번호가 없으며, 운영자에게는 이름까지 마스킹된다.
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
  const CLOSED_HOSPITAL = SEED_FIXTURES.hospitalWithConsultClosed;
  const DOCTOR_AT_H1 = SEED_FIXTURES.doctorAtH1;
  const DOCTOR_ELSEWHERE = SEED_FIXTURES.doctorAtH11;
  const PROCEDURE_AT_H1 = 'implant-general';
  const PROCEDURE_NOT_AT_H1 = 'crown';

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    hospitalId: H1,
    procedureId: PROCEDURE_AT_H1,
    name: '박서영',
    phone: '01012344411',
    preferredTime: '평일 오전',
    message: '상담 부탁드려요',
    thirdPartyConsent: { agreed: true, noticeVersion: '2026-10-12' },
    ...overrides,
  });

  async function createConsult(overrides: Record<string, unknown> = {}, session: Session = user) {
    return request(app.getHttpServer())
      .post('/api/v1/consult-requests')
      .set('Authorization', bearer(session.accessToken))
      .send(validBody(overrides));
  }

  const patch = (id: string, body: Record<string, unknown>, session: Session) =>
    request(app.getHttpServer())
      .patch(`/api/v1/consult-requests/${id}/status`)
      .set('Authorization', bearer(session.accessToken))
      .send(body);

  const unreadFor = async (session: Session, audience: 'user' | 'admin'): Promise<number> => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/notifications/unread-count?audience=${audience}`)
      .set('Authorization', bearer(session.accessToken));

    return response.body.unreadCount as number;
  };

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
    // **수동 정리가 없다.** 테스트 DB 는 매 실행마다 새로 만들어진다 (docs §8.7).
    await app.close();
  });

  // ------------------------------------------------------------------ 접수

  describe('POST /consult-requests', () => {
    it('토큰이 없으면 401 이다', async () => {
      const response = await request(app.getHttpServer()).post('/api/v1/consult-requests').send(validBody());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
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
        visitAt: null,
      });
      expect(response.body.statusHistory).toEqual([
        { status: 'new', changedAt: expect.any(String), visitAt: null },
      ]);
    });

    it('★ 동의 기록이 남고 시각은 서버 시계다 (기기 시계는 증빙이 되지 않는다)', async () => {
      const before = Date.now() - 1000;
      const response = await createConsult();

      expect(response.body.thirdPartyConsent).toEqual({
        agreedAt: expect.any(String),
        noticeVersion: '2026-10-12',
      });
      expect(Date.parse(response.body.thirdPartyConsent.agreedAt)).toBeGreaterThanOrEqual(before);
    });

    it('★ 동의가 없거나 false 면 접수 자체가 성립하지 않는다', async () => {
      for (const consent of [undefined, { agreed: false, noticeVersion: '2026-10-12' }, {}]) {
        const response = await createConsult({ thirdPartyConsent: consent });

        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe('THIRD_PARTY_CONSENT_REQUIRED');
        // 거절 사유가 하나뿐이라 필드 단위 details 를 쓰지 않는다 (계약).
        expect(response.body.error.details).toBeUndefined();
      }
    });

    it('★ 검사 순서가 계약이다 — 동의가 연락처 형식보다 먼저다', async () => {
      const response = await createConsult({ thirdPartyConsent: undefined, phone: '없음' });

      expect(response.body.error.code).toBe('THIRD_PARTY_CONSENT_REQUIRED');
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
      const response = await createConsult({ phone: '01012344411' });

      expect(response.body.phone).toBe('010-1234-4411');
    });

    it('★ 연락처 형식을 서버가 검사한다 (지금은 화면에만 있어 주소로 직접 들어가면 통과한다)', async () => {
      for (const phone of ['1', 'abc', '없음', '02-123-4567']) {
        const response = await createConsult({ phone });

        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe('VALIDATION_FAILED');
        expect(response.body.error.details[0]).toMatchObject({
          field: 'phone',
          code: 'INVALID_PHONE_FORMAT',
        });
      }
    });

    it('이름이 공백뿐이면 거절한다', async () => {
      const response = await createConsult({ name: '   ' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('희망 시간은 4지선다뿐이다 (평일 저녁 포함)', async () => {
      expect((await createConsult({ preferredTime: '평일 저녁' })).status).toBe(201);
      expect((await createConsult({ preferredTime: '아무때나' })).status).toBe(422);
    });

    it('★ 상담 마감인 병원은 서버가 거절한다 (화면은 버튼만 막는다)', async () => {
      const response = await createConsult({ hospitalId: CLOSED_HOSPITAL, procedureId: null });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONSULT_CLOSED');
    });

    it('없는 병원은 404 다', async () => {
      const response = await createConsult({ hospitalId: 'h-nope', procedureId: null });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    });

    it('★ 지목한 전문의를 실제로 저장한다', async () => {
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

    it('시술을 고르지 않으면(`잘 모르겠어요`) 그대로 저장한다', async () => {
      const response = await createConsult({ procedureId: null });

      expect(response.status).toBe(201);
      expect(response.body.procedureId).toBeNull();
      expect(response.body.procedureName).toBeNull();
    });

    it('★ 접수되면 그 병원 담당자에게 알림이 가고, 문구에 이름이 마스킹 없이 들어간다', async () => {
      const before = await unreadFor(adminH1, 'admin');
      const { body: made } = await createConsult({ name: '박서영' });
      const after = await unreadFor(adminH1, 'admin');

      expect(after).toBe(before + 1);

      const list = await request(app.getHttpServer())
        .get('/api/v1/notifications?audience=admin&pageSize=100')
        .set('Authorization', bearer(adminH1.accessToken));
      const notification = list.body.items.find(
        (item: { relatedId: string }) => item.relatedId === made.id,
      );

      expect(notification).toMatchObject({
        audience: 'admin',
        type: 'consult-status',
        consultStatus: 'new',
        title: '새로운 상담 신청',
        message: '박서영님이 상담을 신청했어요',
        relatedResource: 'consultRequest',
        isRead: false,
      });
    });

    it('★ 그 알림은 다른 병원 담당자에게 가지 않는다', async () => {
      const before = await unreadFor(adminH2, 'admin');

      await createConsult();

      expect(await unreadFor(adminH2, 'admin')).toBe(before);
    });

    it('★ 운영자는 접수 알림의 수신자가 아니다 (문구에 고객 이름이 박혀 있다)', async () => {
      const before = await unreadFor(operator, 'admin');

      await createConsult();

      expect(await unreadFor(operator, 'admin')).toBe(before);
    });

    it('접수 이력 행에는 처리자도 환자 알림도 없다 (환자가 스스로 한 일이다)', async () => {
      const { body: made } = await createConsult();
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/consult-requests/${made.id}`)
        .set('Authorization', bearer(adminH1.accessToken));

      expect(detail.body.statusHistory[0]).toMatchObject({
        event: 'status_change',
        status: 'new',
        changedByName: null,
        visitAt: null,
        cancelReason: null,
        notified: false,
      });
    });
  });

  // -------------------------------------------------------------- 내 내역

  describe('GET /me/consult-requests', () => {
    it('내가 낸 상담이 보이고 병원 이름이 채워져 있다', async () => {
      const { body: made } = await createConsult();

      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?pageSize=100')
        .set('Authorization', bearer(user.accessToken));

      expect(response.status).toBe(200);

      const mine = response.body.items.find((item: { id: string }) => item.id === made.id);

      expect(mine.hospitalName).toEqual(expect.any(String));
      expect(mine.hospitalName.length).toBeGreaterThan(0);
    });

    it('★ 시드의 한 계정이 두 병원 상담을 함께 본다 (cr1 · cr8)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?pageSize=100')
        .set('Authorization', bearer(user.accessToken));
      const ids = response.body.items.map((item: { id: string }) => item.id);

      expect(ids).toContain('cr1');
      expect(ids).toContain('cr8');
    });

    it('★ 신청자 이력에는 일시 변경 행이 내려가지 않는다 (예약확정 중복으로 보인다)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?pageSize=100')
        .set('Authorization', bearer(user.accessToken));
      const cr8 = response.body.items.find((item: { id: string }) => item.id === 'cr8');

      // 저장된 이력은 4줄(new·contacted·booked·reschedule)인데 신청자에게는 3줄이다.
      expect(cr8.statusHistory).toHaveLength(3);
      expect(cr8.statusHistory.map((row: { status: string }) => row.status)).toEqual([
        'new',
        'contacted',
        'booked',
      ]);
      // 결과(현재 확정 일시)는 `visitAt` 이 들고 있다.
      expect(cr8.visitAt).toEqual(expect.any(String));
      for (const row of cr8.statusHistory) {
        expect(row).not.toHaveProperty('event');
        expect(row).not.toHaveProperty('changedByName');
        expect(row).not.toHaveProperty('notified');
      }
    });

    it('★ 신청자에게는 취소 사유가 내려가지 않는다 (병원의 내부 처리 분류다)', async () => {
      const applicant = await logIn(app, 'seed-5@molarmolar.example');
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?pageSize=100')
        .set('Authorization', bearer(applicant.accessToken));
      const cancelled = response.body.items.find((item: { id: string }) => item.id === 'cr5');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled).not.toHaveProperty('cancelReason');
      expect(cancelled).not.toHaveProperty('memos');
      expect(cancelled.visitAt).toBeNull();
    });

    it('★ 남의 상담은 목록에 없다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?pageSize=100')
        .set('Authorization', bearer(adminH2.accessToken));

      expect(response.body.items).toEqual([]);
    });

    it('상태로 거른다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?status=booked&pageSize=100')
        .set('Authorization', bearer(user.accessToken));

      expect(response.body.items.every((item: { status: string }) => item.status === 'booked')).toBe(true);
    });

    it('개인정보라 캐시하지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests')
        .set('Authorization', bearer(user.accessToken));

      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('토큰이 없으면 401 이다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/me/consult-requests');

      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------- 관리자 목록

  describe('GET /consult-requests — 목록과 범위', () => {
    const listAs = (session: Session, query = '') =>
      request(app.getHttpServer())
        .get(`/api/v1/consult-requests?pageSize=100${query}`)
        .set('Authorization', bearer(session.accessToken));

    it('일반 사용자는 볼 수 없다', async () => {
      expect((await listAs(user)).status).toBe(403);
    });

    it('★ 병원 담당자에게는 담당 병원 상담만 보인다', async () => {
      const response = await listAs(adminH1);

      expect(response.status).toBe(200);
      expect(response.body.scope).toBe('managed');
      expect(response.body.items.every((item: { hospitalId: string }) => item.hospitalId === H1)).toBe(true);
      // 시드의 h2 상담(cr7·cr8)은 보이지 않아야 한다.
      const ids = response.body.items.map((item: { id: string }) => item.id);
      expect(ids).not.toContain('cr7');
      expect(ids).not.toContain('cr8');
    });

    it('운영자에게는 전 병원이 보인다', async () => {
      const response = await listAs(operator);

      expect(response.body.scope).toBe('all');
      expect(
        new Set(response.body.items.map((item: { hospitalId: string }) => item.hospitalId)).size,
      ).toBeGreaterThan(1);
    });

    it('★ 담당 밖 병원을 콕 집어 요청하면 403 이다 — 병원은 공개 리소스라 숨기지 않는다', async () => {
      const response = await listAs(adminH1, `&hospitalId=${H2}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });

    it('신청일시 최신순이다', async () => {
      const response = await listAs(adminH1);
      const times = response.body.items.map((item: { createdAt: string }) => Date.parse(item.createdAt));

      expect(times).toEqual([...times].sort((a: number, b: number) => b - a));
    });

    it('★ 역할에 따라 본문이 달라지므로 공유 캐시가 섞이지 않게 Vary 를 붙인다', async () => {
      const response = await listAs(adminH1);

      expect(response.headers.vary).toBe('Authorization');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('★ 목록은 담당자에게도 번호를 가린다 (무기록 대량 반출 차단)', async () => {
      const response = await listAs(adminH1);
      const cr1 = response.body.items.find((item: { id: string }) => item.id === 'cr1');

      expect(cr1).toMatchObject({ name: '김민준', phone: '010-****-5601', piiMasked: true });
    });

    it('★ 운영자 목록은 이름까지 가린다', async () => {
      const response = await listAs(operator);
      const cr1 = response.body.items.find((item: { id: string }) => item.id === 'cr1');

      expect(cr1).toMatchObject({ name: '김*준', phone: '010-****-5601', piiMasked: true });
    });

    it('항목이 상세와 같은 스키마다 (이력·메모·동의까지 싣는다)', async () => {
      const response = await listAs(adminH1);
      const cr3 = response.body.items.find((item: { id: string }) => item.id === 'cr3');

      expect(cr3).toMatchObject({
        hospitalName: expect.any(String),
        status: 'booked',
        visitAt: expect.any(String),
        cancelReason: null,
        thirdPartyConsent: { agreedAt: expect.any(String), noticeVersion: '2026-10-12' },
      });
      expect(Array.isArray(cr3.memos)).toBe(true);
      expect(cr3.statusHistory.at(-1)).toMatchObject({ event: 'status_change', status: 'booked', notified: true });
    });

    it('★ 동의 절차 이전 접수는 thirdPartyConsent 가 null 이다 (키는 있다)', async () => {
      const response = await listAs(adminH1);
      const cr2 = response.body.items.find((item: { id: string }) => item.id === 'cr2');

      expect(cr2).toHaveProperty('thirdPartyConsent');
      expect(cr2.thirdPartyConsent).toBeNull();
    });

    it('★ 취소 사유는 이력에서 파생된다', async () => {
      const response = await listAs(adminH1);
      const cr5 = response.body.items.find((item: { id: string }) => item.id === 'cr5');

      expect(cr5).toMatchObject({ status: 'cancelled', cancelReason: 'duplicate', visitAt: null });
    });

    it('statusCounts 는 상태만 푼 모집단이다 — 탭을 눌러도 흔들리지 않는다', async () => {
      const all = await listAs(adminH1);
      const onlyNew = await listAs(adminH1, '&status=new');

      expect(all.body.statusCounts).toEqual(onlyNew.body.statusCounts);
      expect(onlyNew.body.meta.totalItems).toBe(all.body.statusCounts.new);
      expect(all.body.statusCounts.total).toBe(
        all.body.statusCounts.new +
          all.body.statusCounts.contacted +
          all.body.statusCounts.booked +
          all.body.statusCounts.visited +
          all.body.statusCounts.cancelled,
      );
    });

    it('★ status 는 반복 파라미터다 — 같은 것끼리 OR', async () => {
      const response = await listAs(adminH1, '&status=new&status=contacted');

      expect(
        response.body.items.every((item: { status: string }) => ['new', 'contacted'].includes(item.status)),
      ).toBe(true);
      expect(response.body.meta.totalItems).toBe(
        response.body.statusCounts.new + response.body.statusCounts.contacted,
      );
    });

    it('모르는 상태 값은 거절한다', async () => {
      expect((await listAs(adminH1, '&status=done')).status).toBe(422);
    });

    it('period=today 는 KST 달력으로 자른다 (시드의 오늘 접수 3건)', async () => {
      const response = await listAs(adminH1, '&period=today');
      const ids = response.body.items.map((item: { id: string }) => item.id);

      // cr1·cr4·cr5 가 오프셋 0 이다. 테스트가 만든 건도 오늘이라 "포함" 으로만 단정한다.
      expect(ids).toEqual(expect.arrayContaining(['cr1', 'cr4', 'cr5']));
      expect(ids).not.toContain('cr2');
    });

    it('★ period 와 createdFrom/To 를 함께 보내면 422 다', async () => {
      const response = await listAs(adminH1, '&period=today&createdFrom=2026-01-01T00:00:00.000Z');

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('PERIOD_FILTER_CONFLICT');
      expect(response.body.error.details).toBeUndefined();
    });

    it('procedureId 는 반복 파라미터이고 모르는 값은 0건이다 (422 가 아니다)', async () => {
      const laminate = await listAs(adminH1, '&procedureId=laminate');
      const unknown = await listAs(adminH1, '&procedureId=implant');

      expect(laminate.body.items.every((item: { procedureId: string }) => item.procedureId === 'laminate')).toBe(
        true,
      );
      expect(unknown.status).toBe(200);
      expect(unknown.body.items).toEqual([]);
    });

    it('q 는 이름 부분일치이거나 번호 숫자다', async () => {
      const byName = await listAs(adminH1, '&q=김민준');
      const byPhone = await listAs(adminH1, '&q=5601');

      expect(byName.body.items.some((item: { id: string }) => item.id === 'cr1')).toBe(true);
      expect(byPhone.body.items.some((item: { id: string }) => item.id === 'cr1')).toBe(true);
    });

    it('★ 운영자의 숫자 검색은 뒤 4자리 접미 일치뿐이다 (마스킹 우회 차단)', async () => {
      // 담당자는 가운데 숫자로도 찾지만, 운영자는 같은 질의에서 0건이다.
      const admin = await listAs(adminH1, '&q=1234');
      const ops = await listAs(operator, '&q=1234');

      expect(admin.body.items.length).toBeGreaterThan(0);
      expect(ops.body.items).toEqual([]);

      // 뒤 4자리는 운영자도 찾는다 — "어떤 상담 건인지 대조" 가 그 목적이다.
      const opsSuffix = await listAs(operator, '&q=5601');
      expect(opsSuffix.body.items.some((item: { id: string }) => item.id === 'cr1')).toBe(true);
    });

    it('★ 마스킹된 값을 그대로 검색하면 0건이 정상이다', async () => {
      const response = await listAs(adminH1, '&q=010-****-5601');

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    });
  });

  // -------------------------------------------------------------- 관리자 상세

  describe('GET /consult-requests/:id', () => {
    it('★ 전체 번호가 있는 유일한 자리다 (담당 병원 담당자)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/cr1')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: '김민준',
        phone: '010-1234-5601',
        piiMasked: false,
      });
    });

    it('운영자는 상세에서도 마스킹된 값을 본다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/cr1')
        .set('Authorization', bearer(operator.accessToken));

      expect(response.body).toMatchObject({ name: '김*준', phone: '010-****-5601', piiMasked: true });
    });

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
      expect(foreign.body.error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
      expect(foreign.body.error.message).toBe(missing.body.error.message);
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
      expect(rows[0]).toMatchObject({ piiMasked: false, hospitalId: H1 });
    });

    it('★ 열 때마다 한 행이다 — 전체 번호를 본 횟수가 곧 감사 행 수다', async () => {
      const { body: made } = await createConsult();

      for (let i = 0; i < 2; i += 1) {
        await request(app.getHttpServer())
          .get(`/api/v1/consult-requests/${made.id}`)
          .set('Authorization', bearer(adminH1.accessToken));
      }

      expect(
        await prisma.auditLog.count({
          where: { action: 'consult_request.view', targetId: made.id, actorUserId: adminH1.user.id },
        }),
      ).toBe(2);
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

    it('목록은 건별 열람 기록을 남기지 않는다', async () => {
      const before = await prisma.auditLog.count({ where: { action: 'consult_request.view' } });

      await request(app.getHttpServer())
        .get('/api/v1/consult-requests?pageSize=100')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(await prisma.auditLog.count({ where: { action: 'consult_request.view' } })).toBe(before);
    });
  });

  // -------------------------------------------------------------- 상태 변경

  describe('PATCH /consult-requests/:id/status', () => {
    it('★ 운영자는 읽을 수 있지만 바꿀 수 없다', async () => {
      const { body: made } = await createConsult();

      expect((await patch(made.id, { status: 'contacted' }, operator)).status).toBe(403);
    });

    it('담당 아닌 병원의 상담은 404 다', async () => {
      const response = await patch(SEED_FIXTURES.consultAtH2, { status: 'contacted' }, adminH1);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
    });

    it('상태가 바뀌고 이력이 쌓이며 처리자 이름이 남는다', async () => {
      const { body: made } = await createConsult();
      const response = await patch(made.id, { status: 'contacted' }, adminH1);

      expect(response.status).toBe(200);
      expect(response.headers['x-status-changed']).toBe('true');
      expect(response.body.status).toBe('contacted');
      expect(response.body.statusHistory.map((row: { status: string }) => row.status)).toEqual([
        'new',
        'contacted',
      ]);
      expect(response.body.statusHistory[1]).toMatchObject({
        event: 'status_change',
        changedByName: expect.any(String),
        visitAt: null,
        cancelReason: null,
        notified: true,
      });
    });

    it('★ 예약확정은 확정 일시가 필수다 (no-op 판정보다 먼저다)', async () => {
      const { body: made } = await createConsult();
      const response = await patch(made.id, { status: 'booked' }, adminH1);

      expect(response.status).toBe(422);
      expect(response.body.error.details[0]).toMatchObject({
        field: 'visitAt',
        code: 'VISIT_AT_REQUIRED',
        message: '확정 일시를 입력해주세요',
      });
    });

    it('★ 이미 확정 일시가 있으면 본문에 없어도 그 값을 쓴다 (둘 다 없을 때만 422)', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);
      const again = await patch(made.id, { status: 'booked' }, adminH1);

      expect(again.status).toBe(200);
      // 현재 값을 다시 쓴 것이라 바뀐 것이 없다 → no-op.
      expect(again.headers['x-status-changed']).toBe('false');
      expect(again.body.visitAt).toBe('2026-10-09T05:00:00.000Z');
    });

    it('예약확정은 일시를 저장하고 초·밀리초를 깎는다', async () => {
      const { body: made } = await createConsult();
      const response = await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:45.123Z' }, adminH1);

      expect(response.body.visitAt).toBe('2026-10-09T05:00:00.000Z');
      expect(response.body.statusHistory.at(-1).visitAt).toBe('2026-10-09T05:00:00.000Z');
    });

    it('★ 일시만 바꾸면 reschedule 이력 1줄이고 상태는 booked 그대로다', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);
      const response = await patch(made.id, { status: 'booked', visitAt: '2026-10-12T02:00:00.000Z' }, adminH1);

      expect(response.headers['x-status-changed']).toBe('true');
      expect(response.body.status).toBe('booked');
      expect(response.body.visitAt).toBe('2026-10-12T02:00:00.000Z');
      expect(response.body.statusHistory.at(-1)).toMatchObject({
        event: 'reschedule',
        status: 'booked',
        visitAt: '2026-10-12T02:00:00.000Z',
        notified: true,
      });

      // 감사 `action` 이 갈린다 — before/after 에 들어가는 것이 상태가 아니라 일시다.
      const audit = await prisma.auditLog.findMany({
        where: { action: 'consult_request.reschedule', targetId: made.id },
      });

      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        beforeValue: '2026-10-09T05:00:00.000Z',
        afterValue: '2026-10-12T02:00:00.000Z',
      });
    });

    it('★ 같은 값을 다시 보내면 no-op 이다 — 이력도 알림도 감사도 늘지 않는다', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);

      const unreadBefore = await unreadFor(user, 'user');
      const auditBefore = await prisma.auditLog.count({ where: { targetId: made.id } });
      const again = await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:59.000Z' }, adminH1);

      expect(again.status).toBe(200);
      expect(again.headers['x-status-changed']).toBe('false');
      expect(again.body.statusHistory).toHaveLength(2);
      expect(await unreadFor(user, 'user')).toBe(unreadBefore);
      expect(await prisma.auditLog.count({ where: { targetId: made.id } })).toBe(auditBefore);
    });

    it('★ 취소는 사유가 필수이고, 모르는 코드는 다른 detail 코드다', async () => {
      const { body: made } = await createConsult();

      const missing = await patch(made.id, { status: 'cancelled' }, adminH1);
      const invalid = await patch(made.id, { status: 'cancelled', cancelReason: '중복' }, adminH1);

      expect(missing.body.error.details[0]).toMatchObject({
        field: 'cancelReason',
        code: 'CANCEL_REASON_REQUIRED',
        message: '취소 사유를 선택해주세요',
      });
      expect(invalid.body.error.details[0]).toMatchObject({
        field: 'cancelReason',
        code: 'INVALID_CANCEL_REASON',
        message: '취소 사유를 다시 선택해주세요',
      });
    });

    it('★ 취소는 확정 일시를 지우고 사유는 이력 행에만 남는다', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);
      const response = await patch(made.id, { status: 'cancelled', cancelReason: 'no_answer' }, adminH1);

      expect(response.body.visitAt).toBeNull();
      expect(response.body.cancelReason).toBe('no_answer');
      expect(response.body.statusHistory.at(-1)).toMatchObject({
        status: 'cancelled',
        cancelReason: 'no_answer',
        visitAt: null,
      });
      // 직전 booked 행의 스냅샷은 남는다 — "무슨 약속이 있었나" 를 답한다.
      expect(response.body.statusHistory.at(-2).visitAt).toBe('2026-10-09T05:00:00.000Z');
    });

    it('★ 재오픈하면 파생 취소 사유가 저절로 사라진다', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'cancelled', cancelReason: 'duplicate' }, adminH1);
      const reopened = await patch(made.id, { status: 'contacted' }, adminH1);

      expect(reopened.body.cancelReason).toBeNull();
    });

    it('내원완료는 확정 일시를 유지한다', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);
      const visited = await patch(made.id, { status: 'visited' }, adminH1);

      expect(visited.body.status).toBe('visited');
      expect(visited.body.visitAt).toBe('2026-10-09T05:00:00.000Z');
    });

    it('★ 계약에 없는 키(hospitalName)는 조용히 무시한다 — 병원 이름은 서버가 조인한다', async () => {
      const { body: made } = await createConsult();
      const response = await patch(
        made.id,
        { status: 'contacted', hospitalName: '엉뚱한 병원' },
        adminH1,
      );

      expect(response.status).toBe(200);

      const notifications = await prisma.notification.findMany({
        where: { relatedId: made.id, audience: 'user' },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).not.toContain('엉뚱한 병원');
      expect(notifications[0].message).toContain('강남 스마일 치과');
    });

    it('★ 상태가 바뀌면 신청자 **한 명에게만** 알림이 간다', async () => {
      const { body: made } = await createConsult();

      const beforeUser = await unreadFor(user, 'user');
      const beforeAdmin = await unreadFor(adminH1, 'user');

      await patch(made.id, { status: 'contacted' }, adminH1);

      expect(await unreadFor(user, 'user')).toBe(beforeUser + 1);
      // 지금은 알림이 계정과 무관하게 쌓여 관리자 자신의 알림함에도 들어간다 — 그 결함을 닫는다.
      expect(await unreadFor(adminH1, 'user')).toBe(beforeAdmin);
    });

    it('★ 이력·알림·감사가 한 트랜잭션에서 함께 생긴다', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);

      const [changes, notifications, audits] = await Promise.all([
        prisma.consultStatusChange.findMany({ where: { consultRequestId: made.id } }),
        prisma.notification.findMany({ where: { relatedId: made.id, audience: 'user' } }),
        prisma.auditLog.findMany({ where: { action: 'consult_request.status_change', targetId: made.id } }),
      ]);

      const booked = changes.find((row) => row.status === 'booked');

      expect(notifications).toHaveLength(1);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({ beforeValue: 'new', afterValue: 'booked' });
      // 이력 행이 그 알림을 가리킨다 — `notified` 는 규칙이 아니라 저장된 사실이다.
      expect(booked?.notificationId).toBe(notifications[0].id);
      expect(notifications[0]).toMatchObject({
        type: 'consult-status',
        consultStatus: 'booked',
        title: '상담 예약이 확정됐어요',
        relatedType: 'consult_request',
        hospitalId: null,
      });
    });

    it('모르는 상태는 거절한다', async () => {
      const { body: made } = await createConsult();

      expect((await patch(made.id, { status: 'done' }, adminH1)).status).toBe(422);
    });

    // ------------------------------------------------------ 쓰기 응답의 마스킹

    /**
     * 계약의 마스킹 표 마지막 줄 — **쓰기 응답은 목록 투영이다** (2026-10-22 요청 15 리뷰,
     * `docs/api/openapi.yaml` `ConsultRequest` · `docs/api/README.md` §4).
     *
     * 특히 **no-op PATCH** 가 핵심이다: 이력·알림·감사가 모두 0건인 요청이라, 응답에 전체
     * 번호가 실리면 담당 상담의 현재 상태를 그대로 되보내는 것만으로 **기록 없이** 전 건의
     * 번호를 모을 수 있다.
     */
    const MASKED = { name: '박서영', phone: '010-****-4411', piiMasked: true };

    it('★ 쓰기 응답은 목록 투영이다 — no-op PATCH 도 번호를 가린다 (무기록 수집 차단)', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);

      const auditBefore = await prisma.auditLog.count({ where: { targetId: made.id } });
      const again = await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);

      expect(again.status).toBe(200);
      expect(again.headers['x-status-changed']).toBe('false');
      // 감사 행이 늘지 않는 요청이므로 **전체 번호가 실리면 무기록 수집이 된다.**
      expect(await prisma.auditLog.count({ where: { targetId: made.id } })).toBe(auditBefore);
      expect(again.body).toMatchObject(MASKED);
    });

    it('★ 실제 상태 변경 응답도 번호를 가린다', async () => {
      const { body: made } = await createConsult();
      const response = await patch(made.id, { status: 'contacted' }, adminH1);

      expect(response.status).toBe(200);
      expect(response.headers['x-status-changed']).toBe('true');
      expect(response.body).toMatchObject(MASKED);
    });

    it('★ 일시 변경(reschedule) 응답도 번호를 가린다', async () => {
      const { body: made } = await createConsult();

      await patch(made.id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' }, adminH1);
      const response = await patch(made.id, { status: 'booked', visitAt: '2026-10-12T02:00:00.000Z' }, adminH1);

      expect(response.body.statusHistory.at(-1).event).toBe('reschedule');
      expect(response.body).toMatchObject(MASKED);
    });

    it('★ 전체 번호는 GET /{id} 한 곳뿐이다 — 쓰기 직후에도 그 규칙이 그대로다', async () => {
      const { body: made } = await createConsult();
      const written = await patch(made.id, { status: 'contacted' }, adminH1);
      const read = await request(app.getHttpServer())
        .get(`/api/v1/consult-requests/${made.id}`)
        .set('Authorization', bearer(adminH1.accessToken));

      expect(written.body.phone).toBe('010-****-4411');
      expect(read.body).toMatchObject({ name: '박서영', phone: '010-1234-4411', piiMasked: false });
    });
  });

  // -------------------------------------------------------------- 메모

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

    it('★ 메모 작성이 감사 로그에 남고 본문은 기록하지 않는다', async () => {
      const { body: made } = await createConsult();

      await addMemo(made.id, '고객 연락처로 통화함', adminH1);

      const rows = await prisma.auditLog.findMany({
        where: { action: 'consult_request.memo_create', targetId: made.id },
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].beforeValue).toBeNull();
      expect(rows[0].afterValue).toBeNull();
    });

    it('★ 그 메모는 신청자 목록 응답에 절대 나오지 않는다', async () => {
      const { body: made } = await createConsult();

      await addMemo(made.id, '내부 공유용 메모', adminH1);

      const mine = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests?pageSize=100')
        .set('Authorization', bearer(user.accessToken));

      expect(JSON.stringify(mine.body)).not.toContain('내부 공유용 메모');
      expect(mine.body.items.every((item: object) => !('memos' in item))).toBe(true);
    });

    it('★ 운영자는 메모를 남길 수 없다 (읽기 전용)', async () => {
      const { body: made } = await createConsult();

      expect((await addMemo(made.id, '운영자 메모', operator)).status).toBe(403);
    });

    it('운영자는 메모를 읽을 수 있다 (분쟁 시 처리 경과 확인)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/cr3')
        .set('Authorization', bearer(operator.accessToken));

      expect(response.body.memos.map((memo: { id: string }) => memo.id)).toEqual(['memo-cr3-1']);
    });

    it('★ 메모 응답도 목록 투영이다 — 번호를 가린다', async () => {
      const { body: made } = await createConsult();
      const response = await addMemo(made.id, '고객에게 연락함', adminH1);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ name: '박서영', phone: '010-****-4411', piiMasked: true });
    });

    it('빈 메모는 거절한다', async () => {
      const { body: made } = await createConsult();

      expect((await addMemo(made.id, '   ', adminH1)).status).toBe(422);
    });
  });

  // -------------------------------------------------------------- 만들지 않은 것

  describe('만들지 않은 오퍼레이션 2개 (소비 화면 없음)', () => {
    it('GET /consult-requests/summary 는 없다 — 상담 id 로 잡혀 404 다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/consult-requests/summary')
        .set('Authorization', bearer(adminH1.accessToken));

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
    });

    it('GET /me/consult-requests/{id} 는 없다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me/consult-requests/cr1')
        .set('Authorization', bearer(user.accessToken));

      expect(response.status).toBe(404);
    });
  });
});
