import type { ReactNode } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { AdminShell } from '@/components/admin/AdminShell';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabBar } from '@/components/BottomTabBar';
import { TopNavBar } from '@/components/TopNavBar';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { SessionWatcher } from '@/features/auth/components/SessionWatcher';
import type { UserRole } from '@/types/domain';
import {
  RouterBridge,
  ScreenOptionsProvider,
  useScreenOptions,
  type ScreenOptions,
} from '@/navigation';
import { Text, View } from '@/primitives';

import AdminConsultationsPage from '@/pages/admin/AdminConsultationsPage';
import AdminHomePage from '@/pages/admin/AdminHomePage';
import AdminInquiriesPage from '@/pages/admin/AdminInquiriesPage';
import AdminHospitalEditPage from '@/pages/admin/AdminHospitalEditPage';
import AdminHospitalNewPage from '@/pages/admin/AdminHospitalNewPage';
import AdminSpecialistsPage from '@/pages/admin/AdminSpecialistsPage';
import CategoryPage from '@/pages/CategoryPage';
import ConsultRequestPage from '@/pages/ConsultRequestPage';
import DoctorDetailPage from '@/pages/DoctorDetailPage';
import ExplorePage from '@/pages/ExplorePage';
import HospitalDetailPage from '@/pages/HospitalDetailPage';
import InquiryPage from '@/pages/InquiryPage';
import MyPage from '@/pages/MyPage';
import AboutScreen from '@/screens/about';
import AdminNotificationsScreen from '@/screens/admin/notifications';
import LoginScreen from '@/screens/auth/login';
import SignupScreen from '@/screens/auth/signup';
import CommunityPostScreen from '@/screens/community/[id]';
import CommunityNewScreen from '@/screens/community/new';
import EventsScreen from '@/screens/events';
import LocationTermsScreen from '@/screens/legal/location';
import PrivacyScreen from '@/screens/legal/privacy';
import TermsScreen from '@/screens/legal/terms';
import NotificationsScreen from '@/screens/notifications';
import PartnerInquiryScreen from '@/screens/partner-inquiry';
import SearchScreen from '@/screens/search';
import CommunityTabScreen from '@/screens/tabs/community';
import HomeScreen from '@/screens/tabs/index';
import TipDetailScreen from '@/screens/tips/[id]';

/**
 * 라우트 진입 자격.
 *
 * - `auth` — 로그인만 필요 (역할 무관)
 * - `admin` — `hospital_admin` 또는 `operator`
 * - `operator` — 운영자 전용. 병원 생성과 전문의 인증 검수는 병원 담당자가 할 수 없다
 *   (`docs/decisions/0001-roles-and-pii.md` 결정 1·2)
 */
type RouteGuard = 'auth' | 'admin' | 'operator';

const GUARD_ROLES: Record<RouteGuard, readonly UserRole[] | undefined> = {
  auth: undefined,
  admin: ['hospital_admin', 'operator'],
  operator: ['operator'],
};

export interface AppRoute {
  path: string;
  element: ReactNode;
  options: ScreenOptions;
  isTab?: boolean;
  /**
   * 없으면 공개 라우트다. **`/admin` 으로 시작하는 라우트에는 반드시 있어야 한다** —
   * 없으면 주소만 아는 누구나 고객 실명·전화번호를 본다 (`docs/features/known-issues.md` 🔴).
   */
  guard?: RouteGuard;
  /**
   * `'admin'` 이면 환자 앱의 크롬(상단바·헤더·하단탭) 대신 `AdminShell`(사이드 메뉴 + 상단바)을
   * 씌운다. **관리자 라우트 전부가 이 값을 갖는다** — 하나라도 빠지면 그 화면만 메뉴 없이 뜬다.
   */
  shell?: 'admin';
}

/**
 * Static per-route screen options, carried over verbatim from the `<Stack.Screen>` list in
 * the old `src/app/_layout.tsx`. Screens can still override these at runtime by rendering
 * `<Stack.Screen options={{ ... }} />`, which is how the detail screens set their titles.
 */
