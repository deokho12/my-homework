import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, logIn, SEED_ACCOUNTS, seedPassword } from './support/app';

/**
 * =============================================================================
 * 가입 · 로그인 · 내 정보
 * =============================================================================
 *
 * 이 파일은 **계정을 만든다.** 시드 DB 를 공유하므로 만든 계정은 반드시 지운다
 * (`seed-data.spec.ts` 가 사용자 19명을 기대한다). 정리 기준은 이메일 도메인이다.
 */
const TEST_DOMAIN = 'auth-spec.example';

describe('가입·로그인 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = (local: string): string => `${local}@${TEST_DOMAIN}`;

  async function cleanUp(): Promise<void> {
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    // 이전 실행이 중단됐을 수 있으니 시작할 때도 정리한다
    await cleanUp();
  });

  afterAll(async () => {
    await cleanUp();
    await app?.close();
  });

  // ===========================================================================
  // 회원가입
  // ===========================================================================
  describe('POST /api/auth/signup', () => {
    it('201 + AuthSession. 역할은 항상 user 다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ name: '  가입 테스트  ', email: `  ${email('Signup-Ok').toUpperCase()}  `, password: 'molamola1' })
        .expect(201);

      expect(response.body.user).toMatchObject({
        // 이메일은 trim + lower 로 정규화, 이름은 trim (openapi signUp)
        email: email('signup-ok'),
        name: '가입 테스트',
        provider: 'email',
        role: 'user',
        managedHospitalIds: [],
      });
      expect(response.body.tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
      expect(typeof response.body.tokens.accessToken).toBe('string');
      expect(typeof response.body.tokens.refreshToken).toBe('string');
    });

    it('가입 응답의 토큰으로 곧바로 /auth/me 가 된다 (가입 즉시 로그인 상태)', async () => {
      const signUp = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ name: '즉시로그인', email: email('signup-session'), password: 'molamola1' })
        .expect(201);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(signUp.body.tokens.accessToken))
        .expect(200);

      expect(me.body.id).toBe(signUp.body.user.id);
    });

    it('비밀번호는 bcrypt(cost 12) 해시로만 저장된다 — 평문 컬럼이 없다', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ name: '해시확인', email: email('signup-hash'), password: 'molamola1' })
        .expect(201);

      const row = await prisma.user.findUniqueOrThrow({ where: { email: email('signup-hash') } });

      // 시드 계정과 같은 cost 12 (prisma/seed/accounts.ts BCRYPT_COST)
      expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      expect(row.passwordHash).not.toContain('molamola1');
      expect(row.passwordSalt).toBeNull();
    });

    it('중복 이메일은 409 EMAIL_ALREADY_REGISTERED (대소문자·공백을 무시하고 같은 계정으로 본다)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ name: '중복', email: email('signup-dup'), password: 'molamola1' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ name: '중복2', email: ` ${email('Signup-Dup').toUpperCase()} `, password: 'molamola1' })
        .expect(409);

      expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
      expect(response.body.error.message).toBe('이미 가입된 이메일이에요');
    });

    it('형식 위반은 422 VALIDATION_FAILED + 필드별 details', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ name: '   ', email: 'at-기호가-없다', password: '12345' })
        .expect(422);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.message).toBe('입력값을 확인해주세요');

      const fields = response.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toContain('name');
      expect(fields).toContain('email');
      expect(fields).toContain('password');

      const emailDetail = response.body.error.details.find((d: { field: string }) => d.field === 'email');
      expect(emailDetail.code).toBe('INVALID_EMAIL_FORMAT');
      expect(emailDetail.message).toBe('이메일 형식이 올바르지 않아요');
    });

    it('role 을 요청 본문에 넣어도 승격되지 않는다 (승격 경로는 HTTP 에 없다)', async () => {
      // strict 스키마라 알 수 없는 키는 422 로 거절된다. "조용히 무시" 보다 낫다 —
      // 클라이언트가 보낸 값이 반영됐다고 착각하지 않는다.
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({
          name: '승격시도',
          email: email('signup-escalate'),
          password: 'molamola1',
          role: 'operator',
        })
        .expect(422);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(await prisma.user.findUnique({ where: { email: email('signup-escalate') } })).toBeNull();
    });

    it('본문이 JSON 이 아니면 400 MALFORMED_REQUEST (422 가 아니다)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .set('Content-Type', 'application/json')
        .send('{"name": "깨진 JSON"')
        .expect(400);

      expect(response.body.error.code).toBe('MALFORMED_REQUEST');
      // 파서의 영어 내부 문구가 새지 않는다 ("Unexpected end of JSON input")
      expect(response.body.error.message).toBe('요청 형식이 올바르지 않아요');
      expect(response.body.error.message).not.toContain('JSON input');
    });

    it('없는 경로는 404 + 한국어 문구다 (Nest 기본 영어 문구가 새지 않는다)', async () => {
      const response = await request(app.getHttpServer()).post('/api/auth/nope').send({}).expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('요청한 경로를 찾을 수 없어요');
      expect(response.body.error.message).not.toContain('Cannot POST');
    });
  });

  // ===========================================================================
  // 로그인 — 계정 열거 방지가 핵심이다
  // ===========================================================================
  describe('POST /api/auth/login', () => {
    it('시드 계정으로 200 + 역할·담당 병원이 실린다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: SEED_ACCOUNTS.adminH1, password: seedPassword() })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: SEED_ACCOUNTS.adminH1,
        role: 'hospital_admin',
        managedHospitalIds: ['h1'],
      });
      expect(response.body.tokens.refreshExpiresIn).toBe(2_592_000);
    });

    it('이메일 대소문자·앞뒤 공백은 무시한다', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `  ${SEED_ACCOUNTS.user.toUpperCase()} `, password: seedPassword() })
        .expect(200);
    });

    it('★ 계정 없음과 비밀번호 틀림이 구분되지 않는다 (코드·문구·본문이 모두 같다)', async () => {
      const unknownAccount = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: email('never-registered'), password: seedPassword() });

      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: SEED_ACCOUNTS.user, password: '틀린비밀번호' });

      expect(unknownAccount.status).toBe(401);
      expect(wrongPassword.status).toBe(401);
      expect(unknownAccount.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknownAccount.body.error.message).toBe('이메일 또는 비밀번호가 올바르지 않아요');
      // requestId 를 제외하면 본문이 완전히 같다
      expect({ ...unknownAccount.body.error, requestId: null }).toEqual({
        ...wrongPassword.body.error,
        requestId: null,
      });
    });

    it('비밀번호는 대소문자·공백을 구분한다', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: SEED_ACCOUNTS.user, password: ` ${seedPassword()}` })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: SEED_ACCOUNTS.user, password: seedPassword().toUpperCase() })
        .expect(401);
    });

    it('로그인은 비밀번호 형식을 검사하지 않는다 — 짧은 값도 401 이지 422 가 아니다', async () => {
      // 422 로 갈라지면 "짧은 비밀번호를 쓰는 계정" 여부가 새고,
      // 규칙이 바뀌기 전 계정이 로그인 자체를 못 하게 된다.
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: SEED_ACCOUNTS.user, password: '1' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('탈퇴(soft delete) 계정은 계정 없음과 같은 401 이다', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ name: '탈퇴예정', email: email('deleted'), password: 'molamola1' })
        .expect(201);

      await prisma.user.update({
        where: { email: email('deleted') },
        data: { deletedAt: new Date() },
      });

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: email('deleted'), password: 'molamola1' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('비밀번호가 없는 계정(소셜 가입)은 어떤 비밀번호로도 로그인되지 않는다', async () => {
      await prisma.user.create({
        data: {
          id: 'test-social-account',
          email: email('social'),
          name: '소셜계정',
          provider: 'kakao',
          role: 'user',
          passwordHash: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      for (const password of ['', ' ', 'molamola1', 'null', 'undefined']) {
        const response = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: email('social'), password });

        expect(response.status).toBe(password === '' ? 422 : 401);
      }
    });
  });

  // ===========================================================================
  // 비밀번호가 응답에 실리지 않는다
  // ===========================================================================
  describe('비밀번호는 어떤 응답에도 나오지 않는다', () => {
    it('signup / login / me 본문에 password·passwordHash 문자열이 없다', async () => {
      const password = 'molamola1';
      const signUp = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ name: '노출확인', email: email('no-leak'), password })
        .expect(201);

      const logInResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: email('no-leak'), password })
        .expect(200);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(logInResponse.body.tokens.accessToken))
        .expect(200);

      const row = await prisma.user.findUniqueOrThrow({ where: { email: email('no-leak') } });

      for (const body of [signUp.body, logInResponse.body, me.body]) {
        const serialized = JSON.stringify(body);

        expect(serialized).not.toContain('passwordHash');
        expect(serialized).not.toContain('passwordSalt');
        expect(serialized).not.toContain(password);
        expect(serialized).not.toContain(row.passwordHash);
      }

      // 사용자 응답의 키 집합이 openapi User 와 정확히 같다
      expect(Object.keys(me.body).sort()).toEqual(
        ['email', 'id', 'managedHospitalIds', 'name', 'provider', 'role'].sort(),
      );
    });

    it('로그인 실패 응답에도 해시가 실리지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: SEED_ACCOUNTS.user, password: '틀린비밀번호' })
        .expect(401);

      expect(JSON.stringify(response.body)).not.toContain('$2');
      expect(Object.keys(response.body)).toEqual(['error']);
    });
  });

  describe('GET /api/auth/me', () => {
    it('가입한 계정의 정보를 그대로 돌려준다', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.operator);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', bearer(session.accessToken))
        .expect(200);

      expect(response.body).toEqual({
        id: session.user.id,
        email: SEED_ACCOUNTS.operator,
        name: '몰라몰라 운영자',
        provider: 'email',
        role: 'operator',
        managedHospitalIds: [],
      });
    });
  });
});
