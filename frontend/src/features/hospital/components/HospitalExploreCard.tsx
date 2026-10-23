import { Zap } from 'lucide-react';

import { router } from '@/navigation';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from '@/primitives';

import { Badge } from '@/components/Badge';
import { RecommendedBadge } from '@/components/RecommendedBadge';
import { StockImage } from '@/components/StockImage';
import { FavoriteHeartButton } from '@/features/favorite';
import { procedureDisplayName } from '@/features/procedure';
import type { CategoryId } from '@/features/procedure/taxonomy';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { Hospital } from '@/types/domain';
import { distanceKm, formatDistance, type GeoPoint } from '@/utils/geo';
import { isSpecialtyForCategory } from '@/utils/specialty';

interface HospitalExploreCardProps {
  hospital: Hospital;
  /** 지금 보고 있는 시술 대분류. 그 대분류와 맞는 전공이면 "상주" 배지를 강조한다. */
  activeCategory?: CategoryId;
  /**
   * 사용자 좌표. **위치 권한이 실제로 허용됐을 때만** 넘어온다(`useUserLocation().point`).
   * 서울시청 폴백을 여기로 흘려보내면 부산 사용자에게 "0.9km" 라고 적게 된다 —
   * 그래서 카드는 `status` 를 보지 않고, `null` 이면 그냥 거리를 그리지 않는다.
   */
  userPoint?: GeoPoint | null;
  style?: StyleProp<ViewStyle>;
}

/** 좌표가 비어 있는 병원은 `0,0`(기니만 앞바다)으로 온다 — 거리를 계산할 수 없다는 뜻이다. */
function hasCoordinates(hospital: Hospital): boolean {
  return hospital.latitude !== 0 || hospital.longitude !== 0;
}

export function HospitalExploreCard({ hospital, activeCategory, userPoint = null, style }: HospitalExploreCardProps) {
  const requireAuth = useRequireAuth();
  // 대분류 하나에 전공이 여럿일 수 있다(충치치료 = 보철·통합치의학) — 이 판정은 배지의
  // **강조 색**만 정한다. 배지를 붙일지 말지는 서버(`representativeSpecialty`)가 정한다.
  const matchesActiveCategory =
    !!hospital.representativeSpecialty &&
    !!activeCategory &&
    isSpecialtyForCategory(activeCategory, hospital.representativeSpecialty);

  // 서버가 거리를 주면(= 지도 모드의 반경 질의) 그것이 정본이다. 목록 모드는 위치를 보내지
  // 않아 `undefined` 이고, 그때만 화면이 서버와 같은 haversine 으로 계산한다.
  const km =
    hospital.distanceKm ?? (userPoint && hasCoordinates(hospital) ? distanceKm(userPoint, hospital) : null);

  return (
    <View className="relative mb-4" style={style}>
      <Pressable
        onPress={() => router.push(`/hospital/${hospital.id}`)}
        className="overflow-hidden rounded-2xl border border-neutral-100 bg-white"
      >
        <StockImage
          uri={hospital.thumbnail}
          alt={`${hospital.name} 병원 사진`}
          style={{ width: '100%', height: 140 }}
          contentFit="cover"
        />

        <View className="p-4">
          <View className="flex-row items-center gap-1.5">
            <Text className="flex-1 text-base font-bold text-neutral-900" numberOfLines={1}>
              {hospital.name}
            </Text>
            {/* 광고 표시는 알아볼 수 있으면 된다 — 브랜드색 알약으로 키우면 추천과 같은 무게가 된다. */}
            {hospital.sponsorship.isActive ? <Text className="text-[11px] text-neutral-500">광고</Text> : null}
            {hospital.isRecommended ? <RecommendedBadge /> : null}
          </View>
          <Text className="mb-1 text-[13px] font-semibold text-brand-700" numberOfLines={1}>
            {hospital.specialty}
          </Text>
          {/* 거리는 **이미 있는 줄의 끝**에 붙는다 — 나중에 도착해도 카드 높이가 변하지 않는다. */}
          <Text className="mb-2 text-[13px] text-neutral-500" numberOfLines={1}>
            {km === null ? hospital.region : `${hospital.region} · ${formatDistance(km)}`}
          </Text>

          <View className="mb-3 flex-row flex-wrap gap-1.5">
            {hospital.isOneDay ? <Badge icon={Zap} label="원데이 가능" tone="brand" /> : null}
            {hospital.representativeSpecialty ? (
              <Badge
                label={`${hospital.representativeSpecialty} 상주`}
                tone={matchesActiveCategory ? 'brand' : 'neutral'}
              />
            ) : null}
            {hospital.procedureIds.slice(0, 3).map((procedureId) => {
              // 서버가 주는 id 가 곧 세부 시술 id 다(`resin` → "레진"). 모르는 id 는 배지를 건너뛴다.
              const name = procedureDisplayName(procedureId);
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
            <Text className={`text-sm font-semibold ${hospital.consultAvailable ? 'text-white' : 'text-neutral-500'}`}>
              {hospital.consultAvailable ? '상담신청' : '상담 마감'}
            </Text>
          </Pressable>
        </View>
      </Pressable>

      {/* 카드 본문의 **형제**다 — 자식으로 넣으면 버튼 안의 버튼이 되고 클릭이 상세로 새어 나간다. */}
      <FavoriteHeartButton
        hospitalId={hospital.id}
        hospitalName={hospital.name}
        className="absolute right-2 top-2 z-10"
      />
    </View>
  );
}
