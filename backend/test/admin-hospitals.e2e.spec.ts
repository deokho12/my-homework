import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bearer, createTestApp, logIn, SEED_ACCOUNTS } from './support/app';

describe('GET /api/v1/admin/hospitals', () => {
  let app: INestApplication;
  let operator: string;
  let adminH1: string;
  let user: string;

  beforeAll(async () => {
    app = await createTestApp();
    operator = (await logIn(app, SEED_ACCOUNTS.operator)).accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;
    user = (await logIn(app, SEED_ACCOUNTS.user)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (token: string | null): request.Test => {
    const test = request(app.getHttpServer()).get('/api/v1/admin/hospitals');

    return token === null ? test : test.set('Authorization', bearer(token));
  };

  it('담당자는 담당 병원만 보고 scope 가 managed 다', async () => {
    const response = await get(adminH1);

    expect(response.status).toBe(200);
    expect(response.body.scope).toBe('managed');
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(['h1']);
  });

  it('운영자는 전 병원을 보고 scope 가 all 이다', async () => {
    const response = await get(operator);

    expect(response.body.scope).toBe('all');
    expect(response.body.items.length).toBeGreaterThan(1);
  });

  it('일반 사용자는 403 이다', async () => {
    expect((await get(user)).status).toBe(403);
  });

  it('비로그인은 401 이다', async () => {
    expect((await get(null)).status).toBe(401);
  });

  it('캐시하지 않는다', async () => {
    const response = await get(adminH1);

    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('광고 현황 표시용 sponsorship 계산 필드가 항상 있다', async () => {
    const response = await get(adminH1);

    expect(response.body.items[0].sponsorship).toEqual({
      isActive: expect.any(Boolean),
      isPlacementEligible: expect.any(Boolean),
    });
  });
});
