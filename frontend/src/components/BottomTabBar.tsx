import { Hospital, House, MessageCircle, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Pressable, Text, View } from '@/primitives';
import { router, usePathname } from '@/navigation';

/**
 * Replaces expo-router's `<Tabs>` bar from the old `app/(tabs)/_layout.tsx`.
 * Same four destinations and the same active/inactive tints — 아이콘은 이모지
 * (🏠🦷💬👤)에서 lucide 로 바꿨다 (SYS-22, 2026-10-23 시안). 이모지는 OS 마다
 * 그림·크기가 달라 네 칸의 무게가 들쑥날쑥했다.
 */
const TABS: { path: string; label: string; Icon: LucideIcon }[] = [
  { path: '/', label: '홈', Icon: House },
  { path: '/explore', label: '병원', Icon: Hospital },
  { path: '/community', label: '커뮤니티', Icon: MessageCircle },
  { path: '/mypage', label: '마이페이지', Icon: User },
];

/** brand-600 / neutral-500 — 비활성도 읽히는 대비(4.6:1)다. 예전 neutral-400 은 2.5:1 이었다. */
const ACTIVE_TINT = '#17847a';
const INACTIVE_TINT = '#737373';

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
            {/* 아이콘은 장식이다 — 바로 아래 같은 뜻의 글자가 있고, 버튼 이름도 그 글자다. */}
            <tab.Icon size={22} color={color} aria-hidden />
            <Text style={{ fontSize: 10, color, marginTop: 2 }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
