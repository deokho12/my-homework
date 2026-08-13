import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { RouterBridge, router } from '@/navigation';
import { procedures } from '@/mocks/fixtures/procedures';
import SearchScreen from '@/screens/search';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * `router.push` 는 `RouterBridge` 가 마운트돼 있어야 동작한다(`src/navigation/index.tsx`).
 * `fetchProcedures` 를 스파이해 응답 시점을 직접 제어한다 — `?q=` 로 들어온 검색이
 * 시술 목록 로딩과 경합할 때의 동작을 검증하기 위해서다. `fetchDoctors` 는 이 화면이
 * 의사 검색에도 쓰므로 기본적으로 빈 목록을 돌려주도록 스텁한다.
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

describe('검색 화면 — q 로 들어온 자동 검색과 시술 목록 로딩의 경합', () => {
  beforeEach(() => {
    vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });

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
