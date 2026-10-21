import { router, Stack, useLocalSearchParams } from '@/navigation';
import { ChevronLeft } from 'lucide-react';
import { Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QueryState } from '@/components/QueryState';
import { StockImage } from '@/components/StockImage';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useDoctor } from '@/features/doctor';
import { useHospital } from '@/features/hospital';
import { procedureDisplayName } from '@/features/procedure';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { isApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/store/useAuthStore';

export default function DoctorDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: doctor, error, isLoading, isError, isFetching, refetch } = useDoctor(id);
  // `doctor` 가 아직 없으면 `useHospital` 이 fetch 를 걸지 않는다(`enabled: Boolean(id)`) —
  // 전문의가 로드된 뒤에야 소속 병원을 조회한다. `isHospitalLoading` 이 필요한 이유: 병원이
  // 아직 안 왔다고 "없다"고 단정하면 안 된다 — 조회가 끝나기 전의 `undefined` 는 "없음" 이
  // 아니라 "아직 모름" 이다.
  const { data: hospital, isLoading: isHospitalLoading } = useHospital(doctor?.hospitalId);
  const user = useAuthStore((state) => state.user);
  const requireAuth = useRequireAuth();

  // 없는 전문의는 서버가 404 DOCTOR_NOT_FOUND 를 준다 (ApiError로 던져진다) — "다시 시도"
  // 를 권할 에러가 아니라 빈 상태다. 그 외 에러(네트워크 오류 등)는 재시도 가능한 에러로 둔다.
  const notFound = isError && isApiError(error) && error.code === 'DOCTOR_NOT_FOUND';

  return (
    <QueryState
      isLoading={isLoading}
      isError={notFound ? false : isError}
      data={notFound ? null : doctor}
      onRetry={() => {
        void refetch();
      }}
      isRetrying={isError && isFetching}
      emptyState={{ title: '전문의 정보를 찾을 수 없어요' }}
      className="flex-1 bg-white"
    >
      {(doctor) => (
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

              {/*
                안내 문구가 붙으면 헤더 블록의 아래 여백을 그 문구가 이어받는다
                (배지가 없는 전문의는 안내도 없으므로 여백이 전과 같다).
              */}
              <View className={`${doctor.isVerifiedSpecialist ? 'mb-2' : 'mb-5'} flex-row items-center gap-4`}>
                <StockImage
                  uri={doctor.photo}
                  alt={`${doctor.name} ${doctor.title} 프로필 사진`}
                  style={{ width: 96, height: 96 }}
                  borderRadius={48}
                  contentFit="cover"
                />
                <View className="flex-1">
                  {/*
                    좁은 화면(360px)에서는 배지가 다음 줄로 내려간다 — 이름이 `대표원` / `장` 으로
                    쪼개지는 것보다 낫다. `break-keep` 은 한글 낱말 중간에서 끊지 않게 한다.
                  */}
                  <View className="mb-1 flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
                    <Text className="break-keep text-xl font-extrabold text-neutral-900">
                      {doctor.name} {doctor.title}
                    </Text>
                    {/*
                      판정은 서버 `doctor/specialty-badge.ts` 한 곳에 있다 — 화면은 읽기만 한다.
                      탐색 카드의 배지는 `전문의` 그대로다(조건 칩 이름과 같은 낱말이어야
                      "칩으로 걸러낸 것"과 "배지가 붙은 것"이 이어진다). 여기만 뜻을 설명할
                      한 줄이 함께 있어 `전문의 인증` 이라고 쓴다.
                    */}
                    {doctor.isVerifiedSpecialist ? <Badge label="전문의 인증" tone="brand" /> : null}
                  </View>
                  {doctor.visibleSpecialty ? (
                    <Text className="mb-1 text-sm font-semibold text-brand-700">{doctor.visibleSpecialty}</Text>
                  ) : null}
                  <Text className="text-sm text-neutral-500">{doctor.yearsOfExperience}년차</Text>
                  <View className="mt-1 flex-row items-center gap-3">
                    <Text className="text-xs text-neutral-500">후기 {doctor.reviewCount}</Text>
                    <Text className="text-xs text-neutral-500">상담 {doctor.consultCount}</Text>
                  </View>
                </View>
              </View>

              {/*
                사진+정보 가로 블록 **아래** 전체 폭 한 줄. 정보 칸(`flex-1`) 안에 넣으면
                360px 에서 한 문장이 세 줄로 쪼개져 사진 옆에 글자 기둥이 선다.
              */}
              {doctor.isVerifiedSpecialist ? (
                <Text className="mb-5 text-xs text-neutral-500">
                  몰라몰라가 자격증을 확인한 의료진에게만 인증 배지가 붙어요
                </Text>
              ) : null}

              <Text className="mb-2 text-base font-bold text-neutral-900">주요 진료 분야</Text>
              <View className="mb-5 flex-row flex-wrap gap-1.5">
                {doctor.procedureIds.map((procedureId) => {
                  // 서버가 주는 id 가 곧 세부 시술 id 다(`resin` → "레진"). 모르는 id 는 배지를 건너뛴다.
                  const name = procedureDisplayName(procedureId);
                  return name ? <Badge key={procedureId} label={name} tone="brand" /> : null;
                })}
              </View>

              {/* Rating block — logged-out users see an opacity overlay standing in for a blur, since no
                  blur library is installed. Swap for expo-blur's BlurView if the design wants a true blur.
                  `doctor.rating` 은 서버가 잠근다(비로그인이면 null) — 여기서 `?? 0` 으로 덮지 않는다. */}
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
              {isHospitalLoading ? (
                <View
                  className="mb-5 h-20 w-full animate-pulse rounded-2xl bg-neutral-100"
                  role="status"
                  accessibilityLabel="소속 병원 정보를 불러오는 중이에요"
                />
              ) : hospital ? (
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
                        const name = procedureDisplayName(procedureId);
                        return name ? <Badge key={procedureId} label={name} /> : null;
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
                // 로딩 중에는 "상담 마감" 이라고 단정하지 않는다 — 아직 모를 뿐이다. 버튼은
                // 비활성으로 두되(`disabled`), 문구는 조회가 끝난 뒤에만 실제 상태를 말한다.
                label={isHospitalLoading ? '상담 신청' : hospital?.consultAvailable ? '상담 신청' : '상담 마감'}
                disabled={isHospitalLoading || !hospital || !hospital.consultAvailable}
                onPress={() =>
                  hospital &&
                  requireAuth(() => router.push(`/consult/${hospital.id}`), `/consult/${hospital.id}`)
                }
              />
            </View>
          </SafeAreaView>
        </View>
      )}
    </QueryState>
  );
}
