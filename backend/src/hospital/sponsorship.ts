/**
 * 광고(스폰서) 판정. 원래 프론트엔드에 있던 클라이언트 계산 로직의 규칙을 그대로 옮긴 것이다
 * (그 파일은 스토어 정리 Task 로 삭제됐다 — 규칙은 이제 여기 한 곳에만 있다).
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
   * 이 요청이 좁힌 **시술 id 집합**. 세부 시술 칩이면 원소 1개, 분야 탭이면 그 분야의
   * 시술 전부다 (2026-10-21 요청 14 — 전에는 `procedureId?: string` 하나였다).
   * `추천` 탭이나 필터 없음이면 넘기지 않는다 — 넘기지 않으면 카테고리 일치 검사를
   * 하지 않는다 (계약 규칙 2·4).
   *
   * **분야용 판정 함수를 따로 만들지 않는다.** 원소 1개짜리 집합이 지금까지의 동작과
   * 완전히 같으므로, 규칙은 이 함수 하나에 남는다 (AGENTS.md — 같은 판정을 두 곳에
   * 두지 않는다).
   */
  procedureIds?: string[];
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
  const requested = options.procedureIds;
  const categoryOk =
    requested === undefined || input.sponsoredCategories.some((id) => requested.includes(id));

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
