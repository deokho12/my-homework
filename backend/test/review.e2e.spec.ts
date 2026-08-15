import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './support/app';

describe('GET /api/v1/hospitals/:hospitalId/reviews', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('최신순으로 준다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/reviews');

    expect(response.status).toBe(200);

    // h1 후기는 시드에 정확히 2건 — 개수 단정이 없으면 정렬 단정이 빈 배열에서 공허하게 통과한다.
    expect(response.body.items.length).toBe(2);

    const dates = response.body.items.map((item: { createdAt: string }) => item.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('createdAt 은 날짜만이다 (기존 도메인 타입 보존)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/reviews');

    expect(response.body.items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('procedureId 로 좁힌다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/reviews?procedureId=implant');

    // h1 + implant 는 시드에 정확히 1건 — 개수 단정이 없으면 `.every()` 가 빈 배열에서 공허하게 통과한다.
    expect(response.body.items.length).toBe(1);
    expect(
      response.body.items.every((item: { procedureId: string }) => item.procedureId === 'implant')
    ).toBe(true);
  });

  it('없는 병원은 404 HOSPITAL_NOT_FOUND 다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/nope/reviews');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
  });

  it('후기 작성 엔드포인트는 없다', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/hospitals/h1/reviews')
      .send({ rating: 5, content: '좋아요' });

    expect(response.status).toBe(404);
  });
});
