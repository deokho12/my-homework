import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { HospitalCard } from '@/components/HospitalCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StockImage } from '@/components/StockImage';
import { getProcedureById } from '@/data/procedures';
import { guides } from '@/data/guides';
import { getHospitalById } from '@/store/useHospitalStore';

export default function TipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = guides.find((item) => item.id === id);

  if (!guide) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: '' }} />
        <Text className="text-sm text-neutral-500">꿀팁 정보를 찾을 수 없어요</Text>
      </SafeAreaView>
    );
  }

  const procedure = getProcedureById(guide.procedureId);
  const paragraphs = guide.content.split('\n\n');
  const relatedHospitals = (guide.relatedHospitals ?? [])
    .map((hospitalId) => getHospitalById(hospitalId))
    .filter((hospital): hospital is NonNullable<typeof hospital> => Boolean(hospital));

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: '' }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-neutral-100"
          >
            <ChevronLeft size={22} color="#171717" />
          </Pressable>
        </View>

        <View className="px-5">
          <StockImage
            uri={guide.thumbnail}
            alt={guide.title}
            style={{ width: '100%', height: 200 }}
            borderRadius={16}
            contentFit="cover"
          />
        </View>

        <View className="px-5 pt-5">
          {procedure ? (
            <View className="mb-3 flex-row">
              <Badge label={procedure.name} tone="brand" />
            </View>
          ) : null}

          <Text className="mb-2 text-2xl font-extrabold text-neutral-900">{guide.title}</Text>

          <Text className="mb-5 text-xs text-neutral-400">
            {guide.author} · {guide.createdAt}
          </Text>

          <View className="mb-6">
            {paragraphs.map((paragraph, index) => (
              <Text key={index} className="mb-4 text-[15px] leading-6 text-neutral-700">
                {paragraph}
              </Text>
            ))}
          </View>

          {relatedHospitals.length > 0 ? (
            <View className="mb-4">
              <Text className="mb-3 text-base font-bold text-neutral-900">관련 병원 보기</Text>
              {relatedHospitals.map((hospital) => (
                <HospitalCard key={hospital.id} hospital={hospital} />
              ))}
            </View>
          ) : null}

          <View className="h-24" />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} className="border-t border-neutral-100 bg-white px-5 pt-3">
        <View className="pb-3">
          <PrimaryButton
            label="관련 시술 병원 상담받기"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/explore',
                params: { mode: 'hospital', category: guide.procedureId },
              })
            }
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
