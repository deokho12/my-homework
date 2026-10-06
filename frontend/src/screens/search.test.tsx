import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { RouterBridge, router } from '@/navigation';
import SearchScreen from '@/screens/search';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital, Paged } from '@/types/domain';

function pagedHospitals(items: Hospital[]): Paged<Hospital> {
  return { items, meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 } };
}

/**
 * `router.push` 는 `RouterBridge` 가 마운트돼 있어야 동작한다(`src/navigation/index.tsx`).
 * 시술 매칭은 정적 분류 체계(`searchTaxonomy`)가 동기로 끝내므로 이 화면은 `fetchProcedures`
 * 를 아예 부르지 않는다 — 그래서 스파이는 "한 번도 부르지 않는다" 를 단언하는 한 곳에만 둔다.
 *
 * `fetchDoctors` 는 각 테스트가 필요에 맞게 스텁한다 — 전역 `beforeEach` 로 항상 `[]` 를
 * 주면 이름 검색 경로가 실제로 서버 `q` 필터를 타는지 검증할 수 없다(리뷰에서 지적된
 * 결함: 그 마스킹 때문에 "전문의 로스터가 20명을 넘으면 이름 검색이 조용히 깨지는" 회귀를
 * 테스트가 못 잡았다).
 */
function renderSearch(route: string) {
  return renderWithProviders(
    <>
      <RouterBridge />
      <SearchScreen />
    </>,
    { route }
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
    procedureIds: [],
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

describe('검색 화면 — 이름으로 전문의를 찾는 검색 (서버 q 필터)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * F2 회귀 고정: 이 화면이 서버의 페이지네이션(기본 20건)을 넘겨받아 클라이언트가
   * 직접 훑던 예전 버그를 다시 만들지 않는지 확인한다 — `fetchDoctors` 가 검색어를
   * `q` 필터로 받아 부르고, 그 결과로 이동하는지가 핵심이다(로스터 크기와 무관하게
   * 항상 서버가 찾는다).
   */
  it('입력한 이름으로 서버 q 필터를 불러 찾아낸 전문의의 소속 병원으로 이동한다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    const fetchDoctorsSpy = vi.spyOn(doctorApi, 'fetchDoctors').mockImplementation(async (filters = {}) => {
      if (filters.q === '김민준') {
        return {
          items: [baseDoctor()],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        };
      }
      return { items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } };
    });
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch('/search');

    await userEvent.type(screen.getByPlaceholderText('시술, 병원, 원장님 이름을 검색해보세요'), '김민준');
    await userEvent.click(screen.getByText('🔍'));

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/hospital/h1'));
    expect(fetchDoctorsSpy).toHaveBeenCalledWith(expect.objectContaining({ q: '김민준' }));
    expect(screen.queryByText(/검색 결과가 없어요/)).not.toBeInTheDocument();
  });

  /**
   * 홈 화면 인기검색어 pill 은 직함이 붙은 문구로 `/search?q=...` 를 연다(예: "김민준 원장").
   * 서버 `q` 는 부분일치(`nameNormalized.contains`)라 검색어가 실제 이름보다 길면(직함이
   * 붙어서) 1차 조회로는 못 찾는다 — 마지막 낱말을 뗀 2차 조회로 찾아내야 한다.
   */
  it('직함이 붙은 검색어("김민준 원장")도 이름만 뗀 재조회로 찾아낸다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    const fetchDoctorsSpy = vi.spyOn(doctorApi, 'fetchDoctors').mockImplementation(async (filters = {}) => {
      if (filters.q === '김민준') {
        return {
          items: [baseDoctor()],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        };
      }
      return { items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } };
    });
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch(`/search?q=${encodeURIComponent('김민준 원장')}`);

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/hospital/h1'));
    expect(fetchDoctorsSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ q: '김민준 원장' }));
    expect(fetchDoctorsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ q: '김민준' }));
  });

  it('일치하는 시술·병원·전문의가 전혀 없으면 결과 없음 안내를 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    renderSearch('/search');

    await userEvent.type(screen.getByPlaceholderText('시술, 병원, 원장님 이름을 검색해보세요'), '존재하지않는검색어');
    await userEvent.click(screen.getByText('🔍'));

    await waitFor(() => expect(screen.getByText(/검색 결과가 없어요/)).toBeInTheDocument());
  });
});

describe('검색 화면 — 병원명 검색 (서버 q 필터)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 병원명 매칭도 전문의 이름 매칭과 같은 방식(서버 `q` 위임)이어야 한다 — 클라이언트가
   * 페이지를 뒤지지 않는다. 예전에는 `useHospitalStore.getState().hospitals` 를 훑었다.
   */
  it('입력한 병원명으로 서버 q 필터를 불러 찾아낸 병원으로 이동한다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockImplementation(async (filters = {}) => {
      if (filters.q === '강남 스마일 치과') return pagedHospitals([baseHospital()]);
      return pagedHospitals([]);
    });
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch('/search');

    await userEvent.type(screen.getByPlaceholderText('시술, 병원, 원장님 이름을 검색해보세요'), '강남 스마일 치과');
    await userEvent.click(screen.getByText('🔍'));

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/hospital/h1'));
    expect(fetchHospitalsSpy).toHaveBeenCalledWith(expect.objectContaining({ q: '강남 스마일 치과' }));
    expect(screen.queryByText(/검색 결과가 없어요/)).not.toBeInTheDocument();
  });
});

