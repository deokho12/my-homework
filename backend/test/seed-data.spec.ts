import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { procedureCategories as seedCategories } from '../prisma/seed/data/procedure-categories';
import { procedures as seedProcedures } from '../prisma/seed/data/procedures';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * 스모크 테스트 2 — 시드된 데이터를 실제로 읽는다.
 *
 * 확인하는 것은 "행이 있다" 가 아니라 **변환이 맞게 됐는가** 다. fixture 의
 * 배열·JSON 이 테이블로 갈라졌기 때문에, 그 변환이 틀리면 여기서 걸린다.
 *
 * DB 는 `test/global-setup.ts` 가 매 실행마다 새로 만들어 시드한 `prisma/test.db`
 * 다 (docs §8.7). 개발 DB 는 읽지도 쓰지도 않는다.
 */

/**
 * 시드가 쓴 "오늘". 날짜 단정의 기준은 **실행 시각이 아니라 이 값**이다.
 *
 * `test/global-setup.ts` 가 한 번 정해 환경변수로 내려준 값을 그대로 읽는다 — 여기서
 * 다시 계산하면 같은 판정이 두 곳이 된다. 기본 실행이면 오늘 날짜이고,
 * `SEED_TODAY=2027-03-01 npm run test:run` 처럼 고정해서 돌릴 때만 실행 시각과 갈라진다.
 * 그때 단정해야 하는 것은 "샘플이 기준일 주위에 놓였는가" 다 (docs §8.5).
 */
