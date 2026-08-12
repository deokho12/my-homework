import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * 루트 모듈. 도메인 모듈(병원·전문의·상담 …)은 아직 없다 — 인증·인가까지 올라온 상태다.
 * 도메인 모듈이 생기면 `imports` 에 하나씩 추가하고, 보호가 필요한 라우트에는
 * `AuthModule` 이 내보내는 가드를 붙인다.
 *
 * HTTP 레벨 설정(전역 접두어, 예외 필터, 요청 id 미들웨어, CORS)은 `configureApp()` 에 있다
 * (src/app-setup.ts). 테스트도 같은 함수를 쓰기 때문에 "운영에서만 켜진 설정" 이 생기지 않는다.
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
    // 리프레시 토큰 정리 배치(04:00 KST)가 이것을 요구한다. DB 스케줄러(pg_cron)를 쓰지 않는
    // 이유는 SQLite 에 대응물이 없어 이식성 검증이 깨지기 때문이다 (docs/database/README.md §11.1).
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    // 감사 로그. 지금은 CLI 만 기록하지만, 도메인 모듈이 생기면 여기서 주입받는다
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
