import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminShell } from '@/components/admin/AdminShell';
import * as dashboardApi from '@/features/admin/api/dashboardApi';
import type { AdminDashboard } from '@/features/admin/api/dashboardApi';
import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as notificationApi from '@/features/notification/api/notificationApi';
import { RouterBridge, ScreenOptionsProvider } from '@/navigation';
import { useAdminHospitalStore } from '@/store/useAdminHospitalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import type { ManagedHospitalsResponse, User, UserRole } from '@/types/domain';

/**
 * 모든 관리자 화면을 감싸는 셸. **여기서 고정하는 것은 "어느 화면에서도 같은 크롬이 있다"**
 * 와, 그 크롬이 가드·포커스·배지에서 하는 약속들이다.
 */

function signIn(role: UserRole, managedHospitalIds: string[] = ['h1']): void {
  const user: User = {
    id: `u-${role}`,
    email: 'admin@molarmolar.example',
    name: '김실장',
    provider: 'email',
    role,
    managedHospitalIds: role === 'hospital_admin' ? managedHospitalIds : [],
  };

  act(() => {
    useAuthStore.setState({ user, status: 'ready' });
  });
}

function dashboard(overrides: Partial<AdminDashboard> = {}): AdminDashboard {
  return {
    hospitalId: 'h1',
    hospitalName: '강남 스마일 치과',
    numbers: {
      todayNew: 3,
      statusNew: 8,
      pending: 15,
      delayed: 3,
      unansweredInquiries: 2,
      oldestUnansweredAt: null,
      newThisMonth: 42,
      bookedThisMonth: 18,
    },
    funnel: { requested: 42, contacted: 31, booked: 18, visited: 7, cancelled: 6 },
    todo: { delayedConsults: [], delayedRemaining: 0, rejectedDoctors: [] },
    recentConsults: [],
    todayVisits: [],
    completeness: { percent: 100, items: [], noProcedures: false },
    timezone: 'Asia/Seoul',
    calculatedAt: '2026-10-13T02:30:00.000Z',
    ...overrides,
  };
}

function managed(ids: string[]): ManagedHospitalsResponse {
  return {
    items: ids.map((id) => baseHospital({ id, name: `${id} 치과` })),
    meta: { page: 1, pageSize: 100, totalItems: ids.length, totalPages: 1 },
    scope: 'managed',
  };
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function Screen({ label }: { label: string }) {
  return <p>{label} 본문</p>;
}

function renderShell(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <RouterBridge />
          <LocationProbe />
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(
    <ScreenOptionsProvider initial={{ title: '대시보드' }}>
      <Routes>
        <Route element={<AdminShell />}>
          <Route path="/admin" element={<Screen label="대시보드" />} />
          <Route path="/admin/consultations" element={<Screen label="상담 예약" />} />
          <Route path="/admin/consultations/:id" element={<Screen label="상담 상세" />} />
          <Route path="/admin/inquiries" element={<Screen label="문의" />} />
          <Route path="/admin/inquiries/:id" element={<Screen label="문의 상세" />} />
          <Route path="/admin/hospital/:id" element={<Screen label="병원 정보 수정" />} />
          <Route path="/admin/hospital/new" element={<Screen label="병원 등록" />} />
          <Route path="/admin/specialists" element={<Screen label="전문의 인증 검수" />} />
          <Route path="/admin/notifications" element={<Screen label="알림함" />} />
        </Route>
      </Routes>
    </ScreenOptionsProvider>,
    { wrapper: Wrapper }
  );
}

function probe(): string {
  return screen.getByTestId('location').textContent ?? '';
}

/** 세로 메뉴와 좁은 메뉴가 같은 모델을 그린다 — 테스트는 세로 메뉴 쪽을 본다. */
function sideMenu(): HTMLElement {
  return screen.getAllByRole('navigation', { name: '관리자 메뉴' })[0];
}

beforeEach(() => {
  signIn('hospital_admin');
  act(() => {
    useAdminHospitalStore.getState().clear();
  });
  vi.spyOn(dashboardApi, 'fetchAdminDashboard').mockResolvedValue(dashboard());
  vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(managed(['h1']));
  vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) => baseHospital({ id }));
  vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
  vi.spyOn(notificationApi, 'fetchUnreadNotificationCount').mockResolvedValue({ audience: 'admin', unreadCount: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    useAuthStore.setState({ user: null, status: 'ready' });
  });
});

