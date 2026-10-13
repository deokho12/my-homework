import { screen, waitFor, within } from '@testing-library/react';
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
    consultStatus: null,
    ...overrides,
  };
}

function renderScreen() {
  return renderWithProviders(
    <>
      <RouterBridge />
      <NotificationsScreen />
    </>,
    { route: '/notifications' }
  );
}

/** 알림 한 줄은 버튼 하나다 — 그 안의 글자를 다 이어 붙인 접근성 이름으로 찾는다. */
function row(name: RegExp) {
  return screen.findByRole('button', { name });
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

    renderScreen();

    await userEvent.click(await screen.findByText('문의에 답변이 왔어요'));

    // 비공개 답변을 읽을 수 있는 곳은 내 문의뿐이다 — 병원 상세 공개 Q/A 로 보내지 않는다.
    expect(pushSpy).toHaveBeenCalledWith('/mypage?tab=inquiries&inquiry=hi1');
  });

  it('읽음 처리도 함께 한다', async () => {
    writeCollection('notifications', [notification()]);
    vi.spyOn(router, 'push').mockImplementation(() => {});

    renderScreen();

    await userEvent.click(await screen.findByText('문의에 답변이 왔어요'));

    await waitFor(() => {
      const [stored] = JSON.parse(
        window.localStorage.getItem('molarmolar-local-notifications') ?? '[]'
      ) as AppNotification[];
      expect(stored.isRead).toBe(true);
    });
  });
});

describe('NotificationsScreen — 상담 알림', () => {
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

  const consultNotification = (overrides: Partial<AppNotification> = {}) =>
    notification({
      id: 'n-booked',
      type: 'consult-status',
      title: '상담 예약이 확정됐어요',
      message: '강남 스마일 치과 · 10/9(금) 14:00 방문. 변경이 필요하면 병원에 전화해 주세요',
      relatedId: 'cr9',
      consultStatus: 'booked',
      ...overrides,
    });

  it('상담 알림은 상태와 무관하게 마이페이지 상담 내역의 그 상담으로 간다', async () => {
    writeCollection('notifications', [
      consultNotification(),
      consultNotification({
        id: 'n-cancelled',
        title: '상담이 취소됐어요',
        message: '강남 스마일 치과 · 연락이 닿지 않아 취소됐어요',
        relatedId: 'cr8',
        consultStatus: 'cancelled',
        createdAt: '2026-10-11T00:00:00.000Z',
      }),
    ]);
    const pushSpy = vi.spyOn(router, 'push');

    renderScreen();

    await userEvent.click(await screen.findByText('상담 예약이 확정됐어요'));
    expect(pushSpy).toHaveBeenLastCalledWith('/mypage?tab=consults&consult=cr9');

    // 취소 알림도 같은 곳으로 간다 — 예전처럼 병원 상세로 갈라지지 않는다.
    await userEvent.click(screen.getByText('상담이 취소됐어요'));
    expect(pushSpy).toHaveBeenLastCalledWith('/mypage?tab=consults&consult=cr8');
    expect(pushSpy.mock.calls.flat()).not.toContain('/hospital/h1');
  });

  it('상담 id 가 없는 알림은 읽음 처리만 하고 이동하지 않는다', async () => {
    writeCollection('notifications', [consultNotification({ relatedId: null })]);
    const pushSpy = vi.spyOn(router, 'push');

    renderScreen();

    await userEvent.click(await screen.findByText('상담 예약이 확정됐어요'));

    expect(pushSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      const [stored] = JSON.parse(
        window.localStorage.getItem('molarmolar-local-notifications') ?? '[]'
      ) as AppNotification[];
      expect(stored.isRead).toBe(true);
    });
  });

  it('저장된 문구를 그대로 그린다 — 화면이 다시 만들지 않는다', async () => {
    writeCollection('notifications', [
      consultNotification({ message: '옛 병원 이름 · 10/1(목) 09:00 방문. 변경이 필요하면 병원에 전화해 주세요' }),
    ]);

    renderScreen();

    expect(await screen.findByText(/옛 병원 이름/)).toBeInTheDocument();
  });
});

describe('NotificationsScreen — 종류와 읽음 표시', () => {
  beforeEach(() => {
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

  it('낭독기는 안 읽은 행에서만 `안 읽음` 을 듣고, 종류는 늘 듣는다', async () => {
    writeCollection('notifications', [
      notification({
        id: 'n-unread',
        type: 'consult-status',
        title: '상담 예약이 확정됐어요',
        consultStatus: 'booked',
        isRead: false,
        createdAt: '2026-10-12T06:10:00.000Z',
      }),
      notification({
        id: 'n-read',
        title: '문의에 답변이 왔어요',
        isRead: true,
        createdAt: '2026-10-11T06:10:00.000Z',
      }),
    ]);

    renderScreen();

    // 종류 라벨은 아이콘의 유일한 음성 대응이다 (아이콘 자체는 aria-hidden).
    expect(await row(/안 읽음, 예약 알림\./)).toBeInTheDocument();
    const read = await row(/문의 알림\./);
    expect(read).toBeInTheDocument();
    // 읽은 행은 `읽음,` 을 말하지 않는다 — 긴 목록에서 거의 모든 행에 붙는 군더더기다.
    expect(read.textContent).not.toMatch(/안 읽음/);
  });

  it('시각은 기기 시계가 아니라 서울 달력으로 적는다', async () => {
    writeCollection('notifications', [notification({ createdAt: '2026-10-09T05:02:00.000Z' })]);

    renderScreen();

    expect(await screen.findByText('10/9 14:02')).toBeInTheDocument();
  });

  it('본문은 3줄에서 잘린다 (md 이상 2줄) — `block` 과 함께 주면 clamp 가 죽는다', async () => {
    // jsdom 은 레이아웃을 계산하지 않아 "잘렸는지" 를 볼 수 없다. 고정하는 것은 **클래스
    // 조합**이다: `line-clamp-*` 는 `display:-webkit-box` 로 동작하는데 `.block` 이
    // 스타일시트 뒤쪽에 있어 같이 쓰면 `display:block` 이 이기고 clamp 가 조용히 사라진다.
    writeCollection('notifications', [notification({ message: '긴 본문'.repeat(40) })]);

    renderScreen();

    const body = await screen.findByText(/긴 본문/);

    expect(body.className).toContain('line-clamp-3');
    expect(body.className).toContain('md:line-clamp-2');
    expect(body.className.split(/\s+/)).not.toContain('block');
  });

  it('알림 줄은 목록(ul/li)으로 묶인다 — 낭독기가 개수를 먼저 말한다', async () => {
    writeCollection('notifications', [notification(), notification({ id: 'n2', createdAt: '2026-10-11T00:00:00.000Z' })]);

    renderScreen();

    const list = await screen.findByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('상태 칸이 없는 과거 알림도 그려진다 (상담 아이콘으로 떨어진다)', async () => {
    // 시드 알림에는 `consultStatus` 키 자체가 없다 — 읽을 때 null 로 맞춰진다.
    writeCollection('notifications', [
      {
        id: 'notif-legacy',
        audience: 'user',
        type: 'consult-status',
        title: '상담 상태 변경',
        message: "상담 상태가 '예약완료'(으)로 변경되었어요",
        isRead: false,
        createdAt: '2026-07-18T11:45:00.000Z',
        relatedId: 'cr3',
      },
    ]);

    renderScreen();

    expect(await row(/안 읽음, 상담 알림\./)).toBeInTheDocument();
  });
});
