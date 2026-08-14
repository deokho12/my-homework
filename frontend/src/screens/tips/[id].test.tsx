import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { guides } from '@/mocks/fixtures/guides';
import TipDetailScreen from '@/screens/tips/[id]';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Hospital } from '@/types/domain';

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

/**
 * 관련 병원은 이제 `useHospital(hospitalId)` 로 조회한다(예전 `getHospitalById()` 는
 * zustand `getState()` 스냅샷이라 비반응형이었다 — `docs/features/known-issues.md`).
 * `g1` 의 `relatedHospitals`(`@/mocks/fixtures/guides`) 에 실린 id 마다 서로 다른
 * 이름의 fixture 병원을 만들어 준다 — 이름이 겹치면 `getByText` 가 여러 건을 찾아 실패한다.
 */
describe('TipDetailScreen — 관련 병원', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('관련 병원을 useHospital 로 조회해 이름을 렌더한다', async () => {
    const guide = guides.find((item) => item.id === 'g1')!;
    const hospitals = (guide.relatedHospitals ?? []).map((id, index) =>
      baseHospital({ id, name: `관련병원${index + 1}` })
    );
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) => {
      const found = hospitals.find((hospital) => hospital.id === id);
      if (!found) throw new Error(`no fixture hospital: ${id}`);
      return found;
    });

    renderWithProviders(<TipDetailScreen />, { route: '/tips/g1', path: '/tips/:id' });

    const h1 = hospitals.find((hospital) => hospital.id === 'h1')!;
    await waitFor(() => expect(screen.getByText(h1.name)).toBeInTheDocument());
    expect(screen.getByText('관련 병원 보기')).toBeInTheDocument();
  });
});
