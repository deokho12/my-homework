import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HospitalExploreCard } from '@/features/hospital/components/HospitalExploreCard';
import * as navigation from '@/navigation';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 탐색·카테고리 화면이 함께 쓰는 병원 카드. 고정하는 것:
 *
 * 1. "OO전문의 상주" 강조는 **대분류 기준**이다 (`utils/specialty.ts` 의 `CATEGORY_SPECIALTIES`).
 *    충치치료처럼 전공이 둘인 대분류에서 한쪽만 통과하면 배지가 조용히 꺼진다.
 * 2. 시술 배지 이름은 서버 이름이 아니라 **세부 시술 이름**이다 (`cavity` → "레진").
 * 3. **거짓 거리 금지** — `userPoint` 가 없으면 거리 글자가 한 톨도 없어야 한다
 *    (`useUserLocation` 의 서울시청 폴백이 카드까지 새어 들어오는 회귀를 막는다).
 * 4. 하트는 카드 이동으로 새지 않고, 이름·눌림 상태를 낭독기에 말한다.
 */
describe('HospitalExploreCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      <HospitalExploreCard hospital={baseHospital({ procedureIds: ['resin', 'crown'] })} activeCategory="cavity" />
    );

    // `cavity` 의 서버 이름은 "충치치료" 지만 화면에서는 세부 시술 "레진" 이다.
    expect(screen.getByText('레진')).toBeInTheDocument();
    expect(screen.getByText('크라운')).toBeInTheDocument();
    expect(screen.queryByText('충치치료')).not.toBeInTheDocument();
  });

  it('taxonomy 가 모르는 서버 id 는 배지를 건너뛴다 (지어낸 이름을 그리지 않는다)', () => {
    renderWithProviders(
      <HospitalExploreCard hospital={baseHospital({ procedureIds: ['implant-general', 'future-id' as never] })} />
    );

    expect(screen.getByText('일반 임플란트')).toBeInTheDocument();
    expect(screen.queryByText('future-id')).not.toBeInTheDocument();
  });

  describe('거리', () => {
    it('userPoint 가 없으면 거리를 그리지 않는다 — 지역명만 보인다', () => {
      renderWithProviders(<HospitalExploreCard hospital={baseHospital()} />);

      expect(screen.getByText('서울 강남구')).toBeInTheDocument();
      expect(screen.queryByText(/km/)).not.toBeInTheDocument();
    });

    it('userPoint 가 있으면 지역 줄 끝에 거리를 붙인다', () => {
      renderWithProviders(
        <HospitalExploreCard
          hospital={baseHospital({ latitude: 37.5006, longitude: 127.0364 })}
          userPoint={{ latitude: 37.4979, longitude: 127.0276 }}
        />
      );

      // 강남역 ↔ 병원 좌표 ≈ 0.83km
      expect(screen.getByText('서울 강남구 · 0.8km')).toBeInTheDocument();
    });

    it('서버가 distanceKm 을 주면 화면 계산보다 서버 값을 쓴다', () => {
      renderWithProviders(
        <HospitalExploreCard
          hospital={baseHospital({ distanceKm: 2.34 })}
          userPoint={{ latitude: 37.4979, longitude: 127.0276 }}
        />
      );

      expect(screen.getByText('서울 강남구 · 2.3km')).toBeInTheDocument();
    });

    it('좌표가 0,0 인 병원은 거리를 그리지 않는다', () => {
      renderWithProviders(
        <HospitalExploreCard
          hospital={baseHospital({ latitude: 0, longitude: 0 })}
          userPoint={{ latitude: 37.4979, longitude: 127.0276 }}
        />
      );

      expect(screen.getByText('서울 강남구')).toBeInTheDocument();
      expect(screen.queryByText(/km/)).not.toBeInTheDocument();
    });
  });

  describe('찜 하트', () => {
    it('하트를 눌러도 병원 상세로 이동하지 않는다', async () => {
      const pushSpy = vi.spyOn(navigation.router, 'push').mockImplementation(() => {});

      renderWithProviders(<HospitalExploreCard hospital={baseHospital()} />);

      await userEvent.click(screen.getByRole('button', { name: '강남 스마일 치과 찜하기' }));

      expect(pushSpy).not.toHaveBeenCalledWith('/hospital/h1');
      // 하트의 제 동작은 일어났다는 것까지 본다 — 아무 일도 안 일어나도 위 단언은 통과한다.
      // 비로그인이라 로그인 화면으로 가고, `redirect` 는 붙이지 않는다(상세·마이 찜과 같은 규칙).
      expect(pushSpy).toHaveBeenCalledWith({ pathname: '/auth/login', params: {} });
    });

    it('접근성 이름에 병원 이름이 들어가고 눌림 상태를 함께 말한다', () => {
      renderWithProviders(<HospitalExploreCard hospital={baseHospital()} />);

      const heart = screen.getByRole('button', { name: '강남 스마일 치과 찜하기' });
      expect(heart).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('배지', () => {
    it('배지 줄 순서는 원데이 → 상주 → 시술이다', () => {
      renderWithProviders(
        <HospitalExploreCard
          hospital={baseHospital({
            isOneDay: true,
            representativeSpecialty: '치과보철전문의',
            procedureIds: ['resin', 'crown'],
          })}
        />
      );

      // Badge 는 View > Text 이므로 배지 줄은 라벨 글자의 할아버지 노드다.
      const badgeRow = screen.getByText('⚡ 원데이 가능').parentElement?.parentElement;
      expect(badgeRow?.textContent).toBe('⚡ 원데이 가능치과보철전문의 상주레진크라운');
    });

    it('광고·추천은 이름 줄에 있고, 원데이는 사진 위 오버레이가 아니라 배지 줄에 있다', () => {
      renderWithProviders(
        <HospitalExploreCard
          hospital={baseHospital({
            isOneDay: true,
            isRecommended: true,
            sponsorship: { isActive: true, isPlacementEligible: true },
          })}
        />
      );

      const nameRow = screen.getByText('강남 스마일 치과').parentElement;
      // `광고` 는 맨 글자, `🌟 추천` 은 Badge — 둘 다 이름과 같은 줄에 있다.
      expect(screen.getByText('광고').parentElement).toBe(nameRow);
      expect(screen.getByText('🌟 추천').parentElement?.parentElement).toBe(nameRow);
      // 원데이는 배지 줄(= 상주/시술 배지와 같은 줄)에 있다.
      const badgeRow = screen.getByText('⚡ 원데이 가능').parentElement?.parentElement;
      expect(badgeRow).not.toBe(nameRow);
      expect(badgeRow?.textContent).toContain('일반 임플란트');
    });
  });
});
