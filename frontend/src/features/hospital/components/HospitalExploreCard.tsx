import { router } from '@/navigation';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from '@/primitives';

import { Badge } from '@/components/Badge';
import { StockImage } from '@/components/StockImage';
import { displayNameForLegacy } from '@/features/procedure';
import type { CategoryId } from '@/features/procedure/taxonomy';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { Hospital } from '@/types/domain';
import { isSpecialtyForCategory } from '@/utils/specialty';

interface HospitalExploreCardProps {
  hospital: Hospital;
  /** 지금 보고 있는 시술 대분류. 그 대분류와 맞는 전공이면 "상주" 배지를 강조한다. */
  activeCategory?: CategoryId;
  style?: StyleProp<ViewStyle>;
}

export function HospitalExploreCard({ hospital, activeCategory, style }: HospitalExploreCardProps) {
  const requireAuth = useRequireAuth();
  // 대분류 하나에 전공이 여럿일 수 있다(충치치료 = 보철·통합치의학) — 판정은
  // `utils/specialty.ts` 한 곳에 두고 전문의 목록 배지와 공유한다.
  const matchesActiveCategory =
    !!hospital.representativeSpecialty &&
    !!activeCategory &&
    isSpecialtyForCategory(activeCategory, hospital.representativeSpecialty);

  return (
    <Pressable
      onPress={() => router.push(`/hospital/${hospital.id}`)}
      style={style}
      className="mb-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white"
    >
      <View className="relative">
        <StockImage
          uri={hospital.thumbnail}
          alt={`${hospital.name} 병원 사진`}
          style={{ width: '100%', height: 140 }}
          contentFit="cover"
        />
        {hospital.isOneDay ? (
          <View className="absolute left-3 top-3 rounded-full bg-brand-600 px-2.5 py-1">
            <Text className="text-xs font-bold text-white">⚡ 원데이 가능</Text>
          </View>
        ) : null}
      </View>

      <View className="p-4">
        <Text className="text-base font-bold text-neutral-900" numberOfLines={1}>
          {hospital.name}
        </Text>
        <Text className="mb-1 text-[13px] font-semibold text-brand-700" numberOfLines={1}>
          {hospital.specialty}
        </Text>
        <Text className="mb-2 text-[13px] text-neutral-400" numberOfLines={1}>
          {hospital.region}
        </Text>

        <View className="mb-3 flex-row flex-wrap gap-1.5">
          {hospital.sponsorship.isActive ? <Badge label="광고" /> : null}
          {hospital.isRecommended ? <Badge label="🌟 추천" tone="brand" /> : null}
          {hospital.representativeSpecialty ? (
            <Badge
              label={`${hospital.representativeSpecialty} 상주`}
              tone={matchesActiveCategory ? 'brand' : 'neutral'}
            />
          ) : null}
          {hospital.procedureIds.slice(0, 3).map((procedureId) => {
            // 세부 시술 이름(`cavity` → "레진"). 모르는 id 는 배지를 건너뛴다.
            const name = displayNameForLegacy(procedureId);
            return name ? <Badge key={procedureId} label={name} /> : null;
          })}
        </View>

        <View className="mb-3 flex-row items-center gap-3">
          <Text className="text-xs text-neutral-500">후기 {hospital.reviewCount}</Text>
          <Text className="text-xs text-neutral-500">상담 {hospital.consultCount}</Text>
          <Text className="text-xs text-neutral-500">★ {hospital.rating.toFixed(1)}</Text>
        </View>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            requireAuth(() => router.push(`/consult/${hospital.id}`), `/consult/${hospital.id}`);
          }}
          disabled={!hospital.consultAvailable}
          className={`items-center justify-center rounded-xl py-3 ${
            hospital.consultAvailable ? 'bg-brand-600 active:bg-brand-700' : 'bg-neutral-200'
          }`}
        >
          <Text className={`text-sm font-semibold ${hospital.consultAvailable ? 'text-white' : 'text-neutral-400'}`}>
            {hospital.consultAvailable ? '상담신청' : '상담 마감'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
