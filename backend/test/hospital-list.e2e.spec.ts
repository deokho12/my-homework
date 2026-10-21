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
    const response = await get('?procedureId=implant-general');

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.every((item: { procedureIds: string[] }) => item.procedureIds.includes('implant-general')),
    ).toBe(true);
  });

  // --- 분야 필터 (2026-10-21 요청 14) ---------------------------------------

  it('categoryId 로 좁힌다 — 그 분야의 시술을 하나라도 하는 병원', async () => {
    const response = await get('?categoryId=cavity');

    // 시드: h3·h10(resin) h7·h10(inlay·crown) → h3·h7·h10
    expect(response.body.items.map((item: { id: string }) => item.id).sort()).toEqual(['h10', 'h3', 'h7']);
    expect(response.body.meta.totalItems).toBe(3);
  });

  it('분야 필터도 페이지네이션을 그대로 탄다 (100곳 상한이 아니다)', async () => {
    const response = await get('?categoryId=implant&pageSize=2&page=1');

    expect(response.body.items).toHaveLength(2);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 2, totalItems: 4, totalPages: 2 });
  });

  it('categoryId 와 procedureId 가 함께 오면 AND 다', async () => {
    const both = await get('?categoryId=implant&procedureId=wisdom-tooth');

    // wisdom-tooth 는 사랑니·발치 분야다 — 임플란트 분야와 교집합인 병원은 h8 뿐이다
    expect(both.body.items.map((item: { id: string }) => item.id)).toEqual(['h8']);
  });

  it('AND 는 교집합이 없으면 0건이다 — 한쪽을 조용히 버리지 않는다', async () => {
    const response = await get('?categoryId=prevention&procedureId=implant-general');

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.meta.totalItems).toBe(0);
  });

  it('모르는 categoryId 는 422 가 아니라 0건이다', async () => {
    const response = await get('?categoryId=does-not-exist');

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('폐기된 옛 시술 id 로 온 필터는 0건이다 (북마크된 주소)', async () => {
    for (const legacy of ['implant', 'orthodontics', 'cavity', 'gum-disease', 'tmj', 'botox']) {
      const response = await get(`?procedureId=${legacy}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    }
  });

  it('아무 병원도 등록하지 않은 분야는 0건이다 (스케일링·예방)', async () => {
    const response = await get('?categoryId=prevention');

    expect(response.body.items).toEqual([]);
  });

  // --- 광고 우선 노출 ---------------------------------------------------------

  it('분야 목록에서도 광고 병원이 맨 위에 온다 (요청서 14 확인 항목 3)', async () => {
    const ids = (await get('?categoryId=implant')).body.items.map((item: { id: string }) => item.id);

    // h3(4.5)는 implant-general 광고 중 → 평점 1위 h1(4.8)보다 위.
    // h5 는 광고 중이지만 평점 3.2 < 3.5 라 당겨지지 않는다 (맨 뒤).
    expect(ids).toEqual(['h3', 'h1', 'h8', 'h5']);
  });

  it('세부 시술 하나일 때의 순서는 요청 14 이전과 같다 (회귀)', async () => {
    const byProcedure = (await get('?procedureId=implant-general')).body.items.map((item: { id: string }) => item.id);

    expect(byProcedure).toEqual(['h3', 'h1', 'h8', 'h5']);
  });

  it('필터가 없으면 분야 광고도 당기지 않는다 — 계약 규칙 4', async () => {
    const ids = (await get()).body.items.map((item: { id: string }) => item.id);

    // 평점 1위부터다. h3 은 광고 중이지만 필터가 없으므로 평점 순서 그대로다
    expect(ids[0]).toBe('h6');
  });

  it('consultAvailable=false 는 상담을 받지 않는 병원만 준다', async () => {
    const response = await get('?consultAvailable=false');

    // 시드에 정확히 1곳 — 개수 단정이 없으면 필터가 0건을 돌려줘도 `.every()` 가
    // 공허하게 true 라 통과한다 (빈 배열 위의 every).
    expect(response.body.items.length).toBe(1);
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

  it('동점이 섞인 분야 목록에서도 페이지 1·2 가 겹치거나 빠지지 않는다 (계약 요구사항)', async () => {
    // `더 보기` 로 페이지를 이어 붙이기 시작하므로, 같은 값끼리의 순서가 요청마다
    // 흔들리면 page=2 에서 1페이지 항목이 다시 나오거나 사라진다.
    const whole = (await get('?categoryId=cavity')).body.items.map((item: { id: string }) => item.id);
    const page1 = (await get('?categoryId=cavity&pageSize=2&page=1')).body.items.map((item: { id: string }) => item.id);
    const page2 = (await get('?categoryId=cavity&pageSize=2&page=2')).body.items.map((item: { id: string }) => item.id);

    // h3·h7 은 둘 다 평점 4.5 (동점) — tie-break 가 id 라야 경계가 고정된다
    expect([...page1, ...page2]).toEqual(whole);
    expect(new Set([...page1, ...page2]).size).toBe(whole.length);
  });

  it('같은 질의를 여러 번 보내도 순서가 같다', async () => {
    const once = (await get('?categoryId=cavity')).body.items.map((item: { id: string }) => item.id);
    const twice = (await get('?categoryId=cavity')).body.items.map((item: { id: string }) => item.id);

    expect(twice).toEqual(once);
  });

  it('반경 필터는 distanceKm 를 싣고 반경 밖을 제외한다', async () => {
    const response = await get('?latitude=37.4979&longitude=127.0276&radiusKm=3');

    expect(response.status).toBe(200);
    // 개수 단정이 없으면 정밀 필터가 전부 걸러내도 `.every()` 가 공허하게 true 다.
    // 좌표·반경이 바뀌면 정확한 개수도 바뀔 수 있으니 "0건이 아니다" 만 고정한다.
    expect(response.body.items.length).toBeGreaterThan(0);
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
