import type { CategoryId } from '@/features/procedure/taxonomy';
import type { DentalSpecialty } from '@/types/domain';

/**
 * 시술 **대분류**별로 "이 전공이면 강조할 만하다"고 보는 전공들.
 *
 * 값이 **복수**인 이유: 대분류는 세부 시술 여러 개를 묶은 범위라, 충치치료처럼
 * 보철(크라운·인레이)과 보존(레진·신경치료)이 함께 들어가는 칸이 생긴다. 한 전공만
 * 고르면 다른 쪽 전문의가 상주하는 병원의 배지가 조용히 꺼진다.
 *
 * 서버 시술 13종 → 전공 1개로 잇던 옛 표와 조회 함수는 삭제했다 — 화면이 전부 대분류로
 * 넘어가 소비자가 0개가 됐다.
 *
 * 서버의 `backend/src/doctor/specialty-procedures.ts` 와는 `implant` 등에서 갈린다
 * (여기: 구강악안면외과 / 서버: 치과보철). 차이는 `docs/features/known-issues.md` 에 기록한다.
 */
export const CATEGORY_SPECIALTIES: Record<CategoryId, readonly DentalSpecialty[]> = {
  implant: ['구강악안면외과전문의'],
  prevention: ['치주과전문의', '통합치의학과전문의'],
  orthodontics: ['치과교정전문의'],
  cavity: ['치과보철전문의', '통합치의학과전문의'],
  aesthetic: ['치과보철전문의', '통합치의학과전문의'],
  gum: ['치주과전문의'],
  tmj: ['구강악안면외과전문의'],
  botox: ['구강악안면외과전문의'],
  extraction: ['구강악안면외과전문의'],
};

/**
 * 병원 카드(탐색·카테고리)가 "OO전문의 상주" 배지를 **강조할지** 정하는 유일한 판정.
 * 배지를 붙일지 말지는 서버가 준 `representativeSpecialty` 가 정한다 — 전문의 카드는
 * 이 함수를 쓰지 않는다(그 쪽 배지는 서버 `isVerifiedSpecialist` 하나로 갈린다).
 */
export function isSpecialtyForCategory(categoryId: CategoryId, specialty: DentalSpecialty): boolean {
  return CATEGORY_SPECIALTIES[categoryId].includes(specialty);
}
