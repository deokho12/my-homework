import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { SUB_PROCEDURES } from '@/features/procedure/taxonomy';
import { RouterBridge, router } from '@/navigation';
import SearchScreen from '@/screens/search';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital, Paged } from '@/types/domain';

function pagedHospitals(items: Hospital[]): Paged<Hospital> {
  return { items, meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 } };
}

/** `GET /procedures` 응답 — 추천 목록의 `준비중` 배지는 이 값에서만 나온다 (요청 14). */
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

/**
 * `router.push` 는 `RouterBridge` 가 마운트돼 있어야 동작한다(`src/navigation/index.tsx`).
 * 시술 **매칭**은 정적 분류 체계(`searchTaxonomy`)가 동기로 끝낸다 — 목적지는 서버 응답을
 * 기다리지 않는다. `GET /procedures` 는 `준비중` 배지에만 쓰이므로 그것을 보는 테스트만
 * 응답을 스텁한다 (`stubProcedures`).
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
  it('입력한 이름으로 서버 q 필터를 불러 찾아낸 전문의 상세로 이동한다', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: '검색' }));

    // 목적지는 소속 병원이 아니라 **전문의 상세**다 — 추천 목록의 원장님 줄을 눌렀을 때와
    // 같은 곳이어야 한다(같은 글자가 경로에 따라 갈리지 않는다).
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/doctor/d1'));
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

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/doctor/d1'));
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
    await userEvent.click(screen.getByRole('button', { name: '검색' }));

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
    await userEvent.click(screen.getByRole('button', { name: '검색' }));

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
    const searchButton = screen.getByRole('button', { name: '검색' });

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
  it('시술 목록을 기다리지 않고 카테고리 화면으로 바로 보낸다', async () => {
    // 응답이 영원히 오지 않아도 목적지는 정해진다 — 매칭은 번들 상수로 끝난다.
    vi.spyOn(procedureApi, 'fetchProcedures').mockReturnValue(new Promise(() => {}));
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch(`/search?q=${encodeURIComponent('임플란트')}`);

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/category/implant'));
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

/* ------------------------------------------------------------- 입력 중 추천 */

const SEARCH_PLACEHOLDER = '시술, 병원, 원장님 이름을 검색해보세요';

function pagedDoctors(items: Doctor[]): Paged<Doctor> {
  return { items, meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 } };
}

