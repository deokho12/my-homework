import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import type { AuthErrorInfo } from '@/store/useAuthStore';

/**
 * 서버 `422` 의 `details[].field` 를 폼 필드에 붙인다.
 *
 * 서버가 주는 경로는 점 표기이고 배열은 `agreedTermsVersions[0].version` 이다
 * (백엔드 `zod-validation.pipe.ts`). 폼 필드명과 정확히 같거나, 그 필드로 시작하는
 * 경로만 매핑한다 — 모르는 경로를 아무 칸에 붙이면 사용자가 엉뚱한 칸을 고치게 된다.
 *
 * @returns 하나라도 붙였는지. `false` 면 화면이 폼 전체 오류로 문구를 보여줘야 한다.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: AuthErrorInfo,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[]
): boolean {
  if (!error.details?.length) return false;

  let mapped = false;

  for (const detail of error.details) {
    const field = fields.find(
      (candidate) =>
        detail.field === candidate ||
        detail.field.startsWith(`${candidate}.`) ||
        detail.field.startsWith(`${candidate}[`)
    );

    if (!field) continue;

    setError(field, { type: 'server', message: detail.message });
    mapped = true;
  }

  return mapped;
}

/**
 * 어느 칸에도 붙이지 못한 오류의 문구.
 *
 * `422` 의 대표 문구는 `입력값을 확인해주세요` 라 그것만 보여주면 무엇이 틀렸는지 알 수 없다.
 * 폼에 없는 필드의 사유(예: `agreedTermsVersions[0].version`)를 그대로 보여준다.
 */
export function formErrorMessage(error: AuthErrorInfo): string {
  return error.details?.[0]?.message ?? error.message;
}
