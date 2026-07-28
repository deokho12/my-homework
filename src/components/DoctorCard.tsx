import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Badge } from '@/components/Badge';
import { getProcedureById } from '@/data/procedures';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getHospitalById } from '@/store/useHospitalStore';
import type { Doctor } from '@/types/domain';
import { getVisibleSpecialtyLabel, isVerifiedSpecialist } from '@/utils/specialty';

interface DoctorCardProps {
  doctor: Doctor;
  style?: StyleProp<ViewStyle>;
}

export function DoctorCard({ doctor, style }: DoctorCardProps) {
  const requireAuth = useRequireAuth();
  const hospital = getHospitalById(doctor.hospitalId);
  const visibleSpecialty = getVisibleSpecialtyLabel(doctor);

  return (
    <Pressable
      onPress={() => hospital && router.push(`/hospital/${hospital.id}`)}
      style={style}
      className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4"
    >
      <View className="mb-3 flex-row items-center gap-3">
        <Image
          source={{ uri: doctor.photo }}
          style={{ width: 64, height: 64, borderRadius: 32 }}
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="text-base font-bold text-neutral-900" numberOfLines={1}>
            {doctor.name} {doctor.title}
          </Text>
          {visibleSpecialty ? (
            <Text className="text-[13px] text-neutral-500" numberOfLines={1}>
              {visibleSpecialty}
            </Text>
          ) : null}
          {hospital ? (
            <Text className="text-[13px] text-neutral-400" numberOfLines={1}>
              {hospital.name}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mb-3 flex-row flex-wrap gap-1.5">
        {doctor.isRecommended ? <Badge label="🌟 추천" tone="brand" /> : null}
        {isVerifiedSpecialist(doctor) ? <Badge label="전문의" tone="brand" /> : null}
        {doctor.procedureIds.slice(0, 3).map((procedureId) => {
          const procedure = getProcedureById(procedureId);
          return procedure ? <Badge key={procedureId} label={procedure.name} /> : null;
        })}
      </View>

      <View className="mb-3 flex-row items-center gap-3">
        <Text className="text-xs text-neutral-500">후기 {doctor.reviewCount}</Text>
        <Text className="text-xs text-neutral-500">상담 {doctor.consultCount}</Text>
        <Text className="text-xs text-neutral-500">★ {doctor.rating.toFixed(1)}</Text>
      </View>

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          if (!hospital) return;
          requireAuth(() => router.push(`/consult/${hospital.id}`), `/consult/${hospital.id}`);
        }}
        disabled={!hospital?.consultAvailable}
        className={`items-center justify-center rounded-xl py-3 ${
          hospital?.consultAvailable ? 'bg-brand-600 active:bg-brand-700' : 'bg-neutral-200'
        }`}
      >
        <Text
          className={`text-sm font-semibold ${hospital?.consultAvailable ? 'text-white' : 'text-neutral-400'}`}
        >
          {hospital?.consultAvailable ? '상담신청' : '상담 마감'}
        </Text>
      </Pressable>
    </Pressable>
  );
}
