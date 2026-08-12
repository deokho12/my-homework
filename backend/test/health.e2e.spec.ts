import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configureApp } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * 스모크 테스트 1 — 헬스체크가 200 을 주고, **DB 를 실제로 읽는다**.
 *
 * "200 이 나온다" 만 확인하면 DB 가 없어도 통과하는 테스트가 된다. 그래서
 * ① 응답의 procedureCount 가 실제 테이블 카운트와 같은지,
 * ② DB 를 못 읽는 상태에서는 503 이 되는지 까지 확인한다.
 */
describe('GET /health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // main.ts 와 **같은 설정**을 쓴다 (/api 접두어 + health 제외, 요청 id, 예외 필터)
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('200 과 status:ok 를 준다', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      database: { status: 'up' },
    });
    expect(typeof response.body.timestamp).toBe('string');
    expect(typeof response.body.uptimeSeconds).toBe('number');
    expect(response.body.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('응답의 procedureCount 가 DB 의 실제 행 수와 같다 (= 정말 읽었다)', async () => {
    const prisma = app.get(PrismaService);
    const actual = await prisma.procedure.count();

    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(actual).toBeGreaterThan(0);
    expect(response.body.database.procedureCount).toBe(actual);
  });

  it('DB 를 읽을 수 없으면 503 과 status:error 를 준다', async () => {
    const prisma = app.get(PrismaService);
    const original = prisma.procedure.count;

    // 커넥션을 실제로 끊는 대신 카운트 쿼리만 실패시킨다.
    // (SQLite 파일 커넥션을 끊으면 이후 테스트 파일까지 영향을 받는다)
    prisma.procedure.count = (() => Promise.reject(new Error('DB 연결 끊김 (테스트)'))) as never;

    try {
      const response = await request(app.getHttpServer()).get('/health').expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.database.status).toBe('down');
      expect(response.body.database.error).toContain('DB 연결 끊김');
    } finally {
      prisma.procedure.count = original;
    }
  });
});