const SEED_TODAY = (() => {
  const value = process.env.SEED_TODAY;
  if (!value) {
    throw new Error('SEED_TODAY 가 없습니다 — test/global-setup.ts 가 정해 줘야 합니다.');
  }
  return value;
})();

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

  it('시술 마스터가 31종이고 sort_order 가 시드 데이터 배열 순서다', async () => {
    const rows = await prisma.procedure.findMany({ orderBy: { sortOrder: 'asc' } });

    expect(rows).toHaveLength(31);
    expect(rows.map((row) => row.id)).toEqual(seedProcedures.map((procedure) => procedure.id));
    expect(rows[0]).toMatchObject({ id: 'implant-general', name: '일반 임플란트', sortOrder: 0 });
    expect(rows.at(-1)).toMatchObject({ id: 'general-extraction', sortOrder: 30 });
  });

  it('시술 분야가 9종이고 모든 시술에 분야가 있다', async () => {
    const categories = await prisma.procedureCategory.findMany({ orderBy: { sortOrder: 'asc' } });
    const procedures = await prisma.procedure.findMany({ orderBy: { sortOrder: 'asc' } });

    expect(categories.map((row) => row.id)).toEqual(seedCategories.map((category) => category.id));
    expect(categories[0]).toMatchObject({ id: 'implant', name: '임플란트', sortOrder: 0 });

    const categoryIds = new Set(categories.map((row) => row.id));

    expect(procedures.every((row) => categoryIds.has(row.categoryId))).toBe(true);
    // 분야 배정도 시드 데이터 파일과 같아야 한다 — 화면이 31개를 묶는 유일한 근거다
    expect(procedures.map((row) => `${row.id}:${row.categoryId}`)).toEqual(
      seedProcedures.map((procedure) => `${procedure.id}:${procedure.categoryId}`),
    );
  });

  it('옛 시술 id 6개가 남아 있지 않다 — 자식 행도 마찬가지다', async () => {
    const legacyIds = ['implant', 'orthodontics', 'cavity', 'gum-disease', 'tmj', 'botox'];

    expect(await prisma.procedure.count({ where: { id: { in: legacyIds } } })).toBe(0);
    expect(await prisma.hospitalProcedure.count({ where: { procedureId: { in: legacyIds } } })).toBe(0);
    expect(await prisma.doctorProcedure.count({ where: { procedureId: { in: legacyIds } } })).toBe(0);
    expect(await prisma.hospitalSponsorship.count({ where: { procedureId: { in: legacyIds } } })).toBe(0);
  });

  it('스케일링·예방 분야는 등록한 병원이 없다 — 시드가 넣지 않는다 (요청서 14 확인 항목 1·4)', async () => {
    const rows = await prisma.hospitalProcedure.count({
      where: { procedure: { categoryId: 'prevention' } },
    });

    expect(rows).toBe(0);
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
      ['bruxism-botox', 'implant-general', 'laminate'].sort(),
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

  it('광고 5행이 전부 기준일을 포함한다 — 시드가 언제 돌아도 스폰서 배치가 보인다', async () => {
    const all = await prisma.hospitalSponsorship.findMany({ orderBy: { id: 'asc' } });
    const active = await prisma.hospitalSponsorship.findMany({
      where: { startDate: { lte: SEED_TODAY }, endDate: { gte: SEED_TODAY } },
      orderBy: { id: 'asc' },
    });

    // ★ 2026-09-15 에 마지막 fixture 광고가 끝나 이 테스트가 빨개진 적이 있다.
    //   §8.5 의 "기준일 하나로 통째로 민다" 가 그것을 구조적으로 막는다 —
    //   fixture 창 4개가 모두 FIXTURE_TODAY 를 품고 있으므로, 같은 값을 더한 뒤에도
    //   반드시 SEED_TODAY 를 품는다. 그래서 "진행중 = 전부" 다.
    expect(all).toHaveLength(5);
    expect(active).toHaveLength(5);

    // (병원 × 시술) 로 풀린 모양 — h5 만 카테고리 2개라 행이 2개다
    expect(active.map((row) => `${row.hospitalId}:${row.procedureId}`)).toEqual([
      'h2:laminate',
      'h3:implant-general',
      'h5:gum-treatment',
      'h5:implant-general',
      'h6:whitening',
    ]);

    // h1 은 평점 1위인데 광고를 사지 않은 대조군이다 (fixture 주석)
    expect(all.some((row) => row.hospitalId === 'h1')).toBe(false);
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

  it('상담이 기준일 쪽으로 옮겨져 최근 3일 안에 접수된 건이 있다', async () => {
    // 예전에는 "이번 **달** 신규 상담이 0 이 아니다" 였다. 그 단정은 **매월 1일에
    // 반드시 실패한다** — 가장 최근 상담(cr6)이 SEED_TODAY-1일, 즉 지난 달이기 때문이다
    // (docs §8.5 의 "'이번 달' 은 SEED_TODAY 의 일(日)에 달려 있다"). 어느 날 돌려도
    // 참인 것만 고정한다: 가장 최근 상담은 기준일 하루 전이므로 3일 창에 반드시 든다.
    const seedToday = new Date(`${SEED_TODAY}T00:00:00.000Z`);
    const threeDaysAgo = new Date(seedToday.getTime() - 3 * 24 * 60 * 60 * 1000);

    const recent = await prisma.consultRequest.count({ where: { createdAt: { gte: threeDaysAgo } } });
    const pending = await prisma.consultRequest.count({ where: { status: 'new' } });

    expect(recent).toBeGreaterThan(0);
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
    // **시드가 만든 계정만 본다.** 테스트 DB 는 매 실행마다 새로 만들므로(docs §8.7)
    // 개발 중에 화면에서 가입해 본 계정이 더는 섞이지 않는다 — 그 이유로 걸던 필터는
    // 아니다. 그래도 남겨 둔다: 같은 실행 안에서 가입 e2e(`auth-accounts.e2e.spec.ts`)가
    // 만드는 계정이 이 파일보다 먼저 돌 수 있고, 그건 시드의 결함이 아니다.
    // 시드 계정은 도메인이 `.example` 이라 그 행들과 구분된다.
    const users = (await prisma.user.findMany({ orderBy: { id: 'asc' } })).filter((user) =>
      user.email.endsWith('@molarmolar.example'),
    );

    expect(users).toHaveLength(19);
    expect(users.filter((u) => u.role === 'operator')).toHaveLength(1);
    expect(users.filter((u) => u.role === 'hospital_admin')).toHaveLength(11);
    expect(users.filter((u) => u.role === 'user')).toHaveLength(7);

    for (const user of users) {
      // 이메일은 정규화되어 저장된다 (docs §3.9)
      expect(user.email).toBe(user.email.trim().toLowerCase());
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
