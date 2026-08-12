/**
 * =============================================================================
 * 리프레시 토큰 정리 CLI — docs/database/README.md §11.1
 * =============================================================================
 *
 * ```bash
 * npm run tokens:cleanup                  # 만료 행 + 7일 넘게 지난 소비 행
 * npm run tokens:cleanup -- --keep-days=0 # 만료 행만 (소비 행은 만료까지 남긴다)
 * npm run tokens:cleanup -- --dry-run     # 지우지 않고 대상 수만 센다
 * ```
 *
 * 주 수단은 **일 1회 스케줄**(`RefreshTokenCleanupService`, 04:00 KST)이다. 이 CLI 는
 * 배치가 멈춘 것을 발견했을 때의 수동 수단이다 (§11.1 "실행 방법 (권장 순서)" 3).
 *
 * Nest 를 부팅하지 않고 `PrismaClient` 를 직접 쓴다 — 부팅하면 컨트롤러가 함께 로드되고,
 * 정리 작업이 HTTP 서버를 요구할 이유가 없다 (operator-role.ts 와 같은 판단).
 */
import { PrismaClient } from '@prisma/client';

import { DEFAULT_CONSUMED_RETENTION_DAYS, pruneRefreshTokens } from '../auth/refresh-token-cleanup';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv/config');
} catch {
  /* 운영 환경: 환경변수가 이미 있다 */
}

const prisma = new PrismaClient();

function usage(): string {
  return [
    '사용법:',
    '  npm run tokens:cleanup [-- --keep-days=<N>] [--dry-run]',
    '',
    `  --keep-days=<N>  소비된(회전된) 행을 N일간 남깁니다 (기본 ${DEFAULT_CONSUMED_RETENTION_DAYS},`,
    '                   0 이면 만료될 때까지 남깁니다)',
    '  --dry-run        삭제하지 않고 대상 행 수만 셉니다',
  ].join('\n');
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const keepDaysArg = args.find((arg) => arg.startsWith('--keep-days='));
  const unknown = args.filter((arg) => arg !== '--dry-run' && !arg.startsWith('--keep-days='));

  if (unknown.length > 0) {
    console.error(`✗ 알 수 없는 인자: ${unknown.join(' ')}\n`);
    console.error(usage());

    return 2;
  }

  const keepDays = keepDaysArg ? Number(keepDaysArg.split('=')[1]) : DEFAULT_CONSUMED_RETENTION_DAYS;

  if (!Number.isInteger(keepDays) || keepDays < 0) {
    console.error(`✗ --keep-days 는 0 이상의 정수여야 합니다 (받은 값: '${keepDaysArg}')\n`);
    console.error(usage());

    return 2;
  }

  const now = new Date();
  const before = await prisma.refreshToken.count();

  if (dryRun) {
    const expired = await prisma.refreshToken.count({ where: { expiresAt: { lt: now } } });
    const consumed =
      keepDays > 0
        ? await prisma.refreshToken.count({
            where: { usedAt: { lt: new Date(now.getTime() - keepDays * MS_PER_DAY) } },
          })
        : 0;

    console.log(`(dry-run) 전체 ${before}행 중 삭제 대상: 만료 ${expired}행, 소비 ${consumed}행`);
    console.log('  ※ 두 조건이 겹치는 행이 있어 합계가 실제 삭제 수보다 클 수 있습니다.');

    return 0;
  }

  const result = await pruneRefreshTokens(prisma, { now, consumedRetentionDays: keepDays });

  console.log(`✓ 리프레시 토큰 정리 완료 (기준 ${now.toISOString()}, --keep-days=${keepDays})`);
  console.log(`  만료 행 삭제        ${result.expired}`);
  console.log(`  소비 행 삭제        ${result.consumed}`);
  console.log(`  남은 행             ${result.remaining} (정리 전 ${before})`);

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error('✗ 실행 중 오류가 발생했습니다:');
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exitCode = 1;
  })
  .finally(() => {
    // SQLite 파일 락을 놓는다. 안 놓으면 다음 명령이 막힌다.
    void prisma.$disconnect();
  });
