import { execFile } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { config as loadEnv } from 'dotenv';

import { assertNotDevDatabase, BACKEND_DIR, testDatabaseFile, testDatabaseUrl } from './support/test-database';

const execFileAsync = promisify(execFile);

/**
 * =============================================================================
 * 테스트 DB 를 **매 실행마다 새로 만든다** (docs/database/README.md §8.7)
 * =============================================================================
 *
 * 순서: `prisma/test.db` 삭제 → `prisma migrate deploy` → 시드(`SEED_TODAY` = 오늘).
 *
 * 왜 `migrate reset` / `db push --force-reset` 이 아닌가
 *   둘은 파괴적 명령이라 Prisma 6 이 사용자 동의 없이 실행되는 것을 막고, 막히면
 *   테스트가 "DB 가 없다" 가 아니라 **프롬프트 대기**로 멈춘다. 파일을 먼저 지우면
 *   빈 파일에 `deploy` 하는 것으로 충분하고, 이 경로는 CI·운영이 쓰는 명령과 같아서
 *   마이그레이션 히스토리가 실제로 적용 가능한지도 함께 검증된다.
 *
 * 끝난 뒤 파일을 지우지 않는다 — 실패를 조사할 때 Prisma Studio 로 열어 봐야 한다.
 * 그래서 teardown 이 없다.
 */

/** 삭제 대상 — 본체 + SQLite 가 만드는 부산물 */
const ARTIFACT_SUFFIXES = ['', '-journal', '-wal', '-shm'];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 파일을 지운다. 윈도우에서는 Prisma Studio·dev 서버가 파일을 잡고 있으면
 * EBUSY/EPERM 이 난다 — 잠깐 기다렸다 다시 해 보고, 그래도 안 되면 **무엇을 닫아야
 * 하는지 적어서** 실패시킨다 (여기서 조용히 넘어가면 지난 실행의 행이 섞인다).
 */
async function removeTestDatabaseFiles(databaseFile: string): Promise<void> {
  for (const suffix of ARTIFACT_SUFFIXES) {
    const file = `${databaseFile}${suffix}`;

    for (let attempt = 0; ; attempt += 1) {
      try {
        rmSync(file, { force: true });
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if ((code === 'EBUSY' || code === 'EPERM') && attempt < 3) {
          await sleep(200);
          continue;
        }

        throw new Error(
          `테스트 DB 파일을 지우지 못했습니다: ${file} (${code ?? 'unknown'}). ` +
            `Prisma Studio 나 dev 서버가 test.db 를 잡고 있는지 확인하세요.`,
        );
      }
    }
  }
}

/**
 * Prisma CLI 를 **node 로 직접** 부른다. `node_modules/.bin/prisma` 는 윈도우에서
 * `.cmd` 래퍼라 `shell: true` 가 필요하다 (test/operator-cli.spec.ts 와 같은 이유).
 */
async function runPrisma(args: string[], env: Record<string, string>): Promise<void> {
  const cli = path.join(BACKEND_DIR, 'node_modules', 'prisma', 'build', 'index.js');

  if (!existsSync(cli)) {
    throw new Error(`Prisma CLI 진입점을 찾지 못했습니다: ${cli}. \`npm install\` 을 먼저 하세요.`);
  }

  try {
    await execFileAsync(process.execPath, [cli, ...args], {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...env },
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string };

    // 성공했을 때는 한 줄만 찍고, 실패했을 때만 자식 출력을 통째로 보여 준다
    console.error(`\n테스트 DB 준비 실패: prisma ${args.join(' ')}`);
    console.error(failure.stdout ?? '');
    console.error(failure.stderr ?? failure.message ?? '');

    throw new Error(`prisma ${args.join(' ')} 가 실패했습니다 (위 출력 참고).`);
  }
}

export default async function setup(): Promise<void> {
  // SEED_PASSWORD·JWT 키는 여전히 `.env` 에서 온다 (자식 프로세스인 시드에 넘겨야 한다).
  // dotenv 는 이미 있는 값을 덮지 않으므로 아래에서 넣는 DATABASE_URL 이 이긴다.
  loadEnv();

  const url = testDatabaseUrl();
  assertNotDevDatabase(url);
  process.env.DATABASE_URL = url;

  // 시드의 "오늘" 은 여기서 **한 번만** 정해 환경변수로 내려보낸다. 테스트 워커는 이
  // 프로세스의 환경을 물려받으므로 `seed-data.spec.ts` 는 다시 계산하지 않고 이 값을 읽는다
  // (UTC 자정을 걸친 실행에서 시드와 단정이 하루 어긋나지 않게).
  const seedToday = process.env.SEED_TODAY?.trim() || new Date().toISOString().slice(0, 10);
  process.env.SEED_TODAY = seedToday;
  const startedAt = Date.now();

  await removeTestDatabaseFiles(testDatabaseFile(url));
  await runPrisma(['migrate', 'deploy'], { DATABASE_URL: url });
  // 시드 명령의 정의는 prisma.config.ts 한 곳에만 있다 (여기서 tsx 명령을 복제하지 않는다)
  await runPrisma(['db', 'seed'], { DATABASE_URL: url, SEED_TODAY: seedToday });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`테스트 DB 재생성 (SEED_TODAY=${seedToday}, ${seconds}s) ${url}`);
}
