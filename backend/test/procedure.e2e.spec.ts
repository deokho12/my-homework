import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './support/app';

/** 계약이 고정한 순서 (openapi `listProcedures`). 화면 3곳이 같은 목록을 쓴다. */
const EXPECTED_ORDER = [
  'implant', 'orthodontics', 'laminate', 'inlay', 'crown', 'whitening',
  'wisdom-tooth', 'cavity', 'gum-disease', 'splint', 'snoring-device', 'tmj', 'botox',
];

describe('GET /api/v1/procedures', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('13종을 계약이 고정한 순서로 준다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.status).toBe(200);
    expect(response.body.map((item: { id: string }) => item.id)).toEqual(EXPECTED_ORDER);
  });

  it('화면이 쓰는 필드를 전부 담는다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.body[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      emoji: expect.any(String),
      shortDescription: expect.any(String),
      description: expect.any(String),
    });
  });

  it('인증 없이 접근할 수 있다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.status).toBe(200);
  });

  it('마스터 데이터라 캐시 헤더를 붙인다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.headers['cache-control']).toBe('public, max-age=3600');
  });
});
