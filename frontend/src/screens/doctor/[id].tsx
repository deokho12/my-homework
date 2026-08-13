import { router, Stack, useLocalSearchParams } from '@/navigation';
import { ChevronLeft } from 'lucide-react';
import { Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StockImage } from '@/components/StockImage';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useProcedureMap } from '@/features/procedure';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { useDoctorStore } from '@/store/useDoctorStore';
import { getHospitalById } from '@/store/useHospitalStore';
import { getVisibleSpecialtyLabel, isVerifiedSpecialist } from '@/utils/specialty';

export default function DoctorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doctor = useDoctorStore((state) => state.doctors.find((item) => item.id === id));
  const user = useAuthStore((state) => state.user);
  const requireAuth = useRequireAuth();
  const procedureMap = useProcedureMap();

  if (!doctor) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: '' }} />
        <Text className="text-sm text-neutral-500">전문의 정보를 찾을 수 없어요</Text>
      </SafeAreaView>
    );
  }

  const hospital = getHospitalById(doctor.hospitalId);
  const visibleSpecialty = getVisibleSpecialtyLabel(doctor);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: '' }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className={cx(CONTAINER_PADDING, 'pt-4')}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-neutral-100"
          >
            <ChevronLeft size={22} color="#171717" />
          </Pressable>

          <View className="mb-5 flex-row items-center gap-4">
            <StockImage
              uri={doctor.photo}
              alt={`${doctor.name} ${doctor.title} 프로필 사진`}
              style={{ width: 96, height: 96 }}
              borderRadius={48}
              contentFit="cover"
            />
            <View className="flex-1">
              <View className="mb-1 flex-row items-center gap-1.5">
                <Text className="text-xl font-extrabold text-neutral-900">
                  {doctor.name} {doctor.title}
                </Text>
                {isVerifiedSpecialist(doctor) ? <Badge label="전문의" tone="brand" /> : null}
              </View>
              {visibleSpecialty ? (
                <Text className="mb-1 text-sm font-semibold text-brand-700">{visibleSpecialty}</Text>
              ) : null}
              <Text className="text-sm text-neutral-500">{doctor.yearsOfExperience}년차</Text>
              <View className="mt-1 flex-row items-center gap-3">
                <Text className="text-xs text-neutral-500">후기 {doctor.reviewCount}</Text>
                <Text className="text-xs text-neutral-500">상담 {doctor.consultCount}</Text>
              </View>
            </View>
          </View>

          <Text className="mb-2 text-base font-bold text-neutral-900">주요 진료 분야</Text>
          <View className="mb-5 flex-row flex-wrap gap-1.5">
            {doctor.procedureIds.map((procedureId) => {
              const procedure = procedureMap.get(procedureId);
              return procedure ? <Badge key={procedureId} label={procedure.name} tone="brand" /> : null;
            })}
          </View>

          {/* Rating block — logged-out users see an opacity overlay standing in for a blur, since no
              blur library is installed. Swap for expo-blur's BlurView if the design wants a true blur. */}
          <View className="relative mb-5 overflow-hidden rounded-2xl bg-neutral-50 p-5">
            <View className="flex-row items-end gap-2">
              <Text className="text-3xl font-extrabold text-neutral-900">
                {doctor.rating === null ? '🔒' : doctor.rating.toFixed(1)}
              </Text>
              <Text className="mb-1 text-sm text-neutral-500">후기 {doctor.reviewCount}개 평균 평점</Text>
            </View>

            {!user ? (
              <View className="absolute inset-0 items-center justify-center bg-white/80 px-6">
                <Text className="mb-3 text-center text-sm font-semibold text-neutral-700">
                  로그인하면 실제 후기를 볼 수 있어요
                </Text>
                <Pressable
                  onPress={() => requireAuth(() => {}, `/doctor/${doctor.id}`)}
                  className="rounded-xl bg-brand-600 px-4 py-2.5 active:bg-brand-700"
                >
                  <Text className="text-sm font-semibold text-white">로그인</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <Text className="mb-2 text-base font-bold text-neutral-900">소속 병원</Text>
          {hospital ? (
            <Pressable
              onPress={() => router.push(`/hospital/${hospital.id}`)}
              className="mb-5 flex-row items-center gap-3 rounded-2xl border border-neutral-100 p-4"
            >
              <StockImage
                uri={hospital.thumbnail}
                alt={`${hospital.name} 로고`}
                style={{ width: 56, height: 56 }}
                borderRadius={12}
                contentFit="cover"
              />
              <View className="flex-1">
                <Text className="text-sm font-bold text-neutral-900" numberOfLines={1}>
                  {hospital.name}
                </Text>
                <Text className="mb-1.5 text-xs text-neutral-400" numberOfLines={1}>
                  {hospital.region}
                </Text>
                <View className="mb-1.5 flex-row flex-wrap gap-1">
                  {hospital.procedureIds.slice(0, 3).map((procedureId) => {
                    const procedure = procedureMap.get(procedureId);
                    return procedure ? <Badge key={procedureId} label={procedure.name} /> : null;
                  })}
                </View>
                <View className="flex-row items-center gap-3">
                  <Text className="text-xs text-neutral-500">★ {hospital.rating.toFixed(1)}</Text>
                  <Text className="text-xs text-neutral-500">상담 {hospital.consultCount}</Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <Text className="mb-5 text-sm text-neutral-400">소속 병원 정보를 찾을 수 없어요</Text>
          )}

          <Text className="mb-2 text-base font-bold text-neutral-900">경력 및 활동</Text>
          {doctor.career.length === 0 ? (
            <Text className="mb-4 text-sm text-neutral-400">등록된 경력 정보가 없어요</Text>
          ) : (
            <View className="mb-4">
              {doctor.career.map((item) => (
                <View key={item} className="mb-1.5 flex-row items-start gap-2">
                  <Text className="text-sm leading-5 text-neutral-400">•</Text>
                  <Text className="flex-1 text-sm leading-5 text-neutral-600">{item}</Text>
                </View>
              ))}
            </View>
          )}

          <View className="h-24" />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} className={cx(CONTAINER_PADDING, 'border-t border-neutral-100 bg-white pt-3')}>
        <View className="pb-3">
          <PrimaryButton
            label={hospital?.consultAvailable ? '상담 신청' : '상담 마감'}
            disabled={!hospital || !hospital.consultAvailable}
            onPress={() =>
              hospital &&
              requireAuth(() => router.push(`/consult/${hospital.id}`), `/consult/${hospital.id}`)
            }
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
