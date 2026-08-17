import { router } from '@/navigation';
import { Pressable, Text, View } from '@/primitives';

import { Badge } from '@/components/Badge';
import { StockImage } from '@/components/StockImage';
import { useProcedureMap } from '@/features/procedure';
import { getPromotionByHospital } from '@/mocks/fixtures/promotions';
import { useFavoriteToggle } from '@/features/favorite';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { Hospital } from '@/types/domain';
import { calcDiscountRate, formatPriceRange, formatWon } from '@/utils/format';

interface HospitalCardProps {
  hospital: Hospital;
}

export function HospitalCard({ hospital }: HospitalCardProps) {
  const { isFavorite, isPending: favoritesPending, toggle } = useFavoriteToggle(hospital.id);
  const requireAuth = useRequireAuth();
  const procedureMap = useProcedureMap();
  const promotion = getPromotionByHospital(hospital.id);

  return (
    <Pressable
      onPress={() => router.push(`/hospital/${hospital.id}`)}
      className="mb-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white"
    >
      <View className="relative">
        <StockImage
          uri={hospital.thumbnail}
          alt={`${hospital.name} 병원 사진`}
          style={{ width: '100%', height: 160 }}
          contentFit="cover"
        />
        {promotion ? (
          <View className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1">
            <Text className="text-xs font-bold text-white">🔥 {promotion.badge}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            // 찜 목록을 아직 모르는 동안은 누르지 않는다 — 그 상태의 `isFavorite` 는
            // "찜 안 함" 이 아니라 "모름" 이라, 해제하려는 누름이 추가로 뒤집힌다.
            if (!favoritesPending) requireAuth(toggle);
          }}
          hitSlop={8}
          className={`absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-full bg-white/90 ${
            favoritesPending ? 'opacity-50' : ''
          }`}
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
          {hospital.sponsorship.isActive ? <Badge label="광고" /> : null}
          {hospital.isRecommended ? <Badge label="🌟 추천" tone="brand" /> : null}
          {hospital.isOneDay ? <Badge label="⚡ 원데이 가능" tone="brand" /> : null}
          {hospital.representativeSpecialty ? <Badge label={`${hospital.representativeSpecialty} 상주`} /> : null}
          {hospital.procedureIds.slice(0, 3).map((procedureId) => {
            const procedure = procedureMap.get(procedureId);
            return procedure ? <Badge key={procedureId} label={procedure.name} /> : null;
          })}
        </View>

        {promotion ? (
          <View className="mb-2 flex-row items-center gap-2">
            <Text className="text-sm font-extrabold text-rose-500">
              {calcDiscountRate(promotion.originalPrice, promotion.salePrice)}%
            </Text>
            <Text className="text-base font-bold text-neutral-900">{formatWon(promotion.salePrice)}</Text>
            <Text className="text-xs text-neutral-400 line-through">{formatWon(promotion.originalPrice)}</Text>
          </View>
        ) : null}

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
