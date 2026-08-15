import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BCRYPT_COST } from '../src/auth/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, logIn, seedPassword, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

/**
 * =============================================================================
 * 전문의 인증 검수 (e2e) — GET /doctors/verification-queue · PUT /doctors/:doctorId/verification
 * =============================================================================
 *
 * **격리 방침.** `seed-data.spec.ts` 가 전문의 14명·검수 이력 1행씩을 단정한다. `decide()` 는
 * 결정마다 `DoctorVerification` 행을 **추가**하므로, 시드 전문의(`d1` 등)에 검수를 실행하면
 * 그 단정이 깨진다.
 *
 * 그래서 상태를 바꾸는 테스트는 전부 **operator 가 만든 일회용 병원**의 전문의에서 검증하고,
 * `afterAll` 에서 그 병원들을 물리 삭제한다 — `Doctor.hospital`·`DoctorVerification.doctor`·
 * `Notification.hospital` 이 모두 `onDelete: Cascade` 라 전문의·검수 이력·알림·수신자가
 * 함께 사라진다.
 *
 * 조회(GET)는 읽기 전용이라 시드 데이터를 그대로 쓴다 — 정렬·`일반의` 제외·필드 노출은
 * 시드로 검증해도 다른 테스트를 오염시키지 않는다.
 *
 * 수신자 생성을 검증하려면 담당자가 있는 병원이 필요하다. `POST /hospitals` 로 만든 병원에는
 * 담당자가 없으므로(담당자 지정은 이 조각 범위 밖이다) 이 파일이 새 사용자(`hospital_admin`)와
 * `HospitalAdmin` 행을 Prisma 로 직접 만들어 붙인다 — 시드 계정을 붙이면 그 계정의
 * `managedHospitalIds` 가 일시적으로 바뀌어 다른 파일(`admin-hospitals.e2e.spec.ts` 등)과 얽힌다.
 */
const NEW_ADMIN_EMAIL = 'hospital-admin@doctor-verification-spec.example';
const NEW_ADMIN_ID = 'test-doctor-verification-admin';

