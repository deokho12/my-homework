// ---------------------------------------------------------------------------
// DEV/DEMO STOCK IMAGES — NOT FOR PRODUCTION
// ---------------------------------------------------------------------------
// These are free-license Unsplash photos used purely to make the app look
// populated during development and demos.
//
// Unsplash's old "Source" random-image API (source.unsplash.com/...) is
// DEAD as of 2026 (the service was shut down — a direct check returns
// HTTP 503). Because of that, we can't just build a keyword URL on the fly:
// instead, every URL below points at one *specific* photo whose existence
// was manually verified against the real Unsplash CDN
// (images.unsplash.com/photo-<id>).
//
// IMPORTANT: When this product actually launches, every hospital/doctor/guide
// image field must be replaced with real photos supplied by each hospital —
// do NOT ship these stand-ins to production. Swap the URLs in this file (or
// the data files that reference them) once real assets are available.
// ---------------------------------------------------------------------------

/** Appends Unsplash's resize/format query params to a base photo URL. */
export function sized(url: string, width: number): string {
  return `${url}?q=80&w=${width}&auto=format&fit=crop`;
}

// --- Clinic interiors / procedures -----------------------------------------

/** Clean clinic interior with a desk and chairs. */
export const CLINIC_INTERIOR_1 = 'https://images.unsplash.com/photo-1704455306251-b4634215d98f';
/** Clinic interior with treatment chair and lighting. */
export const CLINIC_INTERIOR_2 = 'https://images.unsplash.com/photo-1722586663955-2f96a4c1f255';
/** Dentist performing a procedure with a scanner. */
export const PROCEDURE_IN_PROGRESS = 'https://images.unsplash.com/photo-1667133295315-820bb6481730';
/** Close-up of metal braces attached to teeth. */
export const BRACES_CLOSEUP = 'https://images.unsplash.com/photo-1598256989809-394fa4f6cd26';
/** Close-up of a clear retainer being worn. */
export const RETAINER_CLOSEUP = 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe';
/** Close-up of an open mouth / oral cavity. */
export const OPEN_MOUTH_CLOSEUP = 'https://images.unsplash.com/photo-1670250492416-570b5b7343b1';

// --- Doctor/medical staff profile photos ------------------------------------

/** Smiling man in a blue shirt. */
export const DOCTOR_MALE_1 = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d';
/** Male medical staff in a white coat. */
export const DOCTOR_MALE_2 = 'https://images.unsplash.com/photo-1645066928295-2506defde470';
/** Medical staff in scrubs/mask. */
export const DOCTOR_MALE_3 = 'https://images.unsplash.com/photo-1550831107-1553da8c8464';
/** Smiling woman in a blue shirt. */
export const DOCTOR_FEMALE_1 = 'https://images.unsplash.com/photo-1594824476967-48c8b964273f';
/** Female medical staff in a white coat. */
export const DOCTOR_FEMALE_2 = 'https://images.unsplash.com/photo-1659353888906-adb3e0041693';
/** Female medical staff pointing at something. */
export const DOCTOR_FEMALE_3 = 'https://images.unsplash.com/photo-1673865641073-4479f93a7776';
/** Medical staff holding a stethoscope. */
export const DOCTOR_FEMALE_4 = 'https://images.unsplash.com/photo-1643297654416-05795d62e39c';
