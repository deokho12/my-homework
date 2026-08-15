import type { ReactNode } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';

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

import AdminHomePage from '@/pages/admin/AdminHomePage';
import AdminHospitalEditPage from '@/pages/admin/AdminHospitalEditPage';
import AdminHospitalNewPage from '@/pages/admin/AdminHospitalNewPage';
import AdminSpecialistsPage from '@/pages/admin/AdminSpecialistsPage';
import DoctorDetailPage from '@/pages/DoctorDetailPage';
import ExplorePage from '@/pages/ExplorePage';
import HospitalDetailPage from '@/pages/HospitalDetailPage';
import AboutScreen from '@/screens/about';
import AdminConsultationDetailScreen from '@/screens/admin/consultations/[id]';
import AdminConsultationsScreen from '@/screens/admin/consultations/index';
import AdminNotificationsScreen from '@/screens/admin/notifications';
import LoginScreen from '@/screens/auth/login';
import SignupScreen from '@/screens/auth/signup';
import CommunityPostScreen from '@/screens/community/[id]';
import CommunityNewScreen from '@/screens/community/new';
import ConsultRequestScreen from '@/screens/consult/[hospitalId]';
import EventsScreen from '@/screens/events';
import LocationTermsScreen from '@/screens/legal/location';
import PrivacyScreen from '@/screens/legal/privacy';
import TermsScreen from '@/screens/legal/terms';
import NotificationsScreen from '@/screens/notifications';
import PartnerInquiryScreen from '@/screens/partner-inquiry';
import SearchScreen from '@/screens/search';
import CommunityTabScreen from '@/screens/tabs/community';
import HomeScreen from '@/screens/tabs/index';
import MyPageScreen from '@/screens/tabs/mypage';
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

interface AppRoute {
  path: string;
  element: ReactNode;
  options: ScreenOptions;
  isTab?: boolean;
  /**
   * 없으면 공개 라우트다. **`/admin` 으로 시작하는 라우트에는 반드시 있어야 한다** —
   * 없으면 주소만 아는 누구나 고객 실명·전화번호를 본다 (`docs/features/known-issues.md` 🔴).
   */
  guard?: RouteGuard;
}

/**
 * Static per-route screen options, carried over verbatim from the `<Stack.Screen>` list in
 * the old `src/app/_layout.tsx`. Screens can still override these at runtime by rendering
 * `<Stack.Screen options={{ ... }} />`, which is how the detail screens set their titles.
 */
const ROUTES: AppRoute[] = [
  { path: '/', element: <HomeScreen />, options: { headerShown: false }, isTab: true },
  { path: '/explore', element: <ExplorePage />, options: { headerShown: false }, isTab: true },
  { path: '/community', element: <CommunityTabScreen />, options: { headerShown: false }, isTab: true },
  { path: '/mypage', element: <MyPageScreen />, options: { headerShown: false }, isTab: true },

  { path: '/hospital/:id', element: <HospitalDetailPage />, options: { title: '' } },
  { path: '/doctor/:id', element: <DoctorDetailPage />, options: { title: '' } },
  { path: '/tips/:id', element: <TipDetailScreen />, options: { title: '' } },
  { path: '/events', element: <EventsScreen />, options: { title: '이벤트' } },

  { path: '/community/new', element: <CommunityNewScreen />, options: { title: '질문하기' } },
  { path: '/community/:id', element: <CommunityPostScreen />, options: { title: '질문 상세' } },

  {
    path: '/consult/:hospitalId',
    element: <ConsultRequestScreen />,
    options: { title: '상담 신청' },
    guard: 'auth',
  },
  { path: '/auth/login', element: <LoginScreen />, options: { title: '로그인' } },
  { path: '/auth/signup', element: <SignupScreen />, options: { title: '회원가입' } },

  { path: '/admin', element: <AdminHomePage />, options: { title: '병원 관리자' }, guard: 'admin' },
  {
    path: '/admin/hospital/new',
    element: <AdminHospitalNewPage />,
    options: { title: '병원 등록' },
    // 병원 생성은 운영자만 한다. 입점 심사가 선행되며, 아무나 병원을 만들 수 없다.
    guard: 'operator',
  },
  {
    path: '/admin/hospital/:id',
    element: <AdminHospitalEditPage />,
    options: { title: '병원 정보 수정' },
    guard: 'admin',
  },
  {
    path: '/admin/specialists',
    element: <AdminSpecialistsPage />,
    options: { title: '전문의 인증 검수' },
    // 전문의 인증 검수는 플랫폼의 판정이다. 병원 담당자에게 열면 자기 병원 전문의를
    // 스스로 승인할 수 있게 된다.
    guard: 'operator',
  },
  {
    path: '/admin/consultations',
    element: <AdminConsultationsScreen />,
    options: { title: '상담 관리' },
    guard: 'admin',
  },
  {
    path: '/admin/consultations/:id',
    element: <AdminConsultationDetailScreen />,
    options: { title: '상담 상세' },
    guard: 'admin',
  },
  {
    path: '/admin/notifications',
    element: <AdminNotificationsScreen />,
    options: { title: '알림' },
    guard: 'admin',
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

/** Seeds the shell's screen options from the matched route's static config. */
function ScreenShell({ options }: { options: ScreenOptions }) {
  return (
    <ScreenOptionsProvider initial={options}>
      <Shell />
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
          <Route key={route.path} element={<ScreenShell options={route.options} />}>
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
