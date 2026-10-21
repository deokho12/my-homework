import * as path from 'node:path';

/**
 * 테스트 DB 의 주소를 정하는 곳 **하나** (docs/database/README.md §8.7).
 *
 * globalSetup(`test/global-setup.ts`, 파일을 만드는 쪽)과 setupFiles(`test/setup.ts`,
 * 테스트 프로세스가 그 파일을 보게 하는 쪽)가 같은 규칙을 쓴다. 두 곳에 각자 적으면
 * 언젠가 한쪽만 바뀌고, 그때 테스트는 **조용히 개발 DB 를 밟는다**.
 */

/** `backend/` 절대 경로. 이 파일은 backend/test/support/ 에 있다. */
export const BACKEND_DIR = path.resolve(__dirname, '..', '..');

/** 기본 테스트 SQLite 파일. `.gitignore` 의 `prisma/test.db*` 가 저널·WAL 까지 뺀다. */
export const TEST_DB_FILE = path.join(BACKEND_DIR, 'prisma', 'test.db');

/**
 * 테스트가 쓸 DATABASE_URL. 상대 경로의 기준은 **schema.prisma 가 있는 `prisma/`** 다.
 * `.env` 의 값은 보지 않는다 — 그게 이 분리의 핵심이다. 빈 값은 "지정 안 함" 으로 본다.
 */
export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL?.trim() || 'file:./test.db';
}

/**
 * 그 주소가 가리키는 **실제 파일**. 지우는 쪽(globalSetup)과 쓰는 쪽(Prisma)이
 * 같은 파일을 봐야 한다 — `TEST_DATABASE_URL` 로 다른 파일을 지정했는데 기본값만
 * 지우면, 지정한 파일은 **초기화되지 않은 채** 쌓인다(이 분리가 막으려던 상태 그 자체다).
 * Prisma 와 같은 규칙으로 푼다: 상대 경로의 기준은 `schema.prisma` 가 있는 `prisma/`.
 */
export function testDatabaseFile(url: string = testDatabaseUrl()): string {
  const raw = url.replace(/^file:/i, '').replace(/\?.*$/, '');

  return path.resolve(BACKEND_DIR, 'prisma', raw);
}

/**
 * 개발 DB 를 가리키면 **시작조차 하지 않는다.** 오타 하나로 개발 DB 에 테스트가
 * 쓰는 경로를 남기지 않는다 (테스트는 역할을 바꾸고 토큰·감사 행을 만든다).
 */
export function assertNotDevDatabase(url: string): void {
  if (/dev\.db/i.test(url)) {
    throw new Error(
      `테스트가 개발 DB(dev.db)를 가리키고 있습니다: '${url}'. ` +
        `테스트는 전용 DB(prisma/test.db)만 씁니다 — docs/database/README.md §8.7. ` +
        `TEST_DATABASE_URL 을 확인하세요.`,
    );
  }
}
