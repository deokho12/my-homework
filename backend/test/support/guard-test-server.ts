import 'reflect-metadata';
import 'dotenv/config';

import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { configureApp } from '../../src/app-setup';
import { AppModule } from '../../src/app.module';
import { GuardTestModule } from './guard-test.module';

/** 실제 앱 + 테스트 전용 보호 라우트. e2e 테스트가 만드는 조합과 같다. */
@Module({ imports: [AppModule, GuardTestModule] })
class GuardTestServerModule {}

/**
 * =============================================================================
 * 수동 확인용 서버 (curl 로 인가를 직접 눌러 보는 용도)
 * =============================================================================
 *
 * ```bash
 * npm run verify:guards        # http://localhost:3100
 * ```
 *
 * **tsx 로 직접 실행하면 안 된다.** tsx(esbuild)는 `emitDecoratorMetadata` 를 지원하지
 * 않아서 Nest 의 생성자 주입이 전부 깨진다(`Cannot read properties of undefined`).
 * 그래서 `verify:guards` 는 tsc 로 `.tmp-manual/` 에 컴파일한 뒤 node 로 실행한다
 * (테스트는 같은 문제를 SWC 로 푼다 — vitest.config.ts 주석 참고).
 *
 * `AppModule` + **테스트 전용 보호 라우트**(`GuardTestModule`)를 함께 띄운다.
 * 도메인 API 가 아직 없어서 `AuthGuard`/`RolesGuard`/`HospitalScopeGuard` 를 붙인
 * 실제 경로가 `src/` 에 없기 때문이다.
 *
 * **`src/` 에서 이 파일을 import 하지 않는다.** 운영 번들(`nest build` → `dist/`)에는
 * `test/` 가 들어가지 않으므로 이 라우트는 운영에 존재할 수 없다.
 * 기본 포트를 3100 으로 둔 것도 실서버(3000)와 헷갈리지 않게 하기 위한 것이다.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(GuardTestServerModule, { bufferLogs: true });
  const port = Number(process.env.GUARD_TEST_PORT ?? 3100);

  configureApp(app);
  await app.listen(port);

  const logger = new Logger('GuardTestServer');
  logger.warn(`인가 수동 확인용 서버 — http://localhost:${port} (테스트 전용 라우트 포함)`);
  logger.log(`  GET   /api/test-guards/authenticated`);
  logger.log(`  GET   /api/test-guards/doctor-verification-queue        (operator)`);
  logger.log(`  PATCH /api/test-guards/hospitals/:hospitalId            (hospital_admin, operator)`);
  logger.log(`  GET   /api/test-guards/consult-requests/:id             (hospital_admin, operator)`);
  logger.log(`  PATCH /api/test-guards/consult-requests/:id/status      (hospital_admin)`);
}

void bootstrap();
