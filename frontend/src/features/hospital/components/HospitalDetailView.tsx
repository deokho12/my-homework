import { CONTAINER_PADDING } from '@/components/layout/Container';
import * as Clipboard from '@/lib/clipboard';
import { router, Stack } from '@/navigation';
import { ChevronDown, ChevronUp, Copy, MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { KakaoMap } from '@/components/map/KakaoMap';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QueryState } from '@/components/QueryState';
import { StockImage } from '@/components/StockImage';
import { useHospitalDoctors } from '@/features/doctor';
import { useProcedureMap } from '@/features/procedure';
import { useHospitalReviews } from '@/features/review';
import { getPromotionByHospital } from '@/mocks/fixtures/promotions';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import type { Hospital, HospitalFeatures } from '@/types/domain';
import { showAlert } from '@/utils/alert';
import { calcDiscountRate, formatPriceRange, formatWon } from '@/utils/format';

const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const EMPTY_FEATURES: HospitalFeatures = {
  coordinator: false,
  painlessAnesthesia: false,
  digitalCare: false,
  parking: false,
  nightConsult: false,
  cctv: false,
};

/**
 * 이미 로드된 병원 하나를 렌더한다. 병원 자체의 조회(로딩/에러/없음)는 `HospitalDetailPage`
 * 가 맡는다 — 페이지에서 분리한 이유는 `QueryState` 의 `children` 이 콜백이라 그 안에서는
 * 훅을 호출할 수 없기 때문이다(`useHospitalDoctors`/`useHospitalReviews` 처럼 로드된 병원의
 * id 에 의존하는 훅이 여기서 필요해진다).
 *
 * 전문의·후기는 각자 자기 섹션 안에서 독립적으로 로딩/에러/빈 상태를 갖는다 — 하나가
 * 실패해도 병원 본문과 다른 섹션은 그대로 보인다.
 */
export function HospitalDetailView({ hospital }: { hospital: Hospital }) {
  const doctorsQuery = useHospitalDoctors(hospital.id);
  const reviewsQuery = useHospitalReviews(hospital.id);
  const procedureMap = useProcedureMap();
  const promotion = getPromotionByHospital(hospital.id);
  const isFavorite = useFavoritesStore((state) => state.isFavorite(hospital.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const requireAuth = useRequireAuth();

  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

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

  // 로딩 중에는 "전문의가 없다"고 단정하지 않는다 — 버튼은 목록이 실제로 도착해 1명
  // 이상일 때만 나타난다(늦게 나타나는 것과 없다고 주장하는 것은 다른 사실이다).
  const hasAnyDoctor = (doctorsQuery.data?.length ?? 0) > 0;

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

        <View className={cx(CONTAINER_PADDING, 'pt-4')}>
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
            {hospital.sponsorship.isActive ? <Badge label="광고" /> : null}
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
              const procedure = procedureMap.get(procedureId);
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
          <QueryState
            isLoading={doctorsQuery.isLoading}
            isError={doctorsQuery.isError}
            data={doctorsQuery.data}
            onRetry={() => {
              void doctorsQuery.refetch();
            }}
            isRetrying={doctorsQuery.isError && doctorsQuery.isFetching}
            emptyState={{ title: '등록된 의료진 정보가 없어요', variant: 'inline' }}
            errorState={{ variant: 'inline' }}
            className="mb-4"
          >
            {(doctors) => (
              <View className="mb-4">
                {doctors.map((doctor) => (
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
                        {doctor.isVerifiedSpecialist ? <Badge label="전문의" tone="brand" /> : null}
                      </View>
                      {doctor.visibleSpecialty ? (
                        <Text className="text-xs text-neutral-500">{doctor.visibleSpecialty}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </QueryState>

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
            방문자 후기 {reviewsQuery.data && reviewsQuery.data.meta.totalItems > 0 ? `(${reviewsQuery.data.meta.totalItems})` : ''}
          </Text>
          <QueryState
            isLoading={reviewsQuery.isLoading}
            isError={reviewsQuery.isError}
            data={reviewsQuery.data?.items}
            onRetry={() => {
              void reviewsQuery.refetch();
            }}
            isRetrying={reviewsQuery.isError && reviewsQuery.isFetching}
            emptyState={{ title: '아직 등록된 후기가 없어요', variant: 'inline' }}
            errorState={{ variant: 'inline' }}
            className="mb-4"
          >
            {(reviews) => (
              <>
                {reviews.map((review) => (
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
                ))}
              </>
            )}
          </QueryState>

          <View className="h-24" />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} className={cx(CONTAINER_PADDING, 'border-t border-neutral-100 bg-white pt-3')}>
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
          {hasAnyDoctor ? (
            <View className="flex-1">
              <PrimaryButton
                variant="outline"
                label="전문의 상담신청"
                disabled={!hospital.consultAvailable}
                onPress={() =>
                  // Consult form is hospital-scoped — routes to the same request flow as the hospital
                  // CTA. TODO(developer): prefill the message with the selected doctor's name if the
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
          <View className={cx(CONTAINER_PADDING, 'flex-row items-center justify-between border-b border-neutral-100 py-3')}>
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
