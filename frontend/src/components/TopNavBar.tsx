import { router, usePathname } from '@/navigation';
import { Pressable, Text, View } from '@/primitives';

import { useUnreadNotificationCount } from '@/features/notification';
import { useAuthStore } from '@/store/useAuthStore';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';

const MENU = [
  { key: 'home', label: '홈', href: '/(tabs)' as const, match: '/' },
  { key: 'events', label: '이벤트', href: '/events' as const, match: '/events' },
  { key: 'hospitals', label: '병원', href: '/(tabs)/explore' as const, match: '/explore' },
  { key: 'community', label: '커뮤니티', href: '/(tabs)/community' as const, match: '/community' },
];

/*
 * 두 단계로 줄어든다. 메뉴는 항상 글자이고(이모지로 바꾸지 않는다) 글자 크기·여백·간격만
 * 좁은 단계에서 줄어들어 한 줄이 절대 넘치지 않는다.
 *
 * 이 바 자체가 md(768) 이상에서만 보이므로(App.tsx 의 `hidden md:flex`), 기본값이 좁은
 * 단계이고 lg(1024) 부터 넓은 단계다. 예전에는 900 이라는 자기만의 기준을 썼는데, 표를
 * 하나로 모으면서 lg 로 흡수했다.
 */

export function TopNavBar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const scrolled = useScrollShadowStore((state) => state.scrolled);
  // 배지 전용 엔드포인트. 마이페이지·상단바·관리자 홈이 같은 숫자를 보여야 한다.
  const { data: unread } = useUnreadNotificationCount('user');
  const unreadCount = unread?.unreadCount ?? 0;

  return (
    <View
      className={scrolled ? 'bg-white shadow-md' : 'border-b border-neutral-100 bg-white'}
      style={{ position: 'sticky', top: 0, zIndex: 50 }}
    >
      <View className="mx-auto w-full max-w-content flex-row items-center px-4 py-3 lg:px-8 lg:py-4">
        {/* Left group: logo + text menu, always left-aligned and glued together */}
        <View className="flex-row flex-shrink-0 items-center gap-6 lg:gap-10">
          <Pressable onPress={() => router.push('/(tabs)')} hitSlop={6}>
            <Text className="text-lg font-extrabold text-brand-700 lg:text-xl" numberOfLines={1}>
              몰라몰라
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-[18px] lg:gap-8">
            {MENU.map((item) => {
              const active = pathname === item.match;
              return (
                <Pressable key={item.key} onPress={() => router.push(item.href)} hitSlop={8}>
                  <Text
                    className={`text-xs font-semibold lg:text-[15px] ${active ? 'font-bold text-brand-700' : 'text-neutral-600'}`}
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
        <View className="flex-row flex-shrink-0 items-center gap-2.5 lg:gap-4">
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
                className="h-8 w-8 items-center justify-center rounded-full bg-neutral-100 lg:h-9 lg:w-9"
                hitSlop={4}
              >
                <Text className="text-base">👤</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => router.push('/auth/login')}
              className="rounded-full bg-brand-600 px-3.5 py-2 lg:px-5 lg:py-2.5"
              hitSlop={4}
            >
              <Text className="text-xs font-semibold text-white lg:text-sm" numberOfLines={1}>
                로그인 및 회원가입
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
