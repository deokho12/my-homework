import type { Prisma } from '@prisma/client';

import { publicHospitalWhere } from '../hospital/public-visibility';
import { GENERAL_PRACTITIONER } from './doctor.projection';
import type { ListDoctorsQuery } from './doctor.schemas';

/**
 * 쿼리 → Prisma `where`.
 *
 * `consultAvailable` · `oneDay` · `nightConsult` 는 **소속 병원 속성으로 전문의를 거른다.**
 * 클라이언트에서 하려면 병원 전체 목록이 필요하므로 서버 필터다 (계약 `listDoctors`).
 *
 * `verifiedSpecialist` 는 `approved` + `일반의` 제외까지만 SQL 로 표현한다.
 * `verifiedSpecialty === specialty` 비교는 컬럼 간 비교라 Prisma 로 표현할 수 없어
 * 투영 후 앱에서 거른다 (호출부 참고).
 */
export function buildDoctorWhere(query: ListDoctorsQuery): Prisma.DoctorWhereInput {
  const where: Prisma.DoctorWhereInput = { deletedAt: null };

  if (query.hospitalId !== undefined) where.hospitalId = query.hospitalId;
  if (query.recommended !== undefined) where.isRecommended = query.recommended;
  if (query.minYearsOfExperience !== undefined) {
    where.yearsOfExperience = { gte: query.minYearsOfExperience };
  }

  // 분야와 세부 시술이 함께 오면 **AND** 다 (`GET /hospitals` 와 같은 규칙 — 계약 §22.6).
  const procedureConditions: Prisma.DoctorProcedureWhereInput[] = [];

  if (query.categoryId !== undefined) {
    procedureConditions.push({ procedure: { categoryId: query.categoryId } });
  }

  if (query.procedureId !== undefined) {
    procedureConditions.push({ procedureId: query.procedureId });
  }

  if (procedureConditions.length > 0) {
    where.AND = procedureConditions.map((condition) => ({ procedures: { some: condition } }));
  }

  if (query.verifiedSpecialist === true) {
    where.verificationStatus = 'approved';
    where.specialty = { not: GENERAL_PRACTITIONER };
  }

  if (query.q !== undefined && query.q.trim() !== '') {
    where.nameNormalized = { contains: query.q.trim().toLowerCase() };
  }

  // 소속 병원이 **앱에 노출되는 병원**이어야 한다는 조건은 `publicHospitalWhere()` 한 곳에서
  // 온다 — `GET /hospitals` 목록·`GET /procedures` 가용성 집계와 같은 함수다. 여기에 직접
  // `{ deletedAt: null }` 을 적으면 노출 조건이 하나 늘어나는 날 전문의 목록만 뒤처진다
  // (public-visibility.ts 주석, AGENTS.md "같은 판정을 두 곳에 두지 않는다").
  // 아래 병원 속성 필터는 그 위에 **덧붙인다** — 대체하지 않는다.
  const hospitalConditions: Prisma.HospitalWhereInput = { ...publicHospitalWhere() };

  if (query.consultAvailable !== undefined) hospitalConditions.consultAvailable = query.consultAvailable;
  if (query.oneDay !== undefined) hospitalConditions.isOneDay = query.oneDay;
  if (query.nightConsult !== undefined) hospitalConditions.featureNightConsult = query.nightConsult;

  // 노출되지 않는 병원의 전문의는 목록에 나오지 않아야 하므로 조건 유무와 무관하게 붙인다.
  where.hospital = { is: hospitalConditions };

  return where;
}
