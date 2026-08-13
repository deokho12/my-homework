import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

interface RosterEntry {
  id: string;
  name: string;
  specialty: string;
}

/**
 * =============================================================================
 * 전문의 쓰기 (e2e) — PUT /hospitals/:hospitalId/doctors · PATCH/DELETE /doctors/:doctorId
 * =============================================================================
 *
 * **격리 방침.** `seed-data.spec.ts` 가 전문의 14명·검수 이력 1행씩을 단정한다
 * (`deletedAt` 필터 없이 `prisma.doctor.findMany` 를 그대로 센다). 이 파일이 명세 동작을
 * 검증하려면 목록 이탈 삭제(soft delete)·재검수 이력 생성이 실제로 일어나야 하는데,
 * 시드 위에서 하면 그 두 카운트가 영구히 틀어진다.
 *
 * 그래서 이 파일은 **operator 가 만든 일회용 병원**의 로스터에서 대부분을 검증하고,
 * `afterAll` 에서 그 병원을 물리 삭제한다 — `Doctor.hospital`·`DoctorVerification.doctor` 가
 * 모두 `onDelete: Cascade` 라 소속 전문의와 검수 이력이 함께 사라져 카운트가 원복된다.
 *
 * 예외 하나("담당자가 자기 병원 로스터를 고칠 수 있다")만 h1 에서 검증한다. 그때도 h1 의
 * 기존 로스터(d1·d7)를 그대로 담아 보내고 신규 1명만 추가한다 — 목록 이탈이 없고
 * 기존 항목의 `specialty`/`certificateUrl` 을 바꾸지 않으므로 시드 전문의는 soft delete 도
 * 재검수도 겪지 않는다. 추가한 전문의만 `afterAll` 에서 물리 삭제한다.
 */
