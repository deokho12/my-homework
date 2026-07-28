import type { DentalSpecialty, Doctor, ProcedureId } from '@/types/domain';

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
};

export function getSpecialtyForProcedure(procedureId: ProcedureId): DentalSpecialty {
  return PROCEDURE_SPECIALTY_MAP[procedureId];
}

/** Procedure ids a specialist is assumed to treat, inferred from their specialty. Used to auto-fill
 * a doctor's procedureIds when a hospital admin registers them without a separate procedure picker. */
export function getProceduresForSpecialty(specialty: DentalSpecialty): ProcedureId[] {
  return (Object.keys(PROCEDURE_SPECIALTY_MAP) as ProcedureId[]).filter(
    (procedureId) => PROCEDURE_SPECIALTY_MAP[procedureId] === specialty
  );
}

/** True once the operator has approved the claim AND it isn't the "일반의" (non-specialist) placeholder. */
export function isVerifiedSpecialist(doctor: Doctor): boolean {
  return doctor.verificationStatus === 'approved' && doctor.specialty !== '일반의';
}

/**
 * What to show next to a doctor's name. "일반의" is always shown (nothing to verify). A real specialty
 * claim is hidden until approved — pending/rejected claims show the name only, per the verification spec.
 */
export function getVisibleSpecialtyLabel(doctor: Doctor): DentalSpecialty | null {
  if (doctor.specialty === '일반의') return '일반의';
  return doctor.verificationStatus === 'approved' ? doctor.specialty : null;
}

/** First approved (non-일반의) specialist at a hospital, used for the "OO전문의 상주" list-card tag. */
export function getRepresentativeSpecialist(doctors: Doctor[]): Doctor | null {
  return doctors.find((doctor) => isVerifiedSpecialist(doctor)) ?? null;
}
