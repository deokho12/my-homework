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
