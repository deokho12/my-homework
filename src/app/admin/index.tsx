import { router, Stack } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useHospitalStore } from '@/store/useHospitalStore';

export default function AdminHospitalListScreen() {
  const hospitals = useHospitalStore((state) => state.hospitals);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '병원 관리자' }} />
      <View className="px-5 pb-2 pt-4">
        <Text className="mb-1 text-lg font-bold text-neutral-900">병원 프로필 관리</Text>
        <Text className="mb-4 text-sm text-neutral-500">
          등록된 병원 정보를 수정하거나 새 병원을 등록할 수 있어요
        </Text>
        <PrimaryButton label="새 병원 등록" onPress={() => router.push('/admin/hospital/new')} />
      </View>

      <FlatList
        data={hospitals}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 py-4"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/admin/hospital/${item.id}`)}
            className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-100 bg-white p-4"
          >
            <View className="flex-1">
              <Text className="text-base font-bold text-neutral-900">{item.name}</Text>
              <Text className="text-xs text-neutral-400">{item.region}</Text>
            </View>
            {item.isOneDay ? <Text className="text-xs font-semibold text-brand-700">⚡ 원데이</Text> : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
