import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { SUB_PROCEDURES } from '@/features/procedure/taxonomy';
import CategoryPage from '@/pages/CategoryPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Hospital, Paged, ProcedureId } from '@/types/domain';

/**
 * 카테고리 화면의 계약은 "어떤 요청을 보내고 무엇을 보여주는가" 다 —
 * `fetchHospitals` 를 스파이해서 호출 인자를 직접 본다 (`ExplorePage.test.tsx` 와 같은 방식).
 */
function paged(items: Hospital[], totalItems = items.length, totalPages = 1): Paged<Hospital> {
  return { items, meta: { page: 1, pageSize: 20, totalItems, totalPages } };
}

/**
 * `GET /procedures` 응답 — `준비중` 은 이 응답의 `isAvailable` 에서만 온다 (요청 14).
 * 아무것도 스텁하지 않으면 응답이 없는 상태(= 아무것도 준비중이 아님)를 본다.
 */
function stubProcedures(availableIds: readonly string[]) {
  return vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(
    SUB_PROCEDURES.map((sub) => ({
      id: sub.id,
      name: sub.name,
      emoji: '',
      shortDescription: '',
      description: '',
      categoryId: sub.categoryId,
      isAvailable: availableIds.includes(sub.id),
    }))
  );
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

  it('등록된 병원이 없는 세부 시술은 "· 준비중" 으로 보이되 **누를 수 있다**', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));
    stubProcedures(['crown', 'resin']);

    render('/category/cavity');

    const comingSoon = await screen.findByRole('button', { name: '신경치료 · 준비중' });
    // 서버가 31개를 다 아는 지금은 물어볼 수 있다 — 답이 0건일 뿐이고, 빈 상태가 그것을 말한다.
    expect(comingSoon).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: '온레이 · 준비중' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '크라운' })).toBeInTheDocument();
  });

  it('`GET /procedures` 가 오기 전에는 준비중 배지를 달지 않는다', () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));
    stubProcedures([]);

    render('/category/cavity');

    expect(screen.getByRole('button', { name: '신경치료' })).toBeInTheDocument();
    expect(screen.queryByText(/준비중/)).not.toBeInTheDocument();
  });

  it('세부 시술 칩을 누르면 그 시술로 서버에 다시 묻고 헤더가 바뀐다', async () => {
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitals')
      .mockImplementation(async (filters = {}) =>
        filters.procedureId === 'crown'
          ? paged([baseHospital({ id: 'h7', procedureIds: ['crown'] })])
          : paged([
              baseHospital({ id: 'h7', procedureIds: ['crown'] }),
              baseHospital({ id: 'h3', procedureIds: ['resin'] }),
            ])
      );

    render('/category/cavity');

    await waitFor(() => expect(screen.getByText('총 2곳')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '크라운' }));

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ procedureId: 'crown' })));
    await waitFor(() => expect(screen.getByText('“크라운” 병원')).toBeInTheDocument());
    expect(screen.getByText('총 1곳')).toBeInTheDocument();
  });

  it('분야 전체는 categoryId 한 번으로 묻는다 — 받아서 거르지 않는다', async () => {
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitals')
      .mockResolvedValue(paged([baseHospital({ id: 'h7', procedureIds: ['crown'] })]));

    render('/category/cavity');

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cavity' })));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');
    await waitFor(() => expect(screen.getByText('총 1곳')).toBeInTheDocument());
  });

  it('등록된 병원이 없는 분야도 물어보고, 빈 상태가 준비중이라고 말한다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));
    stubProcedures([]);

    render('/category/prevention');

    expect(await screen.findByText('등록된 병원이 아직 없어요')).toBeInTheDocument();
    // 분야 전체를 보는 중이므로 `시술` 이 아니라 `분야` 다 — 세부를 고른 아래 테스트와 갈린다.
    expect(screen.getByText('이 분야는 준비중이에요')).toBeInTheDocument();
    // 분야 조건은 서버가 받는다 — 요청을 생략하지 않는다.
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'prevention' }));
  });

  it('?sub= 가 준비중 세부면 그 시술로 묻고, 0건이면 준비중이라고 말한다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));
    stubProcedures(['crown']);

    render('/category/cavity?sub=root-canal');

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'root-canal' })));
    expect(await screen.findByText('이 시술은 준비중이에요')).toBeInTheDocument();
  });

  it('?sub= 에 옛 시술 id 가 와도 열린다 (북마크)', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/cavity?sub=cavity');

    // 옛 `cavity`(= 지금의 레진)로 발급된 주소. 서버에는 새 id 만 나간다.
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'resin' })));
    expect(await screen.findByText('“레진” 병원')).toBeInTheDocument();
  });

  it('다른 대분류의 세부 시술이 ?sub= 로 오면 무시한다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/implant?sub=crown');

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'implant' })));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');
  });

  it('총 개수가 한 묶음을 넘으면 「더 보기」가 보이고, 누르면 이어 붙는다', async () => {
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitals')
      .mockResolvedValueOnce(paged([baseHospital({ id: 'h1' })], 25, 2))
      .mockResolvedValueOnce({
        items: [baseHospital({ id: 'h2' })],
        meta: { page: 2, pageSize: 20, totalItems: 25, totalPages: 2 },
      });

    render('/category/cavity');

    const more = await screen.findByRole('button', { name: '병원 20곳 더 보기' });
    expect(screen.getByText('25곳 중 1곳 보는 중')).toBeInTheDocument();

    await userEvent.click(more);

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    await waitFor(() => expect(screen.getByText('25곳 중 2곳 보는 중')).toBeInTheDocument());
  });

  /**
   * 설계 §2 3·4행. 다음 묶음이 실패해도 `fetchNextPage` 는 캐시를 비우지 않으므로 **이미
   * 그려진 카드가 사라지면 안 된다** — 전체 ErrorState 로 갈아끼우면 20장을 읽던 사람이
   * 처음으로 돌아간다. 카드 수는 카드마다 하나씩 있는 사진의 alt 로 센다.
   */
  it('다음 묶음이 실패해도 불러온 카드는 남고, 다시 시도하면 이어 붙는다', async () => {
    const page = (start: number) =>
      Array.from({ length: 20 }, (_, i) => baseHospital({ id: `h${start + i}`, name: `치과 ${start + i}` }));
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitals')
      .mockResolvedValueOnce(paged(page(1), 40, 2))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        items: page(21),
        meta: { page: 2, pageSize: 20, totalItems: 40, totalPages: 2 },
      });

    render('/category/cavity');

    const more = await screen.findByRole('button', { name: '병원 20곳 더 보기' });
    expect(screen.getAllByAltText(/병원 사진$/)).toHaveLength(20);

    await userEvent.click(more);

    expect(await screen.findByRole('alert')).toHaveTextContent('더 불러오지 못했어요');
    const retry = screen.getByRole('button', { name: '다시 시도' });
    // 실패한 것은 다음 묶음뿐이다 — 전체 오류 화면으로 갈아끼우지 않는다.
    expect(screen.getAllByAltText(/병원 사진$/)).toHaveLength(20);
    expect(screen.getByText('40곳 중 20곳 보는 중')).toBeInTheDocument();
    expect(screen.queryByText('정보를 불러오지 못했어요')).not.toBeInTheDocument();

    await userEvent.click(retry);

    await waitFor(() => expect(screen.getAllByAltText(/병원 사진$/)).toHaveLength(40));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(screen.getByText('40곳을 모두 봤어요')).toBeInTheDocument();
  });

  it('총 개수가 한 묶음 이하면 「더 보기」를 그리지 않는다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([baseHospital()]));

    render('/category/cavity');

    await waitFor(() => expect(screen.getByText('총 1곳')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /더 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/보는 중/)).not.toBeInTheDocument();
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
