import { router } from '@/navigation';
import { Pressable, Text, View } from '@/primitives';

// 정적 마스터 데이터. features/procedure(또는 content) 가 생기면 그쪽으로 옮긴다 (Task 11).
import { getPromotionByHospital } from '@/mocks/fixtures/promotions';
import type { Hospital } from '@/types/domain';
import { formatWon } from '@/utils/format';

interface PriceCompareTableProps {
  hospitals: Hospital[];
}

export function PriceCompareTable({ hospitals }: PriceCompareTableProps) {
  const sorted = [...hospitals].sort((a, b) => {
    const priceOf = (h: Hospital) => getPromotionByHospital(h.id)?.salePrice ?? h.priceRange.min;
    return priceOf(a) - priceOf(b);
  });

  return (
    <View className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <View className="flex-row bg-neutral-50 px-4 py-2.5">
        <Text className="flex-[1.6] text-xs font-semibold text-neutral-400">병원</Text>
        <Text className="flex-1 text-xs font-semibold text-neutral-400">최저가</Text>
        <Text className="w-14 text-right text-xs font-semibold text-neutral-400">평점</Text>
      </View>

      {sorted.map((hospital, index) => {
        const promotion = getPromotionByHospital(hospital.id);
        const price = promotion ? promotion.salePrice : hospital.priceRange.min;

        return (
          <Pressable
            key={hospital.id}
            onPress={() => router.push(`/hospital/${hospital.id}`)}
            className={`flex-row items-center px-4 py-3 ${index > 0 ? 'border-t border-neutral-100' : ''}`}
          >
            <View className="flex-[1.6] pr-2">
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
                {hospital.name}
              </Text>
              <Text className="text-xs text-neutral-400">{hospital.region}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-neutral-900">{formatWon(price)}</Text>
              {promotion ? <Text className="text-xs text-rose-500">할인가</Text> : null}
            </View>
            <Text className="w-14 text-right text-sm text-neutral-600">★ {hospital.rating.toFixed(1)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
