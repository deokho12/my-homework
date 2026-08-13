/**
 * 광고(스폰서) 판정. `frontend/src/utils/sponsorship.ts` 의 규칙을 그대로 옮긴 것이다.
 *
 * **서버가 계산하는 이유:** 클라이언트가 기기 시계로 기간을 판정하면 시계가 틀린 사용자에게
 * 광고가 잘못 노출된다. 계약(`listHospitals`)이 두 값을 각각 내려주라고 명시한다.
 *
 * 순수 함수다 — `new Date()` 를 부르지 않고 `today` 를 인자로 받는다. 기간 경계를
 * 테스트할 수 있어야 하기 때문이다.
 */

/** 이 평점 미만이면 계약·기간이 유효해도 상단 노출에서 제외한다. */
export const MIN_SPONSORED_RATING = 3.5;

export interface SponsorshipInput {
  isSponsored: boolean;
  sponsoredCategories: string[];
  /** 'YYYY-MM-DD' (KST 달력일, 포함). 광고가 없으면 null. */
  startDate: string | null;
  endDate: string | null;
  rating: number;
}

export interface SponsorshipState {
  /** 광고 기간 중인가. `광고` 배지의 조건. */
  isActive: boolean;
  /** 상단 노출 자격이 있는가. 기간 + 평점 + (지정 시) 카테고리. */
  isPlacementEligible: boolean;
}

export interface ComputeSponsorshipOptions {
  /** `Asia/Seoul` 기준 오늘 (`YYYY-MM-DD`). */
  today: string;
  /**
   * 시술 칩으로 좁힌 경우의 시술 id. `추천` 탭이나 필터 없음이면 넘기지 않는다.
   * 넘기지 않으면 카테고리 일치 검사를 하지 않는다 (계약 규칙 2).
   */
  procedureId?: string;
}

export function computeSponsorship(
  input: SponsorshipInput,
  options: ComputeSponsorshipOptions
): SponsorshipState {
  const isActive =
    input.isSponsored &&
    input.startDate !== null &&
    input.endDate !== null &&
    options.today >= input.startDate &&
    options.today <= input.endDate;

  if (!isActive) {
    return { isActive: false, isPlacementEligible: false };
  }

  const ratingOk = input.rating >= MIN_SPONSORED_RATING;
  const categoryOk =
    options.procedureId === undefined || input.sponsoredCategories.includes(options.procedureId);

  return { isActive: true, isPlacementEligible: ratingOk && categoryOk };
}

/**
 * `Asia/Seoul` 기준 오늘 (`YYYY-MM-DD`).
 *
 * 광고·프로모션 기간은 KST 달력일이다 (docs/database/README.md §3.7). 서버가 UTC 로
 * 돌더라도 "오늘"의 경계는 한국 자정이어야 하며, 그렇지 않으면 광고가 9시간 일찍 끝난다.
 *
 * `Intl` 로 계산한다 — 오프셋을 직접 더하면 서버 로컬 타임존에 오염된다.
 */
export function seoulToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
