import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';

// 생성자 주입용 값 import (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { revokeActiveRefreshTokens } from './refresh-token-revocation';
import { RefreshTokenStore } from './refresh-token.store';
import type { RefreshConsumeResult, RefreshTokenClientInfo } from './refresh-token.store';

/**
 * =============================================================================
 * `refresh_tokens` 기반 리프레시 토큰 저장소
 * =============================================================================
 *
 * ☆ **행을 지우지 않는다.** 이 파일에서 가장 중요한 규칙이고, 메모리 구현을 그대로 옮기면
 *   깨지는 지점이다 (docs/database/README.md §11.1).
 *
 *   - 소비(회전) → `used_at` 을 채운다.  **DELETE 가 아니다.**
 *   - 폐기(로그아웃·계열 폐기·계정 단위) → `revoked_at` 을 채운다. **DELETE 가 아니다.**
 *
 *   지우면 재사용된 토큰이 "모르는 jti"(`unknown`)와 구분되지 않아 `REFRESH_TOKEN_REUSED` 와
 *   계열 폐기가 **조용히 동작하지 않게** 된다. 행이 남아 있는 동안만 재사용을 감지할 수 있다.
 *   삭제는 만료 행 정리 배치 하나만 한다 (`refresh-token-cleanup.ts`).
 *
 * 상태 판정 (§11.1 의 표를 그대로 옮긴 것):
 *
 * ```
 * 활성   = used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
 * 소비됨 = used_at IS NOT NULL     → 다시 오면 계열 전체 폐기 (REFRESH_TOKEN_REUSED)
 * 폐기됨 = revoked_at IS NOT NULL  → REFRESH_TOKEN_INVALID  (unknown 으로 매핑)
 * 만료   = expires_at <= now()     → REFRESH_TOKEN_INVALID  (unknown 으로 매핑)
 * ```
 *
 * **검사 순서가 `used_at` → `revoked_at` 인 것도 의도다.** 계열 폐기는 그 계열의 행에
 * `revoked_at` 을 함께 채우므로, `revoked_at` 을 먼저 보면 재사용된 토큰이 그다음 요청부터
 * 단순 `INVALID` 로 보이게 된다. `used_at` 을 먼저 보면 "이미 소비된 토큰이 또 왔다" 는
 * 사실이 계열 폐기 후에도 계속 잡힌다.
 */
@Injectable()
export class PrismaRefreshTokenStore extends RefreshTokenStore {
  private readonly logger = new Logger(PrismaRefreshTokenStore.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async register(entry: {
    jti: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    client?: RefreshTokenClientInfo;
  }): Promise<void> {
    // id 는 애플리케이션이 만든다 — 스키마에 @default 가 없다 (docs/database/README.md §3.4)
    await this.prisma.refreshToken.create({
      data: {
        id: createId(),
        jti: entry.jti,
        userId: entry.userId,
        familyId: entry.familyId,
        expiresAt: entry.expiresAt,
        createdAt: new Date(),
        userAgent: entry.client?.userAgent ?? null,
        ip: entry.client?.ip ?? null,
      },
    });
  }

  async consume(jti: string): Promise<RefreshConsumeResult> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { jti },
      select: { jti: true, userId: true, familyId: true, expiresAt: true, usedAt: true, revokedAt: true },
    });

    if (!row) {
      // 정리 배치가 지운 만료 행이거나 애초에 없는 jti. 구분할 근거가 없다.
      return { outcome: 'unknown' };
    }

    if (row.usedAt) {
      // 이미 쓴 토큰이 또 왔다 = 토큰이 복제됐다는 뜻이다. 어느 쪽이 공격자인지
      // 알 수 없으므로 계열 전체를 끊고 재로그인을 요구한다.
      return this.reportReuse(row.userId, row.familyId, 'used');
    }

    if (row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
      return { outcome: 'unknown' };
    }

    // 소비는 조건부 UPDATE 다. 같은 토큰으로 동시에 두 번 회전하는 경합에서
    // 두 번째 UPDATE 가 0행이 되고, 그때는 재사용으로 다뤄야 한다
    // (둘 다 성공하면 같은 계열에 활성 토큰이 2개가 되어 회전의 의미가 사라진다).
    const consumed = await this.prisma.refreshToken.updateMany({
      where: { jti, usedAt: null, revokedAt: null },
      data: { usedAt: new Date() },
    });

    if (consumed.count === 0) {
      return this.reportReuse(row.userId, row.familyId, 'race');
    }

    return { outcome: 'rotated', familyId: row.familyId };
  }

  async revoke(jti: string): Promise<void> {
    // 없는 jti 면 0행 — 멱등이다. `updateMany` 를 쓰는 이유는 `update` 가 없는 행에
    // 예외를 던지기 때문이고, "이미 폐기됨" 을 다시 폐기하지 않기 위해 조건을 붙였다.
    await this.prisma.refreshToken.updateMany({
      where: { jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 계정 단위 폐기. 반환값은 **끊긴 활성 세션 수**다.
   *
   * 이미 소비된 행(`used_at IS NOT NULL`)은 대상이 아니다 — 그 행은 다시 쓸 수 없고,
   * 재사용 감지를 위해 그대로 남아 있어야 한다.
   *
   * 조건이 `refresh-token-revocation.ts` 에 있는 이유: **CLI 도 같은 폐기를 한다.**
   */
  async revokeAllForUser(userId: string): Promise<number> {
    return revokeActiveRefreshTokens(this.prisma, userId);
  }

  async isActive(jti: string): Promise<boolean> {
    const row = await this.prisma.refreshToken.findFirst({
      where: { jti, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });

    return row !== null;
  }

  /** 재사용 감지 — 계열 전체를 폐기하고 `reused` 를 돌려준다. */
  private async reportReuse(
    userId: string,
    familyId: string,
    reason: 'used' | 'race',
  ): Promise<RefreshConsumeResult> {
    const revoked = await this.revokeFamily(familyId);

    this.logger.warn(
      `리프레시 토큰 재사용 감지 — user=${userId} family=${familyId} reason=${reason} ` +
        `(계열 ${revoked}개 폐기)`,
    );

    return { outcome: 'reused', familyId };
  }

  /**
   * 계열 폐기. `used_at` 은 건드리지 않는다 — 재사용 감지의 근거이고, 지우거나 덮으면
   * 같은 토큰이 또 왔을 때 단순 `INVALID` 로 보인다.
   */
  private async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }
}
