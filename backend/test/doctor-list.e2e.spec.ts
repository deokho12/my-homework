import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

describe('전문의 조회', () => {
  let app: INestApplication;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    userToken = (await logIn(app, SEED_ACCOUNTS.user)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/doctors', () => {
    it('인증 없이 목록을 준다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors');

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('hospitalId 로 좁힌다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors?hospitalId=h1');

      expect(response.body.items.every((item: { hospitalId: string }) => item.hospitalId === 'h1')).toBe(true);
    });

    it('verifiedSpecialist=true 는 배지 자격이 있는 전문의만 준다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors?verifiedSpecialist=true');

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(
        response.body.items.every((item: { isVerifiedSpecialist: boolean }) => item.isVerifiedSpecialist)
      ).toBe(true);
    });

    it('consultAvailable 은 소속 병원 속성으로 거른다', async () => {
      const all = await request(app.getHttpServer()).get('/api/v1/doctors');
      const filtered = await request(app.getHttpServer()).get('/api/v1/doctors?consultAvailable=false');

      expect(filtered.body.items.length).toBeLessThan(all.body.items.length);
    });

    it('minYearsOfExperience 는 본인 경력으로 거른다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors?minYearsOfExperience=10');

      expect(
        response.body.items.every((item: { yearsOfExperience: number }) => item.yearsOfExperience >= 10)
      ).toBe(true);
    });

    it('자격증 URL 을 절대 담지 않는다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors');

      expect(response.body.items.every((item: object) => !('certificateUrl' in item))).toBe(true);
    });
  });

  describe('GET /api/v1/doctors/:doctorId', () => {
    it('비로그인은 rating 이 null 이다', async () => {
      const response = await request(app.getHttpServer()).get(`/api/v1/doctors/${SEED_FIXTURES.doctorAtH1}`);

      expect(response.status).toBe(200);
      expect(response.body.rating).toBeNull();
      expect(typeof response.body.reviewCount).toBe('number');
    });

    it('로그인하면 rating 이 숫자다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/doctors/${SEED_FIXTURES.doctorAtH1}`)
        .set('Authorization', bearer(userToken));

      expect(typeof response.body.rating).toBe('number');
    });

    it('없는 전문의는 404 DOCTOR_NOT_FOUND 다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });

    // 브리프 "내가 미리 확인한 것" — 만료·위조 토큰은 401 이 아니라 authenticated: false 로
    // 취급해야 한다. 공개 화면이므로 로그인 실패가 조회 실패가 되면 안 된다.
    it('★ 위조 토큰을 보내도 401 이 아니라 200 이고 rating 은 null 이다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/doctors/${SEED_FIXTURES.doctorAtH1}`)
        .set('Authorization', bearer('this-is-not-a-valid-jwt'));

      expect(response.status).toBe(200);
      expect(response.body.rating).toBeNull();
    });
  });

  describe('GET /api/v1/hospitals/:hospitalId/doctors', () => {
    it('소속 전문의를 준다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/doctors');

      expect(response.status).toBe(200);
      expect(response.body.every((item: { hospitalId: string }) => item.hospitalId === 'h1')).toBe(true);
    });

    it('없는 병원은 404 HOSPITAL_NOT_FOUND 다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/hospitals/nope/doctors');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    });
  });
});
