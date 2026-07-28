import '@/global.css';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#ffffff' },
            headerShadowVisible: false,
            headerTintColor: '#171717',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="hospitals/[procedureId]" options={{ title: '병원 리스트' }} />
          <Stack.Screen name="hospital/[id]" options={{ title: '' }} />
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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
