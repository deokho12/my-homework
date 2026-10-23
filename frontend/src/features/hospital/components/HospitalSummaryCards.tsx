import { BadgeCheck, Clock, Coins, Star, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/Badge';
import type { TodayHours } from '@/features/hospital/lib/businessHours';
import { summarizeDoctors } from '@/features/hospital/lib/doctorsSummary';
import type { Doctor, PriceRange } from '@/types/domain';
import { formatPriceRange } from '@/utils/format';

interface HospitalSummaryCardsProps {
  today: TodayHours;
  priceRange: PriceRange;
  /** 아직 도착하지 않았으면 undefined — "없다" 와 다르게 적는다. */
  doctors: Doctor[] | undefined;
  doctorsLoading: boolean;
  doctorsError: boolean;
  rating: number;
  reviewCount: number;
}

function SummaryCard({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-100 p-4">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
        <Icon size={14} aria-hidden="true" />
        {label}
      </p>
      {children}
    </div>
  );
}

/** 값이 없는 칸. 빈 상태 문구는 섹션 안의 문구와 같은 톤으로 짧게 적는다. */
function EmptyValue({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

function Value({ children }: { children: ReactNode }) {
  return <p className="text-[15px] font-bold text-neutral-900">{children}</p>;
}

function doctorsLine(doctors: Doctor[] | undefined, isLoading: boolean, isError: boolean) {
  if (isLoading) return <EmptyValue>불러오는 중이에요</EmptyValue>;
  if (isError || !doctors) return <EmptyValue>불러오지 못했어요</EmptyValue>;

  const { headline, specialties } = summarizeDoctors(doctors);

  if (headline === null) return <EmptyValue>등록된 의료진이 없어요</EmptyValue>;

  return (
    <>
      <Value>{headline}</Value>
      {specialties ? <p className="mt-1 text-xs text-neutral-500">{specialties}</p> : null}
    </>
  );
}

/**
 * 사진 아래 요약 카드 2×2 — "지금 문 열었나 · 얼마나 드나 · 누가 보나 · 평은 어떤가"
 * 를 스크롤 전에 답한다 (2026-10-23 시안 B-1).
 *
 * **새 데이터를 쓰지 않는다.** 네 칸 모두 이미 화면이 받던 값(`businessHours`·`priceRange`·
 * 전문의 목록·`rating`)에서 나온다.
 */
export function HospitalSummaryCards({
  today,
  priceRange,
  doctors,
  doctorsLoading,
  doctorsError,
  rating,
  reviewCount,
}: HospitalSummaryCardsProps) {
  const hasPrice = priceRange.max > 0;

  return (
    <div className="mb-4 grid grid-cols-2 gap-3">
      <SummaryCard icon={Clock} label={today.entry ? `오늘 (${today.entry.day})` : '오늘'}>
        {today.entry === null ? (
          <EmptyValue>등록된 진료시간이 없어요</EmptyValue>
        ) : (
          <Value>{today.entry.isClosed ? '휴무' : today.entry.hours}</Value>
        )}
        {/* `unknown` 이면 배지를 숨긴다 — 읽지 못한 문자열로 열림/닫힘을 단정하지 않는다. */}
        {today.status === 'unknown' ? null : (
          <div className="mt-1.5 flex flex-row">
            <Badge
              label={today.status === 'open' ? '진료중' : '진료 종료'}
              tone={today.status === 'open' ? 'brand' : 'neutral'}
            />
          </div>
        )}
      </SummaryCard>

      <SummaryCard icon={Coins} label="가격대">
        {hasPrice ? (
          <Value>{formatPriceRange(priceRange.min, priceRange.max)}</Value>
        ) : (
          <EmptyValue>등록된 가격 정보가 없어요</EmptyValue>
        )}
      </SummaryCard>

      <SummaryCard icon={BadgeCheck} label="의료진">
        {doctorsLine(doctors, doctorsLoading, doctorsError)}
      </SummaryCard>

      <SummaryCard icon={Star} label="평점">
        {reviewCount === 0 ? (
          <EmptyValue>아직 후기가 없어요</EmptyValue>
        ) : (
          <>
            <Value>
              {/* 별점 ★ 은 amber 를 쓴다 (`docs/conventions/frontend.md` 의 예외). */}
              <span className="text-amber-500" aria-hidden="true">
                ★
              </span>{' '}
              {rating.toFixed(1)}
            </Value>
            <p className="mt-1 text-xs text-neutral-500">후기 {reviewCount}개</p>
          </>
        )}
      </SummaryCard>
    </div>
  );
}