// 내보내는 이유: 관리자 라우트 배선(가드 + 셸)을 테스트가 표에서 직접 읽는다 (`test/adminRoutes.test.ts`).
export const ROUTES: AppRoute[] = [
  { path: '/', element: <HomeScreen />, options: { headerShown: false }, isTab: true },
  { path: '/explore', element: <ExplorePage />, options: { headerShown: false }, isTab: true },
  { path: '/community', element: <CommunityTabScreen />, options: { headerShown: false }, isTab: true },
  { path: '/mypage', element: <MyPage />, options: { headerShown: false }, isTab: true },

  // 공개 라우트, 탭 아님. 화면이 자체 헤더(뒤로 + 대분류 이름)를 그린다.
  { path: '/category/:categoryId', element: <CategoryPage />, options: { headerShown: false } },
  { path: '/hospital/:id', element: <HospitalDetailPage />, options: { title: '' } },
  { path: '/doctor/:id', element: <DoctorDetailPage />, options: { title: '' } },
  { path: '/tips/:id', element: <TipDetailScreen />, options: { title: '' } },
  { path: '/events', element: <EventsScreen />, options: { title: '이벤트' } },

  { path: '/community/new', element: <CommunityNewScreen />, options: { title: '질문하기' } },
  { path: '/community/:id', element: <CommunityPostScreen />, options: { title: '질문 상세' } },

  {
    path: '/consult/:hospitalId',
    element: <ConsultRequestPage />,
    options: { title: '상담 신청' },
    guard: 'auth',
  },
  {
    path: '/inquiry/:hospitalId',
    element: <InquiryPage />,
    options: { title: '문의하기' },
    guard: 'auth',
  },
  { path: '/auth/login', element: <LoginScreen />, options: { title: '로그인' } },
  { path: '/auth/signup', element: <SignupScreen />, options: { title: '회원가입' } },

  {
    path: '/admin',
    // 제목은 역할에 따라 화면이 다시 정한다 (`대시보드` / `병원 목록`).
    element: <AdminHomePage />,
    options: { title: '대시보드' },
    guard: 'admin',
    shell: 'admin',
  },
  {
    path: '/admin/hospital/new',
    element: <AdminHospitalNewPage />,
    options: { title: '병원 등록' },
    // 병원 생성은 운영자만 한다. 입점 심사가 선행되며, 아무나 병원을 만들 수 없다.
    guard: 'operator',
    shell: 'admin',
  },
  {
    path: '/admin/hospital/:id',
    element: <AdminHospitalEditPage />,
    options: { title: '병원 정보 수정' },
    guard: 'admin',
    shell: 'admin',
  },
  {
    path: '/admin/specialists',
    element: <AdminSpecialistsPage />,
    options: { title: '전문의 인증 검수' },
    // 전문의 인증 검수는 플랫폼의 판정이다. 병원 담당자에게 열면 자기 병원 전문의를
    // 스스로 승인할 수 있게 된다.
    guard: 'operator',
    shell: 'admin',
  },
  // 목록과 상세가 같은 화면이다 — `:id` 는 선택된 상담을 뜻할 뿐이다.
  {
    path: '/admin/consultations',
    element: <AdminConsultationsPage />,
    options: { title: '상담 예약' },
    guard: 'admin',
    shell: 'admin',
  },
  {
    path: '/admin/consultations/:id',
    element: <AdminConsultationsPage />,
    options: { title: '상담 예약' },
    guard: 'admin',
    shell: 'admin',
  },
  // 목록과 상세가 같은 화면이다 — `:id` 는 선택된 문의를 뜻할 뿐이다.
  {
    path: '/admin/inquiries',
    element: <AdminInquiriesPage />,
    options: { title: '문의' },
    guard: 'admin',
    shell: 'admin',
  },
  {
    path: '/admin/inquiries/:id',
    element: <AdminInquiriesPage />,
    options: { title: '문의' },
    guard: 'admin',
    shell: 'admin',
  },
  {
    path: '/admin/notifications',
    element: <AdminNotificationsScreen />,
    options: { title: '알림함' },
    guard: 'admin',
    shell: 'admin',
  },

  { path: '/notifications', element: <NotificationsScreen />, options: { title: '알림' }, guard: 'auth' },
  { path: '/search', element: <SearchScreen />, options: { headerShown: false } },

  { path: '/legal/terms', element: <TermsScreen />, options: { title: '서비스 이용약관' } },
  { path: '/legal/privacy', element: <PrivacyScreen />, options: { title: '개인정보 처리방침' } },
  {
    path: '/legal/location',
    element: <LocationTermsScreen />,
    options: { title: '위치기반 서비스 이용약관' },
  },
  { path: '/about', element: <AboutScreen />, options: { title: '몰라몰라 알아보기' } },
  { path: '/partner-inquiry', element: <PartnerInquiryScreen />, options: { title: '병원 입점 문의' } },
];

