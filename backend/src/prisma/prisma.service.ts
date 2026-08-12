import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
      // 쿼리 로그는 필요할 때 켜세요. 기본은 경고/에러만.
      log: [
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
