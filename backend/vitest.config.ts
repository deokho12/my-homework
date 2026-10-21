import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * 테스트 러너는 **Vitest** 다 (NestJS 기본은 Jest).
 *
 * 근거: 프론트엔드가 이미 Vitest ^3.2 를 쓴다. 저장소에 러너가 하나면
 * 설정·watch·리포터를 두 번 배우지 않고, CI 도 같은 명령(`test:run`)으로 돈다.
 *
 * 대가: Vitest 의 기본 트랜스파일러(esbuild)는 `emitDecoratorMetadata` 를
 * 지원하지 않아서, 그대로 쓰면 NestJS 의 생성자 주입이 전부 깨진다
 * (`Nest can't resolve dependencies` / 파라미터 타입이 undefined).
 * 그래서 SWC 로 트랜스파일한다 — NestJS 공식 레시피의 구성이다.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    // 실행 시작마다 `prisma/test.db` 를 지우고 다시 만든다 (docs/database/README.md §8.7).
    // 매번 다시 만드는 이유: 테스트는 행을 남기고(refresh_tokens·audit_logs·가입 계정)
    // 역할을 잠시 바꾸기도 한다. 이전 실행이 남긴 상태 위에서 시작하면 "어제는 됐는데"
    // 가 생긴다. 지우는 비용은 몇 초이고, 개발 DB 는 아예 건드리지 않는다.
    // `npm test`(watch)는 세션당 한 번만 돈다 — 파일을 고칠 때마다 다시 만들지 않는다.
    globalSetup: ['./test/global-setup.ts'],
    // DATABASE_URL(테스트 DB) + .env 로드 + reflect-metadata.
    // 셋 다 테스트 파일보다 먼저 평가돼야 한다.
    setupFiles: ['./test/setup.ts'],
    // Nest 앱과 Prisma 커넥션을 매 파일에서 새로 만든다. SQLite 는 쓰기를
    // 직렬화하므로 파일 병렬 실행이 락 경합을 만든다 → 단일 스레드로 돈다.
    fileParallelism: false,
    // Prisma/Nest 종료가 늦는 환경(윈도우)을 고려한 여유
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2023',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
