import type { CategoryId } from '@/features/procedure/taxonomy';
import type { DentalSpecialty } from '@/types/domain';

/**
 * 시술 **대분류**별로 "이 전공이면 강조할 만하다"고 보는 전공들.
 *
 * 값이 **복수**인 이유: 대분류는 세부 시술 여러 개를 묶은 범위라, 충치치료처럼
 * 보철(크라운·인레이)과 보존(레진·신경치료)이 함께 들어가는 칸이 생긴다. 한 전공만
 * 고르면 다른 쪽 전문의가 상주하는 병원의 배지가 조용히 꺼진다.
 *
 * **원본은 서버의 시술 → 전공 표**(`backend/src/doctor/specialty-procedures.ts` 의
 * `PROCEDURE_SPECIALTIES`)이고, 이 표는 그 **분야별 합집합**이다 (DB §17.11). 전에는 두 표가
 * `implant`·`whitening`·`aesthetic` 에서 갈려 있었다 — 이제 `taxonomy.sync.test.ts` 가
 * 합집합임을 고정한다.
 *
 * **사본을 남기는 이유**: 배지는 병원 카드가 그려지는 **첫 프레임**에 필요하다(네트워크를
 * 기다리면 배지가 깜빡인다). 런타임에 합집합을 계산하려면 시술 → 전공 표가 응답에 실려야
 * 하는데, 그것은 소비자 없는 계약 필드를 하나 더 만드는 일이다. 그래서 **사본 + 검사**다.
 */
export const CATEGORY_SPECIALTIES: Record<CategoryId, readonly DentalSpecialty[]> = {
  // 식립(외과)과 보철(상부 구조)이 한 분야에 있어 둘 다 강조한다 (요청자 결정).
  implant: ['치과보철전문의', '구강악안면외과전문의'],
  prevention: ['치주과전문의', '통합치의학과전문의', '소아치과전문의'],
  orthodontics: ['치과교정전문의'],
  cavity: ['통합치의학과전문의', '치과보철전문의'],
  // 치주과는 잇몸성형(`gum-contouring`)으로 들어온다.
  aesthetic: ['치과보철전문의', '통합치의학과전문의', '치주과전문의'],
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
