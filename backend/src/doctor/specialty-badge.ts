/** 검수 대상이 아닌 전공. 자격증이 없고 승인/반려가 화면 표시를 바꾸지 않는다. */
export const GENERAL_PRACTITIONER = '일반의';

/** 배지 판정에 필요한 최소 필드. Doctor 행이든 조인해 읽은 부분 행이든 이 모양이면 된다. */
export interface SpecialtyBadgeInput {
  specialty: string;
  verifiedSpecialty: string | null;
  verificationStatus: string;
}

/**
 * `전문의` 배지 자격. **`verifiedSpecialty === specialty` 를 함께 본다.**
 *
 * 프론트의 기존 구현은 `approved && specialty !== '일반의'` 뿐이라, 승인 후 전공을
 * 다른 과로 바꿔도 배지가 유지됐다 — 검수 없이 새 과의 전문의로 보이는 결함이다.
 * DB 가 두 값을 나눠 둔 이유가 이것이다.
 *
 * 병원 카드의 `OO전문의 상주`(hospital.projection)와 전문의 배지(doctor.projection)가
 * 같은 규칙을 쓰도록 한 곳에 둔다. 두 곳에 두면 갈린다.
 */
export function hasSpecialistBadge(input: SpecialtyBadgeInput): boolean {
  return (
    input.verificationStatus === 'approved' &&
    input.specialty !== GENERAL_PRACTITIONER &&
    input.verifiedSpecialty === input.specialty
  );
}
