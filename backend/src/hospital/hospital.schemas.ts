import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/pagination';

/**
 * 쿼리 문자열은 전부 문자열로 온다. `z.coerce` 로 변환하되 **boolean 은 coerce 를
 * 쓰지 않는다** — `z.coerce.boolean()` 은 `'false'` 를 `true` 로 만든다(빈 문자열이
 * 아닌 모든 문자열이 truthy). 명시적으로 `'true'` 만 참으로 본다.
 */
const booleanParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const SORT_FIELDS = ['rating', 'reviewCount', 'consultCount'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const listHospitalsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    procedureId: z.string().min(1).optional(),
    recommended: booleanParam,
    consultAvailable: booleanParam,
    oneDay: booleanParam,
    hasVerifiedSpecialist: booleanParam,
    nightConsult: booleanParam,
    minDoctorYearsOfExperience: z.coerce.number().int().min(0).optional(),
    sort: z.enum(SORT_FIELDS).default('rating'),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().optional(),
    q: z.string().max(100).optional(),
  })
  .refine(
    (value) =>
      // 세 값은 함께 와야 한다. 하나만 오면 조용히 무시하지 않고 422 로 알린다 —
      // 지도 화면이 반경을 보냈는데 필터가 안 걸리면 원인을 찾을 수 없다.
      [value.latitude, value.longitude, value.radiusKm].every((item) => item === undefined) ||
      [value.latitude, value.longitude, value.radiusKm].every((item) => item !== undefined),
    { message: 'latitude·longitude·radiusKm 는 함께 보내야 해요', path: ['radiusKm'] }
  );

export type ListHospitalsQuery = z.infer<typeof listHospitalsQuerySchema>;

/**
 * 이 엔드포인트로 바꿀 수 없는 필드.
 *
 * **조용히 무시하지 않고 422 로 거절한다.** 무시하면 관리자 화면이 "저장했는데 안 바뀐다"
 * 상태가 된다 — 지금 `대표 이미지 URL` 에서 실제로 겪고 있는 증상이다 (계약 `updateHospital`).
 */
export const READONLY_HOSPITAL_FIELDS = [
  'isSponsored',
  'sponsoredCategories',
  'sponsoredRank',
  'sponsoredStartDate',
  'sponsoredEndDate',
  'rating',
  'reviewCount',
  'consultCount',
] as const;

/** `operator` 만 바꿀 수 있는 필드. `hospital_admin` 이 보내면 422. */
export const OPERATOR_ONLY_HOSPITAL_FIELDS = ['isRecommended'] as const;

const featuresSchema = z.object({
  coordinator: z.boolean(),
  painlessAnesthesia: z.boolean(),
  digitalCare: z.boolean(),
  parking: z.boolean(),
  nightConsult: z.boolean(),
  cctv: z.boolean(),
});

const businessHourSchema = z.object({
  day: z.enum(['월', '화', '수', '목', '금', '토', '일']),
  hours: z.string().min(1),
  isClosed: z.boolean().optional().default(false),
});

export const createHospitalSchema = z.object({
  name: z.string().trim().min(1),
  specialty: z.string().trim().optional(),
  region: z.string().trim().min(1),
  address: z.string().trim().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  thumbnail: z.string().url(),
  images: z.array(z.string().url()).optional(),
  procedureIds: z.array(z.string().min(1)).min(1),
  priceRange: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }),
  consultAvailable: z.boolean().optional(),
  isOneDay: z.boolean().optional(),
  features: featuresSchema.optional(),
  businessHours: z.array(businessHourSchema).optional(),
  directions: z.string().optional(),
  introduction: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  events: z.array(z.string().min(1)).optional(),
});

/** 부분 수정 + 운영자 전용 필드. 금지 필드는 스키마가 아니라 서비스가 판정한다(역할을 알아야 한다). */
export const updateHospitalSchema = createHospitalSchema.partial().extend({
  isRecommended: z.boolean().optional(),
});

export type CreateHospitalDto = z.infer<typeof createHospitalSchema>;
export type UpdateHospitalDto = z.infer<typeof updateHospitalSchema>;
