import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * =============================================================================
 * 계정 단위 리프레시 토큰 폐기 — 저장소와 CLI 가 공유하는 한 곳
 * =============================================================================
 *
 * `docs/api/README.md` §3: "역할 승격·해제 시 그 계정의 리프레시 토큰을 전부 폐기한다."
 * 이 규칙을 지켜야 하는 주체가 **두 개**다.
 *
 *   1. HTTP 경로 — `PrismaRefreshTokenStore.revokeAllForUser` (담당자 지정/해제 등)
 *   2. CLI — `npm run operator:grant` / `operator:revoke` (Nest 를 부팅하지 않는다)
 *
 * 둘이 각자 조건을 쓰면 "활성" 의 정의가 갈라진다. 그래서 조건을 이 함수 하나에 둔다.
 * **이것이 `refresh_tokens` 를 DB 로 옮긴 가장 큰 이득이다** — 메모리 구현에서는 CLI 가
 * 다른 프로세스의 Map 을 건드릴 방법이 없어 "재로그인해야 새 역할이 적용된다" 를
 * 안내문으로 때웠다 (docs/database/README.md §11.1).
 *
 * ☆ **삭제가 아니라 `revoked_at` 세팅이다.** `used_at` 은 건드리지 않는다 — 이미 소비된 행은
 *   재사용 감지의 근거이므로 그대로 남겨야 한다.
 */
export type RefreshTokenRevocationClient = Pick<PrismaClient, 'refreshToken'> | Prisma.TransactionClient;

/**
 * 그 계정의 **활성** 리프레시 토큰을 폐기한다. 반환값은 끊긴 세션 수.
 *
 * 활성 = `used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`
 * ((user_id, expires_at) 인덱스가 받는다 — docs/database/README.md §11.1)
 */
export async function revokeActiveRefreshTokens(
  prisma: RefreshTokenRevocationClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: now },
  });

  return result.count;
}
