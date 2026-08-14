import type { DentalSpecialty, ProcedureId } from '@/types/domain';

export const PROCEDURE_SPECIALTY_MAP: Record<ProcedureId, DentalSpecialty> = {
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

export function getSpecialtyForProcedure(procedureId: ProcedureId): DentalSpecialty {
  return PROCEDURE_SPECIALTY_MAP[procedureId];
}
