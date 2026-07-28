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
          <Stack.Screen
            name="consult/[hospitalId]"
            options={{ presentation: 'modal', title: '상담 신청' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
