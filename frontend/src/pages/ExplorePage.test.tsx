import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { SUB_PROCEDURES } from '@/features/procedure/taxonomy';
import ExplorePage from '@/pages/ExplorePage';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital, Paged } from '@/types/domain';

/**
 * 탐색 화면의 모든 필터(칩·정렬·모드·지도 반경)는 이제 서버 쿼리 파라미터다 — 클라이언트가
 * 배열을 훑어 걸러내지 않는다. `fetchHospitals`/`fetchDoctors` 를 스파이해서 어떤 파라미터로
 * 불렀는지 직접 검증한다 (`src/screens/search.test.tsx` 와 같은 방식).
 */
function pagedHospitals(items: Hospital[], totalItems = items.length, totalPages = 1): Paged<Hospital> {
  return { items, meta: { page: 1, pageSize: 20, totalItems, totalPages } };
}

/** `GET /procedures` 응답 — `준비중` 라벨의 유일한 입력이다 (요청 14). */
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

function pagedDoctors(items: Doctor[], totalItems = items.length, totalPages = 1): Paged<Doctor> {
  return { items, meta: { page: 1, pageSize: 20, totalItems, totalPages } };
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
    procedureIds: ['implant-general'],
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

function baseDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 'd1',
    name: '김민준',
    title: '대표원장',
    hospitalId: 'h1',
    photo: 'https://example.com/photo.jpg',
    procedureIds: ['implant-general'],
    rating: 4.9,
    reviewCount: 180,
    consultCount: 90,
    certificateUrl: null,
    verificationStatus: 'approved',
    rejectionReason: null,
    isRecommended: false,
    yearsOfExperience: 15,
    career: [],
    visibleSpecialty: '치과보철전문의',
    isVerifiedSpecialist: true,
    ...overrides,
  };
}

