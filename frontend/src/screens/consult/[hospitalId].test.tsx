import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';
import { RouterBridge } from '@/navigation';
import ConsultRequestScreen from '@/screens/consult/[hospitalId]';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useConsultStore } from '@/store/useConsultStore';
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
 * `getHospitalById()`(동기 스냅샷)를 `useHospital(hospitalId)` 로 바꿨다 — 조회 상태(로딩·404·
 * 에러)를 실제로 구분해야 한다 (`HospitalDetailPage` 와 같은 패턴).
 */
describe('ConsultRequestScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useConsultStore.setState({ requests: [] });
  });

  function renderScreen(hospitalId: string) {
    return renderWithProviders(
      <>
        <RouterBridge />
        <ConsultRequestScreen />
      </>,
      { route: `/consult/${hospitalId}`, path: '/consult/:hospitalId' }
    );
  }

  it('로딩 중에는 병원을 찾을 수 없다고 단정하지 않는다', () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderScreen('h1');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('병원 정보를 찾을 수 없어요')).not.toBeInTheDocument();
  });

  it('불러온 병원 이름과 폼을 렌더하고, 제출하면 상담 스토어에 저장한다', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderScreen(target.id);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
    await userEvent.type(screen.getByPlaceholderText('010-0000-0000'), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    expect(useConsultStore.getState().requests).toHaveLength(1);
    expect(useConsultStore.getState().requests[0]).toMatchObject({
      hospitalId: target.id,
      name: '홍길동',
      phone: '01012345678',
    });
  });

  it('404 HOSPITAL_NOT_FOUND 면 안내 문구를 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );

    renderScreen('no-such-hospital');

    await waitFor(() => expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument());
  });
});
