import type { INestApplication } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './support/app';

/**
 * =============================================================================
 * 약관 동의 — `agreedTermsVersions` → `user_agreements`
 * =============================================================================
 *
 * 지금까지 이 값은 **받아서 경고 로그만 남기고 버려졌다.** 동의 기록은 사후 재구성이
 * 불가능하므로(누가 무엇에 동의했는지 추정할 근거가 없다) 버리는 것이 곧 소실이었다.
 *
 * 고정하는 것 세 가지 (docs/database/README.md §11.3 "가입 시 처리"):
 *
 *   1. 실제로 행이 남는다 — 입도는 (사용자 × 문서 **버전**)
 *   2. 없는 버전은 `422` — 통과시키면 "동의하지 않은 버전으로 가입" 이 된다
 *   3. 계정 생성과 **같은 트랜잭션** — 422 를 낼 때 계정이 남아 있으면 안 되고,
 *      동의 행 실패가 계정만 만들어 두면 안 된다
 */
describe('가입 시 약관 동의 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  function email(): string {
    const value = `agree-${createId()}@spec.example`;

    createdEmails.push(value);

    return value;
  }

  /** supertest 의 Test 를 그대로 돌려준다 (`.expect(...)` 를 이어 쓰기 위해 async 가 아니다) */
  function signUp(body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer()).post('/api/v1/auth/signup').send(body);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    // user_agreements 와 refresh_tokens 는 users 삭제 시 Cascade 로 함께 사라진다
    // (동의 기록은 증빙 대상이 없어진 기록이고, 세션은 감사 자료가 아니라 인증 상태다).
    // 접두어로 지우는 이유: 이 파일이 만든 계정이 하나라도 남으면 시드 계정 수를 검사하는
    // seed-data.spec 이 깨진다 — `createdEmails` 목록에 없는 유실분까지 훑는다.
    createdEmails.length = 0;
    await prisma.user.deleteMany({ where: { email: { startsWith: 'agree-', endsWith: '@spec.example' } } });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('시드가 약관 3종을 유효한 상태로 넣어 뒀다 (없으면 동의를 기록할 대상이 없다)', async () => {
    const documents = await prisma.legalDocument.findMany({ orderBy: { slug: 'asc' } });

    expect(documents.map((d) => `${d.slug}@${d.version}`)).toEqual([
      'location@1.0',
      'privacy@1.0',
      'terms@1.0',
    ]);

    for (const document of documents) {
      // 미래 시행이면 "지금 유효한 버전" 조회가 0건이 되어 화면이 다시 비어 보인다
      expect(document.effectiveAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(document.requiresAgreement).toBe(true);
      // 플레이스홀더임이 본문에서 드러나야 한다 (법무 검토 없이 배포되지 않게)
      expect(document.content).toContain('자리표시자');
    }
  });

  it('★ 동의한 버전이 user_agreements 행으로 남는다', async () => {
    const address = email();

    const response = await signUp({
      name: '동의 테스트',
      email: address,
      password: 'molamola!dev1',
      agreedTermsVersions: [
        { slug: 'terms', version: '1.0' },
        { slug: 'privacy', version: '1.0' },
      ],
    }).expect(201);

    const agreements = await prisma.userAgreement.findMany({
      where: { userId: response.body.user.id },
      include: { document: true },
    });

    expect(agreements.map((a) => a.document.slug).sort()).toEqual(['privacy', 'terms']);
    // 버전 문자열이 아니라 문서 **버전 행**을 가리킨다 (행이 불변이라 증빙이 성립한다)
    expect(agreements.every((a) => a.legalDocumentId.startsWith('legal-'))).toBe(true);
    expect(agreements[0].agreedAt).toBeInstanceOf(Date);
  });

  it('약관 동의를 보내지 않으면 (지금의 회원가입 화면) 동의 행이 없다', async () => {
    // 화면에 약관 절차가 아직 없어 optional 이다. 없는 동의를 만들어 두지 않는다.
    const response = await signUp({
      name: '동의 없음',
      email: email(),
      password: 'molamola!dev1',
    }).expect(201);

    expect(await prisma.userAgreement.count({ where: { userId: response.body.user.id } })).toBe(0);
  });

  it('★ 없는 버전이면 422 이고 계정이 만들어지지 않는다', async () => {
    const address = email();

    const response = await signUp({
      name: '낡은 버전',
      email: address,
      password: 'molamola!dev1',
      agreedTermsVersions: [
        { slug: 'terms', version: '1.0' },
        // 클라이언트가 캐시된 낡은 버전에 동의하고 보낸 경우
        { slug: 'privacy', version: '0.9' },
      ],
    }).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details).toEqual([
      {
        field: 'agreedTermsVersions[1].version',
        code: 'UNKNOWN_TERMS_VERSION',
        message: expect.stringContaining("'privacy'"),
      },
    ]);

    // 계정이 남아 있으면 "동의 없이 가입된 계정" 이 된다
    expect(await prisma.user.findUnique({ where: { email: address } })).toBeNull();
  });

  it('같은 문서를 두 번 보내도 행은 하나다 (유니크 제약을 위반하지 않는다)', async () => {
    const response = await signUp({
      name: '중복 동의',
      email: email(),
      password: 'molamola!dev1',
      agreedTermsVersions: [
        { slug: 'terms', version: '1.0' },
        { slug: 'terms', version: '1.0' },
      ],
    }).expect(201);

    expect(await prisma.userAgreement.count({ where: { userId: response.body.user.id } })).toBe(1);
  });

  it('허용되지 않은 slug 는 스키마 단계에서 422 다 (about 등)', async () => {
    const response = await signUp({
      name: '알 수 없는 약관',
      email: email(),
      password: 'molamola!dev1',
      agreedTermsVersions: [{ slug: 'about', version: '1.0' }],
    }).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('중복 이메일이면 동의 행도 만들지 않는다 (409 가 먼저다)', async () => {
    const address = email();

    await signUp({ name: '먼저', email: address, password: 'molamola!dev1' }).expect(201);

    const conflict = await signUp({
      name: '나중',
      email: address,
      password: 'molamola!dev1',
      agreedTermsVersions: [{ slug: 'terms', version: '1.0' }],
    }).expect(409);

    expect(conflict.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
    expect(await prisma.userAgreement.count({ where: { userId: user.id } })).toBe(0);
  });
});
