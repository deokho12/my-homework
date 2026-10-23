import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HospitalSummaryLine } from '@/features/hospital/components/HospitalSummaryLine';
import type { TodayHours } from '@/features/hospital/lib/businessHours';

const OPEN_UNTIL_19: TodayHours = {
  entry: { day: '금', hours: '10:00 - 19:00' },
  status: 'open',
  closesAt: '19:00',
};

const UNKNOWN: TodayHours = { entry: null, status: 'unknown', closesAt: null };

describe('HospitalSummaryLine — 다른 탭에서 요약 카드를 대신하는 한 줄', () => {
  it('진료 상태·가격대·평점을 한 줄로 줄여 적는다', () => {
    render(
      <HospitalSummaryLine
        today={OPEN_UNTIL_19}
        priceRange={{ min: 900000, max: 1800000 }}
        rating={4.8}
        reviewCount={312}
      />
    );

    expect(screen.getByText('진료중 · 19시까지')).toBeInTheDocument();
    expect(screen.getByText('900,000원 ~ 1,800,000원')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
  });

  it('★ 는 장식이라, 숫자가 무엇의 숫자인지 낭독기에 따로 알린다', () => {
    render(
      <HospitalSummaryLine today={UNKNOWN} priceRange={{ min: 0, max: 0 }} rating={4.8} reviewCount={312} />
    );

    expect(screen.getByText('평점')).toBeInTheDocument();
    expect(screen.getByText('★')).toHaveAttribute('aria-hidden', 'true');
  });

  it('적을 값이 하나도 없으면 아무것도 그리지 않는다 — 테두리만 남은 빈 줄을 만들지 않는다', () => {
    const { container } = render(
      <HospitalSummaryLine today={UNKNOWN} priceRange={{ min: 0, max: 0 }} rating={0} reviewCount={0} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('후기가 없으면 평점 자리를 비운다 — 0.0 을 적지 않는다', () => {
    render(
      <HospitalSummaryLine
        today={OPEN_UNTIL_19}
        priceRange={{ min: 0, max: 0 }}
        rating={0}
        reviewCount={0}
      />
    );

    expect(screen.getByText('진료중 · 19시까지')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });
});
