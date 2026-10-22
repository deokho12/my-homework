/**
 * =============================================================================
 * 몰라몰라 시드 — prisma/seed/data/*.ts (+ 남은 프론트 fixture 3개) → SQLite
 * =============================================================================
 *
 * 실행:  npm run prisma:seed        (= prisma db seed)
 * 재실행: 안전하다. **모든 쓰기가 id 기준 upsert** 다 (docs/database/README.md §8.1 원칙 2).
 *
 * 설계 규칙
 * ---------------------------------------------------------------------------
 * 1. 원본의 id 를 그대로 쓴다 — `h1`, `d1`, `cr1`, `q1`, `a1`, `g1`, `p1`, `r1`,
 *    `memo-cr3-1`. 화면 문서와 예시 URL, QA 시나리오가 이 값에 의존한다 (docs §8.1 원칙 1).
 *    **예외 하나: 알림 id 는 버렸다** (`notif1`~`notif7`). 알림은 처리 이벤트에서
 *    파생되고(`ntf-{상담id}-{i}`) 그 id 를 가리키는 URL·화면이 없다 (docs §12.13-D).
 * 2. fixture 에 id 가 없던 자식 행(사진·태그·경력·진료시간…)은 **결정적(deterministic) id**
 *    를 만든다. 그래야 재실행이 중복을 만들지 않는다. 규칙:
 *
 *      hp-{hospitalId}-{procedureId}     hospital_procedures
 *      himg-{hospitalId}-{i}             hospital_images
 *      htag-{hospitalId}-{i}             hospital_tags
 *      hev-{hospitalId}-{i}              hospital_event_notes
 *      bh-{hospitalId}-{dayOfWeek}       business_hours
 *      sp-{hospitalId}-{procedureId}     hospital_sponsorships
 *      ha-{userId}-{hospitalId}          hospital_admins
 *      dp-{doctorId}-{procedureId}       doctor_procedures
 *      dc-{doctorId}-{i}                 doctor_careers
 *      dv-{doctorId}                     doctor_verifications
 *      csc-{consultId}-{i}               consult_status_changes
 *      ntf-{consultId}-{i}               notifications (상담 이벤트에서 파생)
 *      rp-{reviewId}-{i}                 review_photos
 *      gh-{guideId}-{hospitalId}         guide_hospitals
 *      nr-{notificationId}-{userId}      notification_recipients
 *
 *    주의: 이 방식은 "행이 사라지는" 변경(fixture 에서 사진 1장을 지우는 등)을
 *    반영하지 않는다. fixture 의 구조가 바뀌면 `npm run prisma:reset` 으로
 *    다시 만드세요.
 * 3. 날짜 정책은 prisma/seed/dates.ts 한 곳에 있다 (docs §8.4, §8.5).
 * 4. 비밀번호 평문은 이전하지 않는다. 개발용 계정을 새로 만들고 `SEED_PASSWORD`
 *    를 bcrypt(12) 로 해시한다 (docs §7.4, §8.3). prisma/seed/accounts.ts
 * 5. `@default(now())` 를 쓰지 않기로 했으므로(docs §3.6) 모든 타임스탬프를
 *    시드가 UTC 로 명시 세팅한다.
 */
import { PrismaClient } from '@prisma/client';

import { phoneDigits } from '../src/consult/masking';
import { adminConsultNotificationText, consultNotificationText } from '../src/consult/notification-text';
import { hospitalAdminAccount, OPERATOR, resolvePasswordHash, userAccount } from './seed/accounts';
import type { SeedAccount } from './seed/accounts';
import { createSeedClock, PROMOTION_WINDOWS, resolveSeedToday, toDateString } from './seed/dates';
import type { SeedClock } from './seed/dates';
import type { SeedMoment } from './seed/data/consult-requests';
import {
  announcements,
  consultApplicants,
  consultRequests,
  doctors,
  guides,
  hospitals,
  procedureCategories,
  procedures,
  promotions,
  qaPosts,
  reviews,
} from './seed/fixtures';
import { legalDocuments } from './seed/legal';

const prisma = new PrismaClient();

/** business_hours.day_of_week 는 '월' 문자열이 아니라 1~7 정수다 (docs §3.2). */
const DAY_LABEL_TO_NUMBER: Record<string, number> = {
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
  일: 7,
};

/** `*_normalized` 컬럼 규칙: lower(trim(원본)) (docs §3.9). */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** `{ day, time }`(KST) → UTC Date. 상담·알림 샘플의 **유일한 날짜 통로**다 (docs §12.13-B). */
function moment(clock: SeedClock, value: SeedMoment): Date {
  return clock.seoulAt(value.day, value.time);
}

