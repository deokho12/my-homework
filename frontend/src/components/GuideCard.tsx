import { router } from '@/navigation';
import { Pressable, Text, View } from '@/primitives';

import { StockImage } from '@/components/StockImage';
import type { GuideContent } from '@/types/domain';

interface GuideCardProps {
  guide: GuideContent;
  onPress?: () => void;
}

export function GuideCard({ guide, onPress }: GuideCardProps) {
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/tips/${guide.id}`))}
      className="mr-3 w-56 overflow-hidden rounded-2xl border border-neutral-100 bg-white"
    >
      <StockImage
        uri={guide.thumbnail}
        alt={guide.title}
        style={{ width: '100%', height: 112 }}
        contentFit="cover"
      />
      <View className="p-3">
        <Text className="mb-1 text-sm font-bold text-neutral-900" numberOfLines={2}>
          {guide.title}
        </Text>
        <Text className="text-xs text-neutral-500" numberOfLines={2}>
          {guide.summary}
        </Text>
      </View>
    </Pressable>
  );
}
