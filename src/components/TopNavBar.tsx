import { router, usePathname } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';

const MENU = [
  { key: 'home', label: '홈', href: '/(tabs)' as const, match: '/' },
  { key: 'events', label: '이벤트', href: '/events' as const, match: '/events' },
  { key: 'hospitals', label: '병원', href: '/(tabs)/explore' as const, match: '/explore' },
  { key: 'community', label: '커뮤니티', href: '/(tabs)/community' as const, match: '/community' },
];

// Two responsive stages: menu labels are ALWAYS text (never emoji), only
// font size / padding / gaps shrink at the narrow stage so the row never wraps.
type NavSize = 'full' | 'compact';

export function TopNavBar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const scrolled = useScrollShadowStore((state) => state.scrolled);
  const unreadCount = useNotificationStore(
    (state) => state.notifications.filter((n) => n.audience === 'user' && !n.isRead).length
  );
  const { width } = useWindowDimensions();

  const size: NavSize = width >= 900 ? 'full' : 'compact';

  const containerPadding = size === 'full' ? 'px-8 py-4' : 'px-4 py-3';
  const logoSizeClass = size === 'full' ? 'text-xl' : 'text-lg';
  const logoMenuGap = size === 'full' ? 40 : 24;
  const menuGap = size === 'full' ? 32 : 18;
  const menuTextClass = size === 'full' ? 'text-[15px]' : 'text-xs';
  const rightGap = size === 'full' ? 'gap-4' : 'gap-2.5';
  const avatarSize = size === 'full' ? 36 : 32;
  const loginPillPadding = size === 'full' ? 'px-5 py-2.5' : 'px-3.5 py-2';
  const loginPillTextClass = size === 'full' ? 'text-sm' : 'text-xs';

  return (
    <View
      className={scrolled ? 'bg-white shadow-md' : 'border-b border-neutral-100 bg-white'}
      style={{ position: 'sticky' as any, top: 0, zIndex: 50 }}
    >
      <View className={`mx-auto w-full flex-row items-center ${containerPadding}`} style={{ maxWidth: 1200 }}>
        {/* Left group: logo + text menu, always left-aligned and glued together */}
        <View className="flex-row flex-shrink-0 items-center" style={{ gap: logoMenuGap }}>
          <Pressable onPress={() => router.push('/(tabs)')} hitSlop={6}>
            <Text className={`font-extrabold text-brand-700 ${logoSizeClass}`} numberOfLines={1}>
              몰라몰라
            </Text>
          </Pressable>

          <View className="flex-row items-center" style={{ gap: menuGap }}>
            {MENU.map((item) => {
              const active = pathname === item.match;
              return (
                <Pressable key={item.key} onPress={() => router.push(item.href)} hitSlop={8}>
                  <Text
                    className={`font-semibold ${menuTextClass} ${active ? 'font-bold text-brand-700' : 'text-neutral-600'}`}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Spacer pushes the right cluster to the far edge without pulling the menu away from the logo */}
        <View className="flex-1" />

        {/* Right cluster */}
        <View className={`flex-row flex-shrink-0 items-center ${rightGap}`}>
          <Pressable onPress={() => router.push('/search')} hitSlop={8}>
            <Text className="text-lg">🔍</Text>
          </Pressable>

          {user ? (
            <>
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

              <Pressable
                onPress={() => router.push('/(tabs)/mypage')}
                className="items-center justify-center rounded-full bg-neutral-100"
                style={{ height: avatarSize, width: avatarSize }}
                hitSlop={4}
              >
                <Text className="text-base">👤</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => router.push('/auth/login')}
              className={`rounded-full bg-brand-600 ${loginPillPadding}`}
              hitSlop={4}
            >
              <Text className={`font-semibold text-white ${loginPillTextClass}`} numberOfLines={1}>
                로그인 및 회원가입
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
