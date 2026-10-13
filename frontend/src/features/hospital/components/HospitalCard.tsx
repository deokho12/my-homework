import { router } from '@/navigation';
import { Pressable, Text, View } from '@/primitives';

import { Badge } from '@/components/Badge';
import { StockImage } from '@/components/StockImage';
import { FavoriteHeartButton } from '@/features/favorite';
import { displayNameForLegacy } from '@/features/procedure';
import { getPromotionByHospital } from '@/mocks/fixtures/promotions';
import type { Hospital } from '@/types/domain';
import { calcDiscountRate, formatPriceRange, formatWon } from '@/utils/format';

interface HospitalCardProps {
  hospital: Hospital;
}

export function HospitalCard({ hospital }: HospitalCardProps) {
  const promotion = getPromotionByHospital(hospital.id);

  return (
    <View className="relative mb-4">
      <Pressable
        onPress={() => router.push(`/hospital/${hospital.id}`)}
        className="overflow-hidden rounded-2xl border border-neutral-100 bg-white"
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
              // 배지는 서버 이름이 아니라 **세부 시술 이름**이다(`cavity` → "레진").
              // taxonomy 가 모르는 id 면 배지를 건너뛴다 — 지어낼 이름이 없다.
              const name = displayNameForLegacy(procedureId);
              return name ? <Badge key={procedureId} label={name} /> : null;
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

      {/*
        카드 본문(`Pressable`)의 **형제**다 — 자식으로 넣으면 버튼 안의 버튼이 되고
        하트 클릭이 병원 상세로 새어 나간다 (탐색 카드와 같은 구조).
      */}
      <FavoriteHeartButton
        hospitalId={hospital.id}
        hospitalName={hospital.name}
        className="absolute right-2 top-2 z-10"
      />
    </View>
  );
}
