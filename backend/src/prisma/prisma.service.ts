import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { isDevTraceEnabled } from '../common/logging/dev-trace';

/**
 * Prisma Client 를 NestJS 의 lifecycle 에 붙인 래퍼.
 *
 * - `onModuleInit` 에서 `$connect()` — 첫 요청이 커넥션 비용을 물지 않게 하고,
 *   DB 가 없으면 부팅 시점에 바로 실패하게 만든다(늦게 실패하는 것보다 낫다).
 * - `onModuleDestroy` 에서 `$disconnect()` — 테스트가 프로세스를 남기지 않게 한다.
 *   (SQLite 는 파일 락을 쥐고 있으므로 특히 중요하다)
 *
 * 규칙(docs/database/README.md §3.8): raw SQL 을 쓰지 않는다. 이 서비스는
 * `$queryRaw`/`$executeRaw` 를 감싸는 헬퍼를 제공하지 않는다.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // 기본은 경고/에러만. **개발 모드에서만** 쿼리 로그를 함께 켠다.
      //
      // 이것이 단계 추적(`common/logging/dev-trace.ts`)의 나머지 절반이다 — 추적 줄이
      // "어느 단계까지 갔는가" 를 보여주고, 이 쿼리 줄이 "그 단계가 DB 에 무엇을
      // 물었는가" 를 보여준다. 덕분에 서비스·리포지토리를 한 줄도 계측하지 않아도 된다.
      log: isDevTraceEnabled()
        ? [
            { emit: 'stdout', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
