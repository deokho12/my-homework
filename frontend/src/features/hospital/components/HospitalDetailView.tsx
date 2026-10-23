import { CONTAINER_PADDING } from '@/components/layout/Container';
import * as Clipboard from '@/lib/clipboard';
import { router, Stack, useLocalSearchParams } from '@/navigation';
import { ChevronDown, ChevronUp, Copy, Gift, MapPin, X, Zap } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { KakaoMap } from '@/components/map/KakaoMap';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QueryState } from '@/components/QueryState';
import { StockImage } from '@/components/StockImage';
import { useHospitalDoctors } from '@/features/doctor';
import { FavoriteHeartButton } from '@/features/favorite';
import {
  HospitalDetailTabs,
  hospitalPanelId,
  hospitalTabId,
  type HospitalDetailTabKey,
} from '@/features/hospital/components/HospitalDetailTabs';
import { HospitalSummaryCards } from '@/features/hospital/components/HospitalSummaryCards';
import { HospitalSummaryLine } from '@/features/hospital/components/HospitalSummaryLine';
import { PromoBadge } from '@/components/PromoBadge';
import { RecommendedBadge } from '@/components/RecommendedBadge';
import { readTodayHours } from '@/features/hospital/lib/businessHours';
import { HospitalInquirySection } from '@/features/inquiry';
import { groupProcedureIdsByCategory } from '@/features/procedure';
import { useHospitalReviews } from '@/features/review';
import { getPromotionByHospital } from '@/mocks/fixtures/promotions';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { Hospital, HospitalFeatures } from '@/types/domain';
import { showAlert } from '@/utils/alert';
import { calcDiscountRate, formatPriceRange, formatWon } from '@/utils/format';

/** 섹션 제목. 탭 라벨이 이미 큰 제목 노릇을 하므로 안쪽은 한 단계 작게 적는다. */
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-base font-bold text-neutral-900">{children}</h2>;
}

const EMPTY_FEATURES: HospitalFeatures = {
  coordinator: false,
  painlessAnesthesia: false,
  digitalCare: false,
  parking: false,
  nightConsult: false,
  cctv: false,
};

/** 점프 뒤 포커스를 섹션 제목으로 옮긴다 — 키보드·스크린 리더에서 "어디로 갔는지" 가 남는다. */
function jumpTo(id: string): void {
  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  document.getElementById(`${id}-h`)?.focus({ preventScroll: true });
}

/**
 * 이미 로드된 병원 하나를 렌더한다. 병원 자체의 조회(로딩/에러/없음)는 `HospitalDetailPage`
 * 가 맡는다 — 페이지에서 분리한 이유는 `QueryState` 의 `children` 이 콜백이라 그 안에서는
 * 훅을 호출할 수 없기 때문이다(`useHospitalDoctors`/`useHospitalReviews` 처럼 로드된 병원의
 * id 에 의존하는 훅이 여기서 필요해진다).
 *
 * 화면 구성은 2026-10-23 시안 B 다 — 사진 아래 요약 카드 2×2 로 "지금 문 열었나 · 얼마나
 * 드나" 를 먼저 답하고, 나머지는 **탭 4개로 한 번에 한 섹션만** 보여준다. 다른 탭에서는
 * 요약이 한 줄로 접힌다.
 *
 * 전문의·후기는 각자 자기 섹션 안에서 독립적으로 로딩/에러/빈 상태를 갖는다 — 하나가
 * 실패해도 병원 본문과 다른 섹션은 그대로 보인다.
 */
