import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeCollection } from '@/lib/localCollection';
import { RouterBridge, router } from '@/navigation';
import NotificationsScreen from '@/screens/notifications';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { AppNotification } from '@/types/domain';

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    audience: 'user',
    type: 'inquiry-answer',
    title: '문의에 답변이 왔어요',
    message: '강남 스마일 치과 · 임플란트는 90만원부터입니다',
    relatedId: 'hi1',
    isRead: false,
    createdAt: '2026-10-12T06:10:00.000Z',
    ...overrides,
  };
}

describe('NotificationsScreen — 문의 답변 알림', () => {
  beforeEach(() => {
    writeCollection('consultRequests', []);
    useAuthStore.setState({
      user: {
        id: 'u-me',
        email: 'me@molarmolar.example',
        name: '김민준',
        provider: 'email',
        role: 'user',
        managedHospitalIds: [],
      },
      status: 'ready',
    });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'ready' });
    vi.restoreAllMocks();
  });

  it('누르면 마이페이지 내 문의의 그 문의를 펼친 채 연다', async () => {
    writeCollection('notifications', [notification()]);
    const pushSpy = vi.spyOn(router, 'push');

    renderWithProviders(
      <>
        <RouterBridge />
        <NotificationsScreen />
      </>,
      { route: '/notifications' }
    );

    await userEvent.click(await screen.findByText('문의에 답변이 왔어요'));

    // 비공개 답변을 읽을 수 있는 곳은 내 문의뿐이다 — 병원 상세 공개 Q/A 로 보내지 않는다.
    expect(pushSpy).toHaveBeenCalledWith('/mypage?tab=inquiries&inquiry=hi1');
  });

  it('읽음 처리도 함께 한다', async () => {
    writeCollection('notifications', [notification()]);
    vi.spyOn(router, 'push').mockImplementation(() => {});

    renderWithProviders(
      <>
        <RouterBridge />
        <NotificationsScreen />
      </>,
      { route: '/notifications' }
    );

    await userEvent.click(await screen.findByText('문의에 답변이 왔어요'));

    await waitFor(() => {
      const [stored] = JSON.parse(
        window.localStorage.getItem('molarmolar-local-notifications') ?? '[]'
      ) as AppNotification[];
      expect(stored.isRead).toBe(true);
    });
  });
});
