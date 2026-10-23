import { Tag } from 'lucide-react';

interface PromoBadgeProps {
  label: string;
  /**
   * 사진 위에 얹히는 자리(이벤트 카드·병원 카드의 왼쪽 위)는 글자를 굵게 쓴다 —
   * 사진 대비 위에서 `font-medium` 은 묻힌다. 글 흐름 안의 배지(병원 상세)는 기본값이다.
   */
  onPhoto?: boolean;
  /** 놓일 자리만 정한다 (`absolute left-3 top-3`). 모양 클래스는 이 컴포넌트가 소유한다. */
  className?: string;
}

/**
 * 할인(프로모) 알약 — `얼리버드`·`할인 28%` 처럼 **깎인 값**을 말하는 자리에만 쓴다.
 * 이벤트 카드·병원 카드·병원 상세 배너가 이 컴포넌트 하나를 쓴다.
 *
 * **아이콘은 `Tag` 하나로 고정이다** (호출부가 고를 수 없다). 원래는 어디서나 같은 🔥
 * 이모지였는데, lucide 로 옮기며 화면마다 다른 아이콘(`Flame`/`Tag`)이 붙었다 — 같은 뜻에
 * 다른 그림이 붙지 않도록 컴포넌트가 소유한다 (SYS-22 리뷰).
 *
 * 공용 `Badge` 를 쓰지 않는 이유는 색이다. 규칙상 할인은 rose 인데, `Badge` 의 rose(`danger`)
 * 는 `취소` 처럼 "끝났고 이루어지지 않았다" 를 가리키는 연한 테두리 알약이다 (2026-10-23 시안은
 * 할인을 꽉 찬 rose 로 그린다). 상태 배지는 전부 `Badge` 를 쓴다.
 *
 * 예전 `features/hospital/components/SalePill.tsx` 였다 — 소비자가 병원 상세 밖으로 늘어나서
 * `components/` 로 올렸다(그 파일의 주석이 예고한 이동이다).
 */
export function PromoBadge({ label, onPhoto = false, className }: PromoBadgeProps) {
  const weight = onPhoto ? 'font-bold' : 'font-medium';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-xs text-white ${weight}${
        className ? ` ${className}` : ''
      }`}
    >
      <Tag size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
