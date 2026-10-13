import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import ExplorePage from '@/pages/ExplorePage';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital, Paged } from '@/types/domain';

/**
 * 탐색 화면의 모든 필터(칩·정렬·모드·지도 반경)는 이제 서버 쿼리 파라미터다 — 클라이언트가
 * 배열을 훑어 걸러내지 않는다. `fetchHospitals`/`fetchDoctors` 를 스파이해서 어떤 파라미터로
 * 불렀는지 직접 검증한다 (`src/screens/search.test.tsx` 와 같은 방식).
 */
function pagedHospitals(items: Hospital[], totalItems = items.length): Paged<Hospital> {
  return { items, meta: { page: 1, pageSize: 20, totalItems, totalPages: 1 } };
}

function pagedDoctors(items: Doctor[], totalItems = items.length): Paged<Doctor> {
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

function baseDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 'd1',
    name: '김민준',
    title: '대표원장',
    hospitalId: 'h1',
    photo: 'https://example.com/photo.jpg',
    procedureIds: ['implant'],
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

  it('이름이 다른 파라미터를 정확히 매핑한다 — 진료시간→nightConsult, 경력→minDoctorYearsOfExperience', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '진료시간' }));
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

  /**
   * 서버 시술 **하나**에만 걸리는 대분류(임플란트)는 서버 필터로 끝난다 — 광고 우선 노출이
   * 유지되는 쪽이다 (`resolveCategoryFilter`).
   */
  it('서버 시술 하나짜리 대분류 탭은 procedureId 로 묻는다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />);
    await userEvent.click(screen.getByRole('button', { name: '임플란트' }));

    await waitFor(() =>
      expect(fetchHospitalsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ procedureId: 'implant' }))
    );
  });

  /**
   * 서버 시술 **여럿**에 걸리는 대분류(충치치료 = cavity+inlay+crown)는 `procedureId` 한 값으로
   * 못 옮긴다 — 넉넉히 받아 클라이언트가 교집합으로 거르고 "총 N곳" 도 거른 뒤의 수다.
   */
  it('서버 시술 여러 개짜리 대분류 탭은 넉넉히 받아 클라이언트가 거른다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(
      pagedHospitals([
        baseHospital({ id: 'h1', name: '임플란트병원', procedureIds: ['implant'] }),
        baseHospital({ id: 'h7', name: '크라운병원', procedureIds: ['crown'] }),
        baseHospital({ id: 'h3', name: '충치병원', procedureIds: ['cavity', 'gum-disease'] }),
      ])
    );

    renderWithProviders(<ExplorePage />);
    await userEvent.click(screen.getByRole('button', { name: '충치치료' }));

    await waitFor(() => expect(screen.getByText('“충치치료” 병원')).toBeInTheDocument());
    const lastCall = fetchHospitalsSpy.mock.calls.at(-1)?.[0] ?? {};
    expect(lastCall).not.toHaveProperty('procedureId');
    expect(lastCall.pageSize).toBe(100);
    expect(screen.getByText('총 2곳')).toBeInTheDocument();
    expect(screen.queryByText('임플란트병원')).not.toBeInTheDocument();
  });

  it('세부가 전부 준비중인 대분류 탭은 요청하지 않고 전용 빈 상태를 보여준다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());
    const callsBefore = fetchHospitalsSpy.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: '스케일링·예방 · 준비중' }));

    expect(await screen.findByText('등록된 병원이 아직 없어요')).toBeInTheDocument();
    expect(fetchHospitalsSpy.mock.calls).toHaveLength(callsBefore);
  });

  it('의사 모드도 같은 대분류 규칙을 쓴다 — 넉넉히 받아 거른 수를 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    const fetchDoctorsSpy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(
      pagedDoctors([
        baseDoctor({ id: 'd1', procedureIds: ['implant'] }),
        baseDoctor({ id: 'd2', name: '이서연', procedureIds: ['inlay'] }),
      ])
    );

    renderWithProviders(<ExplorePage />);
    await userEvent.click(screen.getByRole('button', { name: '충치치료' }));
    await userEvent.click(screen.getByRole('button', { name: '의사' }));

    await waitFor(() => expect(screen.getByText('“충치치료” 의사')).toBeInTheDocument());
    const lastCall = fetchDoctorsSpy.mock.calls.at(-1)?.[0] ?? {};
    expect(lastCall).not.toHaveProperty('procedureId');
    expect(lastCall.pageSize).toBe(100);
    expect(screen.getByText('총 1명')).toBeInTheDocument();
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
   * 이름 자리에 스켈레톤을 그렸다(그 사이 "추천"이라고 잘못 주장하지 않으려고). 이제 분류는
   * 정적 taxonomy 라 **기다릴 것이 없다** — 서버에 시술을 **묻지도 않는다**.
   */
  it('/explore?category=implant 콜드 로드는 시술 목록을 묻지 않고 바로 그 카테고리 이름을 그린다', async () => {
    const fetchProceduresSpy = vi.spyOn(procedureApi, 'fetchProcedures');
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([baseHospital()]));

    renderWithProviders(<ExplorePage />, { route: '/explore?category=implant' });

    await waitFor(() => expect(screen.getByText('“임플란트” 병원')).toBeInTheDocument());
    expect(screen.queryByText('“추천” 병원')).not.toBeInTheDocument();
    expect(fetchProceduresSpy).not.toHaveBeenCalled();
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
});
