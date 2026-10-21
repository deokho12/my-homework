// NestJS DI 가 데코레이터 메타데이터를 읽기 위해 필요하다. 가장 먼저 평가된다.
import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';

import { assertNotDevDatabase, testDatabaseUrl } from './support/test-database';

// 테스트는 **개발 DB 를 쓰지 않는다** (docs/database/README.md §8.7).
// DATABASE_URL 은 `.env` 가 아니라 `test/support/test-database.ts` 의 규칙이 정하고,
// 파일(`prisma/test.db`)은 `test/global-setup.ts` 가 매 실행 시작에 새로 만든다.
// 그래서 테스트 전에 migrate/seed 를 손으로 돌릴 필요가 없다.
//
// 순서가 중요하다: **dotenv 보다 먼저** DATABASE_URL 을 넣는다. dotenv 는 이미 있는
// 값을 덮지 않으므로 여기서 넣은 주소가 이긴다. `.env` 는 SEED_PASSWORD·JWT 키 때문에
// 여전히 읽는다.
const databaseUrl = testDatabaseUrl();

assertNotDevDatabase(databaseUrl);
process.env.DATABASE_URL = databaseUrl;

loadEnv();

// SEED_PASSWORD 가 없을 때의 실패 메시지는 `test/support/app.ts` 가 로그인 시점에
// 한 곳에서 낸다 (같은 판정을 두 군데 두지 않는다 — AGENTS.md).