describe('AdminShell — 어느 관리자 화면에나 같은 크롬', () => {
  it.each([
    '/admin',
    '/admin/consultations',
    '/admin/consultations/c1',
    '/admin/inquiries',
    '/admin/inquiries/hi1',
    '/admin/hospital/h1',
    '/admin/specialists',
    '/admin/notifications',
  ])('%s 에도 메뉴와 상단바가 있다', async (route) => {
    renderShell(route);

    expect(await screen.findByText(/본문$/)).toBeInTheDocument();
    expect(sideMenu()).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('자격이 없으면 셸을 씌우지 않는다 — 가드 화면이 그대로 보인다', async () => {
    signIn('user');

    renderShell('/admin');

    expect(await screen.findByText('대시보드 본문')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '관리자 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('세션 복원 중에는 메뉴도 본문도 그리지 않는다 — 가드가 판정하기 전이다', () => {
    act(() => {
      useAuthStore.setState({ user: null, status: 'restoring' });
    });

    renderShell('/admin');

    expect(screen.queryByRole('navigation', { name: '관리자 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByText('대시보드 본문')).not.toBeInTheDocument();
  });

  it('본문으로 건너뛰기 링크가 main 을 가리킨다', async () => {
    renderShell('/admin');

    expect(await screen.findByRole('link', { name: '본문으로 건너뛰기' })).toHaveAttribute('href', '#admin-main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'admin-main');
  });
});

describe('AdminShell — 메뉴', () => {
  it('현재 화면의 메뉴에 aria-current 가 붙는다', async () => {
    renderShell('/admin/consultations/c1');

    const menu = sideMenu();
    await waitFor(() => expect(within(menu).getByRole('link', { name: /상담 예약/ })).toHaveAttribute('aria-current', 'page'));
    expect(within(menu).getByRole('link', { name: /^문의/ })).not.toHaveAttribute('aria-current');
  });

  it('배지는 대시보드 응답의 숫자이고, 읽어 주는 문장이 함께 있다', async () => {
    renderShell('/admin');

    const menu = sideMenu();

    await waitFor(() =>
      expect(within(menu).getByRole('link', { name: /상담 예약/ })).toHaveAccessibleName('상담 예약, 신규 8건')
    );
    expect(within(menu).getByRole('link', { name: /문의/ })).toHaveAccessibleName('문의, 미답변 2건');
    // 숫자 자체는 `aria-hidden` 이라 "팔" 로 읽히지 않는다.
    expect(within(menu).getByText('8').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('숫자가 0이면 배지를 그리지 않는다 — 0 은 붙일 배지가 아니다', async () => {
    vi.spyOn(dashboardApi, 'fetchAdminDashboard').mockResolvedValue(
      dashboard({ numbers: { ...dashboard().numbers, statusNew: 0, unansweredInquiries: 0 } })
    );

    renderShell('/admin');

    const menu = sideMenu();
    await waitFor(() => expect(within(menu).getByRole('link', { name: '상담 예약' })).toBeInTheDocument());
    expect(within(menu).queryByText('신규 0건')).not.toBeInTheDocument();
  });

  it('병원 정보 메뉴는 선택한 병원으로 가고, 의료진은 그 영역으로 간다', async () => {
    renderShell('/admin');

    const menu = sideMenu();
    expect(await within(menu).findByRole('link', { name: '기본 정보 · 시술' })).toHaveAttribute(
      'href',
      '/admin/hospital/h1'
    );
    expect(within(menu).getByRole('link', { name: '의료진' })).toHaveAttribute(
      'href',
      '/admin/hospital/h1?field=doctors'
    );
  });

  it('준비중 항목은 링크가 아니다', async () => {
    renderShell('/admin');

    const menu = sideMenu();
    await within(menu).findByText('이벤트');
    expect(within(menu).queryByRole('link', { name: /이벤트/ })).not.toBeInTheDocument();
    expect(within(menu).getAllByText('준비중').length).toBeGreaterThan(0);
  });

  it('운영자에게는 검수·새 병원 등록 메뉴가 있고 배지 숫자가 없다', async () => {
    signIn('operator');

    renderShell('/admin');

    const menu = sideMenu();
    expect(await within(menu).findByRole('link', { name: '전문의 인증 검수' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: '새 병원 등록' })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: '대시보드' })).not.toBeInTheDocument();
    // 운영자에게는 담당 병원이 없다 — 대시보드를 부르지도 않는다 (`403` 이 확정이다).
    expect(dashboardApi.fetchAdminDashboard).not.toHaveBeenCalled();
    expect(within(menu).queryByText(/신규 \d+건/)).not.toBeInTheDocument();
    // 홍보·확장은 병원이 자기 병원을 알리는 기능이라 운영자 메뉴에 두지 않는다.
    expect(within(menu).queryByText('홍보 · 확장')).not.toBeInTheDocument();
    expect(within(menu).queryByText('이벤트')).not.toBeInTheDocument();
    // 하단 카드 — 운영자는 "담당 병원 없음" 이 아니라 전체를 본다.
    expect(within(menu).getByText('운영자 · 모든 병원')).toBeInTheDocument();
    expect(within(menu).queryByText('담당 병원 없음')).not.toBeInTheDocument();
  });

  it('담당 병원이 없으면 병원 정보 그룹을 그리지 않는다', async () => {
    signIn('hospital_admin', []);

    renderShell('/admin');

    const menu = sideMenu();
    await within(menu).findByRole('link', { name: '대시보드' });
    expect(within(menu).queryByText('병원 정보')).not.toBeInTheDocument();
    expect(within(menu).getByText('담당 병원 없음')).toBeInTheDocument();
  });
});

describe('AdminShell — 좁은 화면의 더보기', () => {
  it('닫혀 있다가 열리고, Esc 로 닫으면 포커스가 버튼으로 돌아온다', async () => {
    const user = userEvent.setup();
    renderShell('/admin');

    const button = await screen.findByRole('button', { name: /더보기/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById('admin-more-panel');
    expect(panel).toHaveAttribute('hidden');
    // jsdom 은 Tailwind 를 모른다 — 대신 `hidden` 을 이기는 display 유틸리티가 없음을 고정한다
    // (`flex` 가 붙어 있으면 실제 브라우저에서 닫힌 패널이 그대로 보였다).
    expect(panel?.className ?? '').not.toMatch(/(^|\s)(flex|grid|block|inline-flex|inline-block)(\s|$)/);

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('admin-more-panel')).not.toHaveAttribute('hidden');

    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });
});

describe('AdminShell — 포커스', () => {
  it('첫 마운트에는 본문으로 포커스를 옮기지 않는다', async () => {
    renderShell('/admin');

    await screen.findByText('대시보드 본문');
    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('섹션이 바뀌면 본문으로 포커스를 옮기고, :id 만 바뀌면 그대로 둔다', async () => {
    const user = userEvent.setup();
    renderShell('/admin/consultations/c1');

    await screen.findByText('상담 상세 본문');
    const main = screen.getByRole('main');
    expect(main).not.toHaveFocus();

    // 같은 섹션 안에서 다른 상담으로 — 고르던 자리를 잃지 않는다.
    await user.click(within(sideMenu()).getByRole('link', { name: /상담 예약/ }));
    await screen.findByText('상담 예약 본문');
    expect(main).not.toHaveFocus();

    // 다른 섹션으로 — 본문이 통째로 바뀌었으므로 거기서 읽기 시작한다.
    await user.click(within(sideMenu()).getByRole('link', { name: /^문의/ }));
    await screen.findByText('문의 본문');
    expect(screen.getByRole('main')).toHaveFocus();
  });
});

describe('AdminTopBar', () => {
  it('화면 제목이 h1 이다 — 화면마다 다시 쓰지 않는다', async () => {
    renderShell('/admin');

    expect(await screen.findByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument();
  });

  it('상세 라우트에만 목록으로 돌아가는 링크가 있다', async () => {
    const { unmount } = renderShell('/admin/consultations/c1');

    expect(await screen.findByRole('link', { name: '목록으로' })).toHaveAttribute('href', '/admin/consultations');
    unmount();

    renderShell('/admin/consultations');
    await screen.findByText('상담 예약 본문');
    expect(screen.queryByRole('link', { name: '목록으로' })).not.toBeInTheDocument();
  });

  it('검색을 제출하면 그 검색어로 상담 목록을 연다', async () => {
    const user = userEvent.setup();
    renderShell('/admin');

    const input = (await screen.findAllByLabelText('환자 검색'))[0];
    await user.type(input, '박서영{Enter}');

    // 기본 탭(`신규`)·기본 기간(`최근 30일`) 밖의 환자도 찾아야 한다.
    await waitFor(() =>
      expect(probe()).toBe('/admin/consultations?status=all&period=all&q=%EB%B0%95%EC%84%9C%EC%98%81')
    );
  });

  it('빈 검색어는 무시한다 — 목록을 통째로 다시 여는 것은 검색이 아니다', async () => {
    const user = userEvent.setup();
    renderShell('/admin');

    const input = (await screen.findAllByLabelText('환자 검색'))[0];
    await user.type(input, '   {Enter}');

    expect(probe()).toBe('/admin');
  });

  it('안 읽은 알림이 있으면 종에 점이 붙고 읽어 주는 이름이 바뀐다', async () => {
    vi.spyOn(notificationApi, 'fetchUnreadNotificationCount').mockResolvedValue({ audience: 'admin', unreadCount: 3 });

    renderShell('/admin');

    expect(await screen.findByRole('link', { name: '알림, 안 읽음 3건' })).toBeInTheDocument();
    expect(screen.getByTestId('admin-bell-dot')).toBeInTheDocument();
  });

  it('안 읽은 알림이 없으면 점이 없다', async () => {
    renderShell('/admin');

    expect(await screen.findByRole('link', { name: '알림' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-bell-dot')).not.toBeInTheDocument();
  });
});

describe('AdminShell — 병원 선택기', () => {
  it('담당 병원이 1곳이면 선택기를 그리지 않는다', async () => {
    renderShell('/admin');

    await screen.findByText('대시보드 본문');
    expect(screen.queryByLabelText('담당 병원')).not.toBeInTheDocument();
  });

  it('2곳 이상이면 선택기가 있고, 고르면 그 병원 기준으로 바뀐다', async () => {
    const user = userEvent.setup();
    signIn('hospital_admin', ['h1', 'h3']);
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(managed(['h1', 'h3']));

    renderShell('/admin');

    const picker = (await screen.findAllByLabelText('담당 병원'))[0];
    await waitFor(() => expect(within(picker).getByRole('option', { name: 'h3 치과' })).toBeInTheDocument());

    await user.selectOptions(picker, 'h3');

    await waitFor(() => expect(dashboardApi.fetchAdminDashboard).toHaveBeenCalledWith({ hospitalId: 'h3' }));
    expect(screen.getByText('h3 치과 기준으로 바꿨어요')).toBeInTheDocument();
  });

  it('특정 상담을 보던 중에 병원을 바꾸면 목록으로 돌아간다 — 그 상담은 떠난 병원의 것이다', async () => {
    const user = userEvent.setup();
    signIn('hospital_admin', ['h1', 'h3']);
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(managed(['h1', 'h3']));

    renderShell('/admin/consultations/c1');

    const picker = (await screen.findAllByLabelText('담당 병원'))[0];
    await waitFor(() => expect(within(picker).getByRole('option', { name: 'h3 치과' })).toBeInTheDocument());

    await user.selectOptions(picker, 'h3');

    await waitFor(() => expect(probe()).toBe('/admin/consultations'));
  });
});
