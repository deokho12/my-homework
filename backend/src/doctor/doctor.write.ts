import { createId } from '@paralleldrive/cuid2';

import { getProceduresForSpecialty } from './specialty-procedures';

/**
 * 전문의 쓰기 경로의 순수 변환 로직 (DB 접근 없음). 서비스가 조립하고 리포지토리가
 * 트랜잭션 안에서 그대로 Prisma 에 넘긴다 — 리포지토리를 열지 않고도 이 변환을
 * 단위 테스트할 수 있다 (`hospital.write.ts` 선례).
 */

/** 재검수 판정·부분 수정에 필요한 최소 입력. `DoctorUpsertDto`·`UpdateDoctorDto` 양쪽이 이 모양이다. */
export interface DoctorWriteInput {
  name?: string;
  title?: string;
  specialty?: string;
  certificateUrl?: string | null;
  photo?: string;
  yearsOfExperience?: number;
  career?: string[];
  procedureIds?: string[];
}

/** 재검수 판정에 필요한 기존 행의 부분 스냅샷. */
export interface DoctorSnapshot {
  specialty: string;
  certificateUrl: string | null;
}

/**
 * `specialty` 또는 `certificateUrl` 이 **바뀌었는지**. 재검수 트리거의 단일 판정 —
 * `PUT /hospitals/:hospitalId/doctors` 와 `PATCH /doctors/:doctorId` 양쪽이 이 함수를
 * 쓴다. 두 곳에 각자 판정을 두면 갈린다 (`specialty-badge.ts` 의 `hasSpecialistBadge` 와
 * 같은 이유로 한 곳에 둔다).
 *
 * 값이 오지 않은 필드(`undefined`)는 "안 바꿈" 이다 — 그 필드는 비교 대상이 아니다.
 */
export function needsReverification(input: DoctorWriteInput, existing: DoctorSnapshot): boolean {
  const specialtyChanged = input.specialty !== undefined && input.specialty !== existing.specialty;
  const certificateChanged = input.certificateUrl !== undefined && input.certificateUrl !== existing.certificateUrl;

  return specialtyChanged || certificateChanged;
}

/** `Doctor` 갱신에 실제로 쓰는 스칼라 필드. */
export interface DoctorScalarChanges {
  name?: string;
  nameNormalized?: string;
  title?: string;
  specialty?: string;
  certificateUrl?: string | null;
  photo?: string;
  yearsOfExperience?: number;
  verificationStatus?: string;
  verifiedSpecialty?: string | null;
  rejectionReason?: string | null;
}

/**
 * 갱신 — **보낸 키만 채운다.** 폼에 없는 칸(`photo`·`yearsOfExperience`·`career` 등)을
 * 안 보내면 기존 값을 유지한다 (계약 `DoctorUpsert`).
 *
 * `needsReverification` 이 참이면 승인 상태를 되돌린다 — `verificationStatus` 는
 * 요청에서 오지 않으므로(스키마에 없다) 이 분기가 그 값을 바꾸는 유일한 경로다.
 */
export function buildDoctorScalarChanges(input: DoctorWriteInput, existing: DoctorSnapshot): DoctorScalarChanges {
  const changes: DoctorScalarChanges = {};

  if (input.name !== undefined) {
    changes.name = input.name;
    // Global Constraints — name 을 건드리는 모든 경로에서 nameNormalized 를 채운다
    changes.nameNormalized = input.name.trim().toLowerCase();
  }
  if (input.title !== undefined) changes.title = input.title;
  if (input.specialty !== undefined) changes.specialty = input.specialty;
  if (input.certificateUrl !== undefined) changes.certificateUrl = input.certificateUrl;
  if (input.photo !== undefined) changes.photo = input.photo;
  if (input.yearsOfExperience !== undefined) changes.yearsOfExperience = input.yearsOfExperience;

  if (needsReverification(input, existing)) {
    changes.verificationStatus = 'pending';
    changes.verifiedSpecialty = null;
    changes.rejectionReason = null;
  }

  return changes;
}