export function HospitalDetailView({ hospital }: { hospital: Hospital }) {
  const doctorsQuery = useHospitalDoctors(hospital.id);
  const reviewsQuery = useHospitalReviews(hospital.id);
  const procedureGroups = groupProcedureIdsByCategory(hospital.procedureIds);
  const promotion = getPromotionByHospital(hospital.id);
  const requireAuth = useRequireAuth();

  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  /**
   * 마이페이지 `내 문의` 에서 `?section=inquiry` 로 들어오면 문의가 있는 탭에서 시작한다.
   * 탭이 생기기 전에는 그냥 스크롤이면 됐지만, 지금은 그 탭이 열려 있어야 섹션이 존재한다.
   */
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState<HospitalDetailTabKey>(section === 'inquiry' ? 'reviews' : 'info');

  // Fall back gracefully while businessHours/features/directions are still being backfilled onto the
  // mock data (see developer note) — these are required fields on the Hospital type, but not every
  // seed entry has them populated yet.
  const businessHours = hospital.businessHours ?? [];
  const features = hospital.features ?? EMPTY_FEATURES;
  const hasAnyFeature = hospital.isOneDay || Object.values(features).some(Boolean);

  // `진료중` 판정은 순수 함수 하나(`readTodayHours`)가 한다 — 요약 카드·접힌 줄·진료시간
  // 목록의 오늘 강조가 전부 이 결과를 쓴다.
  const today = readTodayHours(businessHours, new Date());
  const collapsedEntry = today.entry ?? businessHours[0];
  const discountRate = promotion ? calcDiscountRate(promotion.originalPrice, promotion.salePrice) : null;

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(hospital.address);
    showAlert('주소가 복사되었어요');
  };

  /**
   * **위쪽 영역(전문의·후기)이 도착한 뒤에** 한 번만 움직인다. 마운트 직후에 움직이면 그 둘이
   * 늦게 그려지며 페이지가 길어져, 문의 섹션이 화면 아래로 1000px 넘게 밀려난다 (2026-10-12 QA).
   * 한 번 움직인 뒤에는 다시 움직이지 않는다 — 사용자가 다른 데로 스크롤했는데 되돌리면 안 된다.
   */
  const pendingInquiryJumpRef = useRef(section === 'inquiry');
  const sectionsAboveSettled = !doctorsQuery.isLoading && !reviewsQuery.isLoading;

  useEffect(() => {
    if (!pendingInquiryJumpRef.current || !sectionsAboveSettled) return;
    pendingInquiryJumpRef.current = false;
    // 방금 도착한 목록이 그려진 다음 프레임에 잰다 — 같은 프레임에서는 높이가 아직 옛 값이다.
    const frame = requestAnimationFrame(() => jumpTo('hospital-inquiry'));
    return () => cancelAnimationFrame(frame);
  }, [sectionsAboveSettled]);

  const promotionBanner = promotion ? (
    <View className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <View className="mb-1.5 flex-row items-center gap-1.5">
        <PromoBadge label={promotion.badge} />
        <Text className="flex-1 text-sm font-semibold text-neutral-700">{promotion.title}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-lg font-extrabold text-rose-500">{discountRate}%</Text>
        <Text className="text-lg font-extrabold text-neutral-900">{formatWon(promotion.salePrice)}</Text>
        <Text className="text-sm text-neutral-500 line-through">{formatWon(promotion.originalPrice)}</Text>
      </View>
    </View>
  ) : null;

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
          <View className="mb-1 flex-row items-start justify-between gap-2">
            <h1 className="flex-1 text-xl font-extrabold text-neutral-900">{hospital.name}</h1>
            {hospital.isRecommended ? <RecommendedBadge label="추천 병원" /> : null}
          </View>
          {/* 주소만 적는다 — `강남역 3분` 같은 거리 문구는 서버에 없는 값이다 (시안 검토 결정). */}
          <Text className="mb-3 text-sm text-neutral-500">{hospital.address}</Text>

          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {hospital.tags.map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
            {hospital.sponsorship.isActive ? <Badge label="광고" /> : null}
          </View>

          {tab === 'info' ? (
            <>
              {/* 할인율은 바로 아래 배너가 말한다 — 같은 값을 두 번 적지 않는다. */}
              <HospitalSummaryCards
                today={today}
                priceRange={hospital.priceRange}
                doctors={doctorsQuery.data}
                doctorsLoading={doctorsQuery.isLoading}
                doctorsError={doctorsQuery.isError}
                rating={hospital.rating}
                reviewCount={hospital.reviewCount}
              />
              {promotionBanner}
            </>
          ) : (
            <HospitalSummaryLine
              today={today}
              priceRange={hospital.priceRange}
              rating={hospital.rating}
              reviewCount={hospital.reviewCount}
            />
          )}

          <HospitalDetailTabs value={tab} onChange={setTab} />

          <div
            id={hospitalPanelId(tab)}
            role="tabpanel"
            aria-labelledby={hospitalTabId(tab)}
            tabIndex={0}
            className="pt-5 outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            {tab === 'info' ? (
              <>
                <SectionTitle>진료시간</SectionTitle>
                <View className="mb-4 rounded-2xl border border-neutral-100 p-4">
                  {businessHours.length === 0 ? (
                    <Text className="text-sm text-neutral-500">등록된 진료시간 정보가 없어요</Text>
                  ) : !hoursExpanded ? (
                    <Pressable
                      onPress={() => setHoursExpanded(true)}
                      className="flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-2">
                        {today.entry ? <Badge label="오늘" tone="brand" /> : null}
                        <Text className="text-sm text-neutral-700">{collapsedEntry?.day}</Text>
                        <Text className="text-sm font-semibold text-neutral-900">
                          {collapsedEntry?.isClosed ? '휴무' : collapsedEntry?.hours}
                        </Text>
                      </View>
                      <ChevronDown size={18} color="#737373" />
                    </Pressable>
                  ) : (
                    <View>
                      {businessHours.map((entry) => {
                        const isToday = entry.day === today.entry?.day;
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

                <SectionTitle>위치</SectionTitle>
                <View className="mb-4 rounded-2xl border border-neutral-100 p-4">
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
                    <SectionTitle>찾아오시는 길</SectionTitle>
                    <Text className="text-sm leading-5 text-neutral-600">{hospital.directions}</Text>
                  </View>
                ) : null}

                <SectionTitle>병원 소개</SectionTitle>
                <Text className="mb-4 text-sm leading-5 text-neutral-600">{hospital.introduction}</Text>

                <SectionTitle>병원 특징</SectionTitle>
                <View className="mb-4 flex-row flex-wrap gap-1.5">
                  {hospital.isOneDay ? <Badge label="원데이가능" icon={Zap} tone="brand" /> : null}
                  {features.coordinator ? <Badge label="전담코디네이터" /> : null}
                  {features.painlessAnesthesia ? <Badge label="무통마취" /> : null}
                  {features.digitalCare ? <Badge label="디지털진료" /> : null}
                  {features.parking ? <Badge label="주차가능" /> : null}
                  {features.nightConsult ? <Badge label="야간상담" /> : null}
                  {features.cctv ? <Badge label="CCTV설치" /> : null}
                  {!hasAnyFeature ? (
                    <Text className="text-sm text-neutral-500">등록된 병원 특징이 없어요</Text>
                  ) : null}
                </View>
              </>
            ) : null}

            {tab === 'price' ? (
              <>
                {/* 할인 배너는 `정보` 탭에만 있다 — 이 탭에서는 가격대를 여기서 적는다. */}
                <View className="mb-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                  <Text className="mb-1 text-sm font-semibold text-neutral-500">가격대</Text>
                  <Text className="text-base font-bold text-neutral-900">
                    {hospital.priceRange.max > 0
                      ? formatPriceRange(hospital.priceRange.min, hospital.priceRange.max)
                      : '등록된 가격 정보가 없어요'}
                  </Text>
                </View>

                <SectionTitle>대표 시술</SectionTitle>
                {/*
                  평면 배지 줄이면 "임플란트·라미네이트·보톡스" 가 한 뭉치로 보여 이 병원의 **진료
                  범위**가 안 드러난다. 대분류로 묶으면 세 분야를 한다는 사실이 먼저 읽힌다.
                  모르는 서버 id 는 `groupProcedureIdsByCategory` 가 조용히 빼므로, 전부 모르는
                  id 거나 `procedureIds: []` 면 그룹이 0개다 — 그때 아무것도 안 그리면 섹션
                  제목만 덩그러니 남는다.
                */}
                {procedureGroups.length === 0 ? (
                  <Text className="mb-4 text-sm text-neutral-500">등록된 시술 정보가 없어요</Text>
                ) : (
                  <View className="mb-4">
                    {procedureGroups.map(({ category, subs }) => (
                      <View key={category.id} className="mb-2.5">
                        <Text className="mb-1.5 text-xs font-semibold text-neutral-500">{category.name}</Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {subs.map((sub) => (
                            <Badge key={sub.id} label={sub.name} tone="brand" />
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {promotion || hospital.events.length > 0 ? (
                  <View className="mb-4">
                    <SectionTitle>진행중인 이벤트</SectionTitle>
                    {promotionBanner}
                    {hospital.events.map((event) => (
                      <View key={event} className="mb-1.5 flex-row items-start gap-1.5">
                        <Gift size={18} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />
                        <Text className="flex-1 text-sm text-brand-700">{event}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {tab === 'doctors' ? (
              <>
                <SectionTitle>전문의 소개</SectionTitle>
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
                          className="mb-2 flex-row items-center gap-3 rounded-2xl border border-neutral-100 p-4"
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
                              <Text className="text-base font-bold text-neutral-900">
                                {doctor.name} {doctor.title}
                              </Text>
                              {doctor.isVerifiedSpecialist ? <Badge label="전문의" tone="brand" /> : null}
                            </View>
                            {doctor.visibleSpecialty ? (
                              <Text className="text-[13px] text-neutral-500">{doctor.visibleSpecialty}</Text>
                            ) : null}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </QueryState>
              </>
            ) : null}

            {tab === 'reviews' ? (
              <>
                <SectionTitle>
                  방문자 후기{' '}
                  {reviewsQuery.data && reviewsQuery.data.meta.totalItems > 0
                    ? `(${reviewsQuery.data.meta.totalItems})`
                    : ''}
                </SectionTitle>
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
                            <Text className="text-xs text-neutral-500">{review.createdAt}</Text>
                          </View>
                          {/* 별점 ★ 은 amber 를 쓴다 (`docs/conventions/frontend.md` 의 예외). */}
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

                <section
                  id="hospital-inquiry"
                  aria-labelledby="hospital-inquiry-h"
                  className="scroll-mt-14 mt-6 border-t border-neutral-100 pt-5"
                >
                  <HospitalInquirySection hospitalId={hospital.id} />
                </section>
              </>
            ) : null}
          </div>

          <View className="h-28" />
        </View>
      </ScrollView>

      {/*
        하단 고정 바는 찜 + 상담신청 둘뿐이다 (시안 B). 예전의 `전문의 상담신청` 은 뺐다 —
        같은 상담 신청 화면으로 가면서 어느 전문의인지 전달하지 못해(계약에 `doctorId` 가
        없다) 두 버튼이 똑같이 동작했다. 전문의 지정 상담은 CONSULT-1 의 몫이다.
      */}
      <SafeAreaView edges={['bottom']} className={cx(CONTAINER_PADDING, 'border-t border-neutral-100 bg-white pt-3')}>
        <View className="flex-row items-center gap-2 pb-3">
          <FavoriteHeartButton hospitalId={hospital.id} hospitalName={hospital.name} size="bar" />
          <View className="flex-1">
            <PrimaryButton
              label={hospital.consultAvailable ? '병원 상담신청' : '상담 마감'}
              disabled={!hospital.consultAvailable}
              onPress={() =>
                requireAuth(() => router.push(`/consult/${hospital.id}`), `/consult/${hospital.id}`)
              }
            />
          </View>
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
