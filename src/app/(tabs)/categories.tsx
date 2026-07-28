import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { procedures } from '@/data/procedures';
import type { Procedure } from '@/types/domain';

function CategoryRow({ procedure }: { procedure: Procedure }) {
  return (
    <Pressable
      onPress={() => router.push(`/hospitals/${procedure.id}`)}
      className="mb-3 flex-row items-center rounded-2xl border border-neutral-100 bg-white p-4 active:bg-neutral-50"
    >
      <Text className="mr-3 text-3xl">{procedure.emoji}</Text>
      <View className="flex-1">
        <Text className="text-base font-bold text-neutral-900">{procedure.name}</Text>
        <Text className="text-[13px] text-neutral-500">{procedure.shortDescription}</Text>
      </View>
      <Text className="text-neutral-300">›</Text>
    </Pressable>
  );
}

export default function CategoriesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <View className="px-5 pb-2 pt-3">
        <Text className="text-2xl font-extrabold text-neutral-900">시술 카테고리</Text>
        <Text className="mt-1 text-sm text-neutral-500">궁금한 시술을 선택하면 관련 병원을 보여드려요</Text>
      </View>
      <FlatList
        data={procedures}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CategoryRow procedure={item} />}
        contentContainerClassName="px-5 pb-8 pt-3"
      />
    </SafeAreaView>
  );
}
