import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HospitalCard } from '@/components/HospitalCard';
import { getHospitalById } from '@/data/hospitals';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import type { Hospital } from '@/types/domain';

export default function FavoritesScreen() {
  const hospitalIds = useFavoritesStore((state) => state.hospitalIds);
  const favoriteHospitals = hospitalIds
    .map((id) => getHospitalById(id))
    .filter((hospital): hospital is Hospital => Boolean(hospital));

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <View className="px-5 pb-2 pt-3">
        <Text className="text-2xl font-extrabold text-neutral-900">찜한 병원</Text>
        <Text className="mt-1 text-sm text-neutral-500">마음에 든 병원을 모아보세요</Text>
      </View>

      {favoriteHospitals.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-2 text-4xl">🤍</Text>
          <Text className="text-center text-sm text-neutral-500">
            아직 찜한 병원이 없어요{'\n'}병원 카드의 하트를 눌러 찜해보세요
          </Text>
        </View>
      ) : (
        <FlatList
          data={favoriteHospitals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HospitalCard hospital={item} />}
          contentContainerClassName="px-5 pb-8 pt-3"
        />
      )}
    </SafeAreaView>
  );
}
