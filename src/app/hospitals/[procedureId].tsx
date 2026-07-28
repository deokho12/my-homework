import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HospitalCard } from '@/components/HospitalCard';
import { PriceCompareTable } from '@/components/PriceCompareTable';
import { getHospitalsByProcedure } from '@/data/hospitals';
import { getProcedureById } from '@/data/procedures';

type ViewMode = 'card' | 'table';

export default function HospitalListScreen() {
  const { procedureId } = useLocalSearchParams<{ procedureId: string }>();
  const procedure = getProcedureById(procedureId);
  const hospitalList = getHospitalsByProcedure(procedureId);
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: procedure ? `${procedure.name} 병원` : '병원 리스트' }} />

      {procedure ? (
        <View className="px-5 pb-1 pt-4">
          <Text className="text-lg font-bold text-neutral-900">
            {procedure.emoji} {procedure.name}
          </Text>
          <Text className="mt-1 text-sm text-neutral-500">{procedure.description}</Text>
        </View>
      ) : null}

      {hospitalList.length > 0 ? (
        <View className="mb-1 mt-3 flex-row px-5">
          <Pressable
            onPress={() => setViewMode('card')}
            className={`mr-2 rounded-full px-3.5 py-1.5 ${viewMode === 'card' ? 'bg-neutral-900' : 'bg-neutral-100'}`}
          >
            <Text className={`text-sm font-medium ${viewMode === 'card' ? 'text-white' : 'text-neutral-500'}`}>
              카드로 보기
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('table')}
            className={`rounded-full px-3.5 py-1.5 ${viewMode === 'table' ? 'bg-neutral-900' : 'bg-neutral-100'}`}
          >
            <Text className={`text-sm font-medium ${viewMode === 'table' ? 'text-white' : 'text-neutral-500'}`}>
              가격 비교표
            </Text>
          </Pressable>
        </View>
      ) : null}

      {hospitalList.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-neutral-500">
            아직 등록된 병원이 없어요{'\n'}곧 더 많은 병원을 만나보실 수 있어요
          </Text>
        </View>
      ) : viewMode === 'table' ? (
        <View className="px-5 pb-8 pt-3">
          <PriceCompareTable hospitals={hospitalList} />
        </View>
      ) : (
        <FlatList
          data={hospitalList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HospitalCard hospital={item} />}
          contentContainerClassName="px-5 pb-8 pt-3"
        />
      )}
    </SafeAreaView>
  );
}
