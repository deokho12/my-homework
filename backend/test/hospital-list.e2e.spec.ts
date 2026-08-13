import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './support/app';

describe('GET /api/v1/hospitals', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (query = ''): request.Test =>
    request(app.getHttpServer()).get(`/api/v1/hospitals${query}`);

  it('인증 없이 목록과 총계를 준다', async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.meta.totalItems).toBe(response.body.items.length);
  });

  it('계약이 정한 필드를 담는다', async () => {
    const [first] = (await get()).body.items;

    expect(first.priceRange).toEqual({ min: expect.any(Number), max: expect.any(Number) });
    expect(first.features).toHaveProperty('nightConsult');
    expect(first.sponsorship).toEqual({
      isActive: expect.any(Boolean),
      isPlacementEligible: expect.any(Boolean),
    });
    expect(Array.isArray(first.procedureIds)).toBe(true);
  });

  it('procedureId 로 좁힌다', async () => {
    const response = await get('?procedureId=implant');

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.every((item: { procedureIds: string[] }) => item.procedureIds.includes('implant'))).toBe(true);
  });

  it('consultAvailable=false 는 상담을 받지 않는 병원만 준다', async () => {
    const response = await get('?consultAvailable=false');

    expect(response.body.items.every((item: { consultAvailable: boolean }) => item.consultAvailable === false)).toBe(true);
  });

  it('hasVerifiedSpecialist=true 는 인증 전문의가 있는 병원만 준다', async () => {
    const response = await get('?hasVerifiedSpecialist=true');
    const all = await get();

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.length).toBeLessThan(all.body.items.length);
  });

  it('sort=reviewCount 는 후기 많은 순이다', async () => {
    const counts = (await get('?sort=reviewCount')).body.items.map(
      (item: { reviewCount: number }) => item.reviewCount
    );

    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
  });

  it('페이지 경계에서 중복·누락이 없다', async () => {
    const first = await get('?pageSize=3&page=1');
    const second = await get('?pageSize=3&page=2');

    const ids = [...first.body.items, ...second.body.items].map((item: { id: string }) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('반경 필터는 distanceKm 를 싣고 반경 밖을 제외한다', async () => {
    const response = await get('?latitude=37.4979&longitude=127.0276&radiusKm=3');

    expect(response.status).toBe(200);
    expect(
      response.body.items.every((item: { distanceKm: number }) => item.distanceKm <= 3)
    ).toBe(true);
  });

  it('좌표를 일부만 보내면 422 다', async () => {
    const response = await get('?latitude=37.4979');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('q 는 병원명 부분 일치다', async () => {
    const all = await get();
    const name: string = all.body.items[0].name;
    const response = await get(`?q=${encodeURIComponent(name.slice(0, 2))}`);

    expect(response.body.items.some((item: { id: string }) => item.id === all.body.items[0].id)).toBe(true);
  });
});

describe('GET /api/v1/hospitals/:hospitalId', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('상세를 준다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1');

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('h1');
  });

  it('없는 병원은 404 HOSPITAL_NOT_FOUND 다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    expect(response.body.error.message).toBe('병원 정보를 찾을 수 없어요');
  });
});
