import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PromotionCard } from '@/components/PromotionCard';
import { promotions } from '@/data/promotions';

export default function EventsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '이벤트' }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <Text className="mb-1 text-2xl font-extrabold text-neutral-900">지금 진행중인 이벤트</Text>
        <Text className="mb-5 text-sm text-neutral-500">기간 한정 할인 혜택을 확인해보세요</Text>

        {promotions.length === 0 ? (
          <Text className="text-sm text-neutral-400">진행중인 이벤트가 없어요</Text>
        ) : (
          <View className="flex-row flex-wrap">
            {promotions.map((promotion) => (
              <PromotionCard key={promotion.id} promotion={promotion} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
