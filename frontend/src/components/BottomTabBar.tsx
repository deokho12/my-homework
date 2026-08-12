import { Pressable, Text, View } from '@/primitives';
import { router, usePathname } from '@/navigation';

/**
 * Replaces expo-router's `<Tabs>` bar from the old `app/(tabs)/_layout.tsx`.
 * Same four destinations, same emoji icons, and the same active/inactive tints
 * (`#17847a` / `#a3a3a3`). Hidden on wide web, where TopNavBar takes over.
 */
const TABS = [
  { path: '/', label: '홈', emoji: '🏠' },
  { path: '/explore', label: '병원', emoji: '🦷' },
  { path: '/community', label: '커뮤니티', emoji: '💬' },
  { path: '/mypage', label: '마이페이지', emoji: '👤' },
];

const ACTIVE_TINT = '#17847a';
const INACTIVE_TINT = '#a3a3a3';

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <View
      className="flex-row border-t border-neutral-200 bg-white"
      style={{ flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' as unknown as number }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.path;
        const color = active ? ACTIVE_TINT : INACTIVE_TINT;

        return (
          <Pressable
            key={tab.path}
            onPress={() => router.push(tab.path)}
            accessibilityLabel={tab.label}
            className="flex-1 items-center justify-center"
            style={{ paddingTop: 7, paddingBottom: 7 }}
          >
            <Text style={{ fontSize: 20, color }}>{tab.emoji}</Text>
            <Text style={{ fontSize: 10, color, marginTop: 2 }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
