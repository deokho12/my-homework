import { router } from '@/navigation';
import { Pressable, Text, View } from '@/primitives';

import { StockImage } from '@/components/StockImage';
import { useHospital } from '@/features/hospital';
import type { Promotion } from '@/types/domain';
import { calcDiscountRate, formatWon } from '@/utils/format';

interface PromotionCardProps {
  promotion: Promotion;
}

export function PromotionCard({ promotion }: PromotionCardProps) {
  // 조회 훅이라 관리자가 병원 정보를 고치면 반영된다 — 예전 `getHospitalById()` 는
  // zustand `getState()` 스냅샷이라 비반응형이었다(`docs/features/known-issues.md`).
  const { data: hospital } = useHospital(promotion.hospitalId);
  if (!hospital) return null;

  return (
    <Pressable
      onPress={() => router.push(`/hospital/${hospital.id}`)}
      className="mr-3 w-64 overflow-hidden rounded-2xl border border-neutral-100 bg-white"
    >
      <View className="relative">
        <StockImage
          uri={hospital.thumbnail}
          alt={`${hospital.name} 병원 사진`}
          style={{ width: '100%', height: 120 }}
          contentFit="cover"
        />
        <View className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1">
          <Text className="text-xs font-bold text-white">🔥 {promotion.badge}</Text>
        </View>
      </View>
      <View className="p-3">
        <Text className="mb-1 text-sm font-bold text-neutral-900" numberOfLines={1}>
          {promotion.title}
        </Text>
        <Text className="mb-1.5 text-xs text-neutral-400" numberOfLines={1}>
          {hospital.name}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-extrabold text-rose-500">
            {calcDiscountRate(promotion.originalPrice, promotion.salePrice)}%
          </Text>
          <Text className="text-sm font-bold text-neutral-900">{formatWon(promotion.salePrice)}</Text>
        </View>
        <Text className="text-xs text-neutral-400 line-through">{formatWon(promotion.originalPrice)}</Text>
      </View>
    </Pressable>
  );
}
