import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TokenService } from '../src/auth/token.service';
import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';
import type { Session } from './support/app';

/**
 * =============================================================================
 * 인가 — "막아야 할 것을 막는가"
 * =============================================================================
 *
 * 이 파일이 고정하는 것은 **응답 코드의 구분**이다. 특히 403 과 404 의 구분은
 * 문서(docs/api/README.md §3)가 근거를 다르게 적어 둔 판단이고, 구현이 편한 쪽으로
 * 흘러가기 쉬우므로 테스트로 못 박는다.
 *
 * 라우트는 `test/support/guard-test.module.ts` 의 테스트 전용 컨트롤러다 —
 * openapi 오퍼레이션의 `x-role` 과 403/404 규칙만 옮겼다.
 */
describe('인가 (e2e)', () => {
  let app: INestApplication;
  let operator: Session;
  let adminH1: Session;
  let adminH2: Session;
  let user: Session;

  beforeAll(async () => {
    app = await createTestApp();

    operator = await logIn(app, SEED_ACCOUNTS.operator);
    adminH1 = await logIn(app, SEED_ACCOUNTS.adminH1);
    adminH2 = await logIn(app, SEED_ACCOUNTS.adminH2);
    user = await logIn(app, SEED_ACCOUNTS.user);
  });

  afterAll(async () => {
    await app?.close();
  });

  // ===========================================================================
  // 1층 — 인증
  // ===========================================================================
  describe('1층 인증 — 토큰이 없거나 못 믿을 때', () => {
    it('비로그인 요청은 보호된 경로에서 401 UNAUTHENTICATED', async () => {
      const response = await request(app.getHttpServer()).get('/api/test-guards/authenticated').expect(401);

      expect(response.body.error.code).toBe('UNAUTHENTICATED');
      expect(response.body.error.message).toBe('로그인이 필요해요');
      // 요청 id 가 본문과 헤더에 같은 값으로 실린다 (docs §11)
      expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
    });

    it('비로그인 요청은 담당 병원 자원에서도 401 이다 (403/404 로 정보가 새지 않는다)', async () => {
      // 인증 실패가 먼저 잡혀야 한다. 여기서 404 가 나오면 비로그인 상태로
      // "이 상담이 존재한다/안 한다" 를 알아낼 수 있게 된다.
      await request(app.getHttpServer())
        .get(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultAtH1}`)
        .expect(401);
      await request(app.getHttpServer())
        .patch(`/api/test-guards/hospitals/${SEED_FIXTURES.hospitalManagedByH1Admin}`)
        .expect(401);
    });

    it('Bearer 스킴이 아니거나 토큰이 비어 있으면 401', async () => {
      for (const header of ['', 'Bearer', 'Bearer    ', 'Basic abc', adminH1.accessToken]) {
        const response = await request(app.getHttpServer())
          .get('/api/test-guards/authenticated')
          .set('Authorization', header)
          .expect(401);

        expect(response.body.error.code).toBe('UNAUTHENTICATED');
      }
    });

    it('서명이 틀린 토큰은 401 UNAUTHENTICATED (만료가 아니다)', async () => {
      const tampered = `${adminH1.accessToken.slice(0, -3)}xyz`;

      const response = await request(app.getHttpServer())
        .get('/api/test-guards/authenticated')
        .set('Authorization', bearer(tampered))
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('만료된 액세스 토큰은 401 ACCESS_TOKEN_EXPIRED — 클라이언트가 재발급할 수 있게 코드를 구분한다', async () => {
      const tokens = app.get(TokenService);
      const expired = tokens.issueAccessToken(
        { id: adminH1.user.id, role: 'hospital_admin' },
        { expiresInSeconds: -60 },
      );

      const response = await request(app.getHttpServer())
        .get('/api/test-guards/authenticated')
        .set('Authorization', bearer(expired))
        .expect(401);

      expect(response.body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
      expect(response.body.error.message).toBe('로그인이 만료되었어요. 다시 로그인해주세요');
    });

    it('리프레시 토큰을 Authorization 헤더에 넣으면 401 (토큰 종류가 다르다)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/test-guards/authenticated')
        .set('Authorization', bearer(adminH1.refreshToken))
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('로그인한 세 역할은 모두 인증 전용 경로를 통과한다', async () => {
      for (const session of [user, adminH1, operator]) {
        const response = await request(app.getHttpServer())
          .get('/api/test-guards/authenticated')
          .set('Authorization', bearer(session.accessToken))
          .expect(200);

        expect(response.body).toEqual({ userId: session.user.id, role: session.user.role });
      }
    });
  });

  // ===========================================================================
  // 2층 — 역할
  // ===========================================================================
  describe('2층 역할 — x-role 밖의 역할은 403', () => {
    it('user 역할은 운영자 전용 경로에서 403 FORBIDDEN', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/test-guards/doctor-verification-queue')
        .set('Authorization', bearer(user.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toBe('이 작업을 수행할 권한이 없어요');
    });

    it('hospital_admin 도 전문의 인증 검수 경로에서 403 — 남의 병원 전문의를 심사할 수 없다', async () => {
      // 이것이 operator 역할이 만들어진 이유다 (결정 1). 담당자가 검수 화면에 들어오면
      // 자기 병원 전문의를 스스로 승인할 수 있다.
      await request(app.getHttpServer())
        .get('/api/test-guards/doctor-verification-queue')
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(403);

      await request(app.getHttpServer())
        .put(`/api/test-guards/doctors/${SEED_FIXTURES.doctorAtH1}/verification`)
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(403);
    });

    it('operator 는 전문의 검수가 된다 — 담당 병원과 무관하게 전 병원', async () => {
      await request(app.getHttpServer())
        .get('/api/test-guards/doctor-verification-queue')
        .set('Authorization', bearer(operator.accessToken))
        .expect(200);

      // h1 소속 전문의와 h11 소속 전문의 모두 검수할 수 있다
      for (const doctorId of [SEED_FIXTURES.doctorAtH1, SEED_FIXTURES.doctorAtH11]) {
        await request(app.getHttpServer())
          .put(`/api/test-guards/doctors/${doctorId}/verification`)
          .set('Authorization', bearer(operator.accessToken))
          .expect(200);
      }
    });

    it('user 역할은 병원 수정 경로에서 403 (담당 검사 이전에 역할에서 걸린다)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/test-guards/hospitals/${SEED_FIXTURES.hospitalManagedByH1Admin}`)
        .set('Authorization', bearer(user.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ===========================================================================
  // 3층 — 담당 범위. 여기서 403 과 404 가 갈린다
  // ===========================================================================
  describe('3층 담당 범위 — 공개 자원은 403', () => {
    it('hospital_admin 이 담당 병원을 수정하는 것은 통과한다', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/test-guards/hospitals/${SEED_FIXTURES.hospitalManagedByH1Admin}`)
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({
        resource: 'hospital',
        hospitalId: SEED_FIXTURES.hospitalManagedByH1Admin,
        managed: true,
      });
    });

    it('hospital_admin 이 담당이 아닌 병원을 수정하려 하면 403 HOSPITAL_NOT_MANAGED', async () => {
      // **지금은 주소의 병원 id 만 바꾸면 남의 병원을 고칠 수 있다.** 그것을 막는 검사다.
      const response = await request(app.getHttpServer())
        .patch(`/api/test-guards/hospitals/${SEED_FIXTURES.hospitalNotManagedByH1Admin}`)
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
      expect(response.body.error.message).toBe('담당하지 않는 병원이에요');
    });

    it('h2 담당자는 h2 만 된다 — 담당 관계가 계정별로 갈려 있다', async () => {
      await request(app.getHttpServer())
        .patch(`/api/test-guards/hospitals/${SEED_FIXTURES.hospitalNotManagedByH1Admin}`)
        .set('Authorization', bearer(adminH2.accessToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/test-guards/hospitals/${SEED_FIXTURES.hospitalManagedByH1Admin}`)
        .set('Authorization', bearer(adminH2.accessToken))
        .expect(403);
    });

    it('담당이 아닌 병원의 전문의 수정도 403 HOSPITAL_NOT_MANAGED', async () => {
      const own = await request(app.getHttpServer())
        .patch(`/api/test-guards/doctors/${SEED_FIXTURES.doctorAtH1}`)
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(200);

      expect(own.body).toMatchObject({ resource: 'doctor', hospitalId: 'h1', managed: true });

      const other = await request(app.getHttpServer())
        .patch(`/api/test-guards/doctors/${SEED_FIXTURES.doctorAtH11}`)
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(403);

      expect(other.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });

    it('operator 는 전 병원을 수정할 수 있고 managed=false 로 구분된다 (마스킹 판단의 근거)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/test-guards/hospitals/${SEED_FIXTURES.hospitalNotManagedByH1Admin}`)
        .set('Authorization', bearer(operator.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({ managed: false });
    });

    it('없는 병원은 담당자에게도 운영자에게도 404 HOSPITAL_NOT_FOUND', async () => {
      for (const session of [adminH1, operator]) {
        const response = await request(app.getHttpServer())
          .patch('/api/test-guards/hospitals/h-does-not-exist')
          .set('Authorization', bearer(session.accessToken))
          .expect(404);

        expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
      }
    });

    it('@Roles 를 빠뜨린 라우트도 담당 검사가 막는다 (fail closed)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/test-guards/misconfigured/hospitals/${SEED_FIXTURES.hospitalManagedByH1Admin}`)
        .set('Authorization', bearer(user.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });
  });

  describe('3층 담당 범위 — 비공개 자원(상담)은 404', () => {
    it('hospital_admin 은 담당 병원의 상담을 볼 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultAtH1}`)
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({
        resource: 'consultRequest',
        hospitalId: 'h1',
        managed: true,
      });
    });

    it('hospital_admin 이 담당이 아닌 병원의 상담을 조회하면 404 다 (403 이 아니다)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultAtH2}`)
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(404);

      expect(response.body.error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
      expect(response.body.error.message).toBe('상담 정보를 찾을 수 없어요');
      // 403 계열 코드가 새어 나오면 안 된다
      expect(response.body.error.code).not.toBe('HOSPITAL_NOT_MANAGED');
      expect(response.body.error.code).not.toBe('FORBIDDEN');
    });

    it('★ 없는 상담과 남의 병원 상담의 응답이 완전히 같다 — 순차 대입으로 건수를 셀 수 없다', async () => {
      const other = await request(app.getHttpServer())
        .get(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultAtH2}`)
        .set('Authorization', bearer(adminH1.accessToken));
      const missing = await request(app.getHttpServer())
        .get(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultMissing}`)
        .set('Authorization', bearer(adminH1.accessToken));

      expect(other.status).toBe(missing.status);
      expect(other.body.error.code).toBe(missing.body.error.code);
      expect(other.body.error.message).toBe(missing.body.error.message);
      // 본문에 남는 차이가 requestId 뿐인지 확인한다
      expect({ ...other.body.error, requestId: null }).toEqual({ ...missing.body.error, requestId: null });
    });

    it('operator 는 전 병원 상담을 조회할 수 있다 (마스킹 대상이므로 managed=false)', async () => {
      for (const consultId of [SEED_FIXTURES.consultAtH1, SEED_FIXTURES.consultAtH2]) {
        const response = await request(app.getHttpServer())
          .get(`/api/test-guards/consult-requests/${consultId}`)
          .set('Authorization', bearer(operator.accessToken))
          .expect(200);

        expect(response.body.managed).toBe(false);
      }
    });

    it('user 역할은 관리자 상담 조회에서 403 이다 (자기 상담은 /me/consult-requests 로 본다)', async () => {
      // cr1 의 신청자 본인이지만 이 경로는 관리자용이다. 신청자 시야는 별도 스키마·경로다.
      const response = await request(app.getHttpServer())
        .get(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultAtH1}`)
        .set('Authorization', bearer(user.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ===========================================================================
  // 역할 비대칭 — 같은 자원, 다른 동작
  // ===========================================================================
  describe('의도된 비대칭 — operator 는 조회는 되고 상태 변경은 안 된다', () => {
    it('operator 의 상담 상태 변경은 403 FORBIDDEN', async () => {
      // 운영자가 상태를 바꾸면 고객에게 알림이 가는데 실제로 예약을 잡은 병원은 모르는
      // 상태가 된다 (docs/api/README.md §3).
      const response = await request(app.getHttpServer())
        .patch(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultAtH1}/status`)
        .set('Authorization', bearer(operator.accessToken))
        .send({ status: 'contacted' })
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('operator 의 상태 변경 거부는 상담 존재 여부를 조회하지 않는다 (없는 id 도 403)', async () => {
      // 역할(2층)이 담당 범위(3층)보다 먼저 돌기 때문이다. 순서가 뒤바뀌면
      // 운영자에게 404/403 차이로 존재 여부가 노출된다.
      const response = await request(app.getHttpServer())
        .patch(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultMissing}/status`)
        .set('Authorization', bearer(operator.accessToken))
        .send({ status: 'contacted' })
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('hospital_admin 은 담당 병원 상담의 상태를 바꿀 수 있고, 남의 병원 상담은 404', async () => {
      await request(app.getHttpServer())
        .patch(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultAtH1}/status`)
        .set('Authorization', bearer(adminH1.accessToken))
        .send({ status: 'contacted' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/api/test-guards/consult-requests/${SEED_FIXTURES.consultAtH2}/status`)
        .set('Authorization', bearer(adminH1.accessToken))
        .send({ status: 'contacted' })
        .expect(404);

      expect(response.body.error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
    });
  });

  // ===========================================================================
  // /auth/me 가 화면 가드의 근거다
  // ===========================================================================
  describe('GET /auth/me — 역할과 담당 병원', () => {
    it('hospital_admin 은 담당 병원 목록을 받는다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(adminH1.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({
        email: SEED_ACCOUNTS.adminH1,
        role: 'hospital_admin',
        managedHospitalIds: ['h1'],
      });
    });

    it('operator 의 managedHospitalIds 는 빈 배열이다 (전 병원 접근이지만 담당자는 아니다)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(operator.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({ role: 'operator', managedHospitalIds: [] });
    });

    it('user 의 managedHospitalIds 도 빈 배열이다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(user.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({ role: 'user', managedHospitalIds: [] });
    });

    it('비로그인은 401', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });
});
