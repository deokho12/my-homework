import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import MyPageScreen from '@/screens/tabs/mypage';
import { useAuthStore } from '@/store/useAuthStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Hospital, User } from '@/types/domain';

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

function loggedInUser(): User {
  return {
    id: 'u1',
    email: 'user@molarmolar.example',
    name: '테스트',
    provider: 'email',
    role: 'user',
    managedHospitalIds: [],
  };
}

/**
 * `getHospitalById()`(zustand `getState()` 스냅샷)를 `useHospital(hospitalId)` 로 바꿨다 —
 * 찜한 병원 목록이 이제 서버에서 조회된다.
 */
describe('MyPageScreen — 찜한 병원', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: loggedInUser(), status: 'ready' });
    useFavoritesStore.setState({ hospitalIds: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('찜한 병원 id 로 useHospital 을 불러 이름을 렌더한다', async () => {
    const target = baseHospital();
    useFavoritesStore.setState({ hospitalIds: [target.id] });
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<MyPageScreen />);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
  });

  it('찜한 병원이 없으면 빈 상태 문구를 보여준다', () => {
    renderWithProviders(<MyPageScreen />);

    expect(screen.getByText(/아직 찜한 병원이 없어요/)).toBeInTheDocument();
  });

  it('조회가 끝났는데도 병원을 찾을 수 없으면(삭제됨) 조용히 걷어낸다', async () => {
    useFavoritesStore.setState({ hospitalIds: ['deleted-hospital'] });
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(new Error('not found'));

    renderWithProviders(<MyPageScreen />);

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByText(/아직 찜한 병원이 없어요/)).not.toBeInTheDocument();
  });
});
