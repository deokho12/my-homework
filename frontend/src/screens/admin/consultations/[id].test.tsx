import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { procedures } from '@/mocks/fixtures/procedures';
import AdminConsultationDetailScreen from '@/screens/admin/consultations/[id]';
import { useConsultStore } from '@/store/useConsultStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { ConsultRequest, Hospital } from '@/types/domain';

function baseRequest(overrides: Partial<ConsultRequest> = {}): ConsultRequest {
  return {
    id: 'c1',
    hospitalId: 'h1',
    procedureId: null,
    name: '홍길동',
    phone: '01012345678',
    preferredTime: '',
    message: '',
    createdAt: new Date().toISOString(),
    status: 'new',
    statusHistory: [],
    memos: [],
    ...overrides,
  };
}

function baseHospital(overrides: Partial<Hospital> = {}): Hospital {
  return {
    id: 'h1',
    name: '강남 스마일 치과',
    specialty: '',
    region: '서울 강남구',
    latitude: 37.5,
    longitude: 127.0,
    thumbnail: '',
    images: [],
    procedureIds: [],
    priceRange: { min: 0, max: 0 },
    rating: 4.8,
    reviewCount: 0,
    consultCount: 0,
    consultAvailable: true,
    businessHours: [],
    directions: '',
    features: {
      coordinator: false,
      painlessAnesthesia: false,
      digitalCare: false,
      parking: false,
      nightConsult: false,
      cctv: false,
    },
    isOneDay: false,
    isRecommended: false,
    isSponsored: false,
    sponsoredCategories: [],
    sponsoredRank: null,
    sponsoredStartDate: null,
    sponsoredEndDate: null,
    tags: [],
    address: '',
    introduction: '',
    events: [],
    sponsorship: { isActive: false, isPlacementEligible: false },
    representativeSpecialty: null,
    ...overrides,
  };
}

function renderScreen(id: string) {
  return renderWithProviders(<AdminConsultationDetailScreen />, {
    route: `/admin/consultations/${id}`,
    path: '/admin/consultations/:id',
  });
}

describe('AdminConsultationDetailScreen — 병원 이름 조회', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useConsultStore.setState({ requests: [] });
  });

  it('병원 조회가 끝나기 전에는 "알 수 없는 병원" 이라고 단정하지 않는다', async () => {
    useConsultStore.setState({ requests: [baseRequest()] });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderScreen('c1');

    await waitFor(() => expect(screen.getByText('연락처')).toBeInTheDocument());
    expect(screen.queryByText('알 수 없는 병원')).not.toBeInTheDocument();
  });

  it('병원 조회가 끝나면 병원 이름을 보여준다', async () => {
    useConsultStore.setState({ requests: [baseRequest()] });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());

    renderScreen('c1');

    await waitFor(() => expect(screen.getByText('강남 스마일 치과')).toBeInTheDocument());
  });
});
