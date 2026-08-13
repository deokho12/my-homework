import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { RouterBridge, router } from '@/navigation';
import { procedures } from '@/mocks/fixtures/procedures';
import SearchScreen from '@/screens/search';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor } from '@/types/domain';

/**
 * `router.push` 는 `RouterBridge` 가 마운트돼 있어야 동작한다(`src/navigation/index.tsx`).
 * `fetchProcedures` 를 스파이해 응답 시점을 직접 제어한다 — `?q=` 로 들어온 검색이
 * 시술 목록 로딩과 경합할 때의 동작을 검증하기 위해서다.
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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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

describe('검색 화면 — q 로 들어온 자동 검색과 시술 목록 로딩의 경합', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('시술 목록이 아직 로딩 중이면 거짓 "결과 없음" 을 보이지 않고, 도착 후 올바른 시술로 이동한다', async () => {
    let resolveProcedures!: (value: typeof procedures) => void;
    vi.spyOn(procedureApi, 'fetchProcedures').mockReturnValue(
      new Promise((resolve) => {
        resolveProcedures = resolve;
      })
    );
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch(`/search?q=${encodeURIComponent('임플란트')}`);

    // 시술 목록이 아직 안 왔다 — 빈 배열을 근거로 "결과 없음" 이라고 단정하면 안 된다.
    expect(screen.queryByText(/검색 결과가 없어요/)).not.toBeInTheDocument();
    expect(pushSpy).not.toHaveBeenCalled();

    resolveProcedures(procedures);

    await waitFor(() =>
      expect(pushSpy).toHaveBeenCalledWith({
        pathname: '/(tabs)/explore',
        params: { mode: 'hospital', category: 'implant' },
      })
    );
    // 도착 후에도 거짓 "결과 없음" 문구가 남아있지 않아야 한다.
    expect(screen.queryByText(/검색 결과가 없어요/)).not.toBeInTheDocument();
  });

  it('시술 목록 로딩이 끝난 뒤에는(캐시 적중) 바로 올바른 결과로 이동한다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    const pushSpy = vi.spyOn(router, 'push');

    renderSearch(`/search?q=${encodeURIComponent('임플란트')}`);

    await waitFor(() =>
      expect(pushSpy).toHaveBeenCalledWith({
        pathname: '/(tabs)/explore',
        params: { mode: 'hospital', category: 'implant' },
      })
    );
    expect(screen.queryByText(/검색 결과가 없어요/)).not.toBeInTheDocument();
  });
});
