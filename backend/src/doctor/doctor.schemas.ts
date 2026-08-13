import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/pagination';
import { SORT_FIELDS } from '../hospital/hospital.schemas';

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