describe('검색 화면 — 제출 순서 보장(경쟁 조건)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 병원명 매칭이 비동기(서버 `q` 필터)가 되면서 생긴 창 — 사용자가 첫 응답을 받기 전에
   * 다른 검색어를 제출하면, 늦게 도착한 첫 검색의 응답이 엉뚱한 병원으로 이동시킬 수
   * 있다. 두 검색을 연달아 제출하고 먼저 제출한 쪽의 응답을 나중에 resolve 해서, 그래도
   * 마지막 제출(두 번째)의 결과만 반영되는지 고정한다.
   */
  it('먼저 제출한 검색의 응답이 나중에 도착해도, 마지막 제출의 결과만 반영된다', async () => {
    const resolvers = new Map<string, (value: Awaited<ReturnType<typeof hospitalApi.fetchHospitals>>) => void>();
    vi.spyOn(hospitalApi, 'fetchHospitals').mockImplementation(
      (filters = {}) =>
        new Promise((resolve) => {
          resolvers.set(String(filters.q), resolve);
        })
    );
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch('/search');

    const searchInput = screen.getByPlaceholderText('시술, 병원, 원장님 이름을 검색해보세요');
    const searchButton = screen.getByText('🔍');

    // 첫 번째 제출: "AAA" — 응답이 늦게 도착한다.
    await userEvent.type(searchInput, 'AAA');
    await userEvent.click(searchButton);

    // 두 번째 제출: "BBB" — 첫 번째가 아직 응답을 받기 전에 제출한다.
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'BBB');
    await userEvent.click(searchButton);

    await waitFor(() => expect(resolvers.has('AAA')).toBe(true));
    await waitFor(() => expect(resolvers.has('BBB')).toBe(true));

    // 나중에 제출한 "BBB" 의 응답을 먼저 resolve 한다 — 정상적으로 그 결과가 반영돼야 한다.
    resolvers.get('BBB')!(pagedHospitals([baseHospital({ id: 'h-bbb', name: 'BBB병원' })]));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/hospital/h-bbb'));

    // 먼저 제출한 "AAA" 의 응답이 이제야(뒤늦게) 도착한다 — 이미 최신이 아니므로
    // 이동을 일으키면 안 된다.
    resolvers.get('AAA')!(pagedHospitals([baseHospital({ id: 'h-aaa', name: 'AAA병원' })]));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pushSpy).not.toHaveBeenCalledWith('/hospital/h-aaa');
    expect(pushSpy).toHaveBeenLastCalledWith('/hospital/h-bbb');
  });
});

describe('검색 화면 — 시술 검색은 정적 분류 체계로 끝난다', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 예전에는 시술 매칭이 `useProcedures()`(서버 13종) 응답을 기다렸다 — 그래서 `?q=` 자동
   * 검색이 로딩과 경합해 거짓 "결과 없음" 을 띄우지 않도록 게이트가 필요했다. 지금은
   * 분류 체계가 정적이라 **서버에 시술을 묻지 않고** 바로 이동한다.
   */
  it('시술 목록을 한 번도 부르지 않고 카테고리 화면으로 바로 보낸다', async () => {
    const fetchProceduresSpy = vi.spyOn(procedureApi, 'fetchProcedures');
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch(`/search?q=${encodeURIComponent('임플란트')}`);

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/category/implant'));
    expect(fetchProceduresSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/검색 결과가 없어요/)).not.toBeInTheDocument();
  });

  it('세부 시술 이름·키워드는 그 세부가 선택된 카테고리 화면으로 보낸다', async () => {
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch(`/search?q=${encodeURIComponent('근관치료')}`);

    // "근관치료" 는 신경치료(준비중)의 키워드다 — 카테고리 화면이 준비중 안내를 맡는다.
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/category/cavity?sub=root-canal'));
  });

  it('크라운 → 충치치료 > 크라운', async () => {
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch(`/search?q=${encodeURIComponent('크라운')}`);

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/category/cavity?sub=crown'));
  });

  /**
   * 병원 이름에 시술 이름이 들어 있어도 카테고리로 납치되면 안 된다 — `searchTaxonomy` 의
   * 매칭 방향(`후보.includes(검색어)`)이 지키는 경계이고, 화면에서도 병원 `q` 폴백이 돈다.
   */
  it('"연세 바른교정치과" 는 카테고리가 아니라 병원 q 폴백으로 간다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockImplementation(async (filters = {}) => {
      if (filters.q === '연세 바른교정치과') return pagedHospitals([baseHospital({ id: 'h2' })]);
      return pagedHospitals([]);
    });
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch(`/search?q=${encodeURIComponent('연세 바른교정치과')}`);

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/hospital/h2'));
    expect(fetchHospitalsSpy).toHaveBeenCalledWith(expect.objectContaining({ q: '연세 바른교정치과' }));
  });

  it('인기검색어의 시술 항목도 카테고리 화면으로 간다', async () => {
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch('/search');

    // 행의 문구("라미네이트")를 `searchTaxonomy` 에 태운 결과다 — 세부 시술 이름이라 그
    // 세부가 선택된 채로 열린다.
    await userEvent.click(screen.getByText('라미네이트'));

    expect(pushSpy).toHaveBeenCalledWith('/category/aesthetic?sub=laminate');
  });

  /**
   * 같은 글자가 경로에 따라 다른 목록을 열면 안 된다. "충치치료" 를 **타이핑**하면 대분류
   * 전체(`/category/cavity`, 3곳)가 열리는데, 인기검색어 **행**을 누를 때만 서버 id `cavity`
   * 가 레진으로 번역돼 `?sub=resin`(1곳)이 열리던 결함을 고정한다.
   */
  it('인기검색어 행도 타이핑과 같은 목록을 연다 — "충치치료" 는 sub 없이 대분류 전체', async () => {
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch('/search');

    // "충치치료" 는 `시술` 탭에만 있다(`all` 탭 목록에는 없다).
    await userEvent.click(screen.getByText('시술'));
    await userEvent.click(screen.getByText('충치치료'));

    expect(pushSpy).toHaveBeenCalledWith('/category/cavity');
  });
});
