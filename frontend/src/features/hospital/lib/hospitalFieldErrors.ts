import type { ApiErrorDetail } from '@/lib/apiClient';

/** 병원 폼이 표시할 수 있는 필드 전부. `HospitalWriteInput` 의 키와 같다. */
export const HOSPITAL_FIELD_KEYS = [
  'name',
  'specialty',
  'region',
  'address',
  'latitude',
  'longitude',
  'thumbnail',
  'introduction',
  'priceRange',
  'tags',
  'procedureIds',
  'consultAvailable',
  'isOneDay',
  'isRecommended',
  'businessHours',
  'directions',
  'features',
] as const;

export type HospitalFieldKey = (typeof HOSPITAL_FIELD_KEYS)[number];

export type HospitalFieldErrors = Partial<Record<HospitalFieldKey, string>>;

/**
 * 서버 `422` 의 `details[].field` 를 병원 폼의 입력 칸에 매핑한다.
 *
 * `features/auth/lib/serverFieldErrors.ts` 의 `applyServerFieldErrors` 와 같은 매칭 규칙이다
 * (정확히 같거나 `field.`/`field[` 로 시작하는 경로만 그 필드로 묶는다). 이 폼은
 * react-hook-form 을 쓰지 않아(`UseFormSetError` 타입에 맞출 수 없어) 별도 함수로 둔다 —
 * 로직은 의도적으로 동일하게 유지한다.
 */
export function mapHospitalFieldErrors(details: ApiErrorDetail[] | undefined): HospitalFieldErrors {
  const result: HospitalFieldErrors = {};
  if (!details?.length) return result;

  for (const detail of details) {
    const field = HOSPITAL_FIELD_KEYS.find(
      (candidate) =>
        detail.field === candidate ||
        detail.field.startsWith(`${candidate}.`) ||
        detail.field.startsWith(`${candidate}[`)
    );

    if (field) result[field] = detail.message;
  }

  return result;
}
