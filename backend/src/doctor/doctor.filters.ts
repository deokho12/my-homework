import type { Prisma } from '@prisma/client';

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

  if (query.procedureId !== undefined) {
    where.procedures = { some: { procedureId: query.procedureId } };
  }

  if (query.verifiedSpecialist === true) {
    where.verificationStatus = 'approved';
    where.specialty = { not: GENERAL_PRACTITIONER };
  }

  if (query.q !== undefined && query.q.trim() !== '') {
    where.nameNormalized = { contains: query.q.trim().toLowerCase() };
  }

  const hospitalConditions: Prisma.HospitalWhereInput = { deletedAt: null };

  if (query.consultAvailable !== undefined) hospitalConditions.consultAvailable = query.consultAvailable;
  if (query.oneDay !== undefined) hospitalConditions.isOneDay = query.oneDay;
  if (query.nightConsult !== undefined) hospitalConditions.featureNightConsult = query.nightConsult;

  // 삭제된 병원의 전문의는 목록에 나오지 않아야 하므로 조건 유무와 무관하게 붙인다.
  where.hospital = { is: hospitalConditions };

  return where;
}
