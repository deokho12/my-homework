import { Stack } from '@/navigation';
import { ScrollView, Text, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { PromotionCard } from '@/components/PromotionCard';
import { CardGrid } from '@/components/layout/CardGrid';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { promotions } from '@/mocks/fixtures/promotions';

export default function EventsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '이벤트' }} />
      <ScrollView contentContainerClassName={cx(CONTAINER_PADDING, 'pb-8 pt-4')}>
        <Text className="mb-1 text-2xl font-extrabold text-neutral-900">지금 진행중인 이벤트</Text>
        <Text className="mb-5 text-sm text-neutral-500">기간 한정 할인 혜택을 확인해보세요</Text>

        {promotions.length === 0 ? (
          <Text className="text-sm text-neutral-400">진행중인 이벤트가 없어요</Text>
        ) : (
          <CardGrid columns="wide">
            {promotions.map((promotion) => (
              <PromotionCard key={promotion.id} promotion={promotion} />
            ))}
          </CardGrid>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
