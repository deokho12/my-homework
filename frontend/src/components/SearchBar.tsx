import { Search } from 'lucide-react';

import { router } from '@/navigation';
import { Pressable, Text, View } from '@/primitives';

/** 검색 아이콘 neutral-500 — 안내 문구(neutral-400)보다 진해 버튼처럼 보인다. */
const ICON_COLOR = '#737373';

export function SearchBar() {
  return (
    <Pressable
      onPress={() => router.push('/search')}
      className="flex-row items-center rounded-full border border-neutral-200 bg-white px-5 py-4"
    >
      {/* 아이콘은 장식이다 — 버튼 이름은 옆의 안내 문구가 된다. */}
      <View className="mr-2">
        <Search size={18} color={ICON_COLOR} aria-hidden />
      </View>
      <View className="flex-1">
        {/* 입력 전 안내 문구라 neutral-400 을 유지한다 (SYS-22 의 예외 — placeholder) */}
        <Text className="text-[15px] text-neutral-400">임플란트, 교정 같은 시술을 검색해보세요</Text>
      </View>
    </Pressable>
  );
}