/** `Doctor` 신규 생성에 쓰는 스칼라 필드. `id` 는 여기서 만든다 — 자식 행(FK)이 필요로 한다. */
export interface DoctorCreateFields {
  id: string;
  name: string;
  nameNormalized: string;
  title: string;
  specialty: string;
  certificateUrl: string | null;
  photo: string;
  yearsOfExperience: number;
  verificationStatus: string;
  verifiedSpecialty: string | null;
  rejectionReason: string | null;
}

/**
 * 신규(로스터에 `id` 없는 항목). `title`·`photo`·`yearsOfExperience` 는 관리자 폼에 칸이
 * 없어 서버가 기본값을 채운다 (계약 `DoctorUpsert`). `verificationStatus` 는 항상
 * `pending` 이다 — 이 경로로는 승인이 나올 수 없다(검수는 별도 오퍼레이션).
 */
export function buildDoctorCreateFields(input: {
  name: string;
  title?: string;
  specialty: string;
  certificateUrl?: string | null;
  photo?: string;
  yearsOfExperience?: number;
}): DoctorCreateFields {
  return {
    id: createId(),
    name: input.name,
    nameNormalized: input.name.trim().toLowerCase(),
    title: input.title ?? '원장',
    specialty: input.specialty,
    certificateUrl: input.certificateUrl ?? null,
    photo: input.photo ?? '',
    yearsOfExperience: input.yearsOfExperience ?? 0,
    verificationStatus: 'pending',
    verifiedSpecialty: null,
    rejectionReason: null,
  };
}

/**
 * 신규 항목의 최종 `procedureIds`. 보냈으면 그대로, 안 보냈으면 전공에서 유도한다
 * (`일반의` 는 병원이 취급하는 시술 전체) — 계약 `replaceHospitalDoctors`.
 */
export function resolveProcedureIds(
  specialty: string,
  procedureIds: string[] | undefined,
  hospitalProcedureIds: string[]
): string[] {
  return procedureIds ?? getProceduresForSpecialty(specialty, hospitalProcedureIds);
}

export function buildCareerRows(
  doctorId: string,
  career: string[]
): { id: string; doctorId: string; content: string; sortOrder: number }[] {
  return career.map((content, index) => ({ id: createId(), doctorId, content, sortOrder: index }));
}

export function buildProcedureRows(
  doctorId: string,
  procedureIds: string[]
): { id: string; doctorId: string; procedureId: string }[] {
  return procedureIds.map((procedureId) => ({ id: createId(), doctorId, procedureId }));
}

export interface PendingVerificationRow {
  id: string;
  doctorId: string;
  submittedSpecialty: string;
  submittedCertificateUrl: string | null;
  status: string;
  createdAt: Date;
}

/**
 * 재검수(또는 최초 제출) 행. `status` 는 항상 `pending` 이다 — 이 경로로는 승인이 나오지
 * 않는다(승인은 `operator` 전용 검수 오퍼레이션의 몫). `doctor_verifications` 는 전문의당
 * 이력이 쌓이는 테이블이라(§8.3) 이 함수가 새 행을 "추가"하는 것이지 기존 행을 갱신하지 않는다.
 */
export function buildPendingVerificationRow(
  doctorId: string,
  submittedSpecialty: string,
  submittedCertificateUrl: string | null,
  now: Date
): PendingVerificationRow {
  return {
    id: createId(),
    doctorId,
    submittedSpecialty,
    submittedCertificateUrl,
    status: 'pending',
    createdAt: now,
  };
}

/** 로스터 요청 전체에서 명시적으로 보낸 `procedureIds` 만 모은다 (중복 제거). 유도된 값은 검증 대상이 아니다. */
export function collectExplicitProcedureIds(items: { procedureIds?: string[] }[]): string[] {
  const ids = new Set<string>();

  for (const item of items) {
    if (item.procedureIds === undefined) continue;

    for (const id of item.procedureIds) ids.add(id);
  }

  return [...ids];
}
