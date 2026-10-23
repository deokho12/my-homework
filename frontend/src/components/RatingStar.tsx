interface RatingStarProps {
  /** 평점. 아직 공개하지 않는 값(비로그인 전문의 평점)은 `null` 로 주면 `비공개` 라고 적는다. */
  rating: number | null;
  /**
   * 낭독기용 `평점` 안내를 붙일지. 바로 옆에 이미 `평점` 이라는 제목이 있는 자리
   * (병원 상세 요약 카드)에서만 끈다 — 켜 두면 같은 말이 두 번 읽힌다.
   */
  labelled?: boolean;
}

/**
 * 별 하나 + 평점 숫자 — 병원 카드·탐색 카드·전문의 카드·가격 비교표·병원 상세가 함께 쓴다.
 *
 * **별 색(amber)과 낭독 처리는 여기서만 정한다.** 같은 모양을 여섯 곳이 각자 적어 두니
 * 병원 상세만 amber 고 카드·비교표는 neutral 로 갈려 있었다 (SYS-24, 2026-10-23 요청자 결정).
 * 숫자는 색을 주지 않고 부모의 글자색을 그대로 물려받는다 — amber-500 은 흰 바탕에서
 * 본문 명도 대비 4.5:1 에 못 미쳐 숫자까지 칠하면 읽기 어렵다.
 */
export function RatingStar({ rating, labelled = true }: RatingStarProps) {
  return (
    <>
      {labelled ? <span className="sr-only">평점 </span> : null}
      <span className="text-amber-500" aria-hidden="true">
        ★
      </span>{' '}
      {rating === null ? '비공개' : rating.toFixed(1)}
    </>
  );
}
