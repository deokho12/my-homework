import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RefreshTokenStore } from '../src/auth/refresh-token.store';
import { TokenService } from '../src/auth/token.service';
import { bearer, createTestApp, logIn, SEED_ACCOUNTS } from './support/app';

/**
 * =============================================================================
 * 토큰 수명주기 — 회전, 재사용 감지, 폐기
 * =============================================================================
 *
 * 리프레시 토큰이 본문으로 오가는 설계(쿠키를 안 쓰는 이유는 Flutter 앱)의 대가가
 * "탈취되면 만료까지 쓸 수 있다" 이고, 그것을 막는 장치가 회전 + 재사용 감지다.
 * 그 장치가 실제로 동작하는지 여기서 고정한다.
 */
describe('토큰 수명주기 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /api/v1/auth/refresh — 회전', () => {
    it('새 액세스·리프레시 토큰을 주고 새 액세스 토큰이 실제로 동작한다', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);

      const refreshed = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      expect(refreshed.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
      expect(refreshed.body.refreshToken).not.toBe(session.refreshToken);

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', bearer(refreshed.body.accessToken))
        .expect(200);
    });

    it('★ 회전 후 옛 리프레시 토큰은 무효다 — 재사용은 401 REFRESH_TOKEN_REUSED', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      const reuse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
      expect(reuse.body.error.message).toBe('보안을 위해 로그아웃되었어요. 다시 로그인해주세요');
    });

    it('★ 재사용이 감지되면 그 계열 전체가 끊긴다 — 회전으로 받은 새 토큰도 무효', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);

      const rotated = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      // 공격자가 훔친 옛 토큰을 쓴다 → 계열 폐기
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      // 정상 사용자의 최신 토큰도 함께 죽는다. 어느 쪽이 공격자인지 알 수 없으므로
      // 양쪽에 재로그인을 요구하는 것이 맞다.
      const afterFamilyRevoke = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);

      expect(afterFamilyRevoke.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('여러 번 연속 회전이 가능하다 (계열은 이어지고 직전 토큰만 죽는다)', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.adminH1);
      let current = session.refreshToken;

      for (let i = 0; i < 3; i += 1) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: current })
          .expect(200);

        current = response.body.refreshToken;
      }

      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: current }).expect(200);
    });

    it('위조·형식 오류·액세스 토큰을 보내면 401 REFRESH_TOKEN_INVALID', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);

      const cases = [
        'not-a-jwt',
        `${session.refreshToken.slice(0, -3)}xyz`,
        // 액세스 토큰을 리프레시 자리에 넣는 것도 막힌다 (서명 키가 다르고 typ 도 다르다)
        session.accessToken,
      ];

      for (const refreshToken of cases) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
          .expect(401);

        expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');
      }
    });

    it('본문에 refreshToken 이 없으면 422 VALIDATION_FAILED', async () => {
      const response = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({}).expect(422);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details[0].field).toBe('refreshToken');
    });

    it('재발급은 DB 의 현재 역할로 액세스 토큰을 만든다 (리프레시 토큰에 role 을 넣지 않은 이유)', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.adminH1);

      const refreshed = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', bearer(refreshed.body.accessToken))
        .expect(200);

      expect(me.body.role).toBe('hospital_admin');
    });
  });

  describe('POST /api/v1/auth/logout — 폐기', () => {
    it('204 를 주고 그 리프레시 토큰은 더 이상 재발급에 쓸 수 없다', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', bearer(session.accessToken))
        .send({ refreshToken: session.refreshToken })
        .expect(204);

      const afterLogout = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      expect(afterLogout.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('로그아웃은 멱등이다 (이미 폐기된 토큰으로 또 불러도 204)', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', bearer(session.accessToken))
        .send({ refreshToken: session.refreshToken })
        .expect(204);
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', bearer(session.accessToken))
        .send({ refreshToken: session.refreshToken })
        .expect(204);
    });

    it('로그인하지 않은 요청은 401 (리프레시 토큰만 알아서는 폐기할 수 없다)', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      // 세션이 그대로 살아 있다
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);
    });

    it('★ 남의 리프레시 토큰은 폐기되지 않는다 (204 를 주지만 그 세션은 살아 있다)', async () => {
      // 이 검사가 없으면 아무 로그인 계정이 토큰 문자열만 알아내 남의 세션을 끊을 수 있다.
      const victim = await logIn(app, SEED_ACCOUNTS.user);
      const attacker = await logIn(app, SEED_ACCOUNTS.adminH2);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', bearer(attacker.accessToken))
        .send({ refreshToken: victim.refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: victim.refreshToken })
        .expect(200);
    });

    it('로그아웃해도 액세스 토큰은 만료까지 유효하다 (문서화된 동작)', async () => {
      // openapi: "액세스 토큰은 만료까지 유효하므로 클라이언트가 즉시 폐기한다".
      // 서버가 액세스 토큰을 폐기하려면 요청마다 폐기 목록을 조회해야 하고,
      // 그러면 무상태 검증의 이점이 사라진다. 대신 수명을 15분으로 짧게 뒀다.
      const session = await logIn(app, SEED_ACCOUNTS.user);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', bearer(session.accessToken))
        .send({ refreshToken: session.refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', bearer(session.accessToken))
        .expect(200);
    });
  });

  describe('저장소 수준 폐기 — 역할 변경 시 세션을 끊는 수단', () => {
    it('revokeAllForUser 후에는 그 계정의 리프레시 토큰이 모두 무효다', async () => {
      // docs/api/README.md §3: "role 은 클레임에 있으므로 승격·해제 시 그 계정의
      // 리프레시 토큰을 전부 폐기한다". 담당자 지정/해제 엔드포인트(다음 Task)가
      // 이 메서드를 호출한다. 여기서는 그 수단이 실제로 동작하는지 확인한다.
      const first = await logIn(app, SEED_ACCOUNTS.user);
      const second = await logIn(app, SEED_ACCOUNTS.user);
      const store = app.get(RefreshTokenStore);

      const revoked = await store.revokeAllForUser(first.user.id);

      expect(revoked).toBeGreaterThanOrEqual(2);

      for (const session of [first, second]) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: session.refreshToken })
          .expect(401);

        expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');
      }
    });
  });

  describe('토큰 클레임', () => {
    it('액세스 토큰 클레임이 문서와 같다 (sub, role, typ, jti, iat, exp, iss, aud)', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.adminH1);
      const [, payload] = session.accessToken.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

      expect(Object.keys(claims).sort()).toEqual(
        ['aud', 'exp', 'iat', 'iss', 'jti', 'role', 'sub', 'typ'].sort(),
      );
      expect(claims.sub).toBe(session.user.id);
      expect(claims.role).toBe('hospital_admin');
      expect(claims.typ).toBe('access');
      // 수명 15분
      expect(claims.exp - claims.iat).toBe(900);
      // managedHospitalIds 는 클레임에 없다 (담당 해제가 즉시 반영되게)
      expect(claims.managedHospitalIds).toBeUndefined();
    });

    it('리프레시 토큰에는 role 이 없고 계열 id(sid)가 있다. 수명은 30일', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.adminH1);
      const [, payload] = session.refreshToken.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

      expect(claims.role).toBeUndefined();
      expect(typeof claims.sid).toBe('string');
      expect(claims.typ).toBe('refresh');
      expect(claims.exp - claims.iat).toBe(2_592_000);
    });

    it('다른 발급자(iss)로 서명된 토큰은 거부된다', async () => {
      // 스테이징 토큰이 운영에서 통하지 않게 하는 검사다.
      const tokens = app.get(TokenService);
      const session = await logIn(app, SEED_ACCOUNTS.user);
      const valid = tokens.issueAccessToken({ id: session.user.id, role: 'user' });

      // 같은 키로 서명했지만 iss 가 다른 토큰을 흉내내기 위해 페이로드를 바꾸면
      // 서명이 깨진다 → 어느 쪽이든 401 이어야 한다
      const [header, payload, signature] = valid.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      claims.iss = 'someone-else';
      const forgedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', bearer(`${header}.${forgedPayload}.${signature}`))
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });
  });
});
