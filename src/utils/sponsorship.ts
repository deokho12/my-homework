import type { Hospital, ProcedureId } from '@/types/domain';

/** Below this rating, a hospital is dropped from sponsored top-placement even if it's paid and ranked. */
export const MIN_SPONSORED_RATING = 3.5;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whether the hospital's ad campaign is currently within its paid date window. */
export function isSponsorshipActive(hospital: Hospital, today: string = todayIso()): boolean {
  if (!hospital.isSponsored || !hospital.sponsoredStartDate || !hospital.sponsoredEndDate) return false;
  return today >= hospital.sponsoredStartDate && today <= hospital.sponsoredEndDate;
}

/** Whether the hospital should be bumped into the sponsored top-placement slots for a given procedure category. */
export function isEligibleForSponsoredPlacement(
  hospital: Hospital,
  category: ProcedureId,
  today?: string
): boolean {
  return (
    isSponsorshipActive(hospital, today) &&
    hospital.sponsoredCategories.includes(category) &&
    hospital.rating >= MIN_SPONSORED_RATING
  );
}

/** Same trust-protection rule as category placement, but for the "추천" tab which isn't tied to one procedure. */
export function isEligibleForRecommendedSponsoredPlacement(hospital: Hospital, today?: string): boolean {
  return isSponsorshipActive(hospital, today) && hospital.rating >= MIN_SPONSORED_RATING;
}
