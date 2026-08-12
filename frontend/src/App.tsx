import type { ReactNode } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { AppHeader } from '@/components/AppHeader';
import { BottomTabBar } from '@/components/BottomTabBar';
import { TopNavBar } from '@/components/TopNavBar';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import {
  RouterBridge,
  ScreenOptionsProvider,
  useScreenOptions,
  type ScreenOptions,
} from '@/navigation';
import { Text, View } from '@/primitives';

import HospitalDetailPage from '@/pages/HospitalDetailPage';
import AboutScreen from '@/screens/about';
import AdminConsultationDetailScreen from '@/screens/admin/consultations/[id]';
import AdminConsultationsScreen from '@/screens/admin/consultations/index';
import AdminHospitalEditScreen from '@/screens/admin/hospital/[id]';
import AdminHospitalNewScreen from '@/screens/admin/hospital/new';
import AdminHomeScreen from '@/screens/admin/index';
import AdminNotificationsScreen from '@/screens/admin/notifications';
import AdminSpecialistsScreen from '@/screens/admin/specialists';
import LoginScreen from '@/screens/auth/login';
import SignupScreen from '@/screens/auth/signup';
import CommunityPostScreen from '@/screens/community/[id]';
import CommunityNewScreen from '@/screens/community/new';
import ConsultRequestScreen from '@/screens/consult/[hospitalId]';
import DoctorDetailScreen from '@/screens/doctor/[id]';
import EventsScreen from '@/screens/events';
import LocationTermsScreen from '@/screens/legal/location';
import PrivacyScreen from '@/screens/legal/privacy';
import TermsScreen from '@/screens/legal/terms';
import NotificationsScreen from '@/screens/notifications';
import PartnerInquiryScreen from '@/screens/partner-inquiry';
import SearchScreen from '@/screens/search';
import CommunityTabScreen from '@/screens/tabs/community';
import ExploreScreen from '@/screens/tabs/explore';
import HomeScreen from '@/screens/tabs/index';
import MyPageScreen from '@/screens/tabs/mypage';
import TipDetailScreen from '@/screens/tips/[id]';

interface AppRoute {
  path: string;
  element: ReactNode;
  options: ScreenOptions;
  isTab?: boolean;
}

/**
 * Static per-route screen options, carried over verbatim from the `<Stack.Screen>` list in
 * the old `src/app/_layout.tsx`. Screens can still override these at runtime by rendering
 * `<Stack.Screen options={{ ... }} />`, which is how the detail screens set their titles.
 */
const ROUTES: AppRoute[] = [
  { path: '/', element: <HomeScreen />, options: { headerShown: false }, isTab: true },
  { path: '/explore', element: <ExploreScreen />, options: { headerShown: false }, isTab: true },
  { path: '/community', element: <CommunityTabScreen />, options: { headerShown: false }, isTab: true },
  { path: '/mypage', element: <MyPageScreen />, options: { headerShown: false }, isTab: true },

  { path: '/hospital/:id', element: <HospitalDetailPage />, options: { title: '' } },
  { path: '/doctor/:id', element: <DoctorDetailScreen />, options: { title: '' } },
  { path: '/tips/:id', element: <TipDetailScreen />, options: { title: '' } },
  { path: '/events', element: <EventsScreen />, options: { title: '이벤트' } },

  { path: '/community/new', element: <CommunityNewScreen />, options: { title: '질문하기' } },
  { path: '/community/:id', element: <CommunityPostScreen />, options: { title: '질문 상세' } },

  { path: '/consult/:hospitalId', element: <ConsultRequestScreen />, options: { title: '상담 신청' } },
  { path: '/auth/login', element: <LoginScreen />, options: { title: '로그인' } },
  { path: '/auth/signup', element: <SignupScreen />, options: { title: '회원가입' } },

  { path: '/admin', element: <AdminHomeScreen />, options: { title: '병원 관리자' } },
  { path: '/admin/hospital/new', element: <AdminHospitalNewScreen />, options: { title: '병원 등록' } },
  { path: '/admin/hospital/:id', element: <AdminHospitalEditScreen />, options: { title: '병원 정보 수정' } },
  { path: '/admin/specialists', element: <AdminSpecialistsScreen />, options: { title: '전문의 인증 검수' } },
  { path: '/admin/consultations', element: <AdminConsultationsScreen />, options: { title: '상담 관리' } },
  {
    path: '/admin/consultations/:id',
    element: <AdminConsultationDetailScreen />,
    options: { title: '상담 상세' },
  },
  { path: '/admin/notifications', element: <AdminNotificationsScreen />, options: { title: '알림' } },

  { path: '/notifications', element: <NotificationsScreen />, options: { title: '알림' } },
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
  const isWideWeb = useIsWideWeb();
  const { pathname } = useLocation();
  const options = useScreenOptions();

  const headerShown = options.headerShown !== false;
  const showTabBar = TAB_PATHS.has(pathname) && !isWideWeb;

  return (
    <View style={{ flex: 1 }}>
      {isWideWeb ? <TopNavBar /> : null}
      <View
        style={{ flex: 1, alignItems: isWideWeb ? 'center' : undefined, backgroundColor: '#ffffff' }}
      >
        <View style={{ flex: 1, width: '100%', maxWidth: isWideWeb ? 1200 : undefined }}>
          {headerShown ? <AppHeader title={options.title} /> : null}
          <View style={{ flex: 1 }}>
            <Outlet />
          </View>
          {showTabBar ? <BottomTabBar /> : null}
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

export default function App() {
  return (
    <BrowserRouter>
      <RouterBridge />
      <Routes>
        {ROUTES.map((route) => (
          <Route key={route.path} element={<ScreenShell options={route.options} />}>
            <Route path={route.path} element={route.element} />
          </Route>
        ))}
        <Route element={<ScreenShell options={{ title: '' }} />}>
          <Route path="*" element={<NotFoundScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