describe('ExplorePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('조건 칩을 누르면 목록이 실제로 바뀐다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockImplementation(async (filters = {}) => {
      if (filters.hasVerifiedSpecialist === true) {
        return pagedHospitals([baseHospital({ id: 'h1' })], 1);
      }
      return pagedHospitals([baseHospital({ id: 'h1' }), baseHospital({ id: 'h2', name: '연세 바른교정치과' })], 2);
    });

    renderWithProviders(<ExplorePage />);

    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());
    expect(screen.getByText('총 2곳')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '전문의' }));

    await waitFor(() => expect(screen.getByText('총 1곳')).toBeInTheDocument());
    expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ hasVerifiedSpecialist: true }));
  });

  it('모드를 의사로 바꾸면 선택한 조건이 유지된 채 다시 적용된다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));
    const fetchDoctorsSpy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([baseDoctor()]));
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());

    renderWithProviders(<ExplorePage />);

    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '상담가능' }));
    await userEvent.click(screen.getByRole('button', { name: '의사' }));

    await waitFor(() => expect(screen.getByText(/총 \d+명/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '상담가능' })).toHaveAttribute('aria-pressed', 'true');
    expect(fetchDoctorsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ consultAvailable: true }));
  });

  it('이름이 다른 파라미터를 정확히 매핑한다 — 야간상담→nightConsult, 경력→minDoctorYearsOfExperience', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());

    // 라벨은 `야간상담` 이지만 서버 파라미터 이름은 그대로 `nightConsult` 다 (EXPLORE-4).
    await userEvent.click(screen.getByRole('button', { name: '야간상담' }));
    await waitFor(() =>
      expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ nightConsult: true }))
    );

    await userEvent.click(screen.getByRole('button', { name: '경력' }));
    await waitFor(() =>
      expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ minDoctorYearsOfExperience: 10 })
      )
    );
  });

  it('의사 모드의 전문의·경력 칩은 verifiedSpecialist·minYearsOfExperience 를 쓴다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    const fetchDoctorsSpy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([baseDoctor()]));

    renderWithProviders(<ExplorePage />);
    await userEvent.click(screen.getByRole('button', { name: '의사' }));
    await waitFor(() => expect(screen.getByText(/총 \d+명/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '전문의' }));
    await waitFor(() =>
      expect(fetchDoctorsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ verifiedSpecialist: true }))
    );

    await userEvent.click(screen.getByRole('button', { name: '경력' }));
    await waitFor(() =>
      expect(fetchDoctorsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ minYearsOfExperience: 10 }))
    );
  });

  it('첫 화면은 "추천" 탭이다 — recommended=true 로 묻는다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />);

    await waitFor(() => expect(screen.getByText('“추천” 병원')).toBeInTheDocument());
    expect(fetchHospitalsSpy).toHaveBeenCalledWith(expect.objectContaining({ recommended: true }));
  });

  /** 분야 탭은 `categoryId` **한 번**이다 — 요청 14 전에는 분야 셋만 100곳을 받아 걸렀다. */
  it('분야 탭은 categoryId 로 한 번 묻는다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />);
    await userEvent.click(screen.getByRole('button', { name: '충치치료' }));

    await waitFor(() =>
      expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 'cavity' }))
    );
    const lastCall = fetchHospitalsSpy.mock.calls.at(-1)?.[0] ?? {};
    expect(lastCall).not.toHaveProperty('procedureId');
    expect(lastCall.pageSize).toBe(20);
  });

  it('등록된 병원이 없는 분야 탭도 물어보고, 빈 상태가 준비중이라고 말한다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockImplementation(async (filters = {}) =>
      filters.categoryId === 'prevention' ? pagedHospitals([], 0) : pagedHospitals([baseHospital()])
    );
    stubProcedures(['implant-general']);

    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());

    await userEvent.click(await screen.findByRole('button', { name: '스케일링·예방 · 준비중' }));

    expect(await screen.findByText('등록된 병원이 아직 없어요')).toBeInTheDocument();
    // 탐색 탭은 언제나 분야 전체다(세부 칩이 없다) — 그래서 `이 분야는` 이다.
    expect(screen.getByText('이 분야는 준비중이에요')).toBeInTheDocument();
    expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 'prevention' }));
  });

  it('의사 모드도 같은 분야 규칙을 쓴다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    const fetchDoctorsSpy = vi
      .spyOn(doctorApi, 'fetchDoctors')
      .mockResolvedValue(pagedDoctors([baseDoctor({ id: 'd1' })]));

    renderWithProviders(<ExplorePage />);
    await userEvent.click(screen.getByRole('button', { name: '충치치료' }));
    await userEvent.click(screen.getByRole('button', { name: '의사' }));

    await waitFor(() => expect(screen.getByText('“충치치료” 의사')).toBeInTheDocument());
    expect(fetchDoctorsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 'cavity' }));
    expect(screen.getByText('총 1명')).toBeInTheDocument();
  });

  /**
   * 라벨만 바뀌고 **동작은 그대로**인지 함께 본다 (EXPLORE-4) — 이름을 고치면서 서버
   * 파라미터까지 건드리면 "평점순을 눌렀는데 상담 많은 순" 같은 어긋남이 조용히 생긴다.
   */
  it('정렬 칩은 `평점순` 이라고 적혀 있고, 그대로 sort=rating 으로 묻는다', async () => {
    const fetchHospitalsSpy = vi
      .spyOn(hospitalApi, 'fetchHospitals')
      .mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: '인기순' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '평점순' })).toHaveAttribute('aria-pressed', 'true');
    expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'rating' }));

    await userEvent.click(screen.getByRole('button', { name: '후기순' }));
    await waitFor(() =>
      expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'reviewCount' }))
    );
  });

  it('리스트/지도 전환은 눌린 상태를 알리는 칩이다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());

    expect(screen.getByRole('button', { name: '리스트 보기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '지도 보기' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: '지도 보기' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '지도 보기' })).toHaveAttribute('aria-pressed', 'true')
    );
  });

  it('지도 보기는 한 번에 100곳까지 받고, 그보다 많으면 띠로 알린다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockImplementation(async (filters = {}) =>
      filters.radiusKm === undefined
        ? pagedHospitals([baseHospital()], 1)
        : pagedHospitals([baseHospital({ id: 'h1' })], 137)
    );

    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '지도 보기' }));

    await waitFor(() =>
      expect(screen.getByText('병원이 많아 1곳만 지도에 표시해요 · 반경을 좁혀보세요')).toBeInTheDocument()
    );
  });

  it('"총 N곳" 은 meta.totalItems 를 쓴다 — 페이지네이션으로 배열이 잘려도 정확하다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()], 37));

    renderWithProviders(<ExplorePage />);

    await waitFor(() => expect(screen.getByText('총 37곳')).toBeInTheDocument());
  });

  it('로딩 중에는 "없어요" 문구를 보여주지 않는다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<ExplorePage />);

    expect(screen.getByText('불러오는 중이에요')).toBeInTheDocument();
    expect(screen.queryByText(/없어요/)).not.toBeInTheDocument();
  });

  it('응답이 비어 있으면 "조건에 맞는 병원이 없어요" 를 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([], 0));

    renderWithProviders(<ExplorePage />);

    await waitFor(() => expect(screen.getByText('조건에 맞는 병원이 없어요')).toBeInTheDocument());
  });

  it('"광고" 배지는 hospital.sponsorship.isActive 로만 판정한다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(
      pagedHospitals([
        baseHospital({ id: 'h1', name: '광고병원', sponsorship: { isActive: true, isPlacementEligible: true } }),
        baseHospital({ id: 'h2', name: '일반병원', sponsorship: { isActive: false, isPlacementEligible: false } }),
      ])
    );

    renderWithProviders(<ExplorePage />);

    await waitFor(() => expect(screen.getByText('광고병원')).toBeInTheDocument());
    expect(screen.getByText('일반병원')).toBeInTheDocument();
    // 두 병원 중 `sponsorship.isActive` 가 켜진 쪽만 "광고" 배지를 얻는다.
    expect(screen.getAllByText('광고')).toHaveLength(1);
  });

  /**
   * 예전에는 `/explore?category=implant` 콜드 로드가 서버 시술 목록을 기다리느라 카테고리
   * 이름 자리에 스켈레톤을 그렸다(그 사이 "추천"이라고 잘못 주장하지 않으려고). 분류 표는
   * 번들 상수라 **기다릴 것이 없다** — 시술 목록(`준비중` 판정용)은 따로 받되, 탭 이름과
   * 목록은 그 응답을 기다리지 않는다.
   */
  it('/explore?category=implant 콜드 로드는 시술 목록을 기다리지 않고 바로 그 카테고리 이름을 그린다', async () => {
    stubProcedures([]);
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />, { route: '/explore?category=implant' });

    expect(screen.getByRole('button', { name: '임플란트' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('“임플란트” 병원')).toBeInTheDocument());
    expect(screen.queryByText('“추천” 병원')).not.toBeInTheDocument();
  });

  /**
   * 홈 배너 "전문의가 검증된 병원만 모았어요" 가 보내는 딥링크. 칩을 직접 켠 것과
   * **같은 요청**이 나가야 배너가 약속한 목록이 나온다.
   */
  it('/explore?specialist=1 은 전문의 칩이 켜진 채로 열린다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />, { route: '/explore?specialist=1' });

    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '전문의' })).toHaveAttribute('aria-pressed', 'true');
    expect(fetchHospitalsSpy).toHaveBeenCalledWith(expect.objectContaining({ hasVerifiedSpecialist: true }));
  });

  it('모르는 specialist 값은 조용히 무시하고 꺼진 상태로 연다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />, { route: '/explore?specialist=yes' });

    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '전문의' })).toHaveAttribute('aria-pressed', 'false');
    expect(fetchHospitalsSpy.mock.calls.at(-1)?.[0]?.hasVerifiedSpecialist).toBeUndefined();
  });

  /** 옛 시술 id 북마크(`?category=crown`)는 그 시술이 속한 대분류 화면이 된다. */
  it('/explore?category=crown 은 "충치치료" 탭으로 열린다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(
      pagedHospitals([baseHospital({ procedureIds: ['crown'] })])
    );

    renderWithProviders(<ExplorePage />, { route: '/explore?category=crown' });

    await waitFor(() => expect(screen.getByText('“충치치료” 병원')).toBeInTheDocument());
  });

  /**
   * [Important 2 리뷰 수정] 지도 보기에서 반경 검색이 0건이면, 반경을 넓혀 재검색할 수단
   * (반경 칩)이 화면에서 사라지면 안 된다 — 사라지면 사용자가 막다른 곳에 갇힌다.
   * `HospitalMapView` 는 `QueryState` 의 `isEmpty` 판정과 무관하게 항상 마운트돼야 하고,
   * 빈 안내는 지도 위 오버레이로(전체 화면 대체가 아니라) 보여야 한다.
   */
  it('지도 보기에서 반경 검색이 0건이어도 반경 칩이 계속 렌더되고 조작할 수 있다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockImplementation(async (filters = {}) => {
      // 리스트 보기(좌표 없음)는 결과가 있다 — 지도 보기로 전환한 뒤 기본 반경(3km)
      // 검색만 0건으로 만들어 빈 지도 시나리오를 재현한다.
      if (filters.radiusKm === undefined) return pagedHospitals([baseHospital()], 1);
      if (filters.radiusKm === 5) return pagedHospitals([baseHospital()], 1);
      return pagedHospitals([], 0);
    });

    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '지도 보기' }));

    // 기본 반경(3km) 검색은 0건이다 — 그래도 지도 화면 전체가 일반 빈 상태 문구로
    // 바뀌면 안 되고, 반경 칩은 계속 눌릴 수 있어야 한다.
    await waitFor(() => expect(screen.getByRole('button', { name: '3km' })).toBeInTheDocument());
    expect(screen.queryByText('조건에 맞는 병원이 없어요')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '5km' }));

    await waitFor(() =>
      expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ radiusKm: 5 }))
    );
    // 반경을 바꾼 뒤에도 칩 자체는 여전히 화면에 있다(막다른 곳이 아니다).
    expect(screen.getByRole('button', { name: '5km' })).toBeInTheDocument();
  });

  describe('더 보기', () => {
    it('다음 묶음을 이어 붙이고 진행 줄이 따라간다', async () => {
      const fetchHospitalsSpy = vi
        .spyOn(hospitalApi, 'fetchHospitals')
        .mockResolvedValueOnce(pagedHospitals([baseHospital({ id: 'h1', name: '첫째병원' })], 25, 2))
        .mockResolvedValueOnce({
          items: [baseHospital({ id: 'h2', name: '둘째병원' })],
          meta: { page: 2, pageSize: 20, totalItems: 25, totalPages: 2 },
        });

      renderWithProviders(<ExplorePage />);

      const more = await screen.findByRole('button', { name: '병원 20곳 더 보기' });
      expect(screen.getByText('25곳 중 1곳 보는 중')).toBeInTheDocument();

      await userEvent.click(more);

      await waitFor(() => expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
      // 이어 붙인다 — 앞 묶음이 사라지지 않는다.
      await waitFor(() => expect(screen.getByText('둘째병원')).toBeInTheDocument());
      expect(screen.getByText('첫째병원')).toBeInTheDocument();
      expect(screen.getByText('25곳 중 2곳 보는 중')).toBeInTheDocument();
    });

    it('다 불러오면 버튼이 사라지고 "모두 봤어요" 한 줄이 남는다', async () => {
      const firstPage = Array.from({ length: 20 }, (_, index) =>
        baseHospital({ id: `h${index + 1}`, name: `병원${index + 1}` })
      );

      vi.spyOn(hospitalApi, 'fetchHospitals')
        .mockResolvedValueOnce(pagedHospitals(firstPage, 22, 2))
        .mockResolvedValueOnce({
          items: [baseHospital({ id: 'h21', name: '병원21' }), baseHospital({ id: 'h22', name: '병원22' })],
          meta: { page: 2, pageSize: 20, totalItems: 22, totalPages: 2 },
        });

      renderWithProviders(<ExplorePage />);

      // 남은 수가 한 묶음보다 적으면 라벨도 그 수를 말한다.
      await userEvent.click(await screen.findByRole('button', { name: '병원 2곳 더 보기' }));

      await waitFor(() => expect(screen.getByText('22곳을 모두 봤어요')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /더 보기/ })).not.toBeInTheDocument();
    });

    it('의사 모드는 단위가 "명" 이다', async () => {
      vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
      vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));
      vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([baseDoctor()], 42, 3));

      renderWithProviders(<ExplorePage />);
      await userEvent.click(screen.getByRole('button', { name: '의사' }));

      expect(await screen.findByRole('button', { name: '의사 20명 더 보기' })).toBeInTheDocument();
      expect(screen.getByText('42명 중 1명 보는 중')).toBeInTheDocument();
    });

    it('가격 비교표를 켜면 "불러온 N곳끼리 비교한 표" 라고 알린다', async () => {
      vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()], 25, 2));

      renderWithProviders(<ExplorePage />);
      await waitFor(() => expect(screen.getByText('총 25곳')).toBeInTheDocument());

      await userEvent.click(screen.getByText('가격 비교표 보기'));

      expect(await screen.findByText('불러온 1곳끼리 비교한 표예요')).toBeInTheDocument();
      // 표 아래에도 「더 보기」가 그대로 있다.
      expect(screen.getByRole('button', { name: '병원 20곳 더 보기' })).toBeInTheDocument();
    });
  });
});
