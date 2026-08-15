import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

/**
 * =============================================================================
 * 병원 쓰기 (e2e) — POST /hospitals · PATCH /hospitals/:hospitalId
 * =============================================================================
 *
 * 이 파일은 시드 병원(h1·h2)의 필드를 고친다. `seed-data.spec.ts` 가 h1 을 광범위하게
 * 단정하므로(name·priceRange·businessHours …) **건드린 필드를 정확히 스냅샷하고
 * afterAll 에서 복원한다.** 이름/정규화 검증은 시드를 건드리지 않도록 이 파일이 만든
 * 일회용 병원에서 한다.
 *
 * 이 파일이 만든 병원은 전부 지운다 — 누적되면 목록 개수 단정이 흔들린다.
 */
describe('병원 쓰기', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let operator: string;
  let adminH1: string;
  let user: string;

  const createdHospitalIds: string[] = [];

  let h1Snapshot: { introduction: string; name: string; nameNormalized: string; isRecommended: boolean };
  let h2Snapshot: { introduction: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    operator = (await logIn(app, SEED_ACCOUNTS.operator)).accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;
    user = (await logIn(app, SEED_ACCOUNTS.user)).accessToken;

    const h1 = await prisma.hospital.findUniqueOrThrow({ where: { id: SEED_FIXTURES.hospitalManagedByH1Admin } });
    const h2 = await prisma.hospital.findUniqueOrThrow({ where: { id: SEED_FIXTURES.hospitalNotManagedByH1Admin } });

    h1Snapshot = {
      introduction: h1.introduction,
      name: h1.name,
      nameNormalized: h1.nameNormalized,
      isRecommended: h1.isRecommended,
    };
    h2Snapshot = { introduction: h2.introduction };
  });

  afterAll(async () => {
    // 이 파일이 건드린 시드(h1·h2) 필드를 정확히 복원한다. 다른 필드는 손대지 않았으므로
    // 여기서 다시 쓰지 않는다.
    await prisma.hospital.update({
      where: { id: SEED_FIXTURES.hospitalManagedByH1Admin },
      data: h1Snapshot,
    });
    await prisma.hospital.update({
      where: { id: SEED_FIXTURES.hospitalNotManagedByH1Admin },
      data: h2Snapshot,
    });

    if (createdHospitalIds.length > 0) {
      await prisma.hospital.deleteMany({ where: { id: { in: createdHospitalIds } } });
    }

    await app.close();
  });

  const patch = (id: string, token: string | null, body: object): request.Test => {
    const test = request(app.getHttpServer()).patch(`/api/v1/hospitals/${id}`).send(body);

    return token === null ? test : test.set('Authorization', bearer(token));
  };

  describe('PATCH /hospitals/:hospitalId', () => {
    it('담당자는 자기 병원을 고칠 수 있다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, adminH1, {
        introduction: '수정된 소개',
      });

      expect(response.status).toBe(200);
      expect(response.body.introduction).toBe('수정된 소개');
    });

    it('담당하지 않는 병원은 403 HOSPITAL_NOT_MANAGED 다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalNotManagedByH1Admin, adminH1, {
        introduction: '남의 병원',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });

    it('운영자는 전 병원을 고칠 수 있다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalNotManagedByH1Admin, operator, {
        introduction: '운영자 수정',
      });

      expect(response.status).toBe(200);
    });

    it('일반 사용자는 403 이다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, user, { introduction: 'x' });

      expect(response.status).toBe(403);
    });

    it('비로그인은 401 이다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, null, { introduction: 'x' });

      expect(response.status).toBe(401);
    });

    it('없는 병원은 404 HOSPITAL_NOT_FOUND 다 (병원은 공개 자원이라 존재를 숨기지 않는다)', async () => {
      const response = await patch('does-not-exist', operator, { introduction: 'x' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    });

    it('광고 필드를 보내면 422 FIELD_NOT_WRITABLE 이다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, operator, {
        sponsoredRank: 1,
      });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('FIELD_NOT_WRITABLE');
    });

    it('집계 필드를 보내면 422 FIELD_NOT_WRITABLE 이다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, operator, { rating: 5 });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('FIELD_NOT_WRITABLE');
    });

    it('isRecommended 는 운영자만 바꿀 수 있다', async () => {
      const byAdmin = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, adminH1, {
        isRecommended: true,
      });
      const byOperator = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, operator, {
        isRecommended: true,
      });

      expect(byAdmin.status).toBe(422);
      expect(byAdmin.body.error.code).toBe('FIELD_NOT_WRITABLE');
      expect(byOperator.status).toBe(200);
    });

    it('이름을 고치면 검색용 정규화 컬럼도 함께 바뀐다 (일회용 병원에서 검증 — 시드 name 은 건드리지 않는다)', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(operator))
        .send({
          name: '__write-spec__ 이름변경용 병원',
          region: '서울 강남구',
          address: '서울 강남구 테헤란로 3',
          latitude: 37.5,
          longitude: 127.03,
          thumbnail: 'https://example.test/name-change.jpg',
          procedureIds: ['implant'],
          priceRange: { min: 100000, max: 200000 },
        })
        .expect(201);

      createdHospitalIds.push(created.body.id);

      await patch(created.body.id, operator, { name: 'Smile Dental 강남' }).expect(200);

      const found = await request(app.getHttpServer()).get('/api/v1/hospitals?q=smile');

      expect(found.body.items.length).toBeGreaterThan(0);
      expect(found.body.items.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
    });
  });

  describe('POST /hospitals', () => {
    const body = {
      name: '테스트 치과',
      region: '서울 강남구',
      address: '서울 강남구 테헤란로 2',
      latitude: 37.5,
      longitude: 127.03,
      thumbnail: 'https://example.test/t.jpg',
      procedureIds: ['implant'],
      priceRange: { min: 100000, max: 200000 },
    };

    it('운영자만 병원을 만들 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(operator))
        .send(body);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeTruthy();
      expect(response.body.rating).toBe(0);

      createdHospitalIds.push(response.body.id);
    });

    it('병원 담당자는 만들 수 없다 — 아무나 병원을 만들 수 있으면 안 된다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(adminH1))
        .send(body);

      expect(response.status).toBe(403);
    });

    it('시술이 비면 422 다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(operator))
        .send({ ...body, procedureIds: [] });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('존재하지 않는 procedureId 는 422 VALIDATION_FAILED 다 (FK 위반으로 500 이 되면 안 된다)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(operator))
        .send({ ...body, procedureIds: ['does-not-exist-procedure'] });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(
        response.body.error.details.some((detail: { field: string }) => detail.field === 'procedureIds')
      ).toBe(true);
    });
  });

  describe('procedureIds FK 검증 · 태그 정규화 중복 제거', () => {
    it('PATCH 로 존재하지 않는 procedureId 를 보내면 POST 와 같은 422 다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, operator, {
        procedureIds: ['does-not-exist-procedure'],
      });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(
        response.body.error.details.some((detail: { field: string }) => detail.field === 'procedureIds')
      ).toBe(true);
    });

    it('정규화 값이 같은 태그 2개를 보내면 200 이고 태그가 1개로 합쳐진다 (일회용 병원 — 시드를 건드리지 않는다)', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(operator))
        .send({
          name: '__write-spec__ 태그중복용 병원',
          region: '서울 강남구',
          address: '서울 강남구 테헤란로 4',
          latitude: 37.5,
          longitude: 127.03,
          thumbnail: 'https://example.test/tag-dedupe.jpg',
          procedureIds: ['implant'],
          priceRange: { min: 100000, max: 200000 },
        })
        .expect(201);

      createdHospitalIds.push(created.body.id);

      const patched = await patch(created.body.id, operator, { tags: ['VIP', 'vip'] });

      expect(patched.status).toBe(200);
      expect(patched.body.tags).toEqual(['VIP']);
    });
  });
});
