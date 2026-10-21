import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { procedures as seedProcedures } from '../prisma/seed/data/procedures';
import { createTestApp } from './support/app';

/**
 * 계약이 고정한 순서 (openapi `listProcedures`) — 분야 순서 × 분야 안 순서를 한 줄로
 * 편 31개다. **시드 데이터 파일에서 끌어온다**: 값을 여기 다시 적으면 사본이 셋이 되고,
 * 갈렸을 때 어느 쪽이 맞는지 알 수 없다 (docs/database/README.md §17.8).
 */
const EXPECTED_ORDER = seedProcedures.map((procedure) => procedure.id);

describe('GET /api/v1/procedures', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('31종을 계약이 고정한 순서로 준다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(31);
    expect(response.body.map((item: { id: string }) => item.id)).toEqual(EXPECTED_ORDER);
  });

  it('옛 id 6개는 더 이상 없다', async () => {
    const ids: string[] = (await request(app.getHttpServer()).get('/api/v1/procedures')).body.map(
      (item: { id: string }) => item.id,
    );

    for (const legacy of ['implant', 'orthodontics', 'cavity', 'gum-disease', 'tmj', 'botox']) {
      expect(ids).not.toContain(legacy);
    }
  });

  it('화면이 쓰는 필드를 전부 담는다 (categoryId·isAvailable 포함)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.body[0]).toEqual({
      id: 'implant-general',
      name: expect.any(String),
      emoji: expect.any(String),
      shortDescription: expect.any(String),
      description: expect.any(String),
      categoryId: 'implant',
      isAvailable: expect.any(Boolean),
    });
  });

  it('모든 항목에 분야가 있고, 분야는 9개뿐이다', async () => {
    const items: { categoryId: string }[] = (await request(app.getHttpServer()).get('/api/v1/procedures')).body;

    expect(items.every((item) => typeof item.categoryId === 'string' && item.categoryId.length > 0)).toBe(true);
    expect(new Set(items.map((item) => item.categoryId)).size).toBe(9);
  });

  it('등록한 병원이 1곳 이상인 시술만 isAvailable 이다 (시드 기준 — 스케일링·예방은 전부 준비중)', async () => {
    const items: { id: string; isAvailable: boolean; categoryId: string }[] = (
      await request(app.getHttpServer()).get('/api/v1/procedures')
    ).body;
    const byId = new Map(items.map((item) => [item.id, item.isAvailable]));

    // 시드의 병원 11곳이 등록한 13종은 열려 있다
    expect(byId.get('implant-general')).toBe(true);
    expect(byId.get('gum-treatment')).toBe(true);

    // 아무 병원도 등록하지 않은 세부 시술은 준비중이다 (요청서 14 확인 항목 2)
    expect(byId.get('scaling')).toBe(false);
    expect(byId.get('halitosis')).toBe(false);

    // 분야 전체가 비어 있는 상태 — 화면이 "분야 준비중" 을 유도하는 근거다
    expect(items.filter((item) => item.categoryId === 'prevention').every((item) => !item.isAvailable)).toBe(true);
  });

  it('삭제된 병원만 등록한 시술은 준비중이다 — 공개 목록과 같은 조건을 쓴다', async () => {
    const prisma = app.get(PrismaService);
    const hospital = await prisma.hospital.findUniqueOrThrow({ where: { id: 'h9' } });

    try {
      await prisma.hospital.update({ where: { id: 'h9' }, data: { deletedAt: new Date() } });

      const items: { id: string; isAvailable: boolean }[] = (
        await request(app.getHttpServer()).get('/api/v1/procedures')
      ).body;
      const byId = new Map(items.map((item) => [item.id, item.isAvailable]));

      // h9 만 등록한 시술 → 준비중. h9 이 빠져도 h4 가 남는 splint 는 그대로 열려 있다
      expect(byId.get('tmj-treatment')).toBe(false);
      expect(byId.get('splint')).toBe(true);
    } finally {
      await prisma.hospital.update({ where: { id: 'h9' }, data: { deletedAt: hospital.deletedAt } });
    }
  });

  it('인증 없이 접근할 수 있다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.status).toBe(200);
  });

  it('isAvailable 이 변하는 응답이라 no-cache 다 (max-age 를 쓰지 않는다)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers['cache-control']).not.toContain('max-age');
  });

  it('ETag 를 주고, 같은 값으로 재검증하면 304 + 빈 본문이다', async () => {
    const first = await request(app.getHttpServer()).get('/api/v1/procedures');
    const etag = first.headers.etag;

    expect(etag).toBeDefined();

    const second = await request(app.getHttpServer()).get('/api/v1/procedures').set('If-None-Match', etag);

    expect(second.status).toBe(304);
    expect(second.text).toBe('');
    expect(second.headers['cache-control']).toBe('no-cache');
    // 304 에도 ETag 가 실려야 한다 (RFC 9110 15.4.5). 빠지면 브라우저가 다음 요청에서
    // 캐시 항목의 검증자를 잃고 매번 전체 본문을 받는다.
    expect(second.headers.etag).toBe(etag);
  });

  it('다른 ETag 로 재검증하면 200 + 본문이다', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/procedures')
      .set('If-None-Match', '"stale-etag"');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(31);
  });

  it('본문이 바뀌면 ETag 도 바뀐다 — 저장 직후의 304 가 틀린 답이 되지 않는다', async () => {
    const prisma = app.get(PrismaService);
    const before = (await request(app.getHttpServer()).get('/api/v1/procedures')).headers.etag;

    await prisma.hospitalProcedure.create({
      data: { id: 'hp-test-etag', hospitalId: 'h1', procedureId: 'scaling' },
    });

    try {
      const after = (await request(app.getHttpServer()).get('/api/v1/procedures')).headers.etag;

      expect(after).not.toBe(before);
    } finally {
      await prisma.hospitalProcedure.delete({ where: { id: 'hp-test-etag' } });
    }
  });
});