describe('전문의 인증 검수', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let operator: string;
  let adminH1: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    operator = (await logIn(app, SEED_ACCOUNTS.operator)).accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /doctors/verification-queue — 시드 데이터로 읽기 전용 검증', () => {
    it('★ :doctorId 라우트에 잡히지 않는다 (선언 순서)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue')
        .set('Authorization', bearer(operator));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body.error).toBeUndefined();
    });

    it('운영자 전용이다 — 병원 담당자는 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue')
        .set('Authorization', bearer(adminH1));

      expect(response.status).toBe(403);
    });

    it('캐시하지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue')
        .set('Authorization', bearer(operator));

      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('대기 → 반려 → 승인 순이다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue?status=&includeGeneralPractitioners=true&pageSize=100')
        .set('Authorization', bearer(operator));

      const order = { pending: 0, rejected: 1, approved: 2 };
      const ranks = response.body.items.map(
        (item: { verificationStatus: keyof typeof order }) => order[item.verificationStatus],
      );

      expect(ranks.length).toBeGreaterThan(0);
      expect(ranks).toEqual([...ranks].sort((a: number, b: number) => a - b));
    });

    it('일반의를 기본으로 제외한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue?pageSize=100')
        .set('Authorization', bearer(operator));

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items.every((item: { specialty: string }) => item.specialty !== '일반의')).toBe(true);
    });

    it('includeGeneralPractitioners=true 면 일반의도 포함한다', async () => {
      const excluded = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue?pageSize=100')
        .set('Authorization', bearer(operator));

      const included = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue?includeGeneralPractitioners=true&pageSize=100')
        .set('Authorization', bearer(operator));

      expect(included.body.meta.totalItems).toBeGreaterThan(excluded.body.meta.totalItems);
    });

    it('검수 화면은 자격증 URL 과 병원명을 본다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue?pageSize=100')
        .set('Authorization', bearer(operator));

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0]).toHaveProperty('certificateUrl');
      expect(response.body.items[0]).toHaveProperty('hospitalName');
      expect(typeof response.body.items[0].hospitalName).toBe('string');
    });

    it('status 로 필터한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue?status=approved&pageSize=100')
        .set('Authorization', bearer(operator));

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(
        response.body.items.every((item: { verificationStatus: string }) => item.verificationStatus === 'approved'),
      ).toBe(true);
    });
  });

  describe('PUT /doctors/:doctorId/verification — 일회용 병원에서만 상태를 바꾼다', () => {
    let hospitalNoAdminId: string;
    let doctorNoAdminId: string;
    let hospitalWithAdminId: string;
    let doctorWithAdminId: string;

    const createHospital = async (name: string): Promise<string> => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(operator))
        .send({
          name,
          region: '서울 강남구',
          address: '서울 강남구 테헤란로 5',
          latitude: 37.5,
          longitude: 127.03,
          thumbnail: 'https://example.test/doctor-verification.jpg',
          procedureIds: ['implant'],
          priceRange: { min: 100000, max: 200000 },
        })
        .expect(201);

      return response.body.id as string;
    };

    const addDoctor = async (
      targetHospitalId: string,
      overrides: Record<string, unknown> = {},
    ): Promise<string> => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/hospitals/${targetHospitalId}/doctors`)
        .set('Authorization', bearer(operator))
        .send({ doctors: [{ name: '검수대상 원장', specialty: '치과보철전문의', ...overrides }] })
        .expect(200);

      return response.body[0].id as string;
    };

    const decide = (token: string, doctorId: string, body: object): request.Test =>
      request(app.getHttpServer())
        .put(`/api/v1/doctors/${doctorId}/verification`)
        .set('Authorization', bearer(token))
        .send(body);

    beforeAll(async () => {
      // 이전 실행이 중단됐을 수 있으니 시작할 때도 정리한다.
      await prisma.user.deleteMany({ where: { email: NEW_ADMIN_EMAIL } });

      hospitalNoAdminId = await createHospital('__doctor-verification-spec__ 담당자 없는 병원');
      // `certificateUrl` 을 안 보낸다 — 미제출 전문의도 승인할 수 있어야 한다(계약).
      doctorNoAdminId = await addDoctor(hospitalNoAdminId);

      hospitalWithAdminId = await createHospital('__doctor-verification-spec__ 담당자 있는 병원');
      doctorWithAdminId = await addDoctor(hospitalWithAdminId, {
        certificateUrl: 'https://example.test/cert.jpg',
      });

      await prisma.user.create({
        data: {
          id: NEW_ADMIN_ID,
          email: NEW_ADMIN_EMAIL,
          name: '검수 알림 테스트 담당자',
          provider: 'email',
          role: 'hospital_admin',
          passwordHash: await bcrypt.hash(seedPassword(), BCRYPT_COST),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await prisma.hospitalAdmin.create({
        data: {
          id: 'test-doctor-verification-hospital-admin',
          userId: NEW_ADMIN_ID,
          hospitalId: hospitalWithAdminId,
          createdAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      // Hospital 삭제가 Doctor·DoctorVerification·Notification·NotificationRecipient·
      // HospitalAdmin 을 cascade 로 함께 지운다 — seed-data.spec.ts 의 카운트가 원복된다.
      await prisma.hospital.delete({ where: { id: hospitalNoAdminId } });
      await prisma.hospital.delete({ where: { id: hospitalWithAdminId } });

      const deleted = await prisma.user.deleteMany({ where: { email: NEW_ADMIN_EMAIL } });
      if (deleted.count !== 1) {
        throw new Error(`정리 실패 — ${NEW_ADMIN_EMAIL} 이 ${deleted.count}건 삭제됐어요 (기대: 1)`);
      }
    });

    it('운영자가 승인하면 상태가 바뀌고 반려 사유가 지워진다 — 담당자 0명 병원도 성공한다', async () => {
      const response = await decide(operator, doctorNoAdminId, { status: 'approved' });

      expect(response.status).toBe(200);
      expect(response.body.verificationStatus).toBe('approved');
      expect(response.body.rejectionReason).toBeNull();

      const notification = await prisma.notification.findFirst({
        where: { relatedType: 'doctor', relatedId: doctorNoAdminId },
        orderBy: { createdAt: 'desc' },
      });
      expect(notification).not.toBeNull();
      expect(notification?.audience).toBe('admin');
      expect(notification?.hospitalId).toBe(hospitalNoAdminId);

      const recipients = await prisma.notificationRecipient.findMany({
        where: { notificationId: notification?.id },
      });
      // 담당자가 0명인 병원 — 알림은 만들어지되 수신자가 없다.
      expect(recipients).toHaveLength(0);
    });

    it('반려에는 사유가 필수다', async () => {
      const response = await decide(operator, doctorNoAdminId, { status: 'rejected' });

      expect(response.status).toBe(422);
    });

    it('pending 으로 되돌릴 수 없다 — status enum 은 approved/rejected 뿐이다', async () => {
      const response = await decide(operator, doctorNoAdminId, { status: 'pending' });

      expect(response.status).toBe(422);
    });

    it('병원 담당자는 검수할 수 없다 — 자기 병원 전문의를 스스로 승인하면 안 된다', async () => {
      const response = await decide(adminH1, SEED_FIXTURES.doctorAtH1, { status: 'approved' });

      expect(response.status).toBe(403);
    });

    it('승인하면 소속 병원 담당자에게 알림 행과 수신자가 생긴다', async () => {
      const before = await prisma.notification.count();

      const response = await decide(operator, doctorWithAdminId, { status: 'approved' });
      expect(response.status).toBe(200);
      expect(response.body.verificationStatus).toBe('approved');

      const after = await prisma.notification.count();
      expect(after).toBeGreaterThan(before);

      const notification = await prisma.notification.findFirst({
        where: { relatedType: 'doctor', relatedId: doctorWithAdminId },
        orderBy: { createdAt: 'desc' },
      });
      expect(notification?.audience).toBe('admin');
      expect(notification?.hospitalId).toBe(hospitalWithAdminId);
      // 알림 문구 관례(frontend/src/mocks/fixtures/notifications.ts): title 은 짧은 명사구,
      // message 는 구체적 사실을 담은 문장이고 마침표를 붙이지 않는다.
      expect(notification?.title).toBe('전문의 인증 승인');
      expect(notification?.message).toBe('검수대상 원장 전문의의 인증이 승인되었어요');

      const recipients = await prisma.notificationRecipient.findMany({
        where: { notificationId: notification?.id },
      });
      expect(recipients).toHaveLength(1);
      expect(recipients[0].userId).toBe(NEW_ADMIN_ID);
    });

    it('되돌리기(승인 → 반려)가 허용되고, 검수 기록을 남긴다 — 누가, 언제, 무엇을', async () => {
      const response = await decide(operator, doctorWithAdminId, {
        status: 'rejected',
        rejectionReason: '자격증 이미지가 흐려요',
      });

      expect(response.status).toBe(200);
      expect(response.body.verificationStatus).toBe('rejected');
      expect(response.body.rejectionReason).toBe('자격증 이미지가 흐려요');

      const record = await prisma.doctorVerification.findFirst({
        where: { doctorId: doctorWithAdminId },
        orderBy: { createdAt: 'desc' },
      });

      expect(record?.status).toBe('rejected');
      expect(record?.reviewedByUserId).toBe('u-operator');
      expect(record?.reviewedAt).not.toBeNull();
      expect(record?.rejectionReason).toBe('자격증 이미지가 흐려요');

      const notification = await prisma.notification.findFirst({
        where: { relatedType: 'doctor', relatedId: doctorWithAdminId },
        orderBy: { createdAt: 'desc' },
      });
      expect(notification?.title).toBe('전문의 인증 반려');
      expect(notification?.message).toBe('검수대상 원장 전문의의 인증이 반려되었어요. 사유: 자격증 이미지가 흐려요');
    });

    it('없는 전문의는 404 다', async () => {
      const response = await decide(operator, 'does-not-exist', { status: 'approved' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });
  });
});
