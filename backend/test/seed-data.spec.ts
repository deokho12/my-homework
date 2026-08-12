import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * 스모크 테스트 2 — 시드된 데이터를 실제로 읽는다.
 *
 * 확인하는 것은 "행이 있다" 가 아니라 **변환이 맞게 됐는가** 다. fixture 의
 * 배열·JSON 이 테이블로 갈라졌기 때문에, 그 변환이 틀리면 여기서 걸린다.
 *
 * 선행 조건: `npm run prisma:migrate && npm run prisma:seed`
 */
describe('시드 데이터 (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [PrismaModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('시술 마스터가 13종이고 sort_order 가 fixture 순서다', async () => {
    const rows = await prisma.procedure.findMany({ orderBy: { sortOrder: 'asc' } });

    expect(rows).toHaveLength(13);
    expect(rows[0]).toMatchObject({ id: 'implant', name: '임플란트', sortOrder: 0 });
    expect(rows.at(-1)).toMatchObject({ id: 'botox', sortOrder: 12 });
  });

  it('fixture 의 id 가 그대로 살아 있다 (h1 / d1 / cr1 / q1 / g1 / p1 / r1 / notif1)', async () => {
    const [hospital, doctor, consult, post, guide, promotion, review, notification] = await Promise.all([
      prisma.hospital.findUnique({ where: { id: 'h1' } }),
      prisma.doctor.findUnique({ where: { id: 'd1' } }),
      prisma.consultRequest.findUnique({ where: { id: 'cr1' } }),
      prisma.qaPost.findUnique({ where: { id: 'q1' } }),
      prisma.guide.findUnique({ where: { id: 'g1' } }),
      prisma.promotion.findUnique({ where: { id: 'p1' } }),
      prisma.review.findUnique({ where: { id: 'r1' } }),
      prisma.notification.findUnique({ where: { id: 'notif1' } }),
    ]);

    expect(hospital?.name).toBe('강남 스마일 치과');
    expect(doctor?.name).toBe('김민준');
    expect(consult?.status).toBe('new');
    expect(post?.title).toContain('임플란트');
    expect(guide).not.toBeNull();
    expect(promotion?.salePrice).toBe(1290000);
    expect(review?.rating).toBe(5);
    expect(notification?.audience).toBe('user');
  });

  it('h1 의 JSON·배열 필드가 실 컬럼과 자식 테이블로 풀렸다', async () => {
    const hospital = await prisma.hospital.findUniqueOrThrow({
      where: { id: 'h1' },
      include: {
        procedures: true,
        images: { orderBy: { sortOrder: 'asc' } },
        tags: true,
        eventNotes: true,
        businessHours: { orderBy: { dayOfWeek: 'asc' } },
      },
    });

    // PriceRange JSON → Int 컬럼 2개 (원)
    expect(hospital.priceMin).toBe(900000);
    expect(hospital.priceMax).toBe(1800000);
    expect(Number.isInteger(hospital.priceMin)).toBe(true);

    // HospitalFeatures JSON → boolean 6개. Prisma 를 통과하면 진짜 true/false 다
    expect(hospital.featureNightConsult).toBe(true);
    expect(hospital.featureCctv).toBe(false);

    // 검색용 정규화 컬럼
    expect(hospital.nameNormalized).toBe('강남 스마일 치과');

    // 배열 → 자식 테이블
    expect(hospital.procedures.map((p) => p.procedureId).sort()).toEqual(
      ['botox', 'implant', 'laminate'].sort(),
    );
    expect(hospital.images).toHaveLength(2);
    expect(hospital.tags.map((t) => t.tag)).toContain('당일진료');
    expect(hospital.eventNotes).toHaveLength(1);

    // business_hours.day_of_week 는 '월' 이 아니라 1~7 정수다
    expect(hospital.businessHours).toHaveLength(7);
    expect(hospital.businessHours.map((b) => b.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(hospital.businessHours[0].hours).toBe('10:00 - 19:00');
    expect(hospital.businessHours[6].isClosed).toBe(true);
  });

  it('광고는 컬럼이 아니라 "오늘이 기간 안인 행" 으로 파생된다', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const active = await prisma.hospitalSponsorship.findMany({
      where: { startDate: { lte: today }, endDate: { gte: today } },
    });

    // h1 은 평점 1위인데 광고를 사지 않은 대조군이다 (fixture 주석)
    expect(active.some((row) => row.hospitalId === 'h1')).toBe(false);
    // h5 는 카테고리 2개를 사서 행이 2개로 풀렸다
    expect(active.filter((row) => row.hospitalId === 'h5').map((row) => row.procedureId).sort()).toEqual(
      ['gum-disease', 'implant'],
    );
  });

  it('전문의 배지 판정식이 데이터만으로 성립한다', async () => {
    const doctors = await prisma.doctor.findMany({ include: { verifications: true } });

    expect(doctors).toHaveLength(14);

    for (const doctor of doctors) {
      // 검수 이력이 전문의마다 1행 (docs §8.3)
      expect(doctor.verifications).toHaveLength(1);
      expect(doctor.verifications[0].status).toBe(doctor.verificationStatus);

      if (doctor.verificationStatus === 'approved') {
        expect(doctor.verifiedSpecialty).toBe(doctor.specialty);
        expect(doctor.verifications[0].reviewedByUserId).toBe('u-operator');
      } else {
        // 승인이 아니면 verified_specialty 가 비어 있어 배지가 붙지 않는다
        expect(doctor.verifiedSpecialty).toBeNull();
      }
    }

    const badgeEligible = doctors.filter(
      (d) =>
        d.verificationStatus === 'approved' &&
        d.verifiedSpecialty === d.specialty &&
        d.specialty !== '일반의',
    );

    expect(badgeEligible.length).toBeGreaterThan(0);
  });

  it('상담 7건에 신청자 계정이 붙어 있고 상태 이력이 최신순으로 나온다', async () => {
    const consults = await prisma.consultRequest.findMany({
      // 동일 timestamp 의 순서가 DB 마다 다르지 않게 타이브레이커를 둔다 (docs §7.5)
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { user: true, statusChanges: { orderBy: { changedAt: 'asc' } }, memos: true },
    });

    expect(consults).toHaveLength(7);

    for (const consult of consults) {
      expect(consult.userId).toBeTruthy();
      expect(consult.user.role).toBe('user');
      // 폼 스냅샷 이름과 계정 이름이 시드에서는 일치한다
      expect(consult.user.name).toBe(consult.name);
      expect(consult.statusChanges.length).toBeGreaterThan(0);
      // 첫 이력은 항상 'new' 이고 신청 시각과 같다
      expect(consult.statusChanges[0].status).toBe('new');
      expect(consult.statusChanges[0].changedAt.getTime()).toBe(consult.createdAt.getTime());
      // 마지막 이력의 상태가 현재 상태다
      expect(consult.statusChanges.at(-1)?.status).toBe(consult.status);
    }

    const cr2 = consults.find((c) => c.id === 'cr2');
    expect(cr2?.memos.map((m) => m.id)).toEqual(['memo-cr2-1']);
  });

  it('상담이 SEED_TODAY 기준으로 옮겨져 이번 달 신규 상담이 0 이 아니다', async () => {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const thisMonth = await prisma.consultRequest.count({
      where: { createdAt: { gte: monthStart, lt: nextMonthStart } },
    });
    const pending = await prisma.consultRequest.count({ where: { status: 'new' } });

    expect(thisMonth).toBeGreaterThan(0);
    expect(pending).toBeGreaterThan(0);
  });

  it('알림 읽음 상태가 계정별로 갈라져 있다', async () => {
    // notif1(cr3 예약완료)은 cr3 신청자에게만 간다
    const notif1Recipients = await prisma.notificationRecipient.findMany({
      where: { notificationId: 'notif1' },
    });

    expect(notif1Recipients).toHaveLength(1);
    expect(notif1Recipients[0].userId).toBe('u-seed-3');
    expect(notif1Recipients[0].readAt).toBeNull();

    // 그래서 다른 사용자 계정의 안 읽음 개수는 0 이다
    const unreadForApplicant3 = await prisma.notificationRecipient.count({
      where: { userId: 'u-seed-3', readAt: null },
    });
    const unreadForApplicant1 = await prisma.notificationRecipient.count({
      where: { userId: 'u-seed-1', readAt: null },
    });

    expect(unreadForApplicant3).toBe(1);
    expect(unreadForApplicant1).toBe(0);

    // 관리자 알림은 담당 병원 담당자에게만 (notif4 → h1, notif5 → h5)
    const adminNotif = await prisma.notification.findUniqueOrThrow({
      where: { id: 'notif4' },
      include: { recipients: true },
    });

    expect(adminNotif.hospitalId).toBe('h1');
    expect(adminNotif.relatedType).toBe('consult_request');
    expect(adminNotif.recipients.map((r) => r.userId)).toEqual(['u-admin-h1']);
  });

  it('개발용 계정 19개가 역할별로 있고 비밀번호는 해시로만 저장된다', async () => {
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });

    expect(users).toHaveLength(19);
    expect(users.filter((u) => u.role === 'operator')).toHaveLength(1);
    expect(users.filter((u) => u.role === 'hospital_admin')).toHaveLength(11);
    expect(users.filter((u) => u.role === 'user')).toHaveLength(7);

    for (const user of users) {
      // 이메일은 정규화되어 저장된다 (docs §3.9)
      expect(user.email).toBe(user.email.trim().toLowerCase());
      expect(user.email.endsWith('@molarmolar.example')).toBe(true);
      // bcrypt 해시 형태. 평문 비밀번호 컬럼은 스키마에 아예 없다 (docs §5.9)
      expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      expect(user.deletedAt).toBeNull();
    }

    // 병원 담당자는 hospital_admins 로 담당 범위가 정해진다
    const admins = await prisma.hospitalAdmin.findMany({ where: { userId: 'u-admin-h1' } });
    expect(admins.map((a) => a.hospitalId)).toEqual(['h1']);
  });

  it('커뮤니티 답변이 배열이 아니라 행으로 저장돼 있다', async () => {
    const post = await prisma.qaPost.findUniqueOrThrow({
      where: { id: 'q1' },
      include: { answers: true },
    });

    expect(post.isAnonymous).toBe(true);
    expect(post.authorUserId).toBeNull();
    expect(post.answers).toHaveLength(1);
    expect(post.answers[0]).toMatchObject({
      id: 'a1',
      authorName: '몰라몰라 자문의',
      isDentist: true,
      doctorId: null,
    });
  });
});
