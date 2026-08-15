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
    // .env 로드 + reflect-metadata. 두 개 다 테스트 파일보다 먼저 평가돼야 한다.
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
