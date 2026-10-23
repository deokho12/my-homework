import { closesAtLabel, type TodayHours } from '@/features/hospital/lib/businessHours';
import type { PriceRange } from '@/types/domain';
import { formatPriceRange } from '@/utils/format';

interface HospitalSummaryLineProps {
  today: TodayHours;
  priceRange: PriceRange;
  rating: number;
  reviewCount: number;
}

/**
 * 다른 탭에서 요약 카드를 대신하는 한 줄 (2026-10-23 시안 B-2).
 * 카드와 **같은 값**을 줄여 적는다 — 두 곳이 다른 규칙으로 갈리지 않게 같은
 * `TodayHours` 를 받는다.
 */
export function HospitalSummaryLine({ today, priceRange, rating, reviewCount }: HospitalSummaryLineProps) {
  const statusText =
    today.status === 'open'
      ? today.closesAt
        ? `진료중 · ${closesAtLabel(today.closesAt)}`
        : '진료중'
      : today.status === 'closed'
        ? '진료 종료'
        : null;

  const hasPrice = priceRange.max > 0;
  const hasRating = reviewCount > 0;

  // 셋 다 없으면 아무것도 그리지 않는다 — 빈 줄에 테두리만 남는 자리가 생긴다.
  if (statusText === null && !hasPrice && !hasRating) return null;

  return (
    <div className="-mx-4 mb-1 flex items-center gap-2 border-b border-neutral-100 bg-white px-4 py-2.5 md:-mx-6 lg:-mx-8">
      {statusText ? <span className="shrink-0 text-[13px] font-semibold text-neutral-700">{statusText}</span> : null}
      {statusText && hasPrice ? (
        <span className="shrink-0 text-[13px] text-neutral-500" aria-hidden="true">
          ·
        </span>
      ) : null}
      {hasPrice ? (
        <span className="min-w-0 truncate text-[13px] text-neutral-500">
          {formatPriceRange(priceRange.min, priceRange.max)}
        </span>
      ) : null}
      {hasRating ? (
        <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
          {/* 별은 장식이라 숨기고, 숫자만 읽히지 않게 무엇의 숫자인지 낭독기에 알린다. */}
          <span className="sr-only">평점 </span>
          <span className="text-amber-500" aria-hidden="true">
            ★
          </span>{' '}
          {rating.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}