const TAB_PATHS = new Set(ROUTES.filter((route) => route.isTab).map((route) => route.path));

function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-sm text-neutral-500">페이지를 찾을 수 없어요</Text>
    </View>
  );
}

/** Renders the header/tab chrome around the active screen, matching the old root layout. */
function Shell() {
  const { pathname } = useLocation();
  const options = useScreenOptions();

  const headerShown = options.headerShown !== false;
  const isTabRoute = TAB_PATHS.has(pathname);

  /*
   * 넓은 화면은 상단바, 좁은 화면은 하단탭이다. 예전에는 `useIsWideWeb()` 으로 둘 중
   * 하나만 렌더했지만, 지금은 둘 다 렌더하고 CSS 로 감춘다. 리사이즈마다 셸 전체가
   * 리렌더되지 않고, 폭 판정이 첫 페인트 전에 끝나 새로고침 때 탭바가 깜빡이지 않는다.
   *
   * `flex: 1` 사슬은 건드리지 않는다 — #root 부터 ScrollView 까지 한 칸이라도 끊기면
   * 스크롤이 통째로 죽는다 (src/test/appShellLayout.test.tsx).
   */
  return (
    <View style={{ flex: 1 }}>
      <View className="hidden md:flex">
        <TopNavBar />
      </View>
      <View className="flex-1 items-center bg-white">
        <View className="w-full max-w-content flex-1">
          {headerShown ? <AppHeader title={options.title} /> : null}
          <View style={{ flex: 1 }}>
            <Outlet />
          </View>
          {isTabRoute ? (
            <View className="md:hidden">
              <BottomTabBar />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Seeds the shell's screen options from the matched route's static config.
 *
 * 관리자 라우트는 `AdminShell` 이 유일한 크롬이다 — `Shell` 과 겹쳐 쓰면 헤더가 두 벌이 되고
 * 제목이 두 번 읽힌다. `Shell` 쪽은 손대지 않는다 (`src/test/appShellLayout.test.tsx` 의
 * flex 사슬이 그 구조를 고정한다).
 */
function ScreenShell({ options, shell }: { options: ScreenOptions; shell?: 'admin' }) {
  return (
    <ScreenOptionsProvider initial={options}>
      {shell === 'admin' ? <AdminShell /> : <Shell />}
    </ScreenOptionsProvider>
  );
}

/** 가드가 붙은 라우트는 자격을 통과할 때만 화면을 렌더한다. */
function withGuard(element: ReactNode, guard: RouteGuard | undefined) {
  if (!guard) return element;

  return <RequireAuth roles={GUARD_ROLES[guard]}>{element}</RequireAuth>;
}

export default function App() {
  return (
    <BrowserRouter>
      <RouterBridge />
      <SessionWatcher />
      <Routes>
        {ROUTES.map((route) => (
          <Route key={route.path} element={<ScreenShell options={route.options} shell={route.shell} />}>
            <Route path={route.path} element={withGuard(route.element, route.guard)} />
          </Route>
        ))}
        <Route element={<ScreenShell options={{ title: '' }} />}>
          <Route path="*" element={<NotFoundScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
