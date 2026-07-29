import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StockImage } from '@/components/StockImage';
import { getProcedureById } from '@/data/procedures';
import { getPromotionByHospital } from '@/data/promotions';
import { getReviewsByHospital } from '@/data/reviews';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useDoctorStore } from '@/store/useDoctorStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useHospitalStore } from '@/store/useHospitalStore';
import { calcDiscountRate, formatPriceRange, formatWon } from '@/utils/format';
import { getVisibleSpecialtyLabel, isVerifiedSpecialist } from '@/utils/specialty';
import { isSponsorshipActive } from '@/utils/sponsorship';

export default function HospitalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hospital = useHospitalStore((state) => state.hospitals.find((item) => item.id === id));
  const doctors = useDoctorStore((state) => state.doctors.filter((doctor) => doctor.hospitalId === id));
  const reviews = getReviewsByHospital(id);
  const promotion = getPromotionByHospital(id);
  const isFavorite = useFavoritesStore((state) => state.isFavorite(id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const requireAuth = useRequireAuth();

  if (!hospital) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">병원 정보를 찾을 수 없어요</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: hospital.name }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled>
          {hospital.images.map((uri) => (
            <StockImage
              key={uri}
              uri={uri}
              alt={`${hospital.name} 병원 사진`}
              style={{ width: 400, height: 240 }}
              contentFit="cover"
            />
          ))}
        </ScrollView>

        <View className="px-5 pt-4">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="flex-1 text-xl font-extrabold text-neutral-900">{hospital.name}</Text>
            <Text className="text-sm text-neutral-500">
              ★ {hospital.rating.toFixed(1)} ({hospital.reviewCount})
            </Text>
          </View>
          <Text className="mb-3 text-sm text-neutral-500">{hospital.address}</Text>

          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {hospital.tags.map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
          </View>

          {promotion ? (
            <View className="mb-4 rounded-2xl bg-rose-50 p-4">
              <View className="mb-1 flex-row items-center gap-1.5">
                <Badge label={`🔥 ${promotion.badge}`} tone="brand" />
                <Text className="text-sm font-semibold text-neutral-600">{promotion.title}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-extrabold text-rose-500">
                  {calcDiscountRate(promotion.originalPrice, promotion.salePrice)}%
                </Text>
                <Text className="text-lg font-extrabold text-neutral-900">
                  {formatWon(promotion.salePrice)}
                </Text>
                <Text className="text-sm text-neutral-400 line-through">
                  {formatWon(promotion.originalPrice)}
                </Text>
              </View>
            </View>
          ) : (
            <View className="mb-4 rounded-2xl bg-neutral-50 p-4">
              <Text className="mb-1 text-sm font-semibold text-neutral-500">가격대</Text>
              <Text className="text-base font-bold text-neutral-900">
                {formatPriceRange(hospital.priceRange.min, hospital.priceRange.max)}
              </Text>
            </View>
          )}

          <Text className="mb-2 text-base font-bold text-neutral-900">대표 시술</Text>
          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {hospital.procedureIds.map((procedureId) => {
              const procedure = getProcedureById(procedureId);
              return procedure ? <Badge key={procedureId} label={procedure.name} tone="brand" /> : null;
            })}
          </View>

          <Text className="mb-2 text-base font-bold text-neutral-900">병원 특징</Text>
          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {hospital.isRecommended ? <Badge label="🌟 추천 병원" tone="brand" /> : null}
            {hospital.isOneDay ? (
              <Badge label="⚡ 원데이 진료 가능" tone="brand" />
            ) : (
              <Badge label="원데이 진료 불가" />
            )}
            {hospital.consultAvailable ? <Badge label="실시간 상담 가능" tone="brand" /> : null}
            {isSponsorshipActive(hospital) ? <Badge label="광고" /> : null}
          </View>

          <Text className="mb-2 text-base font-bold text-neutral-900">전문의 소개</Text>
          {doctors.length === 0 ? (
            <Text className="mb-4 text-sm text-neutral-400">등록된 의료진 정보가 없어요</Text>
          ) : (
            <View className="mb-4">
              {doctors.map((doctor) => {
                const visibleSpecialty = getVisibleSpecialtyLabel(doctor);
                return (
                  <View
                    key={doctor.id}
                    className="mb-2 flex-row items-center gap-3 rounded-xl border border-neutral-100 p-3"
                  >
                    <StockImage
                      uri={doctor.photo}
                      alt={`${doctor.name} ${doctor.title} 프로필 사진`}
                      style={{ width: 56, height: 56 }}
                      borderRadius={28}
                      contentFit="cover"
                    />
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-sm font-bold text-neutral-900">
                          {doctor.name} {doctor.title}
                        </Text>
                        {isVerifiedSpecialist(doctor) ? <Badge label="전문의" tone="brand" /> : null}
                      </View>
                      {visibleSpecialty ? (
                        <Text className="text-xs text-neutral-500">{visibleSpecialty}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <Text className="mb-2 text-base font-bold text-neutral-900">병원 소개</Text>
          <Text className="mb-4 text-sm leading-5 text-neutral-600">{hospital.introduction}</Text>

          {hospital.events.length > 0 ? (
            <View className="mb-4">
              <Text className="mb-2 text-base font-bold text-neutral-900">진행중인 이벤트</Text>
              {hospital.events.map((event) => (
                <Text key={event} className="text-sm text-brand-700">
                  🎁 {event}
                </Text>
              ))}
            </View>
          ) : null}

          <Text className="mb-2 text-base font-bold text-neutral-900">
            방문자 후기 {reviews.length > 0 ? `(${reviews.length})` : ''}
          </Text>
          {reviews.length === 0 ? (
            <Text className="mb-4 text-sm text-neutral-400">아직 등록된 후기가 없어요</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} className="mb-3 rounded-xl border border-neutral-100 p-3">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-neutral-800">{review.authorName}</Text>
                  <Text className="text-xs text-neutral-400">{review.createdAt}</Text>
                </View>
                <Text className="mb-1 text-xs text-amber-500">{'★'.repeat(review.rating)}</Text>
                <Text className="mb-2 text-sm leading-5 text-neutral-600">{review.content}</Text>
                {review.photos && review.photos.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {review.photos.map((uri) => (
                      <StockImage
                        key={uri}
                        uri={uri}
                        alt="후기 사진"
                        style={{ width: 88, height: 88, marginRight: 8 }}
                        borderRadius={12}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ))
          )}

          <View className="h-24" />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} className="border-t border-neutral-100 bg-white px-5 pt-3">
        <View className="flex-row items-center gap-3 pb-3">
          <Pressable
            onPress={() => requireAuth(() => toggleFavorite(hospital.id))}
            className="h-14 w-14 items-center justify-center rounded-xl border border-neutral-200"
          >
            <Text className="text-xl">{isFavorite ? '❤️' : '🤍'}</Text>
          </Pressable>
          <View className="flex-1">
            <PrimaryButton
              label={hospital.consultAvailable ? '상담 신청하기' : '상담 마감'}
              disabled={!hospital.consultAvailable}
              onPress={() =>
                requireAuth(() => router.push(`/consult/${hospital.id}`), `/consult/${hospital.id}`)
              }
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
