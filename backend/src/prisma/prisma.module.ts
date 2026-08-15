import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * 전역 모듈. 도메인 모듈마다 `imports: [PrismaModule]` 을 반복하지 않기 위해
 * `@Global()` 로 둔다. Prisma Client 는 커넥션 풀을 들고 있으므로
 * 프로세스에 인스턴스가 하나여야 한다.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
