// reflect-metadata 는 Nest 의 DI 가 데코레이터 메타데이터를 읽기 위해 필요하다.
// 반드시 다른 import 보다 먼저 평가되어야 한다.
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { configureApp } from './app-setup';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);

  // 전역 접두어(/api/v1), 요청 id 미들웨어, 예외 필터. 테스트도 같은 함수를 쓴다.
  configureApp(app);

  // 전역 ValidationPipe 를 두지 않는다. Nest 의 ValidationPipe 는 생성자에서
  // class-validator / class-transformer 를 require 하므로, Zod 를 고른 이 프로젝트에서는
  // 쓸 수 없다(설치되지 않은 패키지를 부팅 시점에 찾는다).
  // 검증은 각 라우트에서 ZodValidationPipe 로 한다 — src/common/pipes/zod-validation.pipe.ts
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  });

  // 서버 프로세스는 UTC 로 돈다 (docs/database/README.md §7.5 체크리스트).
  // 표시용 시간대 변환은 프론트엔드에서만 한다.
  const port = config.get('PORT', { infer: true });

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`몰라몰라 API 가 http://localhost:${port} 에서 실행중입니다`);
  logger.log(`헬스체크: http://localhost:${port}/health`);
}

void bootstrap();
