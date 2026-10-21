import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

import { parse as parseEnv } from 'dotenv';
import { describe, expect, it } from 'vitest';

import {
  assertNotDevDatabase,
  BACKEND_DIR,
  TEST_DB_FILE,
  testDatabaseFile,
  testDatabaseUrl,
} from './support/test-database';

/**
 * 테스트가 **개발 DB 를 밟지 않는다**는 것을 테스트 안에서 증명한다 (docs §8.7).
 *
 * 격리는 눈으로 확인하기 어렵다 — 깨져도 테스트는 그냥 통과하고, 대신 개발 DB 에
 * 행이 쌓이거나 개발 중에 만든 계정 때문에 다른 테스트가 빨개진다. 그래서 "지금
 * 이 프로세스가 보고 있는 파일이 무엇인가" 를 단정으로 고정한다.
 */
describe('테스트 DB 격리', () => {
  it('이 프로세스의 DATABASE_URL 은 dev.db 가 아니다', () => {
    const url = process.env.DATABASE_URL;

    expect(url).toBeTruthy();
    expect(url).not.toMatch(/dev\.db/);
    expect(() => assertNotDevDatabase(url as string)).not.toThrow();
  });

  it('DATABASE_URL 이 테스트 DB 규칙(TEST_DATABASE_URL ?? file:./test.db)과 같다', () => {
    expect(process.env.DATABASE_URL).toBe(testDatabaseUrl());
  });

  it('테스트 DB 파일이 실제로 만들어져 있다 (globalSetup 이 돌았다)', () => {
    expect(TEST_DB_FILE).toBe(path.join(BACKEND_DIR, 'prisma', 'test.db'));
    expect(existsSync(testDatabaseFile())).toBe(true);
  });

  it('주소 → 파일 변환은 Prisma 와 같은 규칙이다 (상대 경로 기준은 prisma/)', () => {
    // globalSetup 이 지우는 파일과 Prisma 가 여는 파일이 같아야 한다
    expect(testDatabaseFile('file:./test.db')).toBe(TEST_DB_FILE);
    expect(testDatabaseFile('file:test.db?connection_limit=1')).toBe(TEST_DB_FILE);
    expect(testDatabaseFile('file:./other.db')).toBe(path.join(BACKEND_DIR, 'prisma', 'other.db'));
  });

  it('.env 의 DATABASE_URL 이 dev.db 를 가리켜도 테스트는 그 값을 쓰지 않는다', () => {
    const envPath = path.join(BACKEND_DIR, '.env');

    if (!existsSync(envPath)) return; // CI 에 .env 가 없을 수 있다

    const fromEnvFile = parseEnv(readFileSync(envPath)).DATABASE_URL;

    if (fromEnvFile && /dev\.db/.test(fromEnvFile)) {
      expect(process.env.DATABASE_URL).not.toBe(fromEnvFile);
    }
  });

  it('assertNotDevDatabase 는 dev.db 주소를 막는다', () => {
    expect(() => assertNotDevDatabase('file:./dev.db')).toThrow(/dev\.db/);
    expect(() => assertNotDevDatabase('file:C:/x/backend/prisma/dev.db')).toThrow(/dev\.db/);
    expect(() => assertNotDevDatabase('file:./test.db')).not.toThrow();
  });
});
