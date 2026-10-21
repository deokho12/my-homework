/**
 * 시술 → 그 시술을 다루는 **전공들** (31행 — docs/database/README.md §17.11).
 *
 * 신규 전문의를 등록할 때 `procedureIds` 를 보내지 않으면 서버가 이 표에서 유도한다
 * (계약 `replaceHospitalDoctors`). 관리자 폼에 시술 선택 칸이 없기 때문이다.
 *
 * **이 파일은 import 가 하나도 없다.** 프론트엔드의 동기화 테스트가 이 표를 상대
 * 경로로 읽어 `CATEGORY_SPECIALTIES`(분야 → 강조 전공)가 이 표의 **합집합**임을
 * 고정하기 때문이다 (§17.11). 사본이 둘인 이유: 병원 카드의 배지는 카드가 그려지는
 * 첫 프레임에 필요해서 네트워크를 기다릴 수 없고, 계약에 소비자 없는 필드를 더하는
 * 대신 **사본 + 검사**를 택했다. 갈라지면 테스트가 먼저 깨진다.
 *
 * 쓸 수 있는 값은 기존 7개 전공 + `일반의` 뿐이다 (`DentalSpecialty`).
 * **구강악안면방사선과전문의는 31개 중 어디에도 없다** — 영상 진단은 세부 시술
 * 목록에 없는 활동이라 자동 배정이 0개인 것이 맞다 (§17.11).
 */
export const PROCEDURE_SPECIALTIES: Record<string, readonly string[]> = {
  // 임플란트 — 식립(외과)과 보철(상부 구조)이 한 분야에 있어 둘 다 둔다 (요청자 결정)
  'implant-general': ['치과보철전문의', '구강악안면외과전문의'],
  'bone-graft': ['구강악안면외과전문의'],
  'sinus-lift': ['구강악안면외과전문의'],
  'implant-denture': ['치과보철전문의'],

  // 스케일링·예방
  scaling: ['치주과전문의', '통합치의학과전문의'],
  fluoride: ['소아치과전문의', '통합치의학과전문의'],
  sealant: ['소아치과전문의', '통합치의학과전문의'],
  halitosis: ['치주과전문의', '통합치의학과전문의'],

  // 교정
  'clear-aligner': ['치과교정전문의'],
  'lingual-braces': ['치과교정전문의'],
  'bracket-braces': ['치과교정전문의'],
  'partial-ortho': ['치과교정전문의'],

  // 충치치료
  resin: ['통합치의학과전문의'],
  inlay: ['치과보철전문의', '통합치의학과전문의'],
  onlay: ['치과보철전문의', '통합치의학과전문의'],
  crown: ['치과보철전문의'],
  'root-canal': ['통합치의학과전문의'],

  // 심미
  laminate: ['치과보철전문의'],
  whitening: ['통합치의학과전문의', '치과보철전문의'],
  'gum-contouring': ['치주과전문의'],

  // 잇몸치료
  'gum-treatment': ['치주과전문의'],
  'periodontal-surgery': ['치주과전문의'],
  'gum-graft': ['치주과전문의'],

  // 턱관절·스플린트
  'tmj-treatment': ['구강악안면외과전문의'],
  splint: ['구강악안면외과전문의'],
  'bruxism-device': ['구강악안면외과전문의'],
  'snoring-device': ['구강악안면외과전문의'],

  // 보톡스
  'bruxism-botox': ['구강악안면외과전문의'],
  'masseter-botox': ['구강악안면외과전문의'],

  // 사랑니·발치
  'wisdom-tooth': ['구강악안면외과전문의'],
  'general-extraction': ['구강악안면외과전문의'],
};

/**
 * `일반의` 는 특정 과에 묶이지 않는다 — 그 전공의 시술은 "전부" 다.
 *
 * `doctor/specialty-badge.ts` 에도 같은 상수가 있다. **공유하지 않는 이유**는 이 파일이
 * import 0 여야 하기 때문이다(머리말) — 프론트 동기화 테스트가 상대 경로로 읽는다.
 * 판정이 아니라 값 하나의 사본이고, 값이 갈리면 로스터 자동 배정 테스트가 깨진다.
 */
const GENERAL_PRACTITIONER = '일반의';

/**
 * 전공이 다루는 시술 **∩ 그 병원이 취급하는 시술** (2026-10-21 요청 14).
 *
 * 전에는 교집합 없이 전공 표를 그대로 돌려줬다. 시술이 13 → 31 로 늘면서 그 규칙은
 * 구강악안면외과 전문의 한 명에게 **그 병원이 하지도 않는 시술 11개**를 붙인다
 * (계약 `replaceHospitalDoctors`, docs/api/README.md §22.8).
 *
 * `일반의` 는 지금까지처럼 병원 취급 시술 전체다 — 그 전공의 시술 = 전체이므로
 * **교집합도 전체**다. 규칙이 둘이 아니라 하나로 합쳐진다.
 *
 * 순서는 **병원 시술 목록의 순서**를 따른다 (호출부가 `Procedure.sortOrder` 순으로
 * 읽어 넘긴다).
 */
export function getProceduresForSpecialty(specialty: string, hospitalProcedureIds: string[]): string[] {
  if (specialty === GENERAL_PRACTITIONER) return [...hospitalProcedureIds];

  return hospitalProcedureIds.filter((procedureId) =>
    (PROCEDURE_SPECIALTIES[procedureId] ?? []).includes(specialty),
  );
}
