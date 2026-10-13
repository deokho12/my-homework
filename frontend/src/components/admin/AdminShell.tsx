import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { AdminNarrowNav } from '@/components/admin/AdminNarrowNav';
import { AdminSideMenu, type AdminMenuContentProps } from '@/components/admin/AdminSideMenu';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { adminSection, buildAdminMenu, hospitalSwitchTarget } from '@/components/admin/adminMenu';
import { useAdminDashboard } from '@/features/admin/hooks/useAdminDashboard';
import { useAdminHospital } from '@/features/admin/hooks/useAdminHospital';
import { useSession } from '@/features/auth/hooks/useSession';
import { ActivityIndicator, View } from '@/primitives';

/**
 * 모든 관리자 화면의 **유일한 크롬**: 왼쪽 메뉴(lg 이상) + 상단바 + 본문.
 *
 * 환자 앱의 `TopNavBar`·`AppHeader`·`BottomTabBar` 는 여기서 끈다 (`App.tsx` 의
 * `shell: 'admin'`) — 헤더가 두 벌이면 제목이 두 번 읽히고 탭바가 관리자에게 아무 뜻이 없다.
 *
 * **가드와 겹치지 않는다.** 자격이 없는 사람에게는 셸을 씌우지 않고 가드 화면을 그대로
 * 보여준다 — 로그인하라는 화면에 사이드 메뉴가 붙어 있으면 "들어와 있다" 로 읽힌다.
 *
 * `min-h-0 flex-1` 사슬을 끊지 않는다 — `#root` 부터 ScrollView 까지 한 칸이라도 끊기면
 * 본문 스크롤이 통째로 죽는다 (`src/test/appShellLayout.test.tsx`).
 */
export function AdminShell() {
  const { user, isRestoring, isHospitalAdmin, isOperator } = useSession();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);

  const { hospitalId, count, options, select } = useAdminHospital();
  const dashboard = useAdminDashboard(hospitalId, { enabled: isHospitalAdmin && !isOperator });
  const [switchNotice, setSwitchNotice] = useState('');

  const section = adminSection(pathname);
  const lastSection = useRef<string | null>(null);

  /**
   * **섹션이 바뀔 때만** 본문으로 포커스를 옮긴다. 첫 마운트에 옮기면 새로고침마다 포커스가
   * 튀고, `:id` 만 바뀔 때(목록에서 다른 상담 선택) 옮기면 고르던 자리를 잃는다.
   */
  useEffect(() => {
    if (lastSection.current !== null && lastSection.current !== section) {
      mainRef.current?.focus();
    }

    lastSection.current = section;
  }, [section]);

  if (isRestoring) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isHospitalAdmin) return <Outlet />;

  const groups = buildAdminMenu({
    isOperator,
    selectedHospitalId: hospitalId,
    pathname,
    field: searchParams.get('field') ?? undefined,
    // **셸과 대시보드가 같은 쿼리를 읽는다** — 배지와 카드가 다른 숫자를 말할 수 없다.
    counts: {
      statusNew: dashboard.data?.numbers.statusNew ?? null,
      unansweredInquiries: dashboard.data?.numbers.unansweredInquiries ?? null,
    },
  });

  const selectHospital = (nextId: string) => {
    if (nextId === hospitalId) return;

    select(nextId);

    const name = options.find((option) => option.id === nextId)?.name ?? nextId;
    setSwitchNotice(`${name} 기준으로 바꿨어요`);

    // 보고 있던 레코드는 방금 떠난 병원의 것이다 — 목록(또는 새 병원의 같은 화면)으로.
    const target = hospitalSwitchTarget(pathname, nextId);
    if (target) navigate(target, { replace: true });
  };

  const menu: AdminMenuContentProps = {
    groups,
    // 1곳이면 고를 것이 없다. 운영자는 담당 병원이라는 개념 자체가 없다.
    showPicker: count > 1,
    pickerId: 'admin-hospital',
    hospitalId,
    hospitalOptions: options,
    onSelectHospital: selectHospital,
    // 운영자에게 "담당 병원 없음" 은 거짓이다 — 맡은 병원이 없는 게 아니라 전체를 본다.
    hospitalName: isOperator
      ? '운영자 · 모든 병원'
      : (dashboard.data?.hospitalName ?? options.find((option) => option.id === hospitalId)?.name ?? null),
    userName: user?.name ?? '',
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-50 lg:flex-row">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-700 focus:ring-2 focus:ring-brand-600"
      >
        본문으로 건너뛰기
      </a>

      <AdminSideMenu {...menu} className="hidden lg:flex lg:w-[248px] lg:shrink-0" />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <AdminNarrowNav {...menu} pickerId="admin-hospital-narrow" className="lg:hidden" />

        <p aria-live="polite" className="sr-only">
          {switchNotice}
        </p>

        <main
          id="admin-main"
          ref={mainRef}
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col items-center outline-none"
        >
          <div className="flex min-h-0 w-full max-w-content flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
