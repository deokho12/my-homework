import type { Doctor } from '@/types/domain';

export interface DoctorsSummary {
  /** `전문의 2명` · `의료진 3명`. 등록된 의료진이 없으면 null. */
  headline: string | null;
  /** `치과보철과 · 치과교정과` — 전문의가 있을 때만. 그 밖에는 null. */
  specialties: string | null;
}

/**
 * 요약 카드의 `의료진` 칸 한 줄.
 *
 * **`전문의` 배지와 같은 근거(`isVerifiedSpecialist`·`visibleSpecialty`)만 본다.** 둘 다
 * 서버 계산 필드라 화면이 다시 판정하지 않는다 — 같은 화면의 의료진 목록과 이 숫자가
 * 어긋나면 어느 쪽이 맞는지 아무도 모른다 (`AGENTS.md` — 같은 판정을 두 곳에 두지 않는다).
 */
export function summarizeDoctors(doctors: readonly Doctor[]): DoctorsSummary {
  if (doctors.length === 0) return { headline: null, specialties: null };

  const specialists = doctors.filter((doctor) => doctor.isVerifiedSpecialist);

  if (specialists.length === 0) return { headline: `의료진 ${doctors.length}명`, specialties: null };

  const names = [...new Set(specialists.flatMap((doctor) => doctor.visibleSpecialty ?? []))];

  return {
    headline: `전문의 ${specialists.length}명`,
    specialties: names.length > 0 ? names.join(' · ') : null,
  };
}
