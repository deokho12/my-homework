import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { getProcedureById } from '@/data/procedures';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import type { Hospital } from '@/types/domain';
import { formatPriceRange } from '@/utils/format';

interface HospitalCardProps {
  hospital: Hospital;
}

export function HospitalCard({ hospital }: HospitalCardProps) {
  const isFavorite = useFavoritesStore((state) => state.isFavorite(hospital.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  return (
    <Pressable
      onPress={() => router.push(`/hospital/${hospital.id}`)}
      className="mb-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white"
    >
      <View className="relative">
        <Image
          source={{ uri: hospital.thumbnail }}
          style={{ width: '100%', height: 160 }}
          contentFit="cover"
        />
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(hospital.id);
          }}
          hitSlop={8}
          className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-full bg-white/90"
        >
          <Text className="text-base">{isFavorite ? '❤️' : '🤍'}</Text>
        </Pressable>
      </View>

      <View className="p-4">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-base font-bold text-neutral-900" numberOfLines={1}>
            {hospital.name}
          </Text>
          {hospital.consultAvailable ? <Badge label="상담가능" tone="brand" /> : null}
        </View>

        <Text className="mb-2 text-[13px] text-neutral-400">{hospital.region}</Text>

        <View className="mb-2 flex-row flex-wrap gap-1.5">
          {hospital.procedureIds.slice(0, 3).map((procedureId) => {
            const procedure = getProcedureById(procedureId);
            return procedure ? <Badge key={procedureId} label={procedure.name} /> : null;
          })}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-neutral-800">
            {formatPriceRange(hospital.priceRange.min, hospital.priceRange.max)}
          </Text>
          <Text className="text-sm text-neutral-500">
            ★ {hospital.rating.toFixed(1)} ({hospital.reviewCount})
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
