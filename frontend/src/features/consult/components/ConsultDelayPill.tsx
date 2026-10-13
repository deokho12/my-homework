/**
 * `지연` 표시. **목록 카드·대시보드의 오늘 할 일·최근 상담 줄이 같은 조각을 쓴다** —
 * 각자 복사해 두면 같은 상담이 한 화면에서 다른 생김새로 보인다.
 *
 * 상태 칩이 아니라서 `Badge(danger)` 를 쓰지 않는다 — 같은 빨강이라도 더 작고 굵은 pill 로
 * 두어 옆의 `취소` 칩과 갈린다. **색 없이 글자로도 읽힌다.**
 *
 * 판정은 여기 없다 — `isConsultDelayed`(`consultDisplay.ts`) 하나뿐이고, 대시보드 숫자는
 * 서버가 같은 부등식으로 센 값을 그대로 쓴다.
 */
export function ConsultDelayPill() {
  return (
    <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
      지연
    </span>
  );
}
