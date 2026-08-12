import { ChevronLeft } from 'lucide-react';

import { Pressable, Text, View } from '@/primitives';
import { router } from '@/navigation';

/**
 * Replaces the expo-router Stack header. Mirrors the root layout's original
 * `screenOptions`: white background, no shadow, `#171717` tint.
 */
export function AppHeader({ title, canGoBack = true }: { title?: string; canGoBack?: boolean }) {
  return (
    <View
      className="flex-row items-center bg-white px-2"
      style={{ height: 56, flexShrink: 0 }}
    >
      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="뒤로 가기"
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <ChevronLeft size={24} color="#171717" />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}

      <Text
        className="ml-1 flex-1 text-[17px] font-semibold"
        style={{ color: '#171717' }}
        numberOfLines={1}
      >
        {title ?? ''}
      </Text>
    </View>
  );
}
