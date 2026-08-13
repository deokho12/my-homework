import type { Prisma } from '@prisma/client';

import type { HospitalResponse } from './hospital.projection';
import type { ListHospitalsQuery, SortField } from './hospital.schemas';

/**
 * 쿼리 → Prisma `where`.
 *
 * **`q` 는 `nameNormalized` 를 쓴다.** `mode: 'insensitive'` 는 Prisma 에서 PostgreSQL
 * 전용이라 SQLite 에서 동작하지 않는다 (docs/database/README.md §3.9).
 *
 * `hasVerifiedSpecialist` 와 `minDoctorYearsOfExperience` 는 병원↔전문의 조인이라
 * 클라이언트에서 할 수 없다. Prisma 관계 필터(`doctors: { some }`)로 표현한다 —
 * raw SQL 을 쓰지 않는다.
 *
 * 좌표 조건(`bounds`)은 호출부가 bounding box 를 계산해 넘긴다. 단순 부등호라
 * `latitude`/`longitude` 인덱스를 탈 수 있다.
 */
export function buildHospitalWhere(
  query: ListHospitalsQuery,
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Prisma.HospitalWhereInput {
  const where: Prisma.HospitalWhereInput = { deletedAt: null };

  if (query.procedureId !== undefined) {
    where.procedures = { some: { procedureId: query.procedureId } };
  }

  if (query.recommended !== undefined) where.isRecommended = query.recommended;
  if (query.consultAvailable !== undefined) where.consultAvailable = query.consultAvailable;
  if (query.oneDay !== undefined) where.isOneDay = query.oneDay;
  if (query.nightConsult !== undefined) where.featureNightConsult = query.nightConsult;

  if (query.q !== undefined && query.q.trim() !== '') {
    where.nameNormalized = { contains: query.q.trim().toLowerCase() };
  }

  // 전문의 조건 두 개는 같은 `doctors.some` 안에서 AND 로 묶는다. 따로 두면
  // "인증 전문의가 있고, (다른) 10년차가 있다" 가 되어 의미가 달라진다.
  const doctorConditions: Prisma.DoctorWhereInput = { deletedAt: null };
  let hasDoctorCondition = false;

  if (query.hasVerifiedSpecialist === true) {
    doctorConditions.verificationStatus = 'approved';
    doctorConditions.specialty = { not: '일반의' };
    hasDoctorCondition = true;
  }

  if (query.minDoctorYearsOfExperience !== undefined) {
    doctorConditions.yearsOfExperience = { gte: query.minDoctorYearsOfExperience };
    hasDoctorCondition = true;
  }

  if (hasDoctorCondition) {
    where.doctors = { some: doctorConditions };
  }

  if (bounds !== undefined) {
    where.latitude = { gte: bounds.minLat, lte: bounds.maxLat };
    where.longitude = { gte: bounds.minLon, lte: bounds.maxLon };
  }

  return where;
}

export interface OrderHospitalsOptions {
  sort: SortField;
  /**
   * 광고를 맨 앞으로 당길지. 계약 규칙 4 — **필터가 없으면(`기타` 칩) 우선 노출을
   * 적용하지 않는다.** 호출부가 `procedureId` 나 `recommended` 가 있을 때만 켠다.
   */
  sponsoredFirst: boolean;
}

/**
 * 계약이 정한 순서로 정렬한다.
 *
 * 1. 자격 있는 광고를 `sponsoredRank` 오름차순으로 맨 앞
 * 2. 나머지는 `sort` 기준 내림차순
 * 3. 동점은 `id` 오름차순 — DB 마다 반환 순서가 달라 페이지 경계에서 중복·누락이 생긴다
 *
 * 입력을 변형하지 않는다 (`toSorted` 대신 복사 후 `sort` — tsconfig lib 이 ES2022 다).
 */
export function orderHospitals(
  items: HospitalResponse[],
  options: OrderHospitalsOptions
): HospitalResponse[] {
  const promoted = (item: HospitalResponse): boolean =>
    options.sponsoredFirst && item.sponsorship.isPlacementEligible;

  return [...items].sort((a, b) => {
    const aPromoted = promoted(a);
    const bPromoted = promoted(b);

    if (aPromoted !== bPromoted) return aPromoted ? -1 : 1;

    if (aPromoted && bPromoted) {
      const rankDiff = (a.sponsoredRank ?? Number.MAX_SAFE_INTEGER) - (b.sponsoredRank ?? Number.MAX_SAFE_INTEGER);
      if (rankDiff !== 0) return rankDiff;
    }

    const valueDiff = b[options.sort] - a[options.sort];
    if (valueDiff !== 0) return valueDiff;

    return a.id.localeCompare(b.id);
  });
}
