import type { PrismaClient } from '@prisma/client';

/**
 * =============================================================================
 * 리프레시 토큰 정리 배치 — docs/database/README.md §11.1 "만료 행 정리 전략"
 * =============================================================================
 *
 * **행이 계속 누적된다.** 회전마다 새 행이 생기고, 소비된 행도 재사용 감지를 위해
 * 만료 전에는 지우지 않기 때문이다. §11.1 의 규모 추정: 하루 20분 사용이면 세션당 30일에
 * 약 60행, 앱을 계속 열어 두면 약 2,880행.
 *
 * 규칙 두 단계:
 *
 *   1차 **만료 행은 상태와 무관하게 지운다.** 만료 후에는 재사용 감지 대상도 아니다
 *       (`consume` 이 `expires_at` 로 이미 거절한다).
 *   2차 **소비된 지 오래된 행**(기본 7일). 탈취된 토큰은 즉시 쓰이므로 감지 가치가 급감한다.
 *       `0` 이면 이 단계를 하지 않는다.
 *
 * 지키는 것:
 * - `deleteMany` 만 쓴다. raw SQL·DB 트리거·`pg_cron` 없음 (§3.8, §11.6) — 두 DB 에서
 *   같은 코드가 같게 동작해야 한다.
 * - **`register()` 마다 훑던 메모리 구현의 sweep 을 옮기지 않았다.** DB 에서는 그것이
 *   로그인 경로마다 `deleteMany` 를 넣는 셈이다 (§11.1 "기회적 sweep" 경고).
 *
 * 이 함수를 `PrismaClient` 를 받는 순수 함수로 둔 이유: **스케줄 배치와 CLI 가 같은 코드를
 * 써야 한다.** CLI(`npm run tokens:cleanup`)는 Nest 를 부팅하지 않고 `PrismaClient` 를
 * 직접 쓴다 (operator-role.ts 와 같은 이유).
 */

/** `refresh_tokens` 에만 접근하면 되므로 필요한 부분만 받는다 (PrismaService 도 만족한다). */
export type RefreshTokenCleanupClient = Pick<PrismaClient, 'refreshToken'>;

export interface RefreshTokenCleanupOptions {
  /** 기준 시각. 테스트가 고정할 수 있게 인자로 받는다 */
  now?: Date;
  /**
   * 소비된 행을 며칠 뒤에 지울지. 기본 7일 (§11.1 의 REUSE_DETECTION_WINDOW).
   * `0` 이면 2차 정리를 하지 않는다 — 만료까지 재사용 감지를 유지하는 선택이다.
   */
  consumedRetentionDays?: number;
}

export interface RefreshTokenCleanupResult {
  /** 1차 — 만료된 행 */
  expired: number;
  /** 2차 — 소비된 지 오래된 행 */
  consumed: number;
  /** 남은 행 수 (로그·CLI 출력용) */
  remaining: number;
}

export const DEFAULT_CONSUMED_RETENTION_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function pruneRefreshTokens(
  prisma: RefreshTokenCleanupClient,
  options: RefreshTokenCleanupOptions = {},
): Promise<RefreshTokenCleanupResult> {
  const now = options.now ?? new Date();
  const retentionDays = options.consumedRetentionDays ?? DEFAULT_CONSUMED_RETENTION_DAYS;

  // 1차: 만료 행. (expires_at) 인덱스가 받는다.
  const expired = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });

  // 2차: 소비된 지 오래된 행. 아직 만료되지 않았어도 지운다.
  let consumed = 0;

  if (retentionDays > 0) {
    const cutoff = new Date(now.getTime() - retentionDays * MS_PER_DAY);
    const result = await prisma.refreshToken.deleteMany({ where: { usedAt: { lt: cutoff } } });

    consumed = result.count;
  }

  return { expired: expired.count, consumed, remaining: await prisma.refreshToken.count() };
}
