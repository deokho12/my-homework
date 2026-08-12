import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { purgeAuditLogsBefore } from '../src/audit/audit-log-retention';
import { RefreshTokenStore } from '../src/auth/refresh-token.store';
import { TokenService } from '../src/auth/token.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, logIn, SEED_ACCOUNTS } from './support/app';

const execFileAsync = promisify(execFile);
const BACKEND_DIR = path.resolve(__dirname, '..');

/**
 * =============================================================================
 * 리프레시 토큰 저장소가 DB 로 옮겨진 뒤 — 메모리 구현이 못 하던 것들
 * =============================================================================
 *
 * 회전·재사용 감지 자체는 `auth-tokens.e2e.spec.ts` 가 이미 고정한다(그 테스트는 저장소를
 * 바꿔도 그대로 통과해야 한다). 이 파일은 **DB 저장소여야만 성립하는 것**을 확인한다.
 *
 *   1. 소비·폐기가 **DELETE 가 아니라 `used_at`/`revoked_at`** 이다
 *      → 이것이 깨지면 재사용 공격이 `unknown`(단순 만료)으로 보여 계열 폐기가 조용히 죽는다
 *   2. **새 store 인스턴스(새 PrismaService)에서도 회전이 이어진다** — 프로세스 재시작·다중 인스턴스
 *   3. `expires_at` 로 만료 행이 거부된다
 *   4. `revokeAllForUser` 가 DB 행을 폐기한다 → **다른 프로세스(CLI)가 세션을 끊을 수 있다**
 */