describe('전문의 쓰기', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let operator: string;
  let adminH1: string;
  let userToken: string;
  let userId: string;

  let hospitalId: string;
  const h1AddedDoctorIds: string[] = [];
  let consultId: string | undefined;

  const put = (token: string, targetHospitalId: string, doctors: object[]): request.Test =>
    request(app.getHttpServer())
      .put(`/api/v1/hospitals/${targetHospitalId}/doctors`)
      .set('Authorization', bearer(token))
      .send({ doctors });

  /**
   * 일회용 병원의 현재 로스터. **Prisma 로 직접 읽는다** — 공개 응답(`GET /hospitals/:id/doctors`)은
   * 미승인 전공을 가려서(`visibleSpecialty`) `specialty` 필드를 아예 안 주므로, `pending` 항목을
   * "그대로 유지" 로 되돌려 보내는 페이로드를 만들 때 그 응답을 쓰면 `specialty` 가 없어 422 가 난다.
   */
  const currentRoster = async (): Promise<RosterEntry[]> => {
    return prisma.doctor.findMany({
      where: { hospitalId, deletedAt: null },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, specialty: true },
    });
  };

  /** 기존 항목을 "그대로 유지" 로 보낼 페이로드. `id`/`name`/`specialty` 만 채운다 — 나머지는 undefined 라 안 바뀐다. */
  const keepPayload = (roster: RosterEntry[]): { id: string; name: string; specialty: string }[] =>
    roster.map((item) => ({ id: item.id, name: item.name, specialty: item.specialty }));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const operatorSession = await logIn(app, SEED_ACCOUNTS.operator);
    operator = operatorSession.accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;

    const userSession = await logIn(app, SEED_ACCOUNTS.user);
    userToken = userSession.accessToken;
    userId = userSession.user.id;

    const hospital = await request(app.getHttpServer())
      .post('/api/v1/hospitals')
      .set('Authorization', bearer(operator))
      .send({
        name: '__doctor-write-spec__ 일회용 병원',
        region: '서울 강남구',
        address: '서울 강남구 테헤란로 5',
        latitude: 37.5,
        longitude: 127.03,
        thumbnail: 'https://example.test/doctor-write.jpg',
        procedureIds: ['implant', 'orthodontics'],
        priceRange: { min: 100000, max: 200000 },
      })
      .expect(201);

    hospitalId = hospital.body.id as string;
  });

  afterAll(async () => {
    if (consultId !== undefined) {
      // ConsultRequest.hospital 이 onDelete: Restrict 다 — 병원을 지우기 전에 먼저 지운다.
      await prisma.consultRequest.delete({ where: { id: consultId } });
    }

    if (h1AddedDoctorIds.length > 0) {
      // h1 은 시드 병원이라 물리 삭제할 수 없다. 이 파일이 h1 에 "추가한" 전문의만
      // 물리 삭제한다 — 시드 전문의(d1·d7)는 건드리지 않는다.
      await prisma.doctor.deleteMany({ where: { id: { in: h1AddedDoctorIds } } });
    }

    // Doctor.hospital·DoctorVerification.doctor 가 onDelete: Cascade 라, 이 병원을 지우면
    // 이 파일이 만든 전문의와 그 검수 이력이 함께 사라져 seed-data.spec.ts 의 카운트가 원복된다.
    await prisma.hospital.delete({ where: { id: hospitalId } });

    await app.close();
  });

  describe('PUT /hospitals/:hospitalId/doctors — 일회용 병원', () => {
    it('이름이 비면 422 다 — 조용한 삭제 경로를 막는다', async () => {
      const response = await put(operator, hospitalId, [{ name: '', specialty: '일반의' }]);

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('id 없는 항목은 신규로 만들고 pending 으로 들어간다 — procedureIds 미지정이면 전공/병원 시술에서 유도한다', async () => {
      const response = await put(operator, hospitalId, [
        { name: '전문의A', specialty: '치과교정전문의' },
        { name: '전문의B', specialty: '일반의' },
      ]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.every((item: { verificationStatus: string }) => item.verificationStatus === 'pending')).toBe(
        true
      );

      const specialist = response.body.find((item: { name: string }) => item.name === '전문의A');
      const generalist = response.body.find((item: { name: string }) => item.name === '전문의B');

      // 치과교정전문의 → orthodontics 로 유도된다 (specialty-procedures.ts).
      expect(specialist.procedureIds).toEqual(['orthodontics']);
      // 일반의 → 병원이 취급하는 시술 전체(implant·orthodontics)를 받는다.
      expect([...generalist.procedureIds].sort()).toEqual(['implant', 'orthodontics']);
    });

    it('목록에서 빠진 항목은 삭제된다', async () => {
      const before = await currentRoster();
      expect(before).toHaveLength(2);

      const keep = before.slice(0, 1);
      const response = await put(operator, hospitalId, keepPayload(keep));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      const after = await currentRoster();
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe(keep[0].id);
    });

    it('전공을 바꾸면 승인이 pending 으로 되돌아간다', async () => {
      const current = await currentRoster();
      expect(current).toHaveLength(1);

      const target = current[0];

      // 검수 화면 없이도 "이미 승인된" 상태를 만들어야 재검수 복귀를 검증할 수 있다.
      await prisma.doctor.update({
        where: { id: target.id },
        data: { verificationStatus: 'approved', verifiedSpecialty: target.specialty },
      });

      const response = await put(operator, hospitalId, [
        { id: target.id, name: target.name, specialty: '소아치과전문의' },
      ]);

      expect(response.status).toBe(200);
      const updated = response.body.find((item: { id: string }) => item.id === target.id);

      expect(updated.verificationStatus).toBe('pending');
      expect(updated.rejectionReason).toBeNull();

      // 재검수 이력이 새로 쌓였다 (신규 생성 시의 1행 + 이번 재검수 1행).
      const verifications = await prisma.doctorVerification.findMany({ where: { doctorId: target.id } });
      expect(verifications).toHaveLength(2);
    });

    it('verificationStatus 를 직접 보내도 승인되지 않는다', async () => {
      const current = await currentRoster();
      expect(current).toHaveLength(1);

      const response = await put(operator, hospitalId, [
        ...keepPayload(current),
        { name: '자칭전문의', specialty: '치주과전문의', verificationStatus: 'approved' },
      ]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);

      const created = response.body.find((item: { name: string }) => item.name === '자칭전문의');
      expect(created.verificationStatus).toBe('pending');
    });

    it('담당하지 않는 병원은 403 HOSPITAL_NOT_MANAGED 다', async () => {
      const response = await put(adminH1, hospitalId, [{ name: '침입', specialty: '일반의' }]);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });

    it('일반 사용자는 403 이다', async () => {
      const response = await put(userToken, hospitalId, [{ name: '침입', specialty: '일반의' }]);

      expect(response.status).toBe(403);
    });

    it('없는 병원은 404 HOSPITAL_NOT_FOUND 다', async () => {
      const response = await put(operator, 'does-not-exist-hospital', [{ name: '유령', specialty: '일반의' }]);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    });

    it('존재하지 않는 procedureId 를 보내면 422 VALIDATION_FAILED 다', async () => {
      const response = await put(operator, hospitalId, [
        { name: '오타시술', specialty: '일반의', procedureIds: ['does-not-exist-procedure'] },
      ]);

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details.some((detail: { field: string }) => detail.field === 'procedureIds')).toBe(
        true
      );
    });
  });

  describe('PUT /hospitals/:hospitalId/doctors — h1 예외: 담당자가 자기 병원 로스터를 고칠 수 있다', () => {
    it('기존 로스터(d1·d7)를 그대로 담아 보내고 신규 1명만 추가하면, 시드 전문의는 안 건드려지고 신규만 pending 으로 들어간다', async () => {
      const existing = await prisma.doctor.findMany({
        where: { hospitalId: SEED_FIXTURES.hospitalManagedByH1Admin, deletedAt: null },
        orderBy: { id: 'asc' },
        select: { id: true, name: true, specialty: true, verificationStatus: true, verifiedSpecialty: true },
      });

      // h1 은 시드에 정확히 2명 — 개수 단정 없이 .map() 만 하면 로스터가 비어도 통과한다.
      expect(existing).toHaveLength(2);

      const response = await put(adminH1, SEED_FIXTURES.hospitalManagedByH1Admin, [
        ...existing.map((item) => ({ id: item.id, name: item.name, specialty: item.specialty })),
        { name: '__doctor-write-spec__ h1 신규', specialty: '치주과전문의' },
      ]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);

      const created = response.body.find((item: { name: string }) => item.name === '__doctor-write-spec__ h1 신규');
      expect(created.verificationStatus).toBe('pending');
      h1AddedDoctorIds.push(created.id);

      // 시드 전문의는 그대로다 — verificationStatus·verifiedSpecialty·specialty 가 안 바뀌었다.
      const after = await prisma.doctor.findMany({
        where: { id: { in: existing.map((item) => item.id) } },
        orderBy: { id: 'asc' },
      });

      expect(after).toHaveLength(2);
      for (const [index, row] of after.entries()) {
        expect(row.verificationStatus).toBe(existing[index].verificationStatus);
        expect(row.verifiedSpecialty).toBe(existing[index].verifiedSpecialty);
        expect(row.specialty).toBe(existing[index].specialty);
      }

      // 재검수 이력도 늘지 않았다 — 전문의마다 여전히 1행.
      const verifications = await prisma.doctorVerification.findMany({
        where: { doctorId: { in: existing.map((item) => item.id) } },
      });
      expect(verifications).toHaveLength(2);
    });
  });

  describe('PATCH /doctors/:doctorId', () => {
    it('전공을 바꾸면 승인이 pending 으로 되돌아간다', async () => {
      const created = await put(operator, hospitalId, [
        ...keepPayload(await currentRoster()),
        { name: '패치대상', specialty: '치과교정전문의' },
      ]);
      const target = created.body.find((item: { name: string }) => item.name === '패치대상');

      await prisma.doctor.update({
        where: { id: target.id },
        data: { verificationStatus: 'approved', verifiedSpecialty: '치과교정전문의' },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/doctors/${target.id}`)
        .set('Authorization', bearer(operator))
        .send({ specialty: '치주과전문의' });

      expect(response.status).toBe(200);
      expect(response.body.verificationStatus).toBe('pending');
      expect(response.body.rejectionReason).toBeNull();
      expect(response.body.specialty).toBe('치주과전문의');
    });

    it('이름을 빈 문자열로 보내면 422 다', async () => {
      const created = await put(operator, hospitalId, [
        ...keepPayload(await currentRoster()),
        { name: '이름검증대상', specialty: '일반의' },
      ]);
      const target = created.body.find((item: { name: string }) => item.name === '이름검증대상');

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/doctors/${target.id}`)
        .set('Authorization', bearer(operator))
        .send({ name: '' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('담당하지 않는 병원의 전문의는 403 HOSPITAL_NOT_MANAGED 다', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/doctors/${SEED_FIXTURES.doctorAtH11}`)
        .set('Authorization', bearer(adminH1))
        .send({ title: '원장' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });

    it('없는 전문의는 404 DOCTOR_NOT_FOUND 다', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/doctors/does-not-exist-doctor')
        .set('Authorization', bearer(operator))
        .send({ title: '원장' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });

    it('일반 사용자는 403 이다', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/doctors/${SEED_FIXTURES.doctorAtH1}`)
        .set('Authorization', bearer(userToken))
        .send({ title: '원장' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /doctors/:doctorId', () => {
    it('삭제하면 공개 목록·상세·소속 목록에서 모두 사라진다', async () => {
      const created = await put(operator, hospitalId, [
        ...keepPayload(await currentRoster()),
        { name: '삭제대상', specialty: '일반의' },
      ]);
      const target = created.body.find((item: { name: string }) => item.name === '삭제대상');

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/doctors/${target.id}`)
        .set('Authorization', bearer(operator));

      expect(response.status).toBe(204);

      expect((await request(app.getHttpServer()).get(`/api/v1/doctors/${target.id}`)).status).toBe(404);

      const list = await request(app.getHttpServer()).get('/api/v1/doctors?pageSize=100');
      expect(list.body.items.some((item: { id: string }) => item.id === target.id)).toBe(false);

      const hospitalRoster = await request(app.getHttpServer()).get(`/api/v1/hospitals/${hospitalId}/doctors`);
      expect(hospitalRoster.body.some((item: { id: string }) => item.id === target.id)).toBe(false);
    });

    it('물리 삭제가 아니라 soft delete 다 — 상담의 doctorId 가 보존된다', async () => {
      const created = await put(operator, hospitalId, [
        ...keepPayload(await currentRoster()),
        { name: '상담지목대상', specialty: '일반의' },
      ]);
      const target = created.body.find((item: { name: string }) => item.name === '상담지목대상');
      const now = new Date();

      const consult = await prisma.consultRequest.create({
        data: {
          id: `cr-doctor-write-spec-${target.id as string}`,
          userId,
          hospitalId,
          doctorId: target.id,
          name: '테스터',
          phone: '010-0000-0000',
          preferredTime: '평일 오전',
          createdAt: now,
          updatedAt: now,
        },
      });
      consultId = consult.id;

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/doctors/${target.id}`)
        .set('Authorization', bearer(operator));

      expect(response.status).toBe(204);

      const after = await prisma.consultRequest.findUnique({ where: { id: consult.id } });
      expect(after?.doctorId).toBe(target.id);

      const doctorRow = await prisma.doctor.findUnique({ where: { id: target.id } });
      expect(doctorRow?.deletedAt).not.toBeNull();
    });

    it('담당하지 않는 병원의 전문의는 403 HOSPITAL_NOT_MANAGED 다', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/doctors/${SEED_FIXTURES.doctorAtH11}`)
        .set('Authorization', bearer(adminH1));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });

    it('없는 전문의는 404 DOCTOR_NOT_FOUND 다', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/doctors/does-not-exist-doctor')
        .set('Authorization', bearer(operator));

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });
  });
});
