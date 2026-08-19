import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as consultApi from '@/features/consult/api/consultApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { ApiError } from '@/lib/apiClient';
import { procedures } from '@/mocks/fixtures/procedures';
import AdminConsultationDetailScreen from '@/screens/admin/consultations/[id]';
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
  });

  it('병원 조회가 끝나기 전에는 "알 수 없는 병원" 이라고 단정하지 않는다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequestById').mockResolvedValue(baseRequest());
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderScreen('c1');

    await waitFor(() => expect(screen.getByText('연락처')).toBeInTheDocument());
    expect(screen.queryByText('알 수 없는 병원')).not.toBeInTheDocument();
  });

  it('병원 조회가 끝나면 병원 이름을 보여준다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequestById').mockResolvedValue(baseRequest());
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());

    renderScreen('c1');

    await waitFor(() => expect(screen.getByText('강남 스마일 치과')).toBeInTheDocument());
  });
});

describe('AdminConsultationDetailScreen — 조회 상태', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('로딩 중에는 상담을 찾을 수 없다고 단정하지 않는다', () => {
    vi.spyOn(consultApi, 'fetchConsultRequestById').mockReturnValue(new Promise(() => {}));

    renderScreen('c1');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('상담 정보를 찾을 수 없어요')).not.toBeInTheDocument();
  });

  it('404 CONSULT_REQUEST_NOT_FOUND 면 기존 안내 문구를 보여준다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequestById').mockRejectedValue(
      new ApiError({ status: 404, code: 'CONSULT_REQUEST_NOT_FOUND', message: '상담 정보를 찾을 수 없어요' })
    );

    renderScreen('nope');

    await waitFor(() => expect(screen.getByText('상담 정보를 찾을 수 없어요')).toBeInTheDocument());
    // 없는 상담은 "다시 시도" 를 권할 에러가 아니다.
    expect(screen.queryByRole('button', { name: /다시 시도/ })).not.toBeInTheDocument();
  });

  it('메모를 추가하면 저장 API 를 부른다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequestById').mockResolvedValue(baseRequest());
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    const addMemo = vi
      .spyOn(consultApi, 'addConsultMemo')
      .mockResolvedValue(baseRequest({ memos: [{ id: 'm1', content: '연락 완료', createdAt: 'x' }] }));

    renderScreen('c1');

    await waitFor(() => expect(screen.getByPlaceholderText('내부 공유용 메모를 남겨보세요')).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText('내부 공유용 메모를 남겨보세요'), '연락 완료');
    await userEvent.click(screen.getByRole('button', { name: '메모 추가' }));

    await waitFor(() => expect(addMemo).toHaveBeenCalledWith('c1', '연락 완료'));
  });

  it('상태 칩을 누르면 상태 변경 API 를 부른다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequestById').mockResolvedValue(baseRequest());
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    const updateStatus = vi
      .spyOn(consultApi, 'updateConsultStatus')
      .mockResolvedValue(baseRequest({ status: 'booked' }));

    renderScreen('c1');

    await waitFor(() => expect(screen.getByText('상태 변경')).toBeInTheDocument());
    await userEvent.click(screen.getByText('예약완료'));

    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith('c1', 'booked'));
  });
});
