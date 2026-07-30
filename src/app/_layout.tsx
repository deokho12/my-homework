import '@/global.css';

import { Stack } from 'expo-router';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TopNavBar } from '@/components/TopNavBar';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

export default function RootLayout() {
  const isWideWeb = useIsWideWeb();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          {isWideWeb ? <TopNavBar /> : null}
          <View
            style={{ flex: 1, alignItems: isWideWeb ? 'center' : undefined, backgroundColor: '#ffffff' }}
          >
            <View style={{ flex: 1, width: '100%', maxWidth: isWideWeb ? 1200 : undefined }}>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: '#ffffff' },
                  headerShadowVisible: false,
                  headerTintColor: '#171717',
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="hospital/[id]" options={{ title: '' }} />
                <Stack.Screen name="doctor/[id]" options={{ title: '' }} />
                <Stack.Screen name="events" options={{ title: '이벤트' }} />
                <Stack.Screen name="community/[id]" options={{ title: '질문 상세' }} />
                <Stack.Screen
                  name="community/new"
                  options={{ presentation: 'modal', title: '질문하기' }}
                />
                <Stack.Screen
                  name="consult/[hospitalId]"
                  options={{ presentation: 'modal', title: '상담 신청' }}
                />
                <Stack.Screen name="auth/login" options={{ presentation: 'modal', title: '로그인' }} />
                <Stack.Screen name="auth/signup" options={{ presentation: 'modal', title: '회원가입' }} />
                <Stack.Screen name="admin/index" options={{ title: '병원 관리자' }} />
                <Stack.Screen name="admin/hospital/new" options={{ title: '병원 등록' }} />
                <Stack.Screen name="admin/hospital/[id]" options={{ title: '병원 정보 수정' }} />
                <Stack.Screen name="admin/specialists" options={{ title: '전문의 인증 검수' }} />
                <Stack.Screen name="admin/consultations/index" options={{ title: '상담 관리' }} />
                <Stack.Screen name="admin/consultations/[id]" options={{ title: '상담 상세' }} />
                <Stack.Screen name="admin/notifications" options={{ title: '알림' }} />
                <Stack.Screen name="notifications" options={{ title: '알림' }} />
                <Stack.Screen name="search" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
                <Stack.Screen name="legal/terms" options={{ title: '서비스 이용약관' }} />
                <Stack.Screen name="legal/privacy" options={{ title: '개인정보 처리방침' }} />
                <Stack.Screen name="legal/location" options={{ title: '위치기반 서비스 이용약관' }} />
                <Stack.Screen name="about" options={{ title: '몰라몰라 알아보기' }} />
                <Stack.Screen name="partner-inquiry" options={{ title: '병원 입점 문의' }} />
              </Stack>
            </View>
          </View>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
