import { Injectable, Logger } from '@nestjs/common';
// 생성자 주입용 값 import (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import type { Env } from '../config/env.schema';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { pruneRefreshTokens } from './refresh-token-cleanup';
import type { RefreshTokenCleanupResult } from './refresh-token-cleanup';

/**
 * 리프레시 토큰 정리 스케줄 — **일 1회 04:00 KST 가 주 수단이다** (§11.1 "실행 방법 (권장 순서)" 1).
 *
 * - 시간대를 `Asia/Seoul` 로 명시한다. 서버 TZ 에 맡기면 배포 환경에 따라 실행 시각이 달라진다.
 * - 실패해도 던지지 않는다. 정리는 **위생 작업**이고, 실패가 API 가용성에 영향을 주면 안 된다.
 *   (반대로 정리가 계속 실패하면 행이 누적되므로 에러 로그로 남긴다.)
 * - 배치가 멈춘 것을 발견했을 때의 수동 수단은 `npm run tokens:cleanup` 이다 (§11.1 3).
 */
@Injectable()
export class RefreshTokenCleanupService {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);
  private readonly enabled: boolean;
  private readonly consumedRetentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('REFRESH_TOKEN_CLEANUP_ENABLED', { infer: true });
    this.consumedRetentionDays = config.get('REFRESH_TOKEN_CONSUMED_RETENTION_DAYS', { infer: true });
  }

  /** 04:00 KST. cron 표현식의 6칸 중 첫 칸은 초다 (@nestjs/schedule). */
  @Cron('0 0 4 * * *', { name: 'refresh-token-cleanup', timeZone: 'Asia/Seoul' })
  async runScheduled(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const result = await this.run();

      this.logger.log(
        `리프레시 토큰 정리 — 만료 ${result.expired}행, 소비 ${result.consumed}행 삭제 ` +
          `(남은 행 ${result.remaining})`,
      );
    } catch (error) {
      this.logger.error(
        `리프레시 토큰 정리 실패 (다음 스케줄에 다시 시도합니다): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** 스케줄과 CLI·테스트가 함께 쓰는 실행 진입점. */
  async run(options?: { now?: Date; consumedRetentionDays?: number }): Promise<RefreshTokenCleanupResult> {
    return pruneRefreshTokens(this.prisma, {
      now: options?.now,
      consumedRetentionDays: options?.consumedRetentionDays ?? this.consumedRetentionDays,
    });
  }
}