describe('검색 화면 — 입력 중 추천 목록', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('"인레" 를 치면 시술 그룹에 인레이가 보조줄과 함께 뜬다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '인레');

    // 제목은 일치 구간이 굵게 갈라지므로(`인레` + `이`) 접근 이름으로 찾는다.
    expect(await screen.findByRole('option', { name: '인레이, 충치치료 › 인레이' })).toBeInTheDocument();
    expect(screen.getByText('시술')).toBeInTheDocument();
    expect(screen.getByText('충치치료 › 인레이')).toBeInTheDocument();
  });

  it('동의어로 걸리면 왜 떴는지 보조줄이 말한다 — "금니" → 크라운', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '금니');

    expect(await screen.findByText('크라운')).toBeInTheDocument();
    expect(screen.getByText(/‘금니’ 로 찾았어요/)).toBeInTheDocument();
  });

  it('준비중 세부에는 준비중 배지가 붙고, 보조줄이 목적지의 빈 상태와 같은 말을 한다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));
    // 신경치료를 하는 병원이 한 곳도 없는 서버 상태.
    stubProcedures(['crown']);

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '신경치료');

    expect(await screen.findByText('준비중')).toBeInTheDocument();
    expect(screen.getByText('충치치료 › 신경치료 · 등록된 병원이 아직 없어요')).toBeInTheDocument();
  });

  it('글자를 모두 지우면 인기 검색어가 돌아온다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    await userEvent.type(input, '인레');
    expect(await screen.findByRole('option', { name: /인레이/ })).toBeInTheDocument();
    expect(screen.queryByText('인기 검색어')).not.toBeInTheDocument();

    await userEvent.clear(input);

    expect(await screen.findByText('인기 검색어')).toBeInTheDocument();
    expect(screen.getByText('임플란트')).toBeInTheDocument();
  });

  it('이름으로 걸린 병원이 시술로 걸린 병원보다 먼저다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockImplementation(async (filters = {}) => {
      if (filters.q === '인레') return pagedHospitals([baseHospital({ id: 'h-name', name: '인레이치과' })]);
      return pagedHospitals([baseHospital({ id: 'h-proc', name: '시술로 걸린 치과', procedureIds: ['inlay'] })]);
    });
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '인레');

    await screen.findByText('시술로 걸린 치과');
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.getAttribute('aria-label'))).toEqual([
      '인레이, 충치치료 › 인레이',
      '인레이치과, 서울 강남구 · 일반 임플란트',
      '시술로 걸린 치과, 서울 강남구 · 인레이',
    ]);
  });

  it('원장님 행은 소속 병원과 전공을 보여주고, 누르면 전문의 상세로 간다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([baseDoctor()]));
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '김민준');

    const option = await screen.findByRole('option', { name: '김민준 대표원장, 강남 스마일 치과 · 치과보철전문의' });
    expect(screen.getByText('원장님')).toBeInTheDocument();

    await userEvent.click(option);
    expect(pushSpy).toHaveBeenCalledWith('/doctor/d1');
  });

  it('visibleSpecialty 가 null 이면 전공 조각과 가운뎃점이 없다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(
      pagedDoctors([baseDoctor({ visibleSpecialty: null, isVerifiedSpecialist: false })])
    );

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '김민준');

    expect(await screen.findByText('강남 스마일 치과')).toBeInTheDocument();
    expect(screen.queryByText(/치과보철전문의/)).not.toBeInTheDocument();
  });

  it('병원 질의가 실패해도 시술 그룹은 그대로 보인다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockRejectedValue(new Error('offline'));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '인레');

    expect(await screen.findByText('병원 추천을 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('다시 시도')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /인레이/ })).toBeInTheDocument();
  });

  it('1자 입력은 네트워크를 묻지 않고 시술 그룹만 보여준다', async () => {
    const fetchHospitalsSpy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    const fetchDoctorsSpy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '임');

    expect(await screen.findByText('두 글자부터 병원·원장님도 찾아드려요')).toBeInTheDocument();
    expect(screen.getByText('임플란트 분야 전체')).toBeInTheDocument();
    // 디바운스(250ms)를 넉넉히 넘긴 뒤에도 요청이 없어야 한다.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchHospitalsSpy).not.toHaveBeenCalled();
    expect(fetchDoctorsSpy).not.toHaveBeenCalled();
  });

  it('추천이 0건이면 기존 안내 문구와 인기 검색어가 함께 보인다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    await userEvent.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'zzzzz');

    expect(await screen.findByText(/"zzzzz"에 대한 검색 결과가 없어요/)).toBeInTheDocument();
    expect(screen.getByText('인기 검색어')).toBeInTheDocument();
  });
});

describe('검색 화면 — 키보드', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('↓ 두 번 뒤 Enter 는 두 번째 항목의 목적지로 간다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(
      pagedHospitals([baseHospital({ id: 'h-two', name: '두번째 치과' })])
    );
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch('/search');
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    await userEvent.type(input, '인레');
    await screen.findByText('두번째 치과');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', 'search-suggest-hospital-h-two');

    await userEvent.keyboard('{Enter}');
    expect(pushSpy).toHaveBeenCalledWith('/hospital/h-two');
  });

  it('한글 조합 중 Enter 는 검색을 실행하지 않는다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch('/search');
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    await userEvent.type(input, '인레');
    await screen.findByRole('option', { name: /인레이/ });

    // IME 후보 확정 Enter — 예전 primitive TextInput 은 이것으로 검색을 실행해 버렸다.
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(pushSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pushSpy).toHaveBeenCalledWith('/category/cavity?sub=inlay');
  });

  it('Esc 한 번은 추천을 접고, 두 번은 입력을 비운다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    await userEvent.type(input, '인레');
    await screen.findByRole('option', { name: /인레이/ });

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByText('인기 검색어')).toBeInTheDocument();
    expect(input).toHaveValue('인레');

    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('접힌 뒤 ↓ 는 목록을 다시 펴고, 보이지 않는 줄을 활성으로 만들지 않는다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(pagedHospitals([]));
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(pagedDoctors([]));

    renderSearch('/search');
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    await userEvent.type(input, '인레');
    await screen.findByRole('option', { name: /인레이/ });

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-activedescendant');
    // 닫힌 동안에는 문서에 없는 목록을 가리키지 않는다.
    expect(input).not.toHaveAttribute('aria-controls');

    await userEvent.keyboard('{ArrowDown}');
    expect(await screen.findByRole('option', { name: /인레이/ })).toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(input).toHaveAttribute('aria-controls');
  });
});
