import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromotionCard } from '@/components/PromotionCard';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Promotion } from '@/types/domain';

/**
 * `getHospitalById()`(zustand `getState()` 스냅샷, 비반응형)를 `useHospital(hospitalId)` 로
 * 바꿨다 — 관리자가 병원 정보를 고치면 이 카드도 다시 렌더된다 (`docs/features/known-issues.md`).
 */
describe('PromotionCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
