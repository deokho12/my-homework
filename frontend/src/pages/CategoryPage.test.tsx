import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import CategoryPage from '@/pages/CategoryPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Hospital, Paged, ProcedureId } from '@/types/domain';

/**
 * 카테고리 화면의 계약은 "어떤 요청을 보내고 무엇을 보여주는가" 다 —
 * `fetchHospitals` 를 스파이해서 호출 인자를 직접 본다 (`ExplorePage.test.tsx` 와 같은 방식).
 */
function paged(items: Hospital[], totalItems = items.length): Paged<Hospital> {
  return { items, meta: { page: 1, pageSize: 20, totalItems, totalPages: 1 } };
}

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
    procedureIds: ['crown'] as ProcedureId[],
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

function render(route: string) {
  return renderWithProviders(<CategoryPage />, { route, path: '/category/:categoryId' });
}

describe('CategoryPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('대분류 이름과 설명을 헤더에 그린다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/cavity');

    expect(screen.getByText('충치치료')).toBeInTheDocument();
    expect(screen.getByText('초기 충치부터 신경치료·보철까지')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('총 1곳')).toBeInTheDocument());
  });

  it('서버가 모르는 세부 시술은 "준비중" 으로 보이되 눌리지 않는다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/cavity');

    expect(screen.getByRole('button', { name: '신경치료 · 준비중' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: '온레이 · 준비중' })).toHaveAttribute('aria-disabled', 'true');
    // 서버 id 가 있는 세부는 비활성이 아니다.
    expect(screen.getByRole('button', { name: '크라운' })).not.toHaveAttribute('aria-disabled');
  });

  it('세부 시술 칩을 누르면 그 시술로 서버에 다시 묻고 헤더가 바뀐다', async () => {
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitals')
      .mockImplementation(async (filters = {}) =>
        filters.procedureId === 'crown'
          ? paged([baseHospital({ id: 'h7', procedureIds: ['crown'] })])
          : paged([
              baseHospital({ id: 'h7', procedureIds: ['crown'] }),
              baseHospital({ id: 'h3', procedureIds: ['cavity'] }),
            ])
      );

    render('/category/cavity');

    await waitFor(() => expect(screen.getByText('총 2곳')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '크라운' }));

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ procedureId: 'crown' })));
    await waitFor(() => expect(screen.getByText('“크라운” 병원')).toBeInTheDocument());
    expect(screen.getByText('총 1곳')).toBeInTheDocument();
  });

  it('대분류 전체가 서버 시술 여러 개에 걸리면 넉넉히 받아 클라이언트가 거른다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(
      paged([
        baseHospital({ id: 'h1', procedureIds: ['implant'] }),
        baseHospital({ id: 'h7', procedureIds: ['crown'] }),
      ])
    );

    render('/category/cavity');

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 })));
    // 받은 2곳 중 충치치료에 걸리는 건 1곳 — meta.totalItems 도 다시 센다.
    await waitFor(() => expect(screen.getByText('총 1곳')).toBeInTheDocument());
  });

  it('세부가 전부 준비중인 대분류는 요청하지 않고 전용 빈 상태를 보여준다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/prevention');

    expect(await screen.findByText('등록된 병원이 아직 없어요')).toBeInTheDocument();
    expect(screen.getByText('이 시술은 준비중이에요')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('?sub= 가 준비중 세부면 안내하고 대분류 전체를 보여준다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/cavity?sub=root-canal');

    expect(screen.getByText('신경치료은(는) 준비중이에요 — 충치치료 전체를 보여드려요')).toBeInTheDocument();
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 })));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');

    // 칩 줄은 실제로 보고 있는 목록(= 전체)을 가리킨다. 비활성 칩이 눌린 상태로 남지 않는다.
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '신경치료 · 준비중' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('다른 대분류의 세부 시술이 ?sub= 로 오면 무시한다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/implant?sub=crown');

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'implant' })));
    expect(screen.queryByText(/준비중이에요/)).not.toBeInTheDocument();
  });

  it('없는 카테고리는 탐색으로 되돌아갈 길을 준다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    render('/category/bogus');

    expect(screen.getByText('없는 카테고리예요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '병원 탐색으로' })).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('정렬 칩은 서버 sort 값으로 번역된다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/implant');
    await waitFor(() => expect(spy).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: '후기순' }));
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'reviewCount' })));

    await userEvent.click(screen.getByRole('button', { name: '상담가능' }));
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ consultAvailable: true })));
  });
});
