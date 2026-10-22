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

/** 시드가 만드는 상담 8건 (docs §12.13-C). 다른 스펙이 만든 행과 섞이지 않게 범위를 좁힌다. */
const SEED_CONSULT_IDS = ['cr1', 'cr2', 'cr3', 'cr4', 'cr5', 'cr6', 'cr7', 'cr8'];

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

  it('fixture 의 id 가 그대로 살아 있다 (h1 / d1 / cr1 / q1 / g1 / p1 / r1)', async () => {
    const [hospital, doctor, consult, post, guide, promotion, review] = await Promise.all([
      prisma.hospital.findUnique({ where: { id: 'h1' } }),
      prisma.doctor.findUnique({ where: { id: 'd1' } }),
      prisma.consultRequest.findUnique({ where: { id: 'cr1' } }),
      prisma.qaPost.findUnique({ where: { id: 'q1' } }),
      prisma.guide.findUnique({ where: { id: 'g1' } }),
      prisma.promotion.findUnique({ where: { id: 'p1' } }),
      prisma.review.findUnique({ where: { id: 'r1' } }),
    ]);

    expect(hospital?.name).toBe('강남 스마일 치과');
    expect(doctor?.name).toBe('김민준');
    expect(consult?.status).toBe('new');
    expect(post?.title).toContain('임플란트');
    expect(guide).not.toBeNull();
    expect(promotion?.salePrice).toBe(1290000);
    expect(review?.rating).toBe(5);
  });

  it('★ 알림 id 는 이벤트에서 파생된다 — 옛 notif1~notif7 은 사라졌다 (요청서 15)', async () => {
    const legacy = await prisma.notification.count({
      where: { id: { in: ['notif1', 'notif2', 'notif3', 'notif4', 'notif5', 'notif6', 'notif7'] } },
    });
    const intake = await prisma.notification.findUnique({ where: { id: 'ntf-cr1-0' } });

    expect(legacy).toBe(0);
    expect(intake).toMatchObject({
      audience: 'admin',
      type: 'consult-status',
      consultStatus: 'new',
      title: '새로운 상담 신청',
      message: '김민준님이 상담을 신청했어요',
      relatedType: 'consult_request',
      relatedId: 'cr1',
      hospitalId: 'h1',
    });
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

  it('상담 8건에 신청자 계정이 붙어 있고 이력이 접수 행으로 시작한다', async () => {
    const consults = await prisma.consultRequest.findMany({
      // **시드가 만든 8건만 본다.** 같은 실행의 상담 e2e 가 상담을 더 만들기 때문이다
      // (테스트 DB 는 실행당 한 번만 새로 만든다 — docs §8.7). 계정 단정이 가입 e2e 를
      // 걸러 내는 것과 같은 이유다.
      where: { id: { in: SEED_CONSULT_IDS } },
      // 동일 timestamp 의 순서가 DB 마다 다르지 않게 타이브레이커를 둔다 (docs §7.5)
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { user: true, statusChanges: { orderBy: { changedAt: 'asc' } }, memos: true },
    });

    expect(consults).toHaveLength(8);

    for (const consult of consults) {
      expect(consult.userId).toBeTruthy();
      expect(consult.user.role).toBe('user');
      // 폼 스냅샷 이름과 계정 이름이 시드에서는 일치한다
      expect(consult.user.name).toBe(consult.name);
      // 번호 검색이 거는 정규화 컬럼 (요청서 15)
      expect(consult.phoneDigits).toBe(consult.phone.replace(/\D/g, ''));
      expect(consult.statusChanges.length).toBeGreaterThan(0);
      // 첫 이력은 항상 접수 행이다 — 'new' · 신청 시각 · 행위자 없음 · 알림 없음
      expect(consult.statusChanges[0]).toMatchObject({
        event: 'status_change',
        status: 'new',
        changedByUserId: null,
        notificationId: null,
      });
      expect(consult.statusChanges[0].changedAt.getTime()).toBe(consult.createdAt.getTime());
      // 마지막 이력의 상태가 현재 상태다 (일시 변경 행도 그 시점 상태를 들고 있다)
      expect(consult.statusChanges.at(-1)?.status).toBe(consult.status);

      for (const change of consult.statusChanges.slice(1)) {
        // 접수 뒤의 모든 이벤트는 처리자와 환자 알림을 남긴다 (docs §12.13-D 규칙 2)
        expect(change.changedByUserId).not.toBeNull();
        expect(change.notificationId).not.toBeNull();
      }
    }

    // 메모 2건. **`author_user_id` 가 채워진 메모가 처음 생겼다** (예전 시드는 전부 null)
    const cr3 = consults.find((row) => row.id === 'cr3');
    const cr5 = consults.find((row) => row.id === 'cr5');

    expect(cr3?.memos.map((memo) => memo.id)).toEqual(['memo-cr3-1']);
    expect(cr3?.memos[0].authorUserId).toBe('u-admin-h1');
    expect(cr5?.memos.map((memo) => memo.id)).toEqual(['memo-cr5-1']);
  });

  it('★ 새 샘플이 보증하는 것 — 어느 날 시드해도 숫자가 0 이 아니다 (docs §12.13-C)', async () => {
    const seedToday = new Date(`${SEED_TODAY}T00:00:00.000Z`);
    // KST 달력일의 경계. 시드의 `오늘` 도 KST 다 (요청서 15).
    const todayStart = new Date(`${SEED_TODAY}T00:00:00.000+09:00`);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const seeded = { id: { in: SEED_CONSULT_IDS }, hospitalId: 'h1' };
    const todayNew = await prisma.consultRequest.count({
      where: { ...seeded, createdAt: { gte: todayStart, lt: tomorrowStart } },
    });
    const pending = await prisma.consultRequest.count({
      where: { ...seeded, status: { in: ['new', 'contacted'] } },
    });
    // `지연` = `new` 이면서 접수 24시간 경과. cr2(D−3)가 그 자리다.
    const delayed = await prisma.consultRequest.count({
      where: {
        ...seeded,
        status: 'new',
        createdAt: { lt: new Date(seedToday.getTime() - 24 * 60 * 60 * 1000) },
      },
    });
    const visitingToday = await prisma.consultRequest.count({
      where: { ...seeded, status: 'booked', visitAt: { gte: todayStart, lt: tomorrowStart } },
    });

    expect(todayNew).toBe(3); // cr1 · cr4 · cr5 (전부 오프셋 0)
    expect(pending).toBe(3); // cr1 · cr2 · cr6
    expect(delayed).toBe(1); // cr2
    expect(visitingToday).toBe(1); // cr3 (오늘 14:00). cr4 는 `visited` 라 빠진다

    // 상태 5개가 모두 적어도 한 건씩 있다 — 깔때기의 다섯 숫자가 0 이 되지 않는다.
    for (const status of ['new', 'contacted', 'booked', 'visited', 'cancelled']) {
      expect(
        await prisma.consultRequest.count({ where: { id: { in: SEED_CONSULT_IDS }, status } }),
      ).toBeGreaterThan(0);
    }
  });

  it('★ 새로 생긴 칸들이 채워져 있다 — 확정 일시 · 동의 기록 · 취소 사유 · 일시 변경', async () => {
    const [cr2, cr3, cr5, cr8] = await Promise.all([
      prisma.consultRequest.findUniqueOrThrow({ where: { id: 'cr2' } }),
      prisma.consultRequest.findUniqueOrThrow({ where: { id: 'cr3' } }),
      prisma.consultRequest.findUniqueOrThrow({
        where: { id: 'cr5' },
        include: { statusChanges: true },
      }),
      prisma.consultRequest.findUniqueOrThrow({
        where: { id: 'cr8' },
        include: { statusChanges: { orderBy: { changedAt: 'asc' } } },
      }),
    ]);

    // 동의 기록 — 둘은 함께 채워지거나 함께 null 이다 (앱 불변식).
    expect(cr3.thirdPartyConsentAgreedAt).not.toBeNull();
    expect(cr3.thirdPartyConsentNoticeVersion).toBe('2026-10-12');
    expect(cr2.thirdPartyConsentAgreedAt).toBeNull();
    expect(cr2.thirdPartyConsentNoticeVersion).toBeNull();

    // 취소가 확정 일시를 비우고, 사유는 이력 행에만 남는다.
    expect(cr5.visitAt).toBeNull();
    expect(cr5.statusChanges.find((row) => row.status === 'cancelled')?.cancelReason).toBe('duplicate');

    // 일시 변경 1건 — 이력 행은 `booked` 상태를 그대로 들고 있다.
    const reschedules = cr8.statusChanges.filter((row) => row.event === 'reschedule');

    expect(reschedules).toHaveLength(1);
    expect(reschedules[0].status).toBe('booked');
    expect(cr8.visitAt?.getTime()).toBe(reschedules[0].visitAt?.getTime());
    // 직전 `booked` 행의 스냅샷은 그때의 약속 그대로다 (뒤에 바뀌어도 고쳐지지 않는다).
    expect(cr8.statusChanges[2].visitAt?.getTime()).not.toBe(cr8.visitAt?.getTime());
  });

  it('알림이 계정별로 갈라지고, 문구는 순수 함수가 만든 그대로다', async () => {
    // 상태 변경 알림은 그 상담의 신청자 **한 명**에게만 간다.
    const booked = await prisma.notification.findUniqueOrThrow({
      where: { id: 'ntf-cr3-2' },
      include: { recipients: true },
    });

    expect(booked.audience).toBe('user');
    expect(booked.consultStatus).toBe('booked');
    expect(booked.title).toBe('상담 예약이 확정됐어요');
    expect(booked.message).toContain('강남 스마일 치과 · ');
    expect(booked.message).toContain(' 방문. 변경이 필요하면 병원에 전화해 주세요');
    expect(booked.recipients.map((row) => row.userId)).toEqual(['u-seed-3']);
    expect(booked.recipients[0].readAt).toBeNull();

    // 일시 변경 알림의 제목만 다르다 (`consult_status` 는 그대로 `booked`).
    const rescheduled = await prisma.notification.findUniqueOrThrow({ where: { id: 'ntf-cr8-3' } });

    expect(rescheduled.title).toBe('예약 일시가 바뀌었어요');
    expect(rescheduled.consultStatus).toBe('booked');

    // 접수 알림은 담당 병원 담당자에게만 (cr7 → h2).
    const intakeH2 = await prisma.notification.findUniqueOrThrow({
      where: { id: 'ntf-cr7-0' },
      include: { recipients: true },
    });

    expect(intakeH2.hospitalId).toBe('h2');
    expect(intakeH2.recipients.map((row) => row.userId)).toEqual(['u-admin-h2']);

    // 환자 A(u-seed-1)와 환자 B(u-seed-2)가 **다른 건수**를 받는다 — 둘 다 "연락중" 하나뿐이면
    // 화면이 섞여 보여도 눈으로 알아챌 수 없다 (docs §12.13-E).
    //
    // 읽음 상태가 아니라 **수신 행의 수**를 센다. 같은 실행의 알림 e2e 가 읽음 처리를
    // 눌러 보기 때문이다 — 그쪽이 확인하는 것이 정확히 "읽음은 계정별" 이다.
    const consultRowsOf = async (userId: string): Promise<number> =>
      prisma.notificationRecipient.count({
        where: { userId, notification: { id: { startsWith: 'ntf-cr' } } },
      });

    expect(await consultRowsOf('u-seed-1')).toBe(3); // cr8 의 연락중 · 예약확정 · 일시 변경
    expect(await consultRowsOf('u-seed-2')).toBe(1); // cr6 의 연락중
  });

  it('공지 3건은 fan-out 되고 읽음으로 시작한다', async () => {
    const announcements = await prisma.notification.findMany({
      where: { id: { in: ['ntf-event-1', 'ntf-system-1', 'ntf-system-2'] } },
      include: { recipients: true },
      orderBy: { id: 'asc' },
    });

    expect(announcements).toHaveLength(3);

    for (const announcement of announcements) {
      // 상담과 무관한 알림이라 `consult_status`·`related_*` 가 전부 null 이다.
      expect(announcement.consultStatus).toBeNull();
      expect(announcement.relatedType).toBeNull();
      expect(announcement.relatedId).toBeNull();
      expect(announcement.recipients.every((row) => row.readAt !== null)).toBe(true);
    }

    expect(announcements.find((row) => row.id === 'ntf-event-1')?.recipients).toHaveLength(7);
    expect(announcements.find((row) => row.id === 'ntf-system-2')?.recipients).toHaveLength(11);
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
