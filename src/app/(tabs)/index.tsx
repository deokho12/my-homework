import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuideCard } from '@/components/GuideCard';
import { ProcedureCategoryCard } from '@/components/ProcedureCategoryCard';
import { PromotionCard } from '@/components/PromotionCard';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { guides } from '@/data/guides';
import { procedures } from '@/data/procedures';
import { promotions } from '@/data/promotions';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <Text className="text-2xl font-extrabold text-brand-700">몰라몰라</Text>
        </View>

        <View className="mb-5">
          <SearchBar />
        </View>

        <View className="mb-6 rounded-2xl bg-brand-600 px-5 py-6">
          <Text className="mb-1 text-lg font-bold text-white">병원명 말고, 시술로 찾아보세요</Text>
          <Text className="text-sm text-brand-50">
            임플란트, 교정, 라미네이트까지 한눈에 비교하고 상담까지 한번에
          </Text>
        </View>

        {promotions.length > 0 ? (
          <View className="mb-6">
            <SectionHeader title="지금 진행중인 이벤트" actionLabel="전체보기" onPressAction={() => router.push('/events')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {promotions.map((promotion) => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View className="mb-6">
          <SectionHeader
            title="시술로 찾기"
            actionLabel="전체보기"
            onPressAction={() => router.push('/(tabs)/explore')}
          />
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {procedures.slice(0, 8).map((procedure) => (
              <ProcedureCategoryCard key={procedure.id} procedure={procedure} />
            ))}
          </View>
        </View>

        <View>
          <SectionHeader title="이런 꿀팁 어때요?" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {guides.map((guide) => (
              <GuideCard
                key={guide.id}
                guide={guide}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/explore',
                    params: { mode: 'hospital', category: guide.procedureId },
                  })
                }
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
