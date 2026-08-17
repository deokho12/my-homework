import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as favoriteApi from '@/features/favorite/api/favoriteApi';
import * as notificationApi from '@/features/notification/api/notificationApi';
import MyPageScreen from '@/screens/tabs/mypage';
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

/**
 * 마이페이지.
 *
 * 찜은 이제 **서버 목록**이다 — 예전에는 브라우저에 저장돼 로그아웃해도 남았다.
 * `expand=hospital` 로 병원 본문까지 한 번에 받으므로 항목마다 병원을 조회하지 않는다.
 */
describe('MyPageScreen — 찜한 병원', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: loggedInUser(), status: 'ready' });
    vi.spyOn(notificationApi, 'fetchUnreadCount').mockResolvedValue({ audience: 'user', unreadCount: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  it('★ 병원 본문을 한 번에 받아 렌더한다 (항목마다 조회하지 않는다)', async () => {
    const target = baseHospital();
    const favoritesSpy = vi
      .spyOn(favoriteApi, 'fetchMyFavorites')
      .mockResolvedValue({ hospitalIds: [target.id], hospitals: [target] });

    renderWithProviders(<MyPageScreen />);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(favoritesSpy).toHaveBeenCalledWith('hospital');
  });

  it('찜한 병원이 없으면 빈 상태 문구를 보여준다', async () => {
    vi.spyOn(favoriteApi, 'fetchMyFavorites').mockResolvedValue({ hospitalIds: [], hospitals: [] });

    renderWithProviders(<MyPageScreen />);

    await waitFor(() => expect(screen.getByText(/아직 찜한 병원이 없어요/)).toBeInTheDocument());
  });

  it('★ 조회 중에는 "없어요" 라고 단정하지 않는다', () => {
    vi.spyOn(favoriteApi, 'fetchMyFavorites').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<MyPageScreen />);

    expect(screen.queryByText(/아직 찜한 병원이 없어요/)).not.toBeInTheDocument();
  });

  it('안 읽은 알림 개수를 배지로 보여준다', async () => {
    vi.spyOn(favoriteApi, 'fetchMyFavorites').mockResolvedValue({ hospitalIds: [], hospitals: [] });
    vi.spyOn(notificationApi, 'fetchUnreadCount').mockResolvedValue({ audience: 'user', unreadCount: 3 });

    renderWithProviders(<MyPageScreen />);

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('★ 상담 신청 내역으로 가는 길이 있다 (안내만 있고 화면이 없던 문제)', async () => {
    vi.spyOn(favoriteApi, 'fetchMyFavorites').mockResolvedValue({ hospitalIds: [], hospitals: [] });

    renderWithProviders(<MyPageScreen />);

    await waitFor(() => expect(screen.getByText('상담 신청 내역')).toBeInTheDocument());
  });
});
