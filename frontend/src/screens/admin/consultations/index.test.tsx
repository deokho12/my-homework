import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BadgeTone } from '@/components/Badge';
import { CONSULT_STATUS_TONE } from '@/features/consult';
import * as consultApi from '@/features/consult/api/consultApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { procedures } from '@/mocks/fixtures/procedures';
import AdminConsultationsScreen from '@/screens/admin/consultations/index';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { ConsultRequest, Hospital, Paged } from '@/types/domain';

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

/** `components/Badge.tsx` 의 톤별 배경 클래스. 색이 실제로 갈리는지 보려면 한 조각은 필요하다. */
const TONE_BOX_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100',
  brand: 'bg-brand-50',
  info: 'bg-sky-50',
  warning: 'bg-amber-50',
};

function pageOf(requests: ConsultRequest[]): Paged<ConsultRequest> {
  return {
    items: requests,
    meta: { page: 1, pageSize: 100, totalItems: requests.length, totalPages: 1 },
  };
}

describe('AdminConsultationsScreen — 병원 이름 조회', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('병원 조회가 끝나기 전에는 "알 수 없는 병원" 이라고 단정하지 않는다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(pageOf([baseRequest()]));
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.queryByText(/알 수 없는 병원/)).not.toBeInTheDocument();
  });

  it('병원 조회가 끝나면 병원 이름을 보여준다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(pageOf([baseRequest()]));
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByText(/강남 스마일 치과/)).toBeInTheDocument());
  });
});

/**
 * 상태 칩 색은 마이페이지 상담 내역과 **같은 표**(`CONSULT_STATUS_TONE`)를 쓴다.
 * 예전에는 이 화면에만 `status === 'booked' ? 'brand' : 'neutral'` 이 인라인으로 있어
 * 같은 상담이 두 화면에서 다른 색으로 보일 수 있었다.
 */
describe('AdminConsultationsScreen — 상태 칩 색', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['new' as const, '신규'],
    ['contacted' as const, '연락중'],
    ['booked' as const, '예약완료'],
    ['cancelled' as const, '취소'],
  ])('%s 칩이 공용 톤(%s)으로 그려진다', async (status, label) => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(pageOf([baseRequest({ status })]));
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

    // 빠른 상태 버튼에도 같은 라벨이 있다 — 칩은 `<Badge>` 쪽(테두리 있는 알약)이다.
    const chip = screen
      .getAllByText(label)
      .map((node) => node.parentElement)
      .find((node) => node?.className.includes('rounded-full border px-2.5'));

    expect(chip?.className).toContain(TONE_BOX_CLASS[CONSULT_STATUS_TONE[status]]);
  });
});

describe('AdminConsultationsScreen — 조회 상태', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('로딩 중에는 "없어요" 문구를 보여주지 않는다', () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AdminConsultationsScreen />);

    expect(screen.queryByText(/없어요/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('0건이면 기존 빈 상태 문구를 보여준다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(pageOf([]));

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByText('접수된 상담 신청이 없어요')).toBeInTheDocument());
  });

  it('상태 칩을 고르면 그 상태로 서버에 다시 묻는다', async () => {
    const fetchSpy = vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(pageOf([]));

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith({ pageSize: 100, status: undefined }));

    await userEvent.click(screen.getByText('예약완료'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith({ pageSize: 100, status: 'booked' }));
  });

  it('조회에 실패하면 다시 시도할 수 있게 안내한다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockRejectedValue(new Error('boom'));

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument();
  });
});
