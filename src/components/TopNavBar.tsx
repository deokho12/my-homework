import { router, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';

const MENU = [
  { label: '홈', href: '/(tabs)' as const, match: '/' },
  { label: '이벤트', href: '/events' as const, match: '/events' },
  { label: '병원', href: '/(tabs)/explore' as const, match: '/explore' },
  { label: '커뮤니티', href: '/(tabs)/community' as const, match: '/community' },
];

export function TopNavBar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  return (
    <View className="border-b border-neutral-100 bg-white">
      <View
        className="mx-auto w-full flex-row items-center justify-between px-8 py-4"
        style={{ maxWidth: 1200 }}
      >
        <Pressable onPress={() => router.push('/(tabs)')}>
          <Text className="text-xl font-extrabold text-brand-700">몰라몰라</Text>
        </Pressable>

        <View className="flex-row items-center gap-8">
          {MENU.map((item) => {
            const active = pathname === item.match;
            return (
              <Pressable key={item.label} onPress={() => router.push(item.href)}>
                <Text className={`text-sm font-semibold ${active ? 'text-brand-700' : 'text-neutral-600'}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.push('/search')} hitSlop={8}>
            <Text className="text-lg">🔍</Text>
          </Pressable>

          {user ? (
            <Pressable
              onPress={() => router.push('/(tabs)/mypage')}
              className="h-9 w-9 items-center justify-center rounded-full bg-neutral-100"
            >
              <Text className="text-base">👤</Text>
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => router.push('/auth/login')} className="px-3 py-2">
                <Text className="text-sm font-semibold text-neutral-700">로그인</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/auth/signup')}
                className="rounded-full bg-brand-600 px-4 py-2"
              >
                <Text className="text-sm font-semibold text-white">회원가입</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
