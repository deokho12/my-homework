/**
 * =============================================================================
 * 몰라몰라 시드 — frontend/src/mocks/fixtures/*.ts → SQLite
 * =============================================================================
 *
 * 실행:  npm run prisma:seed        (= prisma db seed)
 * 재실행: 안전하다. **모든 쓰기가 id 기준 upsert** 다 (docs/database/README.md §8.1 원칙 2).
 *
 * 설계 규칙
 * ---------------------------------------------------------------------------
 * 1. fixture 의 id 를 그대로 쓴다 — `h1`, `d1`, `cr1`, `q1`, `a1`, `g1`, `p1`,
 *    `r1`, `notif1`, `memo-cr2-1`. 화면 문서와 예시 URL, QA 시나리오가 이 값에
 *    의존한다 (docs §8.1 원칙 1).
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

import { hospitalAdminAccount, OPERATOR, resolvePasswordHash, userAccount } from './seed/accounts';
import type { SeedAccount } from './seed/accounts';
import {
  addDays,
  addMs,
  consultShift,
  parseFixtureDate,
  PROMOTION_WINDOWS,
  resolveSeedToday,
  toDateString,
} from './seed/dates';
import {
  consultRequests,
  doctors,
  guides,
  hospitals,
  notifications,
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

function dayOfWeek(label: string): number {
  const value = DAY_LABEL_TO_NUMBER[label.trim()];

  if (value === undefined) {
    throw new Error(`알 수 없는 요일 라벨: '${label}' (월~일 이어야 합니다)`);
  }

  return value;
}

async function main(): Promise<void> {
  const seedToday = resolveSeedToday(process.env.SEED_TODAY);
  const now = new Date();
  const passwordHash = await resolvePasswordHash(process.env.SEED_PASSWORD);

  console.log('─'.repeat(78));
  console.log(`시드 시작  SEED_TODAY=${toDateString(seedToday)}  (실행 시각 ${now.toISOString()})`);
  console.log('─'.repeat(78));

  // ===========================================================================
  // 1. 시술 마스터 13종 — sort_order = fixture 배열 순서
  // ===========================================================================
  for (const [index, procedure] of procedures.entries()) {
    const data = {
      name: procedure.name,
      emoji: procedure.emoji,
      shortDescription: procedure.shortDescription,
      description: procedure.description,
      sortOrder: index,
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
  const applicantAccounts: SeedAccount[] = consultRequests.map((consult, index) =>
    userAccount(index + 1, consult.name),
  );
  const adminAccounts: SeedAccount[] = hospitals.map((hospital) =>
    hospitalAdminAccount(hospital.id, hospital.name),
  );
  const accounts: SeedAccount[] = [OPERATOR, ...adminAccounts, ...applicantAccounts];

  /** 상담 fixture 의 순서가 곧 신청자 계정이다 — cr1→u-seed-1 … cr7→u-seed-7 (docs §8.3). */
  const consultApplicantId = new Map<string, string>(
    consultRequests.map((consult, index) => [consult.id, applicantAccounts[index].id]),
  );

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
    if (hospital.isSponsored && hospital.sponsoredStartDate && hospital.sponsoredEndDate) {
      for (const procedureId of hospital.sponsoredCategories) {
        const id = `sp-${hospital.id}-${procedureId}`;
        const payload = {
          rank: hospital.sponsoredRank ?? 1,
          startDate: hospital.sponsoredStartDate,
          endDate: hospital.sponsoredEndDate,
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
  const submittedAt = addDays(seedToday, -7);
  const reviewedAt = addDays(seedToday, -6);

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
  // 6. 상담 신청 + 상태 이력 + 메모
  //    날짜는 SEED_TODAY 기준 상대 오프셋 (docs §8.5). 계산은 seed/dates.ts.
  // ===========================================================================
  /** 상담 id → 시간 이동량(ms). 관련 알림을 같이 밀 때 쓴다. */
  const consultDelta = new Map<string, number>();
  let statusChangeCount = 0;
  let memoCount = 0;

  for (const consult of consultRequests) {
    const { createdAt, deltaMs } = consultShift(consult.id, consult.createdAt, seedToday);
    consultDelta.set(consult.id, deltaMs);

    const userId = consultApplicantId.get(consult.id);

    if (!userId) {
      throw new Error(`상담 '${consult.id}' 의 신청자 계정을 찾지 못했습니다`);
    }

    // 마지막 상태 변경 시각을 updated_at 으로 쓴다
    const lastChange = consult.statusHistory.at(-1);
    const updatedAt = lastChange ? addMs(parseFixtureDate(lastChange.changedAt), deltaMs) : createdAt;

    const data = {
      userId,
      hospitalId: consult.hospitalId,
      // fixture 에는 지목 전문의가 없다. 병원 단위 상담이므로 null (docs §5.2)
      doctorId: null,
      procedureId: consult.procedureId,
      // 폼 입력값 스냅샷. users.name 과 다를 수 있다 (docs §4)
      name: consult.name,
      phone: consult.phone,
      preferredTime: consult.preferredTime,
      message: consult.message,
      status: consult.status,
      createdAt,
      updatedAt,
    };

    await prisma.consultRequest.upsert({
      where: { id: consult.id },
      create: { id: consult.id, ...data },
      update: data,
    });

    for (const [index, change] of consult.statusHistory.entries()) {
      const id = `csc-${consult.id}-${index}`;
      const payload = {
        status: change.status,
        changedAt: addMs(parseFixtureDate(change.changedAt), deltaMs),
        // 시드/시스템이 만든 행이므로 담당자 없음 (docs 스키마 주석)
        changedByUserId: null,
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
        createdAt: addMs(parseFixtureDate(memo.createdAt), deltaMs),
        authorUserId: null,
      };

      // 메모는 fixture 에 id 가 있다 (memo-cr2-1 등) — 그대로 쓴다
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
      createdAt: parseFixtureDate(review.createdAt),
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
      startDate: toDateString(addDays(seedToday, window.start)),
      endDate: toDateString(addDays(seedToday, window.end)),
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
      createdAt: parseFixtureDate(guide.createdAt),
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
    const createdAt = parseFixtureDate(post.createdAt);
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
      const answeredAt = parseFixtureDate(answer.createdAt);
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
  // 11. 알림 + 수신자 (docs §5.3, §8.3)
  //     - user  + 관련 상담 있음 → 그 상담의 신청자 1명
  //     - user  + 전체 공지      → 사용자 7명 fan-out
  //     - admin + 관련 상담 있음 → 그 병원 담당자 1명 (+ notifications.hospital_id)
  //     - admin + 운영 공지      → 병원 담당자 11명 fan-out
  //     읽음 상태는 계정별이다 (notification_recipients.read_at)
  // ===========================================================================
  const consultById = new Map(consultRequests.map((consult) => [consult.id, consult]));
  let recipientCount = 0;

  for (const notification of notifications) {
    const relatedConsult = notification.relatedId ? consultById.get(notification.relatedId) : undefined;

    // 상담과 연결된 알림은 그 상담이 밀린 만큼 같이 민다. 그러지 않으면
    // "상담보다 먼저 도착한 상담 알림" 이 되어 버린다.
    const deltaMs = relatedConsult ? (consultDelta.get(relatedConsult.id) ?? 0) : 0;
    const createdAt = addMs(parseFixtureDate(notification.createdAt), deltaMs);

    const hospitalId =
      notification.audience === 'admin' && relatedConsult ? relatedConsult.hospitalId : null;

    const data = {
      audience: notification.audience,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      // 다형 참조. FK 는 걸 수 없고 related_type 으로 무엇인지 표시한다 (docs §4)
      relatedType: relatedConsult ? 'consult_request' : null,
      relatedId: relatedConsult ? relatedConsult.id : null,
      hospitalId,
      createdAt,
    };

    await prisma.notification.upsert({
      where: { id: notification.id },
      create: { id: notification.id, ...data },
      update: data,
    });

    // 수신자 결정
    let recipientIds: string[];

    if (notification.audience === 'user') {
      recipientIds = relatedConsult
        ? [consultApplicantId.get(relatedConsult.id) as string]
        : applicantAccounts.map((account) => account.id);
    } else if (relatedConsult) {
      recipientIds = [`u-admin-${relatedConsult.hospitalId}`];
    } else {
      recipientIds = adminAccounts.map((account) => account.id);
    }

    for (const userId of recipientIds) {
      const id = `nr-${notification.id}-${userId}`;
      // fixture 의 전역 isRead 를 계정별 read_at 으로 옮긴다.
      // 읽은 알림은 "도착 즉시 읽음" 으로 둔다 (별도 시각 정보가 없다).
      const readAt = notification.isRead ? createdAt : null;

      await prisma.notificationRecipient.upsert({
        where: { id },
        create: { id, notificationId: notification.id, userId, readAt },
        update: { userId, readAt },
      });
      recipientCount += 1;
    }
  }

  console.log(`  notifications             ${notifications.length}`);
  console.log(`  notification_recipients   ${recipientCount}`);

  // ===========================================================================
  // 12. 약관 3종 (docs §11.3)
  //     - effective_at 은 SEED_TODAY - 1일 (미래면 "지금 유효한 버전" 이 0건이 된다)
  //     - 본문은 자리표시자임이 화면에서 드러나는 문구다 (prisma/seed/legal.ts)
  //     - user_agreements 는 만들지 않는다: 동의하지 않은 동의 기록을 만들면 안 된다
  // ===========================================================================
  const legalEffectiveAt = addDays(seedToday, -1);

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
