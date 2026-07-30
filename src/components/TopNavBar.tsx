import { router, usePathname } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
// NOTE(developer): useNotificationStore is a contract import — store not implemented yet.
// See the developer handoff notes for the exact required shape.
import { useNotificationStore } from '@/store/useNotificationStore';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';

const MENU = [
  { key: 'home', label: '홈', icon: '🏠', href: '/(tabs)' as const, match: '/' },
  { key: 'events', label: '이벤트', icon: '🎉', href: '/events' as const, match: '/events' },
  { key: 'hospitals', label: '병원', icon: '🦷', href: '/(tabs)/explore' as const, match: '/explore' },
  { key: 'community', label: '커뮤니티', icon: '💬', href: '/(tabs)/community' as const, match: '/community' },
];

// Three responsive stages so the menu always stays on one line, never wraps, and never
// collapses into a hamburger — see AGENTS/design notes for the exact breakpoints.
type NavSize = 'full' | 'compact' | 'icon';

export function TopNavBar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const scrolled = useScrollShadowStore((state) => state.scrolled);
  const unreadCount = useNotificationStore(
    (state) => state.notifications.filter((n) => n.audience === 'user' && !n.isRead).length
  );
  const { width } = useWindowDimensions();

  const size: NavSize = width >= 1100 ? 'full' : width >= 850 ? 'compact' : 'icon';

  const containerPadding = size === 'full' ? 'px-8 py-4' : size === 'compact' ? 'px-5 py-3' : 'px-4 py-3';
  const logoSizeClass = size === 'full' ? 'text-xl' : size === 'compact' ? 'text-lg' : 'text-base';
  const menuGap = size === 'full' ? 'gap-8' : size === 'compact' ? 'gap-4' : 'gap-2';
  const rightGap = size === 'full' ? 'gap-4' : size === 'compact' ? 'gap-2.5' : 'gap-1.5';
  const avatarSize = size === 'full' ? 36 : 32;

  return (
    <View
      className={scrolled ? 'bg-white shadow-md' : 'border-b border-neutral-100 bg-white'}
      style={{ position: 'sticky' as any, top: 0, zIndex: 50 }}
    >
      <View
        className={`mx-auto w-full flex-row items-center justify-between ${containerPadding}`}
        style={{ maxWidth: 1200 }}
      >
        <Pressable onPress={() => router.push('/(tabs)')}>
          <Text className={`font-extrabold text-brand-700 ${logoSizeClass}`} numberOfLines={1}>
            {size === 'icon' ? '몰라' : '몰라몰라'}
          </Text>
        </Pressable>

        <View className={`flex-row flex-shrink-0 items-center ${menuGap}`}>
          {MENU.map((item) => {
            const active = pathname === item.match;
            return (
              <Pressable key={item.key} onPress={() => router.push(item.href)} hitSlop={6}>
                {size === 'icon' ? (
                  <Text className="text-lg" numberOfLines={1}>
                    {item.icon}
                  </Text>
                ) : (
                  <Text
                    className={`text-sm font-semibold ${active ? 'text-brand-700' : 'text-neutral-600'}`}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <View className={`flex-row flex-shrink-0 items-center ${rightGap}`}>
          <Pressable onPress={() => router.push('/search')} hitSlop={8}>
            <Text className="text-lg">🔍</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/notifications')} hitSlop={8} style={{ position: 'relative' }}>
            <Text className="text-lg">🔔</Text>
            {unreadCount > 0 ? (
              <View
                className="border border-white bg-rose-500"
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  minWidth: 9,
                  height: 9,
                  borderRadius: 5,
                }}
              />
            ) : null}
          </Pressable>

          {user ? (
            <Pressable
              onPress={() => router.push('/(tabs)/mypage')}
              className="items-center justify-center rounded-full bg-neutral-100"
              style={{ height: avatarSize, width: avatarSize }}
            >
              <Text className="text-base">👤</Text>
            </Pressable>
          ) : size === 'icon' ? (
            <View className="flex-row items-center gap-1.5">
              <Pressable
                onPress={() => router.push('/auth/login')}
                className="items-center justify-center rounded-full bg-neutral-100"
                style={{ height: 32, width: 32 }}
                hitSlop={6}
              >
                <Text className="text-sm">🔑</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/auth/signup')}
                className="items-center justify-center rounded-full bg-brand-600"
                style={{ height: 32, width: 32 }}
                hitSlop={6}
              >
                <Text className="text-sm">👤</Text>
              </Pressable>
            </View>
          ) : (
            <View className={`flex-row items-center ${size === 'compact' ? 'gap-1.5' : 'gap-2'}`}>
              <Pressable
                onPress={() => router.push('/auth/login')}
                className={size === 'compact' ? 'px-2 py-1.5' : 'px-3 py-2'}
              >
                <Text className="text-sm font-semibold text-neutral-700" numberOfLines={1}>
                  로그인
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/auth/signup')}
                className={`rounded-full bg-brand-600 ${size === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2'}`}
              >
                <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                  회원가입
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
