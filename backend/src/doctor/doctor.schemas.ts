import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/pagination';
import { SORT_FIELDS } from '../hospital/hospital.schemas';
import { GENERAL_PRACTITIONER } from './doctor.projection';

/**
 * 쿼리 문자열은 전부 문자열로 온다. `z.coerce.boolean()` 을 쓰지 않는 이유는
 * `hospital.schemas.ts` 와 같다 — 빈 문자열이 아닌 모든 문자열이 truthy가 된다.
 */
const booleanParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const listDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  hospitalId: z.string().min(1).optional(),
  procedureId: z.string().min(1).optional(),
  recommended: booleanParam,
  consultAvailable: booleanParam,
  oneDay: booleanParam,
  verifiedSpecialist: booleanParam,
  nightConsult: booleanParam,
  minYearsOfExperience: z.coerce.number().int().min(0).optional(),
  sort: z.enum(SORT_FIELDS).default('rating'),
  q: z.string().max(100).optional(),
});

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;

/**
 * `DentalSpecialty` (openapi). 배지 판정에 쓰는 `일반의` 도 여기 포함된다 —
 * `일반의` 는 검수 대상이 아니지만 여전히 `specialty` 값으로 받을 수 있다.
 */
export const DENTAL_SPECIALTIES = [
  '치과보철전문의',
  '치과교정전문의',
  '구강악안면외과전문의',
  '치주과전문의',
  '소아치과전문의',
  '통합치의학과전문의',
  '구강악안면방사선과전문의',
  GENERAL_PRACTITIONER,
] as const;

/**
 * 병원 폼의 전문의 한 명 (`DoctorUpsert`). `id` 가 있으면 갱신, 없으면 신규.
 *
 * **`name` 이 필수(`minLength: 1`)다** — 이름을 비우고 저장하면 조용히 삭제되는
 * 현재 사고 경로를 막는다 (`replaceHospitalDoctors` 결함 1).
 *
 * **`verificationStatus` 는 여기 없다.** 요청에 실려 와도 이 스키마가 모르는 키라
 * zod 가 버리고, 서비스는 애초에 이 필드를 읽지 않는다 — 받아서 무시하는 필드는
 * 언젠가 통과하므로 스키마에서부터 존재하지 않게 한다.
 */
export const doctorUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(50),
  title: z.string().trim().max(50).optional(),
  specialty: z.enum(DENTAL_SPECIALTIES),
  certificateUrl: z.string().url().nullable().optional(),
  photo: z.string().url().optional(),
  yearsOfExperience: z.number().int().min(0).optional(),
  career: z.array(z.string().trim().min(1)).optional(),
  procedureIds: z.array(z.string().min(1)).optional(),
});

export type DoctorUpsertDto = z.infer<typeof doctorUpsertSchema>;

/** `PUT /hospitals/:hospitalId/doctors` 요청 본문. */
export const replaceDoctorsSchema = z.object({
  doctors: z.array(doctorUpsertSchema),
});

export type ReplaceDoctorsDto = z.infer<typeof replaceDoctorsSchema>;

/**
 * `PATCH /doctors/:doctorId` (`DoctorUpdateRequest`). 전부 부분 수정이다 — `id` 는
 * 경로 파라미터로 이미 있으므로 여기 없다. `name` 을 보내면 여전히 `minLength: 1` 이다
 * (빈 문자열로 지우는 경로를 만들지 않는다).
 */
export const updateDoctorSchema = doctorUpsertSchema.omit({ id: true }).partial();

export type UpdateDoctorDto = z.infer<typeof updateDoctorSchema>;