describe('리프레시 토큰 저장소 (DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let store: RefreshTokenStore;
  let tokens: TokenService;

  function jtiOf(refreshToken: string): string {
    const [, payload] = refreshToken.split('.');

    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).jti as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    store = app.get(RefreshTokenStore);
    tokens = app.get(TokenService);
  });

  afterAll(async () => {
    // 이 파일이 만든 세션 행을 지운다 (다른 파일의 행 수 기대에 영향을 주지 않게)
    await prisma.refreshToken.deleteMany({});
    await app?.close();
  });

  describe('★ 소비·폐기는 행을 지우지 않는다', () => {
    it('회전하면 옛 행이 남고 used_at 이 채워진다 (DELETE 였다면 재사용을 감지할 수 없다)', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);
      const oldJti = jtiOf(session.refreshToken);

      const rotated = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      const oldRow = await prisma.refreshToken.findUnique({ where: { jti: oldJti } });

      // 행이 그대로 있고, 상태만 '소비됨' 이다
      expect(oldRow).not.toBeNull();
      expect(oldRow?.usedAt).toBeInstanceOf(Date);
      expect(oldRow?.revokedAt).toBeNull();

      // 새 행은 같은 계열(family_id)에 활성으로 들어간다
      const newRow = await prisma.refreshToken.findUniqueOrThrow({
        where: { jti: jtiOf(rotated.body.refreshToken) },
      });

      expect(newRow.familyId).toBe(oldRow?.familyId);
      expect(newRow.usedAt).toBeNull();
      expect(newRow.revokedAt).toBeNull();
    });

    it('★ 재사용이 오면 계열 전체에 revoked_at 이 찍히고 used_at 은 지워지지 않는다', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);
      const stolenJti = jtiOf(session.refreshToken);

      const rotated = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      // 공격자가 이미 소비된 토큰을 다시 쓴다
      const reuse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      const stolen = await prisma.refreshToken.findUniqueOrThrow({ where: { jti: stolenJti } });
      const family = await prisma.refreshToken.findMany({ where: { familyId: stolen.familyId } });

      // used_at 이 남아 있어야 "또 오면 또 재사용" 을 계속 판정할 수 있다
      expect(stolen.usedAt).toBeInstanceOf(Date);
      expect(stolen.revokedAt).toBeInstanceOf(Date);
      // 계열 전체가 폐기됐다 (정상 사용자의 최신 토큰 포함)
      expect(family.length).toBeGreaterThanOrEqual(2);
      expect(family.every((row) => row.revokedAt !== null)).toBe(true);

      // 그 계열의 활성 토큰은 하나도 없다
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);

      // ☆ 같은 훔친 토큰이 또 오면 여전히 REUSED 다 (행을 지웠다면 INVALID 로 보인다)
      const again = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      expect(again.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    });

    it('로그아웃은 행을 지우지 않고 revoked_at 을 채운다', async () => {
      const session = await logIn(app, SEED_ACCOUNTS.user);
      const jti = jtiOf(session.refreshToken);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ refreshToken: session.refreshToken })
        .expect(204);

      const row = await prisma.refreshToken.findUniqueOrThrow({ where: { jti } });

      expect(row.revokedAt).toBeInstanceOf(Date);
      // 쓰이지 않은 토큰이므로 used_at 은 그대로 null — 폐기와 소비는 다른 사실이다
      expect(row.usedAt).toBeNull();
      expect(await store.isActive(jti)).toBe(false);
    });
  });

  describe('★ 프로세스를 새로 만들어도 회전이 이어진다 (메모리 구현이 못 했던 것)', () => {
    it('다른 앱 인스턴스(새 PrismaService·새 store)에서 발급한 토큰이 회전된다', async () => {
      // 인스턴스 A 에서 로그인
      const session = await logIn(app, SEED_ACCOUNTS.user);

      // 인스턴스 B — 별도 Nest 앱이므로 store 도 PrismaService 도 새 객체다.
      // 메모리 구현이라면 B 의 Map 이 비어 있어 여기서 REFRESH_TOKEN_INVALID 가 났다.
      const other = await createTestApp();

      try {
        expect(other.get(RefreshTokenStore)).not.toBe(store);

        const rotated = await request(other.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken: session.refreshToken })
          .expect(200);

        // 그리고 A 에서 옛 토큰을 쓰면 B 의 회전이 보인다 → 재사용으로 잡힌다
        const reuse = await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken: session.refreshToken })
          .expect(401);

        expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

        // B 가 준 토큰도 A 에서 (계열 폐기 때문에) 무효다 — 두 인스턴스가 같은 상태를 본다
        const afterFamilyRevoke = await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken: rotated.body.refreshToken })
          .expect(401);

        expect(afterFamilyRevoke.body.error.code).toBe('REFRESH_TOKEN_INVALID');
      } finally {
        await other.close();
      }
    });
  });

  describe('만료', () => {
    it('expires_at 이 지난 행은 거부된다 (서명이 아직 유효해도)', async () => {
      // 서명 수명은 30일인 정상 토큰을 만들고, 저장소 행만 과거 만료로 등록한다.
      // 그래야 "거부의 근거가 expires_at 컬럼" 이라는 것이 드러난다.
      const refresh = tokens.issueRefreshToken('u-seed-1');

      await store.register({
        jti: refresh.jti,
        userId: 'u-seed-1',
        familyId: refresh.familyId,
        expiresAt: new Date(Date.now() - 1000),
      });

      expect(await store.isActive(refresh.jti)).toBe(false);

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: refresh.token })
        .expect(401);

      expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');

      // 만료 행은 소비되지 않는다 (used_at 이 찍히면 다음에 재사용으로 오인된다)
      const row = await prisma.refreshToken.findUniqueOrThrow({ where: { jti: refresh.jti } });
      expect(row.usedAt).toBeNull();
    });
  });

  describe('revokeAllForUser — 역할 변경·비밀번호 변경 시의 수단', () => {
    it('활성 행만 폐기하고 이미 소비된 행의 used_at 은 건드리지 않는다', async () => {
      // 반환값(끊긴 세션 수)을 정확히 세려면 이 계정의 이전 행이 없어야 한다.
      // 행이 누적되는 테이블이므로(정리 배치가 있는 이유) 앞선 테스트의 세션이 남아 있다.
      await prisma.refreshToken.deleteMany({ where: { user: { email: SEED_ACCOUNTS.adminH2 } } });

      const first = await logIn(app, SEED_ACCOUNTS.adminH2);
      const second = await logIn(app, SEED_ACCOUNTS.adminH2);

      // first 를 한 번 회전시켜 '소비됨' 행을 하나 만든다
      const rotated = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      const consumedJti = jtiOf(first.refreshToken);

      const revoked = await store.revokeAllForUser(first.user.id);

      // 활성 행 2개(회전 결과 + second)만 센다. 소비된 행은 대상이 아니다
      expect(revoked).toBe(2);

      const consumedRow = await prisma.refreshToken.findUniqueOrThrow({ where: { jti: consumedJti } });
      expect(consumedRow.usedAt).toBeInstanceOf(Date);
      expect(consumedRow.revokedAt).toBeNull();

      for (const token of [rotated.body.refreshToken, second.refreshToken]) {
        const response = await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken: token })
          .expect(401);

        expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');
      }
    });

    it('없는 사용자·세션 없는 사용자면 0 이고 아무 행도 바뀌지 않는다 (멱등)', async () => {
      expect(await store.revokeAllForUser(`missing-${createId()}`)).toBe(0);
    });
  });

  describe('★ 다른 프로세스(CLI)가 실행 중인 서버의 세션을 끊는다', () => {
    it('operator:grant 가 그 계정의 리프레시 토큰을 폐기하고 audit_logs 에 남긴다', async () => {
      // 메모리 구현에서는 불가능했던 것이다 — CLI 는 서버 프로세스의 Map 을 볼 수 없어
      // "다시 로그인해야 새 역할이 적용됩니다" 를 안내문으로 때웠다 (docs §11.1).
      const session = await logIn(app, SEED_ACCOUNTS.user);
      const tsxCli = path.join(BACKEND_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
      const script = path.join('src', 'scripts', 'operator-role.ts');

      try {
        const granted = await execFileAsync(
          process.execPath,
          [tsxCli, script, 'grant', SEED_ACCOUNTS.user, `--actor=${SEED_ACCOUNTS.operator}`],
          { cwd: BACKEND_DIR },
        );

        expect(granted.stdout).toContain('활성 세션');
        expect(granted.stdout).toContain('audit_logs 에 기록했습니다');

        // ★ 실행 중인 서버가 발급한 세션이 죽었다
        const response = await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken: session.refreshToken })
          .expect(401);

        expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');

        // 감사 로그가 실제 행으로 남았다 (스냅샷 2개 포함)
        const log = await prisma.auditLog.findFirstOrThrow({
          where: { action: 'user.role_grant_operator', targetId: session.user.id },
          orderBy: { createdAt: 'desc' },
        });

        expect(log).toMatchObject({
          actorUserId: 'u-operator',
          actorRole: 'operator',
          targetType: 'user',
          beforeValue: 'user',
          afterValue: 'operator',
          // 대상 계정의 이메일·이름을 마스킹 없이 보고 실행한다
          piiMasked: false,
          hospitalId: null,
        });
        expect(log.requestId.startsWith('cli-')).toBe(true);
        expect(log.userAgent).toContain('cli:operator-role');
      } finally {
        // 역할을 되돌린다 (seed-data.spec 이 역할 분포를 검사한다)
        await execFileAsync(process.execPath, [tsxCli, script, 'revoke', SEED_ACCOUNTS.user], {
          cwd: BACKEND_DIR,
        });
        // 감사 로그 삭제는 **보존기간 배치 경로 하나만** 허용된다 (docs §11.2-(4)).
        // 테스트도 그 경로를 쓴다 — 개발 DB 의 audit_logs 에는 테스트 행만 있다.
        await purgeAuditLogsBefore(prisma, new Date(Date.now() + 60_000));
      }
    });
  });
});
