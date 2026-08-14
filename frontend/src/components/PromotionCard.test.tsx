import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromotionCard } from '@/components/PromotionCard';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Hospital, Promotion } from '@/types/domain';

/**
 * `getHospitalById()`(zustand `getState()` 스냅샷, 비반응형)를 `useHospital(hospitalId)` 로
 * 바꿨다 — 관리자가 병원 정보를 고치면 이 카드도 다시 렌더된다 (`docs/features/known-issues.md`).
 */
describe('PromotionCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function baseHospital(overrides: Partial<Hospital> = {}): Hospital {
    return {
      id: 'h1',
      name: '강남 스마일 치과',
      specialty: '임플란트 전문의원',
      region: '서울 강남구',
      latitude: 37.5006,
      longitude: 127.0364,
      thumbnail: 'https://example.com/thumb.jpg',
      images: [],
      procedureIds: ['implant'],
      priceRange: { min: 900000, max: 1800000 },
      rating: 4.8,
      reviewCount: 312,
      consultCount: 128,
      consultAvailable: true,
      businessHours: [],
      directions: '',
      features: {
        coordinator: true,
        painlessAnesthesia: true,
        digitalCare: true,
        parking: true,
        nightConsult: true,
        cctv: false,
      },
      isOneDay: true,
      isRecommended: true,
      isSponsored: false,
      sponsoredCategories: [],
      sponsoredRank: null,
      sponsoredStartDate: null,
      sponsoredEndDate: null,
      tags: [],
      address: '서울특별시 강남구 테헤란로 123',
      introduction: '',
      events: [],
      sponsorship: { isActive: false, isPlacementEligible: false },
      representativeSpecialty: null,
      ...overrides,
    };
  }

  function promotion(overrides: Partial<Promotion> = {}): Promotion {
    return {
      id: 'promo-1',
      hospitalId: 'h1',
      procedureId: 'implant',
      title: '임플란트 특가',
      originalPrice: 1500000,
      salePrice: 990000,
      badge: '얼리버드',
      ...overrides,
    };
  }

  it('useHospital 로 조회한 병원 이름을 렌더한다', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<PromotionCard promotion={promotion({ hospitalId: target.id })} />);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(screen.getByText('얼리버드', { exact: false })).toBeInTheDocument();
  });

  it('조회가 끝나기 전에는 아무것도 렌더하지 않는다', () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<PromotionCard promotion={promotion()} />);

    expect(container.textContent).toBe('');
  });
});