function dayOfWeek(label: string): number {
  const value = DAY_LABEL_TO_NUMBER[label.trim()];

  if (value === undefined) {
    throw new Error(`알 수 없는 요일 라벨: '${label}' (월~일 이어야 합니다)`);
  }

  return value;
}

async function main(): Promise<void> {
  const seedToday = resolveSeedToday(process.env.SEED_TODAY);
  // fixture 날짜는 전부 이 시계를 거친다 (docs §8.5 — 기준일 하나로 통째로 민다)
  const clock = createSeedClock(seedToday);
  const shiftDays = Math.round(clock.shiftMs / (24 * 60 * 60 * 1000));
  const now = new Date();
  const passwordHash = await resolvePasswordHash(process.env.SEED_PASSWORD);

  console.log('─'.repeat(78));
  console.log(
    `시드 시작  SEED_TODAY=${toDateString(seedToday)}  shift=${shiftDays >= 0 ? '+' : '−'}${Math.abs(shiftDays)}일  (실행 시각 ${now.toISOString()})`,
  );
  console.log('─'.repeat(78));

  // ===========================================================================
  // 1. 시술 분야 9종 + 시술 마스터 31종 — sort_order = 배열 순서
  //    **분야를 먼저** 넣는다 — `procedures.category_id` 가 FK 다 (docs §17.8).
  // ===========================================================================
  for (const [index, category] of procedureCategories.entries()) {
    const data = { name: category.name, description: category.description, sortOrder: index };

    await prisma.procedureCategory.upsert({
      where: { id: category.id },
      create: { id: category.id, ...data },
      update: data,
    });
  }
  console.log(`  procedure_categories      ${procedureCategories.length}`);

  for (const [index, procedure] of procedures.entries()) {
    const data = {
      name: procedure.name,
      emoji: procedure.emoji,
      shortDescription: procedure.shortDescription,
      description: procedure.description,
      sortOrder: index,
      categoryId: procedure.categoryId,
    };

    await prisma.procedure.upsert({
      where: { id: procedure.id },
      create: { id: procedure.id, ...data },
      update: data,
    });
  }
  console.log(`  procedures                ${procedures.length}`);

  // ===========================================================================
  // 2. 계정 — 운영자 1 + 병원 담당자 11 + 사용자 7 (fixture 에 없는 데이터)
  // ===========================================================================
  // ★ 신청자 계정은 **명시 목록**이다 (docs §12.13-E). 예전에는 상담 건수만큼 만들었는데
  //   (`consultRequests.map(...)`, 상담 1건 = 계정 1개), 한 사람이 두 병원에 신청하는
  //   샘플(cr1·cr8)이 생기면서 그 1:1 가정이 깨졌다. id 체계와 이름은 그대로다.
  const applicantAccounts: SeedAccount[] = consultApplicants.map((applicant) =>
    userAccount(applicant.index, applicant.name),
  );
  const applicantById = new Map(consultApplicants.map((applicant) => [applicant.index, applicant]));
  const adminAccounts: SeedAccount[] = hospitals.map((hospital) =>
    hospitalAdminAccount(hospital.id, hospital.name),
  );
  const accounts: SeedAccount[] = [OPERATOR, ...adminAccounts, ...applicantAccounts];

  /** 상담 → 신청자 계정 id. 상담이 `applicantIndex` 로 가리킨다. */
  const consultApplicantId = new Map<string, string>(
    consultRequests.map((consult) => [consult.id, `u-seed-${consult.applicantIndex}`]),
  );
  const hospitalNameById = new Map(hospitals.map((hospital) => [hospital.id, hospital.name]));

  for (const account of accounts) {
    const data = {
      // 이메일은 항상 trim + lower 로 정규화해서 저장한다 (docs §3.9)
      email: normalize(account.email),
      name: account.name,
      provider: 'email',
      role: account.role,
      passwordHash,
      passwordSalt: null,
      updatedAt: now,
    };

    await prisma.user.upsert({
      where: { id: account.id },
      // createdAt 은 최초 1회만. 재실행이 계정 생성 시각을 바꾸지 않게 한다.
      create: { id: account.id, ...data, createdAt: now },
      update: data,
    });
  }
  console.log(`  users                     ${accounts.length}`);

  // ===========================================================================
  // 3. 병원 + 자식 테이블 6개
  // ===========================================================================
  let hospitalProcedureCount = 0;
  let hospitalImageCount = 0;
  let hospitalTagCount = 0;
  let hospitalEventNoteCount = 0;
  let businessHourCount = 0;
  let sponsorshipCount = 0;

  for (const hospital of hospitals) {
    const data = {
      name: hospital.name,
      nameNormalized: normalize(hospital.name),
      specialty: hospital.specialty,
      region: hospital.region,
      address: hospital.address,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      thumbnail: hospital.thumbnail,
      introduction: hospital.introduction,
      directions: hospital.directions,
      // PriceRange JSON → 실 컬럼 2개 (원 단위 Int)
      priceMin: hospital.priceRange.min,
      priceMax: hospital.priceRange.max,
      // 비정규화 표시값. 실제 집계와 무관하다 (docs §4)
      rating: hospital.rating,
      reviewCount: hospital.reviewCount,
      consultCount: hospital.consultCount,
      consultAvailable: hospital.consultAvailable,
      isOneDay: hospital.isOneDay,
      isRecommended: hospital.isRecommended,
      // HospitalFeatures JSON → 실 boolean 6개 (docs §3.3)
      featureCoordinator: hospital.features.coordinator,
      featurePainlessAnesthesia: hospital.features.painlessAnesthesia,
      featureDigitalCare: hospital.features.digitalCare,
      featureParking: hospital.features.parking,
      featureNightConsult: hospital.features.nightConsult,
      featureCctv: hospital.features.cctv,
      updatedAt: now,
    };

    await prisma.hospital.upsert({
      where: { id: hospital.id },
      create: { id: hospital.id, ...data, createdAt: now },
      update: data,
    });

    // 취급 시술 (배열 → 조인 테이블)
    for (const procedureId of hospital.procedureIds) {
      const id = `hp-${hospital.id}-${procedureId}`;

      await prisma.hospitalProcedure.upsert({
        where: { id },
        create: { id, hospitalId: hospital.id, procedureId },
        update: { hospitalId: hospital.id, procedureId },
      });
      hospitalProcedureCount += 1;
    }

    // 상세 사진 캐러셀
    for (const [index, url] of hospital.images.entries()) {
      const id = `himg-${hospital.id}-${index}`;

      await prisma.hospitalImage.upsert({
        where: { id },
        create: { id, hospitalId: hospital.id, url, sortOrder: index },
        update: { url, sortOrder: index },
      });
      hospitalImageCount += 1;
    }

    // 태그 (표시용 원본 + 정규화 값)
    for (const [index, tag] of hospital.tags.entries()) {
      const id = `htag-${hospital.id}-${index}`;

      await prisma.hospitalTag.upsert({
        where: { id },
        create: { id, hospitalId: hospital.id, tag, tagNormalized: normalize(tag) },
        update: { tag, tagNormalized: normalize(tag) },
      });
      hospitalTagCount += 1;
    }

    // '진행중인 이벤트' 자유 문구 (가격 있는 할인은 promotions)
    for (const [index, content] of hospital.events.entries()) {
      const id = `hev-${hospital.id}-${index}`;

      await prisma.hospitalEventNote.upsert({
        where: { id },
        create: { id, hospitalId: hospital.id, content, sortOrder: index },
        update: { content, sortOrder: index },
      });
      hospitalEventNoteCount += 1;
    }

    // 진료시간 — '월' → 1
    for (const entry of hospital.businessHours) {
      const dow = dayOfWeek(entry.day);
      const id = `bh-${hospital.id}-${dow}`;
      const payload = { hours: entry.hours, isClosed: entry.isClosed ?? false };

      await prisma.businessHour.upsert({
        where: { id },
        create: { id, hospitalId: hospital.id, dayOfWeek: dow, ...payload },
        update: payload,
      });
      businessHourCount += 1;
    }

    // 광고 캠페인 — 광고 필드 5개를 (병원 × 시술) 행으로 푼다 (docs §5.10).
    // isSponsored=false 인 병원은 행을 만들지 않는다 (h1 이 그 대조군).
    // 기간 두 개는 §8.5 의 이동 규칙을 거친다 — fixture 값(2026-07~09)을 그대로 넣으면
    // 그 날이 지난 뒤 광고가 전부 사라진다 (실제로 2026-09-15 에 그렇게 됐다).
    if (hospital.isSponsored && hospital.sponsoredStartDate && hospital.sponsoredEndDate) {
      const startDate = clock.day(hospital.sponsoredStartDate);
      const endDate = clock.day(hospital.sponsoredEndDate);

      // 시드 **입력** 점검이다. fixture 창이 FIXTURE_TODAY 를 품지 않게 바뀌면
      // 민 뒤에도 기준일을 품지 못해 "광고가 언제 시드해도 보인다"(§8.5)가 깨진다.
      // 서버의 노출 판정(`src/hospital/sponsorship.ts`, KST 날짜 기준)을 복제한 것이
      // 아니다 — 저쪽은 요청 시점에 행을 걸러 내는 규칙이고, 이쪽은 넣는 값이
      // 규칙을 만족하는지 보는 검사다. 둘이 같은 판정을 두 번 하는 것이 아니다.
      const today = toDateString(clock.today);

      if (startDate > today || endDate < today) {
        throw new Error(
          `병원 '${hospital.id}' 의 광고 기간이 기준일을 포함하지 않습니다 ` +
            `(${startDate} ~ ${endDate}, SEED_TODAY=${today}). fixture 창이 ` +
            `FIXTURE_TODAY 를 품도록 고치세요 — docs/database/README.md §8.5.`,
        );
      }

      for (const procedureId of hospital.sponsoredCategories) {
        const id = `sp-${hospital.id}-${procedureId}`;
        const payload = {
          rank: hospital.sponsoredRank ?? 1,
          startDate,
          endDate,
        };

        await prisma.hospitalSponsorship.upsert({
          where: { id },
          create: { id, hospitalId: hospital.id, procedureId, ...payload, createdAt: now },
          update: payload,
        });
        sponsorshipCount += 1;
      }
    }
  }

  console.log(`  hospitals                 ${hospitals.length}`);
  console.log(`  hospital_procedures       ${hospitalProcedureCount}`);
  console.log(`  hospital_images           ${hospitalImageCount}`);
  console.log(`  hospital_tags             ${hospitalTagCount}`);
  console.log(`  hospital_event_notes      ${hospitalEventNoteCount}`);
  console.log(`  business_hours            ${businessHourCount}`);
  console.log(`  hospital_sponsorships     ${sponsorshipCount}`);

  // ===========================================================================
  // 4. 병원 담당자 연결 — "이 사람은 어느 병원의 담당자인가"
  //    (hospitals 를 먼저 넣어야 FK 가 성립한다)
  // ===========================================================================
  for (const account of adminAccounts) {
    const hospitalId = account.hospitalId;

    if (!hospitalId) continue;

    const id = `ha-${account.id}-${hospitalId}`;

    await prisma.hospitalAdmin.upsert({
      where: { id },
      create: { id, userId: account.id, hospitalId, createdAt: now },
      update: { userId: account.id, hospitalId },
    });
  }
  console.log(`  hospital_admins           ${adminAccounts.length}`);

  // ===========================================================================
  // 5. 전문의 + 주요 시술 + 경력 + 검수 이력
  // ===========================================================================
  // fixture 에 검수 날짜가 없다 → 시드가 만든다 (docs §8.4)
  const submittedAt = clock.fromToday(-7);
  const reviewedAt = clock.fromToday(-6);

  let doctorProcedureCount = 0;
  let doctorCareerCount = 0;

  for (const doctor of doctors) {
    // 전문의 배지 판정식이 성립하도록 승인 건에만 verified_specialty 를 채운다 (docs §5.8)
    const verifiedSpecialty = doctor.verificationStatus === 'approved' ? doctor.specialty : null;

    const data = {
      hospitalId: doctor.hospitalId,
      name: doctor.name,
      nameNormalized: normalize(doctor.name),
      title: doctor.title,
      specialty: doctor.specialty,
      photo: doctor.photo,
      rating: doctor.rating,
      reviewCount: doctor.reviewCount,
      consultCount: doctor.consultCount,
      yearsOfExperience: doctor.yearsOfExperience,
      isRecommended: doctor.isRecommended,
      certificateUrl: doctor.certificateUrl,
      verificationStatus: doctor.verificationStatus,
      rejectionReason: doctor.rejectionReason,
      verifiedSpecialty,
      updatedAt: now,
    };

    await prisma.doctor.upsert({
      where: { id: doctor.id },
      create: { id: doctor.id, ...data, createdAt: now },
      update: data,
    });

    for (const procedureId of doctor.procedureIds) {
      const id = `dp-${doctor.id}-${procedureId}`;

      await prisma.doctorProcedure.upsert({
        where: { id },
        create: { id, doctorId: doctor.id, procedureId },
        update: { doctorId: doctor.id, procedureId },
      });
      doctorProcedureCount += 1;
    }

    for (const [index, content] of doctor.career.entries()) {
      const id = `dc-${doctor.id}-${index}`;

      await prisma.doctorCareer.upsert({
        where: { id },
        create: { id, doctorId: doctor.id, content, sortOrder: index },
        update: { content, sortOrder: index },
      });
      doctorCareerCount += 1;
    }

    // 검수 이력 1행 — fixture 의 verificationStatus 로부터 만든다 (docs §8.3)
    const isPending = doctor.verificationStatus === 'pending';
    const verification = {
      submittedSpecialty: doctor.specialty,
      submittedCertificateUrl: doctor.certificateUrl,
      status: doctor.verificationStatus,
      rejectionReason: doctor.verificationStatus === 'rejected' ? doctor.rejectionReason : null,
      reviewedByUserId: isPending ? null : OPERATOR.id,
      reviewedAt: isPending ? null : reviewedAt,
    };
    const verificationId = `dv-${doctor.id}`;

    await prisma.doctorVerification.upsert({
      where: { id: verificationId },
      create: { id: verificationId, doctorId: doctor.id, ...verification, createdAt: submittedAt },
      update: { ...verification, createdAt: submittedAt },
    });
  }

  console.log(`  doctors                   ${doctors.length}`);
  console.log(`  doctor_procedures         ${doctorProcedureCount}`);
  console.log(`  doctor_careers            ${doctorCareerCount}`);
  console.log(`  doctor_verifications      ${doctors.length}`);

  // ===========================================================================
  // 6. 상담 신청 + 처리 이력 + 메모 + **그 이벤트가 만든 알림** (docs §12.13)
  //    날짜는 SEED_TODAY 기준 오프셋이다 (§8.4 쪽 — 밀 원본이 없는 새 데이터다).
  //
  //    알림을 여기서 함께 만드는 이유는 순서다: `consult_status_changes.notification_id`
  //    가 FK 라서 이력 행보다 알림 행이 **먼저** 있어야 한다. 런타임도 같은 순서다
  //    (`ConsultRepository.updateStatus` — 알림을 만들고 그 id 를 이력 행에 적는다).
  //
  //    문구는 **서버의 순수 함수를 불러서** 만든다. 문자열을 여기 적으면 문구를 다듬는 날
  //    시드와 런타임이 조용히 갈린다 (AGENTS.md).
  // ===========================================================================
  let statusChangeCount = 0;
  let memoCount = 0;
  let consultNotificationCount = 0;
  let recipientCount = 0;

  /** 알림 1행 + 수신자 N행. 재실행이 중복을 만들지 않도록 id 가 결정적이다. */
  async function upsertNotification(params: {
    id: string;
    audience: 'user' | 'admin';
    type: string;
    consultStatus: string | null;
    title: string;
    message: string;
    relatedType: string | null;
    relatedId: string | null;
    hospitalId: string | null;
    createdAt: Date;
    recipientIds: string[];
    readAt: Date | null;
  }): Promise<void> {
    const data = {
      audience: params.audience,
      type: params.type,
      consultStatus: params.consultStatus,
      title: params.title,
      message: params.message,
      relatedType: params.relatedType,
      relatedId: params.relatedId,
      hospitalId: params.hospitalId,
      createdAt: params.createdAt,
    };

    await prisma.notification.upsert({
      where: { id: params.id },
      create: { id: params.id, ...data },
      update: data,
    });

    for (const userId of params.recipientIds) {
      const id = `nr-${params.id}-${userId}`;

      await prisma.notificationRecipient.upsert({
        where: { id },
        create: { id, notificationId: params.id, userId, readAt: params.readAt },
        update: { userId, readAt: params.readAt },
      });
      recipientCount += 1;
    }
  }

  for (const consult of consultRequests) {
    const applicant = applicantById.get(consult.applicantIndex);
    const userId = consultApplicantId.get(consult.id);

    if (!applicant || !userId) {
      throw new Error(`상담 '${consult.id}' 의 신청자 계정을 찾지 못했습니다`);
    }

    const createdAt = moment(clock, consult.createdAt);
    const lastChange = consult.statusHistory.at(-1);
    const updatedAt = lastChange ? moment(clock, lastChange.at) : createdAt;
    const hospitalName = hospitalNameById.get(consult.hospitalId) ?? null;
    // 폼 입력값 스냅샷. 계정 이름과 다를 수 있지만(docs §4) 시드는 같게 둔다 —
    // 다르게 두면 "계정 이름과 폼 이름이 다른 것" 과 "시드가 틀린 것" 을 QA 가 구분할 수 없다.
    const name = applicant.name;

    const data = {
      userId,
      hospitalId: consult.hospitalId,
      doctorId: consult.doctorId,
      procedureId: consult.procedureId,
      name,
      phone: consult.phone,
      // 번호 검색이 거는 정규화 컬럼. 규칙은 서버와 **같은 함수**다 (docs §3.9, §12.5)
      phoneDigits: phoneDigits(consult.phone),
      preferredTime: consult.preferredTime,
      message: consult.message,
      status: consult.status,
      visitAt: consult.visitAt === null ? null : moment(clock, consult.visitAt),
      // 둘은 함께 채워지거나 함께 null 이다 (앱 불변식, docs §12.12).
      // null = 거절이 아니라 **동의 절차 도입 이전 접수**다.
      thirdPartyConsentAgreedAt: consult.thirdPartyConsentNoticeVersion === null ? null : createdAt,
      thirdPartyConsentNoticeVersion: consult.thirdPartyConsentNoticeVersion,
      createdAt,
      updatedAt,
    };

    await prisma.consultRequest.upsert({
      where: { id: consult.id },
      create: { id: consult.id, ...data },
      update: data,
    });

    for (const [index, change] of consult.statusHistory.entries()) {
      const changedAt = moment(clock, change.at);
      const changeVisitAt = change.visitAt === null ? null : moment(clock, change.visitAt);
      const notificationId = `ntf-${consult.id}-${index}`;
      const isIntake = index === 0;

      if (isIntake) {
        // 접수 알림은 `audience='admin'` 이다 — **환자 알림이 아니라서** 이력 행에 id 를
        // 적지 않는다 (docs §15.2-ⓑ). 수신자는 그 병원 담당자뿐이다(운영자는 받지 않는다).
        await upsertNotification({
          id: notificationId,
          audience: 'admin',
          type: 'consult-status',
          consultStatus: 'new',
          ...adminConsultNotificationText(name),
          relatedType: 'consult_request',
          relatedId: consult.id,
          hospitalId: consult.hospitalId,
          createdAt: changedAt,
          recipientIds: [`u-admin-${consult.hospitalId}`],
          readAt: null,
        });
      } else {
        await upsertNotification({
          id: notificationId,
          audience: 'user',
          type: 'consult-status',
          // 상태 변경이면 바뀐 뒤 상태, 일시 변경이면 `booked` — 어느 쪽이든 행의 `status` 다.
          consultStatus: change.status,
          ...consultNotificationText({
            event: change.event,
            status: change.status,
            visitAt: changeVisitAt?.toISOString() ?? null,
            cancelReason: change.cancelReason,
            hospitalName,
          }),
          relatedType: 'consult_request',
          relatedId: consult.id,
          // 사용자 알림에는 병원 id 를 채우지 않는다 — 그 칸은 관리자 알림함의 필터 키다.
          hospitalId: null,
          createdAt: changedAt,
          recipientIds: [userId],
          readAt: null,
        });
      }

      consultNotificationCount += 1;

      const id = `csc-${consult.id}-${index}`;
      const payload = {
        event: change.event,
        status: change.status,
        changedAt,
        changedByUserId:
          change.byAdminOfHospital === null ? null : `u-admin-${change.byAdminOfHospital}`,
        visitAt: changeVisitAt,
        cancelReason: change.cancelReason,
        // 접수 행만 null 이다. 나머지는 전부 채워져 관리자 상세에 `환자 알림 발송` 이 붙는다.
        notificationId: isIntake ? null : notificationId,
      };

      await prisma.consultStatusChange.upsert({
        where: { id },
        create: { id, consultRequestId: consult.id, ...payload },
        update: payload,
      });
      statusChangeCount += 1;
    }

    for (const memo of consult.memos) {
      const payload = {
        content: memo.content,
        createdAt: moment(clock, memo.at),
        // `author_user_id` 가 채워진 메모가 처음 생긴다 (예전 시드는 전부 null 이었다).
        authorUserId: `u-admin-${memo.byAdminOfHospital}`,
      };

      await prisma.consultMemo.upsert({
        where: { id: memo.id },
        create: { id: memo.id, consultRequestId: consult.id, ...payload },
        update: payload,
      });
      memoCount += 1;
    }
  }

  console.log(`  consult_requests          ${consultRequests.length}`);
  console.log(`  consult_status_changes    ${statusChangeCount}`);
  console.log(`  consult_memos             ${memoCount}`);

  // ===========================================================================
  // 7. 후기 + 사진
  // ===========================================================================
  let reviewPhotoCount = 0;

  for (const review of reviews) {
    const data = {
      hospitalId: review.hospitalId,
      procedureId: review.procedureId,
      authorName: review.authorName,
      rating: review.rating,
      content: review.content,
      createdAt: clock.at(review.createdAt),
    };

    await prisma.review.upsert({
      where: { id: review.id },
      create: { id: review.id, ...data },
      update: data,
    });

    for (const [index, url] of (review.photos ?? []).entries()) {
      const id = `rp-${review.id}-${index}`;

      await prisma.reviewPhoto.upsert({
        where: { id },
        create: { id, reviewId: review.id, url, sortOrder: index },
        update: { url, sortOrder: index },
      });
      reviewPhotoCount += 1;
    }
  }

  console.log(`  reviews                   ${reviews.length}`);
  console.log(`  review_photos             ${reviewPhotoCount}`);

  // ===========================================================================
  // 8. 프로모션 — fixture 에 없는 기간을 부여한다 (docs §8.4)
  //    4건 모두 SEED_TODAY 를 포함하는 창이라 '진행중' 으로 보인다.
  //    기간 만료 UI 를 QA 하려면 p3 의 end_date 를 과거로 바꿔 보면 된다.
  // ===========================================================================
  for (const promotion of promotions) {
    const window = PROMOTION_WINDOWS[promotion.id];

    if (!window) {
      throw new Error(
        `프로모션 '${promotion.id}' 의 기간이 prisma/seed/dates.ts 에 없습니다 ` +
          `(docs/database/README.md §8.4).`,
      );
    }

    const data = {
      hospitalId: promotion.hospitalId,
      procedureId: promotion.procedureId,
      title: promotion.title,
      originalPrice: promotion.originalPrice,
      salePrice: promotion.salePrice,
      badge: promotion.badge,
      startDate: toDateString(clock.fromToday(window.start)),
      endDate: toDateString(clock.fromToday(window.end)),
    };

    await prisma.promotion.upsert({
      where: { id: promotion.id },
      create: { id: promotion.id, ...data, createdAt: now },
      update: data,
    });
  }
  console.log(`  promotions                ${promotions.length}`);

  // ===========================================================================
  // 9. 시술 꿀팁 + 관련 병원
  // ===========================================================================
  let guideHospitalCount = 0;

  for (const guide of guides) {
    const data = {
      title: guide.title,
      summary: guide.summary,
      thumbnail: guide.thumbnail,
      procedureId: guide.procedureId,
      content: guide.content,
      author: guide.author,
      createdAt: clock.at(guide.createdAt),
    };

    await prisma.guide.upsert({
      where: { id: guide.id },
      create: { id: guide.id, ...data },
      update: data,
    });

    for (const [index, hospitalId] of (guide.relatedHospitals ?? []).entries()) {
      const id = `gh-${guide.id}-${hospitalId}`;

      await prisma.guideHospital.upsert({
        where: { id },
        create: { id, guideId: guide.id, hospitalId, sortOrder: index },
        update: { sortOrder: index },
      });
      guideHospitalCount += 1;
    }
  }

  console.log(`  guides                    ${guides.length}`);
  console.log(`  guide_hospitals           ${guideHospitalCount}`);

  // ===========================================================================
  // 10. 커뮤니티 질문 + 답변
  //     fixture 글은 작성자 계정이 없는 익명 글이다 → author_user_id = null,
  //     is_anonymous = true (docs §5.6). 새 글은 작성자를 반드시 채운다.
  // ===========================================================================
  let answerCount = 0;

  for (const post of qaPosts) {
    const createdAt = clock.at(post.createdAt);
    const data = {
      title: post.title,
      content: post.content,
      procedureId: post.procedureId,
      authorUserId: null,
      isAnonymous: true,
      viewCount: post.viewCount,
      createdAt,
      updatedAt: createdAt,
    };

    await prisma.qaPost.upsert({
      where: { id: post.id },
      create: { id: post.id, ...data },
      update: data,
    });

    for (const answer of post.answers) {
      const answeredAt = clock.at(answer.createdAt);
      const payload = {
        content: answer.content,
        authorUserId: null,
        // 계정이 없는 시드 답변의 표시 이름 스냅샷 ('몰라몰라 자문의' 등, docs §4)
        authorName: answer.authorName,
        isAnonymous: false,
        hospitalId: null,
        doctorId: null,
        // 시드 답변은 doctors 행이 없는데도 '치과의사 답변' 배지가 붙는다.
        // 그래서 is_dentist 가 별도 플래그로 남아 있다 (docs §4)
        isDentist: answer.isDentist,
        createdAt: answeredAt,
        updatedAt: answeredAt,
      };

      await prisma.qaAnswer.upsert({
        where: { id: answer.id },
        create: { id: answer.id, postId: post.id, ...payload },
        update: payload,
      });
      answerCount += 1;
    }
  }

  console.log(`  qa_posts                  ${qaPosts.length}`);
  console.log(`  qa_answers                ${answerCount}`);

  // ===========================================================================
  // 11. 공지 알림 3건 + 수신자 fan-out (docs §5.3, §12.13-D)
  //     상담 알림은 **6번에서 이미 만들었다** — 처리 이벤트에서 파생되기 때문이다.
  //     여기 남는 것은 상담과 무관한 공지뿐이고, 그 셋이 알림함의 나머지 아이콘 두 종류
  //     (`이벤트`·`안내`)와 **한 알림이 여러 계정에 꽂히는 경로**를 살려 둔다.
  //     공지는 전부 읽음이다 — 안 읽음 배지의 대상은 상담 알림 쪽이다.
  // ===========================================================================
  for (const announcement of announcements) {
    const createdAt = moment(clock, announcement.createdAt);
    const recipients =
      announcement.recipients === 'applicants'
        ? applicantAccounts.map((account) => account.id)
        : adminAccounts.map((account) => account.id);

    await upsertNotification({
      id: announcement.id,
      audience: announcement.audience,
      type: announcement.type,
      // 상담이 아니므로 null 이다 (`type='consult-status'` 행만 값을 적는다 — docs §15.1)
      consultStatus: null,
      title: announcement.title,
      message: announcement.message,
      relatedType: null,
      relatedId: null,
      hospitalId: null,
      createdAt,
      recipientIds: recipients,
      // 읽은 알림은 "도착 즉시 읽음" 으로 둔다 (별도 시각 정보가 없다).
      readAt: createdAt,
    });
  }

  console.log(`  notifications             ${consultNotificationCount + announcements.length}`);
  console.log(`  notification_recipients   ${recipientCount}`);

  // ===========================================================================
  // 12. 약관 3종 (docs §11.3)
  //     - effective_at 은 SEED_TODAY - 1일 (미래면 "지금 유효한 버전" 이 0건이 된다)
  //     - 본문은 자리표시자임이 화면에서 드러나는 문구다 (prisma/seed/legal.ts)
  //     - user_agreements 는 만들지 않는다: 동의하지 않은 동의 기록을 만들면 안 된다
  // ===========================================================================
  const legalEffectiveAt = clock.fromToday(-1);

  for (const document of legalDocuments) {
    const data = {
      slug: document.slug,
      version: document.version,
      title: document.title,
      content: document.content,
      requiresAgreement: document.requiresAgreement,
      effectiveAt: legalEffectiveAt,
    };

    await prisma.legalDocument.upsert({
      where: { id: document.id },
      // createdAt 은 최초 1회만. 재실행이 게시 시각을 바꾸지 않게 한다
      create: { id: document.id, ...data, createdAt: now },
      update: data,
    });
  }
  console.log(`  legal_documents           ${legalDocuments.length}`);

  // ===========================================================================
  // 13. 결과 확인 — 실제 DB 행 수를 다시 세서 출력한다
  //     (위 숫자는 "쓰기 시도 횟수", 아래는 "실제 남은 행")
  // ===========================================================================
  const counts = {
    procedures: await prisma.procedure.count(),
    users: await prisma.user.count(),
    hospital_admins: await prisma.hospitalAdmin.count(),
    hospitals: await prisma.hospital.count(),
    hospital_procedures: await prisma.hospitalProcedure.count(),
    hospital_images: await prisma.hospitalImage.count(),
    hospital_tags: await prisma.hospitalTag.count(),
    hospital_event_notes: await prisma.hospitalEventNote.count(),
    business_hours: await prisma.businessHour.count(),
    hospital_sponsorships: await prisma.hospitalSponsorship.count(),
    doctors: await prisma.doctor.count(),
    doctor_procedures: await prisma.doctorProcedure.count(),
    doctor_careers: await prisma.doctorCareer.count(),
    doctor_verifications: await prisma.doctorVerification.count(),
    consult_requests: await prisma.consultRequest.count(),
    consult_status_changes: await prisma.consultStatusChange.count(),
    consult_memos: await prisma.consultMemo.count(),
    favorites: await prisma.favorite.count(),
    reviews: await prisma.review.count(),
    review_photos: await prisma.reviewPhoto.count(),
    promotions: await prisma.promotion.count(),
    guides: await prisma.guide.count(),
    guide_hospitals: await prisma.guideHospital.count(),
    qa_posts: await prisma.qaPost.count(),
    qa_answers: await prisma.qaAnswer.count(),
    notifications: await prisma.notification.count(),
    notification_recipients: await prisma.notificationRecipient.count(),
    // §11 의 5개 테이블. 시드가 넣는 것은 legal_documents 뿐이고 나머지 4개는
    // 런타임에 쌓인다 (refresh_tokens=로그인, audit_logs=관리자 행위,
    // partner_inquiries=접수, user_agreements=가입). 0 이 정상이다 (docs §11.3)
    refresh_tokens: await prisma.refreshToken.count(),
    audit_logs: await prisma.auditLog.count(),
    partner_inquiries: await prisma.partnerInquiry.count(),
    legal_documents: await prisma.legalDocument.count(),
    user_agreements: await prisma.userAgreement.count(),
  };

  console.log('─'.repeat(78));
  console.log('DB 행 수 (32개 테이블)');

  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(26)}${count}`);
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  console.log(`  ${'합계'.padEnd(25)}${total}`);

  // 개발자가 로그인해 볼 계정 안내 (비밀번호는 SEED_PASSWORD)
  console.log('─'.repeat(78));
  console.log('개발용 계정 (비밀번호 = .env 의 SEED_PASSWORD)');
  console.log(`  operator        ${OPERATOR.email}`);
  console.log(`  hospital_admin  ${adminAccounts[0].email} … ${adminAccounts.at(-1)?.email}`);
  console.log(`  user            ${applicantAccounts[0].email} … ${applicantAccounts.at(-1)?.email}`);
  console.log('─'.repeat(78));
  console.log('시드 완료');
}

main()
  .catch((error: unknown) => {
    console.error('\n시드 실패:');
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exitCode = 1;
  })
  .finally(() => {
    // SQLite 파일 락을 놓아야 한다. 안 놓으면 다음 명령이 막힌다.
    void prisma.$disconnect();
  });
