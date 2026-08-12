import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * 루트 모듈. 도메인 모듈(병원·전문의·상담 …)은 아직 없다 — 골격만 세운 상태다.
 * 도메인 모듈이 생기면 `imports` 에 하나씩 추가한다.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env 를 읽고 Zod 로 검증한다. 검증 실패 = 부팅 실패.
      validate: validateEnv,
      // .env 를 두 번 읽지 않게 캐시한다.
      cache: true,
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
