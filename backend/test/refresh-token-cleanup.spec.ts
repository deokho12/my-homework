import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { pruneRefreshTokens } from '../src/auth/refresh-token-cleanup';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

const execFileAsync = promisify(execFile);
const BACKEND_DIR = path.resolve(__dirname, '..');

const DAY_MS = 24 * 60 * 60 * 1000;
/** 이 파일이 만든 행만 지우기 위한 표식 (family_id 접두어) */
const MARK = 'cleanup-spec';

/**
 * =============================================================================
 * 리프레시 토큰 정리 배치 — docs/database/README.md §11.1
 * =============================================================================
 *
 * 확인하는 것은 "지워진다" 가 아니라 **무엇을 남기는가** 다. 소비된 행을 너무 빨리 지우면
 * 재사용 감지가 그만큼 짧아지고(그 행이 감지의 유일한 근거다), 만료 행을 남기면 테이블이
 * 무한히 커진다.
 */
describe('리프레시 토큰 정리 배치', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  /** `refresh_tokens` 한 행. 상태는 컬럼 3개로만 표현된다 (상태 컬럼이 없다) */
  async function seedToken(input: {
    label: string;
    expiresInDays: number;
    usedDaysAgo?: number;
    revoked?: boolean;
  }): Promise<string> {
    const jti = `${MARK}-${input.label}-${createId()}`;
    const now = Date.now();

    await prisma.refreshToken.create({
      data: {
        id: createId(),
        jti,
        // 시드 계정 하나에 붙인다 (user_id 는 NOT NULL + FK)
        userId: 'u-seed-1',
        familyId: `${MARK}-${input.label}`,
        expiresAt: new Date(now + input.expiresInDays * DAY_MS),
        usedAt: input.usedDaysAgo === undefined ? null : new Date(now - input.usedDaysAgo * DAY_MS),
        revokedAt: input.revoked ? new Date(now) : null,
        createdAt: new Date(now - 40 * DAY_MS),
      },
    });

    return jti;
  }

  async function exists(jti: string): Promise<boolean> {
    return (await prisma.refreshToken.findUnique({ where: { jti }, select: { id: true } })) !== null;
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [PrismaModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.refreshToken.deleteMany({ where: { familyId: { startsWith: MARK } } });
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('★ 만료 행만 지우고 used_at 이 최근인 행은 남긴다', async () => {
    const expiredUnused = await seedToken({ label: 'expired-unused', expiresInDays: -1 });
    const expiredUsed = await seedToken({ label: 'expired-used', expiresInDays: -1, usedDaysAgo: 0 });
    const activeUsedRecently = await seedToken({ label: 'used-recent', expiresInDays: 29, usedDaysAgo: 1 });
    const active = await seedToken({ label: 'active', expiresInDays: 30 });

    const result = await pruneRefreshTokens(prisma, { consumedRetentionDays: 7 });

    expect(result.expired).toBeGreaterThanOrEqual(2);

    // 만료 행은 상태와 무관하게 사라진다 (만료 후에는 재사용 감지 대상이 아니다)
    expect(await exists(expiredUnused)).toBe(false);
    expect(await exists(expiredUsed)).toBe(false);

    // ★ 최근에 소비된 행은 남는다 — 이 행이 재사용 감지의 유일한 근거다
    expect(await exists(activeUsedRecently)).toBe(true);
    expect(await exists(active)).toBe(true);
  });

  it('소비된 지 보존기간을 넘긴 행은 만료 전이라도 지운다 (2차 정리)', async () => {
    const usedLongAgo = await seedToken({ label: 'used-old', expiresInDays: 20, usedDaysAgo: 8 });
    const usedRecently = await seedToken({ label: 'used-new', expiresInDays: 20, usedDaysAgo: 6 });

    const result = await pruneRefreshTokens(prisma, { consumedRetentionDays: 7 });

    expect(result.consumed).toBeGreaterThanOrEqual(1);
    expect(await exists(usedLongAgo)).toBe(false);
    expect(await exists(usedRecently)).toBe(true);
  });

  it('consumedRetentionDays=0 이면 2차 정리를 하지 않는다 (만료까지 감지 유지)', async () => {
    const usedLongAgo = await seedToken({ label: 'used-old-keep', expiresInDays: 20, usedDaysAgo: 100 });

    const result = await pruneRefreshTokens(prisma, { consumedRetentionDays: 0 });

    expect(result.consumed).toBe(0);
    expect(await exists(usedLongAgo)).toBe(true);
  });

  it('폐기(revoked)됐지만 만료 전인 행은 남는다 — 폐기는 삭제 기준이 아니다', async () => {
    // revoked_at 을 삭제 기준으로 삼으면 "폐기된 토큰이 또 왔다" 를 구분할 수 없게 된다.
    const revoked = await seedToken({ label: 'revoked', expiresInDays: 10, revoked: true });

    await pruneRefreshTokens(prisma, { consumedRetentionDays: 7 });

    expect(await exists(revoked)).toBe(true);
  });

  it('기준 시각을 넘길 수 있다 (배치를 과거·미래 기준으로 돌려볼 수 있어야 한다)', async () => {
    const expiresIn5Days = await seedToken({ label: 'future-cutoff', expiresInDays: 5 });

    // 10일 뒤 기준으로 돌리면 그 행은 만료된 것으로 취급된다
    await pruneRefreshTokens(prisma, { now: new Date(Date.now() + 10 * DAY_MS), consumedRetentionDays: 7 });

    expect(await exists(expiresIn5Days)).toBe(false);
  });

  it('빈 테이블에서도 안전하다 (배치가 처음 돌 때)', async () => {
    const result = await pruneRefreshTokens(prisma, { now: new Date(0) });

    expect(result.expired).toBe(0);
    expect(result.consumed).toBe(0);
  });

  describe('npm run tokens:cleanup', () => {
    it('CLI 가 실제로 행을 지운다 (--dry-run 은 지우지 않는다)', async () => {
      const expired = await seedToken({ label: 'cli-expired', expiresInDays: -2 });
      const active = await seedToken({ label: 'cli-active', expiresInDays: 30 });
      const tsxCli = path.join(BACKEND_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
      const script = path.join('src', 'scripts', 'tokens-cleanup.ts');

      const dry = await execFileAsync(process.execPath, [tsxCli, script, '--dry-run'], {
        cwd: BACKEND_DIR,
      });

      expect(dry.stdout).toContain('(dry-run)');
      expect(await exists(expired)).toBe(true);

      const run = await execFileAsync(process.execPath, [tsxCli, script, '--keep-days=7'], {
        cwd: BACKEND_DIR,
      });

      expect(run.stdout).toContain('정리 완료');
      expect(await exists(expired)).toBe(false);
      expect(await exists(active)).toBe(true);
    });

    it('알 수 없는 인자는 사용법을 보여주고 실패한다 (exit 2)', async () => {
      const tsxCli = path.join(BACKEND_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
      const script = path.join('src', 'scripts', 'tokens-cleanup.ts');

      try {
        await execFileAsync(process.execPath, [tsxCli, script, '--purge-everything'], { cwd: BACKEND_DIR });
        expect.unreachable('실패해야 합니다');
      } catch (error) {
        const failure = error as { code?: number; stderr?: string };

        expect(failure.code).toBe(2);
        expect(failure.stderr).toContain('사용법');
      }
    });
  });
});
