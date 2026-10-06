import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HospitalExploreCard } from '@/features/hospital/components/HospitalExploreCard';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 탐색·카테고리 화면이 함께 쓰는 병원 카드. 두 가지만 고정한다:
 *
 * 1. "OO전문의 상주" 강조는 **대분류 기준**이다 (`utils/specialty.ts` 의 `CATEGORY_SPECIALTIES`).
 *    충치치료처럼 전공이 둘인 대분류에서 한쪽만 통과하면 배지가 조용히 꺼진다.
 * 2. 시술 배지 이름은 서버 이름이 아니라 **세부 시술 이름**이다 (`cavity` → "레진").
 *    `displayNameForLegacy` 가 동기 함수라 네트워크 대기 없이 즉시 그려져야 한다.
 */
describe('HospitalExploreCard', () => {
  /** Badge 의 tone 은 글자색으로 드러난다 — brand 면 `text-brand-700`, neutral 이면 `text-neutral-600`. */
  const badgeTextOf = (label: string) => screen.getByText(label);

  it('대분류와 맞는 전공이면 상주 배지를 brand 톤으로 강조한다', () => {
    renderWithProviders(
      <HospitalExploreCard
        hospital={baseHospital({ representativeSpecialty: '통합치의학과전문의' })}
        activeCategory="cavity"
      />
    );

    expect(badgeTextOf('통합치의학과전문의 상주')).toHaveClass('text-brand-700');
  });

  it('대분류와 맞지 않는 전공이면 상주 배지를 강조하지 않는다', () => {
    renderWithProviders(
      <HospitalExploreCard
        hospital={baseHospital({ representativeSpecialty: '치과교정전문의' })}
        activeCategory="cavity"
      />
    );

    expect(badgeTextOf('치과교정전문의 상주')).toHaveClass('text-neutral-600');
  });

  it('시술 배지는 서버 이름이 아니라 세부 시술 이름으로 즉시 그려진다', () => {
    renderWithProviders(
      <HospitalExploreCard hospital={baseHospital({ procedureIds: ['cavity', 'crown'] })} activeCategory="cavity" />
    );

    // `cavity` 의 서버 이름은 "충치치료" 지만 화면에서는 세부 시술 "레진" 이다.
    expect(screen.getByText('레진')).toBeInTheDocument();
    expect(screen.getByText('크라운')).toBeInTheDocument();
    expect(screen.queryByText('충치치료')).not.toBeInTheDocument();
  });

  it('taxonomy 가 모르는 서버 id 는 배지를 건너뛴다 (지어낸 이름을 그리지 않는다)', () => {
    renderWithProviders(
      <HospitalExploreCard hospital={baseHospital({ procedureIds: ['implant', 'future-id' as never] })} />
    );

    expect(screen.getByText('일반 임플란트')).toBeInTheDocument();
    expect(screen.queryByText('future-id')).not.toBeInTheDocument();
  });
});
