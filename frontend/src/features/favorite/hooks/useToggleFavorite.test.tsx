import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMyFavorites } from '@/features/favorite/api/favoriteApi';
import { HospitalCard } from '@/features/hospital/components/HospitalCard';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { procedures } from '@/mocks/fixtures/procedures';
import { RouterBridge, usePathname } from '@/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { User } from '@/types/domain';

function loggedInUser(): User {
  return {
    id: 'u1',
    email: 'user@molarmolar.example',
    name: '테스트',
    provider: 'email',
    role: 'user',
    managedHospitalIds: [],
  };
}

/** MemoryRouter 라 `window.location` 은 바뀌지 않는다. 이동 여부를 화면에서 확인하려고 경로를 그린다. */
function PathProbe() {
  return <span data-testid="pathname">{usePathname()}</span>;
}

/**
 * 하트 배선 전체를 한 번에 고정한다: `useIsFavorite`(조회) → `useToggleFavorite`(쓰기) →
 * 무효화 → 다시 그려진 하트. 예전에는 zustand 스토어가 이 셋을 한 몸으로 들고 있었다.
 */
describe('HospitalCard — 찜하기', () => {
  beforeEach(() => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  it('로그인한 사용자가 하트를 누르면 저장되고 하트가 채워진다', async () => {
    useAuthStore.setState({ user: loggedInUser(), status: 'ready' });
    const hospital = baseHospital();

    renderWithProviders(<HospitalCard hospital={hospital} />);

    await userEvent.click(await screen.findByText('🤍'));

    await waitFor(() => expect(screen.getByText('❤️')).toBeInTheDocument());
    expect((await fetchMyFavorites()).hospitalIds).toEqual([hospital.id]);
  });

  it('채워진 하트를 다시 누르면 찜이 해제된다', async () => {
    useAuthStore.setState({ user: loggedInUser(), status: 'ready' });
    const hospital = baseHospital();

    renderWithProviders(<HospitalCard hospital={hospital} />);

    await userEvent.click(await screen.findByText('🤍'));
    await waitFor(() => expect(screen.getByText('❤️')).toBeInTheDocument());

    await userEvent.click(screen.getByText('❤️'));

    await waitFor(() => expect(screen.getByText('🤍')).toBeInTheDocument());
    expect((await fetchMyFavorites()).hospitalIds).toEqual([]);
  });

  it('비로그인 상태에서는 저장하지 않는다 (로그인으로 보낸다)', async () => {
    const hospital = baseHospital();

    // 로그인으로 보내는 경로라 라우터가 실제로 붙어 있어야 한다.
    renderWithProviders(
      <>
        <RouterBridge />
        <PathProbe />
        <HospitalCard hospital={hospital} />
      </>
    );

    await userEvent.click(await screen.findByText('🤍'));

    // 클릭이 만든 이동·재렌더가 끝난 뒤에 단언한다. 곧바로 단언하면 `act(...)` 경고가 나고,
    // "아직 저장되지 않았다" 를 우연히 통과할 수도 있다.
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/auth/login'));
    expect((await fetchMyFavorites()).hospitalIds).toEqual([]);
  });
});
