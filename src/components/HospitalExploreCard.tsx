import { router } from 'expo-router';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Badge } from '@/components/Badge';
import { StockImage } from '@/components/StockImage';
import { getProcedureById } from '@/data/procedures';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getDoctorsByHospital } from '@/store/useDoctorStore';
import type { Hospital, ProcedureId } from '@/types/domain';
import { getRepresentativeSpecialist, getSpecialtyForProcedure } from '@/utils/specialty';
import { isSponsorshipActive } from '@/utils/sponsorship';

interface HospitalExploreCardProps {
  hospital: Hospital;
  /** Currently selected procedure category, if any — used to emphasize a matching specialist tag. */
  activeCategory?: ProcedureId;
  style?: StyleProp<ViewStyle>;
}

export function HospitalExploreCard({ hospital, activeCategory, style }: HospitalExploreCardProps) {
  const requireAuth = useRequireAuth();
  const representativeSpecialist = getRepresentativeSpecialist(getDoctorsByHospital(hospital.id));
  const matchesActiveCategory =
    !!representativeSpecialist &&
    !!activeCategory &&
    representativeSpecialist.specialty === getSpecialtyForProcedure(activeCategory);

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
          {isSponsorshipActive(hospital) ? <Badge label="광고" /> : null}
          {hospital.isRecommended ? <Badge label="🌟 추천" tone="brand" /> : null}
          {representativeSpecialist ? (
            <Badge
              label={`${representativeSpecialist.specialty} 상주`}
              tone={matchesActiveCategory ? 'brand' : 'neutral'}
            />
          ) : null}
          {hospital.procedureIds.slice(0, 3).map((procedureId) => {
            const procedure = getProcedureById(procedureId);
            return procedure ? <Badge key={procedureId} label={procedure.name} /> : null;
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
