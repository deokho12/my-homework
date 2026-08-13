/**
 * 시술 → 대응 전공. `frontend/src/utils/specialty.ts` 에서 옮겨 왔다.
 *
 * 신규 전문의를 등록할 때 `procedureIds` 를 보내지 않으면 서버가 전공에서 유도한다
 * (계약 `replaceHospitalDoctors`). 관리자 폼에 시술 선택 칸이 없기 때문이다.
 */
export const PROCEDURE_SPECIALTY_MAP: Record<string, string> = {
  implant: '치과보철전문의',
  laminate: '치과보철전문의',
  inlay: '치과보철전문의',
  crown: '치과보철전문의',
  orthodontics: '치과교정전문의',
  whitening: '통합치의학과전문의',
  cavity: '통합치의학과전문의',
  'gum-disease': '치주과전문의',
  'wisdom-tooth': '구강악안면외과전문의',
  splint: '구강악안면외과전문의',
  'snoring-device': '구강악안면외과전문의',
  tmj: '구강악안면외과전문의',
  botox: '구강악안면외과전문의',
};

/**
 * 전공이 다루는 시술. **`일반의` 는 병원이 취급하는 시술 전체**를 받는다 —
 * 특정 과에 묶이지 않기 때문이다 (계약 `replaceHospitalDoctors`).
 */
export function getProceduresForSpecialty(specialty: string, hospitalProcedureIds: string[]): string[] {
  if (specialty === '일반의') return [...hospitalProcedureIds];

  return Object.keys(PROCEDURE_SPECIALTY_MAP).filter(
    (procedureId) => PROCEDURE_SPECIALTY_MAP[procedureId] === specialty
  );
}
