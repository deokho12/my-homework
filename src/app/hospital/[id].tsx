import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, Copy, MapPin, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { KakaoMap } from '@/components/map/KakaoMap';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StockImage } from '@/components/StockImage';
import { getProcedureById } from '@/data/procedures';
import { getPromotionByHospital } from '@/data/promotions';
import { getReviewsByHospital } from '@/data/reviews';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useDoctorStore } from '@/store/useDoctorStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useHospitalStore } from '@/store/useHospitalStore';
import type { HospitalFeatures } from '@/types/domain';
import { showAlert } from '@/utils/alert';
import { calcDiscountRate, formatPriceRange, formatWon } from '@/utils/format';
import { getRepresentativeSpecialist, getVisibleSpecialtyLabel, isVerifiedSpecialist } from '@/utils/specialty';
import { isSponsorshipActive } from '@/utils/sponsorship';

const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const EMPTY_FEATURES: HospitalFeatures = {
  coordinator: false,
  painlessAnesthesia: false,
  digitalCare: false,
  parking: false,
  nightConsult: false,
  cctv: false,
};

export default function HospitalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hospital = useHospitalStore((state) => state.hospitals.find((item) => item.id === id));
  const doctors = useDoctorStore((state) => state.doctors.filter((doctor) => doctor.hospitalId === id));
  const reviews = getReviewsByHospital(id);
  const promotion = getPromotionByHospital(id);
  const isFavorite = useFavoritesStore((state) => state.isFavorite(id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const requireAuth = useRequireAuth();

  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  if (!hospital) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">병원 정보를 찾을 수 없어요</Text>
      </SafeAreaView>
    );
  }

  // Fall back gracefully while businessHours/features/directions are still being backfilled onto the
  // mock data (see developer note) — these are required fields on the Hospital type, but not every
  // seed entry has them populated yet.
  const businessHours = hospital.businessHours ?? [];
  const features = hospital.features ?? EMPTY_FEATURES;
  const hasAnyFeature = hospital.isOneDay || Object.values(features).some(Boolean);

  const todayLabel = WEEKDAY_LABELS[new Date().getDay()];
  const todayShort = todayLabel[0];
  // Assumes each businessHours entry's `day` starts with the weekday, e.g. "월" or "월요일".
  const todayEntry = businessHours.find((entry) => entry.day.startsWith(todayShort)) ?? businessHours[0];

  const representativeDoctor = getRepresentativeSpecialist(doctors) ?? doctors[0] ?? null;

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(hospital.address);
    showAlert('주소가 복사되었어요');
  };

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

          <View className="mb-1.5 flex-row flex-wrap gap-1.5">
            {hospital.tags.map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
          </View>
          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {hospital.isRecommended ? <Badge label="🌟 추천 병원" tone="brand" /> : null}
            {isSponsorshipActive(hospital) ? <Badge label="광고" /> : null}
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

          <Text className="mb-2 text-base font-bold text-neutral-900">진료시간</Text>
          <View className="mb-4 rounded-2xl border border-neutral-100 p-4">
            {businessHours.length === 0 ? (
              <Text className="text-sm text-neutral-400">등록된 진료시간 정보가 없어요</Text>
            ) : !hoursExpanded ? (
              <Pressable
                onPress={() => setHoursExpanded(true)}
                className="flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-2">
                  <Badge label="오늘" tone="brand" />
                  <Text className="text-sm text-neutral-700">{todayEntry?.day}</Text>
                  <Text className="text-sm font-semibold text-neutral-900">
                    {todayEntry?.isClosed ? '휴무' : todayEntry?.hours}
                  </Text>
                </View>
                <ChevronDown size={18} color="#737373" />
              </Pressable>
            ) : (
              <View>
                {businessHours.map((entry) => {
                  const isToday = entry.day === todayEntry?.day;
                  return (
                    <View key={entry.day} className="mb-1.5 flex-row items-center justify-between">
                      <Text className={`text-sm ${isToday ? 'font-bold text-brand-700' : 'text-neutral-600'}`}>
                        {entry.day}
                      </Text>
                      <Text className={`text-sm ${isToday ? 'font-bold text-brand-700' : 'text-neutral-600'}`}>
                        {entry.isClosed ? '휴무' : entry.hours}
                      </Text>
                    </View>
                  );
                })}
                <Pressable
                  onPress={() => setHoursExpanded(false)}
                  className="mt-1 flex-row items-center justify-center gap-1 pt-2"
                >
                  <Text className="text-sm font-semibold text-brand-700">접기</Text>
                  <ChevronUp size={16} color="#166863" />
                </Pressable>
              </View>
            )}
          </View>

          <Text className="mb-2 text-base font-bold text-neutral-900">위치</Text>
          <View className="mb-2 rounded-2xl border border-neutral-100 p-4">
            <Text className="mb-3 text-sm leading-5 text-neutral-600">{hospital.address}</Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleCopyAddress}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-neutral-200 py-2.5"
              >
                <Copy size={15} color="#525252" />
                <Text className="text-sm font-semibold text-neutral-600">주소복사</Text>
              </Pressable>
              <Pressable
                onPress={() => setMapVisible(true)}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-50 py-2.5"
              >
                <MapPin size={15} color="#166863" />
                <Text className="text-sm font-semibold text-brand-700">지도보기</Text>
              </Pressable>
            </View>
          </View>

          {hospital.directions ? (
            <View className="mb-4">
              <Text className="mb-2 text-base font-bold text-neutral-900">찾아오시는 길</Text>
              <Text className="text-sm leading-5 text-neutral-600">{hospital.directions}</Text>
            </View>
          ) : null}

          <Text className="mb-2 text-base font-bold text-neutral-900">병원 소개</Text>
          <Text className="mb-4 text-sm leading-5 text-neutral-600">{hospital.introduction}</Text>

          <Text className="mb-2 text-base font-bold text-neutral-900">병원 특징</Text>
          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {hospital.isOneDay ? <Badge label="⚡ 원데이가능" tone="brand" /> : null}
            {features.coordinator ? <Badge label="전담코디네이터" /> : null}
            {features.painlessAnesthesia ? <Badge label="무통마취" /> : null}
            {features.digitalCare ? <Badge label="디지털진료" /> : null}
            {features.parking ? <Badge label="주차가능" /> : null}
            {features.nightConsult ? <Badge label="야간상담" /> : null}
            {features.cctv ? <Badge label="CCTV설치" /> : null}
            {!hasAnyFeature ? <Text className="text-sm text-neutral-400">등록된 병원 특징이 없어요</Text> : null}
          </View>

          <Text className="mb-2 text-base font-bold text-neutral-900">전문의 소개</Text>
          {doctors.length === 0 ? (
            <Text className="mb-4 text-sm text-neutral-400">등록된 의료진 정보가 없어요</Text>
          ) : (
            <View className="mb-4">
              {doctors.map((doctor) => {
                const visibleSpecialty = getVisibleSpecialtyLabel(doctor);
                return (
                  <Pressable
                    key={doctor.id}
                    onPress={() => router.push(`/doctor/${doctor.id}`)}
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
                  </Pressable>
                );
              })}
            </View>
          )}

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
        <View className="flex-row items-center gap-2 pb-3">
          <Pressable
            onPress={() => requireAuth(() => toggleFavorite(hospital.id))}
            className="h-14 w-14 items-center justify-center rounded-xl border border-neutral-200"
          >
            <Text className="text-xl">{isFavorite ? '❤️' : '🤍'}</Text>
          </Pressable>
          <View className="flex-1">
            <PrimaryButton
              label={hospital.consultAvailable ? '병원 상담신청' : '상담 마감'}
              disabled={!hospital.consultAvailable}
              onPress={() =>
                requireAuth(() => router.push(`/consult/${hospital.id}`), `/consult/${hospital.id}`)
              }
            />
          </View>
          {representativeDoctor ? (
            <View className="flex-1">
              <PrimaryButton
                variant="outline"
                label="전문의 상담신청"
                disabled={!hospital.consultAvailable}
                onPress={() =>
                  // Consult form is hospital-scoped — routes to the same request flow as the hospital
                  // CTA. TODO(developer): prefill the message with representativeDoctor's name if the
                  // consult form gains a doctor field.
                  requireAuth(() => router.push(`/consult/${hospital.id}`), `/consult/${hospital.id}`)
                }
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <Modal visible={mapVisible} animationType="slide" onRequestClose={() => setMapVisible(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between border-b border-neutral-100 px-5 py-3">
            <Text className="text-base font-bold text-neutral-900">{hospital.name} 위치</Text>
            <Pressable onPress={() => setMapVisible(false)} hitSlop={8}>
              <X size={22} color="#171717" />
            </Pressable>
          </View>
          <KakaoMap
            center={{ latitude: hospital.latitude, longitude: hospital.longitude }}
            markers={[
              { id: hospital.id, latitude: hospital.latitude, longitude: hospital.longitude, label: hospital.name },
            ]}
            onMarkerPress={() => {}}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
