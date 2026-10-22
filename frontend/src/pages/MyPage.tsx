import { ChevronRight, ClipboardList, Heart, MessageCircleQuestion } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { router, useFocusEffect } from '@/navigation';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { Pressable, SafeAreaView, ScrollView, Text, View, cx } from '@/primitives';

import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QueryState } from '@/components/QueryState';
import { containerClass } from '@/components/layout/Container';
import { useSession } from '@/features/auth/hooks/useSession';
import {
  CONSULT_STATUS_TONE,
  consultProcedureLabel,
  consultScheduleLine,
  useMyConsultRequests,
  type MyConsultRequest,
} from '@/features/consult';
import { useFavorites } from '@/features/favorite';
import { MyInquiryRow, useMyInquiries } from '@/features/inquiry';
import { useHospital } from '@/features/hospital';
import { HospitalCard } from '@/features/hospital/components/HospitalCard';
import { useUnreadNotificationCount } from '@/features/notification';
import { useAuthStore } from '@/store/useAuthStore';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';
import { CONSULT_STATUS_LABEL, type User } from '@/types/domain';
import { showAlert } from '@/utils/alert';

const SCROLL_SHADOW_THRESHOLD = 8;

/**
 * 관리자 상담 목록과 같은 상한. 페이지네이션 UI 가 없어 한 번에 받는다 —
 * 101번째부터 조용히 잘린다 (`docs/features/known-issues.md`).
 */
const MY_CONSULTS_PAGE_SIZE = 100;

/** 내 문의도 같은 상한을 쓴다 — 페이지네이션 UI 가 없어 한 번에 받는다. */
const MY_INQUIRIES_PAGE_SIZE = 100;

const TABS = [
  { key: 'consults', label: '상담 내역' },
  { key: 'inquiries', label: '내 문의' },
  { key: 'favorites', label: '찜' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

/* ------------------------------------------------------------------ 비로그인 / 복원 중 */

function LoginCard() {
  return (
    <View className="mb-6 rounded-2xl border border-neutral-100 bg-white p-5">
      <Text className="mb-1 text-base font-bold text-neutral-900">로그인이 필요해요</Text>
      <Text className="mb-4 text-sm text-neutral-500">
        로그인하면 찜한 병원과 상담 신청 내역을 확인할 수 있어요
      </Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <PrimaryButton label="로그인" onPress={() => router.push('/auth/login')} />
        </View>
        <View className="flex-1">
          <PrimaryButton
            label="회원가입"
            variant="outline"
            onPress={() => router.push('/auth/signup')}
          />
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ 상담 내역 패널 */

interface ConsultRowProps {
  request: MyConsultRequest;
  isLast: boolean;
  /** 알림에서 이 행을 지목하고 들어왔는가 (`?consult=`). 링으로 어느 줄인지 보여준다. */
  highlighted: boolean;
}

/**
 * 상담 내역 한 줄. 누르면 그 병원 상세로 간다 (펼침이 없는 목록이다).
 *
 * `MyInquiryRow` 처럼 `forwardRef` 인 이유는 하나다 — 상담 알림이 `?consult=` 로 지목한
 * 행에 **포커스를 줘야** 하기 때문이다 (`Pressable` 로는 DOM 노드를 잡을 수 없다).
 */
const ConsultRow = forwardRef<HTMLButtonElement, ConsultRowProps>(function ConsultRow(
  { request, isLast, highlighted },
  ref
) {
  // 모르는 시술 id 면 null — 줄 자체를 그리지 않는다 ("미지정"이라 적으면 거짓말이다).
  const procedureLabel = consultProcedureLabel(request.procedureId);
  const schedule = consultScheduleLine({
    createdAt: request.createdAt,
    preferredTime: request.preferredTime,
    // 병원이 확정한 방문 일시. 있으면 신청 보조 문구를 대체하고 강조된다
    // (`10/9(목) 14:00 방문`) — 관리자 목록 카드와 같은 함수·같은 문구다.
    visitAt: request.visitAt,
  });

  return (
    <button
      type="button"
      ref={ref}
      onClick={() => router.push(`/hospital/${request.hospitalId}`)}
      className={cx(
        // `flex flex-col` 은 줄 간격(`gap-1.5`)을 유지하려는 것이다 — 예전 `Pressable`
        // (RN 기본값이 세로 flex)에서 옮겨 오면서 세 줄이 붙어 보이지 않도록.
        'flex w-full flex-col gap-1.5 py-4 text-left',
        !isLast && 'border-b border-neutral-100',
        // 시간이 지나 사라지는 강조는 낭독기·느린 로딩에서 놓친다 — 링은 남는다.
        highlighted && 'rounded-xl ring-2 ring-brand-300'
      )}
    >
      <span className="flex flex-row items-center justify-between gap-2">
        {/* 병원 이름은 **내역 응답에 들어 있다** — 줄마다 병원을 조회하지 않는다 (요청서 15). */}
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-900">
          {request.hospitalName}
        </span>
        <span className="shrink-0">
          <Badge label={CONSULT_STATUS_LABEL[request.status]} tone={CONSULT_STATUS_TONE[request.status]} />
        </span>
      </span>
      {procedureLabel ? <span className="block text-[13px] text-neutral-600">{procedureLabel}</span> : null}
      {schedule ? (
        <span
          className={
            schedule.emphasized
              ? 'block text-sm font-semibold text-brand-700'
              : 'block text-[13px] text-neutral-500'
          }
        >
          {schedule.text}
        </span>
      ) : null}
    </button>
  );
});

/**
 * 상담 내역 목록.
 *
 * `deepLinkId` 는 상담 알림이 들고 온 상담 id 다 (`/mypage?tab=consults&consult=...`).
 * 목록에 없는 id(100건 상한 밖·남의 상담)면 **아무 일도 일어나지 않고 주소만 정리된다** —
 * `내 문의` 의 `?inquiry=` 와 같은 동작이다.
 */
function ConsultsPanel({
  query,
  deepLinkId,
  onDeepLinkHandled,
}: {
  query: ReturnType<typeof useMyConsultRequests>;
  deepLinkId: string | null;
  onDeepLinkHandled: () => void;
}) {
  // 주소에서 파라미터를 지운 뒤에도 강조는 남아야 한다 — 마지막으로 들어온 값을 붙들어 둔다.
  // 렌더 중에 맞춘다(효과가 아니라) — 포커스와 강조가 **같은 값**에서 나오게. 패널이 떠 있는
  // 채로 새 `consult=` 가 붙어도 둘이 갈리지 않는다.
  const [highlightId, setHighlightId] = useState(deepLinkId);
  if (deepLinkId !== null && deepLinkId !== highlightId) setHighlightId(deepLinkId);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const loaded = query.data !== undefined;

  useEffect(() => {
    if (deepLinkId === null || !loaded) return;

    const row = rowRefs.current[deepLinkId];
    row?.focus();
    // jsdom 에는 없는 API 라 옵셔널 호출이다.
    row?.scrollIntoView?.({ block: 'center' });
    // 파라미터는 한 번 쓰고 지운다 — 새로고침·뒤로 가기에서 같은 행이 다시 잡히지 않게.
    onDeepLinkHandled();
  }, [deepLinkId, loaded, onDeepLinkHandled]);

  return (
    <QueryState
      isLoading={query.isLoading}
      isError={query.isError}
      data={query.data}
      onRetry={() => {
        void query.refetch();
      }}
      isRetrying={query.isError && query.isFetching}
      isEmpty={(page) => page.items.length === 0}
      // 기본 `flex-1` 은 스크롤 페이지 중간에서 높이 0 으로 접힌다.
      className="min-h-[200px] justify-center"
      emptyState={{
        icon: ClipboardList,
        title: '아직 신청한 상담이 없어요',
        description: '관심 있는 병원을 찾아 상담을 신청해보세요',
        actionLabel: '병원 찾아보기',
        onAction: () => router.push('/explore'),
      }}
    >
      {(page) => (
        // 정렬은 api 가 이미 최신순이다 — 화면에서 다시 정렬하지 않는다.
        <ul>
          {page.items.map((request, index) => (
            <li key={request.id}>
              <ConsultRow
                ref={(node) => {
                  rowRefs.current[request.id] = node;
                }}
                request={request}
                isLast={index === page.items.length - 1}
                highlighted={highlightId === request.id}
              />
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  );
}

/* ------------------------------------------------------------------ 내 문의 패널 */

/**
 * 내 문의 목록. **행을 펼쳐 답변을 읽는다** — 비공개로 물은 문의의 답변을 읽을 수 있는
 * 유일한 자리라, 목록 밖으로 내보내지 않는다 (계약에 단건 조회 경로도 없다).
 *
 * `deepLinkId` 는 답변 알림이 들고 온 문의 id 다 (`/mypage?tab=inquiries&inquiry=...`).
 */
function InquiriesPanel({
  query,
  deepLinkId,
  onDeepLinkHandled,
}: {
  query: ReturnType<typeof useMyInquiries>;
  deepLinkId: string | null;
  onDeepLinkHandled: () => void;
}) {
  // 딥링크로 들어왔으면 **처음부터** 그 행이 펼쳐진 상태로 시작한다 — 렌더 뒤에 열면
  // 한 프레임 접혀 있다가 펴지고, 그 setState 가 사용자가 접어 둔 행을 되살릴 수도 있다.
  const [openId, setOpenId] = useState<string | null>(deepLinkId);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // 목록이 도착해야 그 행에 포커스를 줄 수 있다. 목록에 없는 id(상한 밖·남의 문의)면
  // 아무 일도 일어나지 않고 주소만 정리된다.
  const loaded = query.data !== undefined;

  useEffect(() => {
    if (deepLinkId === null || !loaded) return;

    rowRefs.current[deepLinkId]?.focus();
    // 파라미터는 한 번 쓰고 지운다 — 새로고침·뒤로 가기에서 같은 행이 다시 열리지 않게.
    onDeepLinkHandled();
  }, [deepLinkId, loaded, onDeepLinkHandled]);

  return (
    <QueryState
      isLoading={query.isLoading}
      isError={query.isError}
      data={query.data}
      onRetry={() => {
        void query.refetch();
      }}
      isRetrying={query.isError && query.isFetching}
      isEmpty={(page) => page.items.length === 0}
      className="min-h-[200px] justify-center"
      emptyState={{
        icon: MessageCircleQuestion,
        title: '아직 남긴 문의가 없어요',
        description: '병원 상세에서 궁금한 점을 물어보세요',
        actionLabel: '병원 찾아보기',
        onAction: () => router.push('/explore'),
      }}
    >
      {(page) => (
        <ul className="min-h-[200px] justify-center">
          {page.items.map((inquiry, index) => (
            <li key={inquiry.id}>
              <MyInquiryRow
                ref={(node) => {
                  rowRefs.current[inquiry.id] = node;
                }}
                inquiry={inquiry}
                isLast={index === page.items.length - 1}
                open={openId === inquiry.id}
                onToggle={() => setOpenId(openId === inquiry.id ? null : inquiry.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  );
}

/* ------------------------------------------------------------------ 찜 패널 */

/**
 * 찜한 병원 하나를 조회해 렌더한다 — 공개 목록 API 는 id 배열로 한 번에 묻는 필터가 없어
 * 항목마다 `useHospital` 을 부른다. 로딩 중에는 자리만 비우고(스켈레톤), 조회가 끝났는데도
 * 없으면(삭제된 병원 등) 조용히 걷어낸다.
 */
function FavoriteHospitalCard({ hospitalId }: { hospitalId: string }) {
  const { data: hospital, isLoading } = useHospital(hospitalId);

  if (isLoading) {
    return (
      <View
        className="mb-4 h-40 w-full animate-pulse rounded-2xl bg-neutral-100"
        role="status"
        accessibilityLabel="찜한 병원 정보를 불러오는 중이에요"
      />
    );
  }

  if (!hospital) return null;

  return <HospitalCard hospital={hospital} />;
}

function FavoritesPanel({ query }: { query: ReturnType<typeof useFavorites> }) {
  // 조회가 끝나기 전에는 "찜한 병원이 없다"고 단정하지 않는다 — 아직 모르는 것이다.
  // 자리 높이는 다른 패널 상태와 같게 잡아 둔다 (카드가 탭 줄까지 접혔다 펴지며 튀지 않게).
  if (query.isLoading) return <div className="min-h-[200px]" />;

  const hospitalIds = query.data?.hospitalIds ?? [];

  if (hospitalIds.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="아직 찜한 병원이 없어요"
        description="병원 카드의 하트를 눌러 찜해보세요"
        actionLabel="병원 찾아보기"
        onAction={() => router.push('/explore')}
        className="min-h-[200px]"
      />
    );
  }

  return (
    <View className="pt-3">
      {hospitalIds.map((hospitalId) => (
        <FavoriteHospitalCard key={hospitalId} hospitalId={hospitalId} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ 메뉴 */

function MenuList() {
  // 아직 모르는 동안(로딩·실패)에는 배지를 그리지 않는다 — 숫자를 지어내지 않는다.
  const { data: unread } = useUnreadNotificationCount('user');
  const unreadCount = unread?.unreadCount ?? 0;
  const logOut = useAuthStore((state) => state.logOut);

  const confirmLogout = () =>
    showAlert('로그아웃', '로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        // 서버 세션 폐기(`POST /auth/logout`)를 기다리지 않고 화면은 즉시 반응한다 —
        // 로컬 상태는 스토어가 성공·실패와 무관하게 비운다.
        onPress: () => {
          void logOut();
        },
      },
    ]);

  return (
    <View className="mb-3 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <Pressable
        onPress={() => router.push('/notifications')}
        className="min-h-[56px] flex-row items-center justify-between border-b border-neutral-100 px-4"
      >
        <Text className="text-[15px] text-neutral-800">알림함</Text>
        <View className="flex-row items-center gap-2">
          {unreadCount > 0 ? (
            <View className="min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5">
              <Text className="text-[11px] font-bold text-white">{unreadCount}</Text>
            </View>
          ) : null}
          <ChevronRight size={18} className="text-neutral-300" aria-hidden="true" />
        </View>
      </Pressable>

      {/* 준비중 줄은 Pressable 이 아니다 — 누를 수 없는 것에 포커스와 커서를 주지 않는다. */}
      {['알림 설정', '회원정보 수정'].map((label) => (
        <View
          key={label}
          className="min-h-[56px] flex-row items-center justify-between border-b border-neutral-100 px-4"
        >
          <Text className="text-[15px] text-neutral-300">{label}</Text>
          <Badge label="준비중" />
        </View>
      ))}

      <Pressable onPress={confirmLogout} className="min-h-[56px] justify-center px-4">
        <Text className="text-[15px] font-semibold text-neutral-600">로그아웃</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ 로그인한 화면 */

function SignedInView({ user, isHospitalAdmin }: { user: User; isHospitalAdmin: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  const tab: TabKey = isTabKey(raw) ? raw : 'consults';
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  const myConsults = useMyConsultRequests({ pageSize: MY_CONSULTS_PAGE_SIZE });
  const myInquiries = useMyInquiries({ pageSize: MY_INQUIRIES_PAGE_SIZE });
  const favorites = useFavorites();

  // 모르는 동안(로딩·실패)에는 숫자를 그리지 않는다 — 라벨만 남는다.
  const counts: Record<TabKey, number | null> = {
    consults: myConsults.data?.meta.totalItems ?? null,
    inquiries: myInquiries.data?.meta.totalItems ?? null,
    favorites: favorites.data?.hospitalIds.length ?? null,
  };

  // 알림이 들고 온 id 둘. 한 번 쓰고 주소에서 지운다 (`replace` — 이력을 쌓지 않는다).
  const deepLinkInquiryId = searchParams.get('inquiry');
  const deepLinkConsultId = searchParams.get('consult');
  const clearParam = useCallback(
    (name: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(name);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const clearInquiryParam = useCallback(() => clearParam('inquiry'), [clearParam]);
  const clearConsultParam = useCallback(() => clearParam('consult'), [clearParam]);

  const selectTab = (key: TabKey) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        // 기본 탭은 주소에 적지 않는다 — `/mypage` 와 `/mypage?tab=consults` 가 같은 화면이다.
        if (key === 'consults') next.delete('tab');
        else next.set('tab', key);
        return next;
      },
      { replace: true }
    );
  };

  // APG 탭 패턴: 화살표는 순환하고, 이동과 동시에 그 탭이 열린다(automatic activation).
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index + last) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;

    if (nextIndex === null) return;

    event.preventDefault();
    const nextKey = TABS[nextIndex].key;
    selectTab(nextKey);
    tabRefs.current[nextKey]?.focus();
  };

  return (
    <>
      <section className="mb-3 flex items-center gap-3.5 rounded-2xl border border-neutral-100 bg-white p-5">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50"
        >
          <span className="text-xl font-bold text-brand-700">{user.name.trim().charAt(0)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold text-neutral-900">{user.name}님, 안녕하세요</p>
          <p className="truncate text-[13px] text-neutral-500">{user.email}</p>
        </div>
      </section>

      <section className="mb-3 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div role="tablist" aria-label="내 활동" className="flex border-b border-neutral-200">
          {TABS.map((item, index) => {
            const selected = item.key === tab;
            const count = counts[item.key];

            return (
              <button
                key={item.key}
                id={`mypage-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`mypage-panel-${item.key}`}
                tabIndex={selected ? 0 : -1}
                ref={(node) => {
                  tabRefs.current[item.key] = node;
                }}
                onClick={() => selectTab(item.key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`min-h-[48px] flex-1 whitespace-nowrap border-b-2 px-1 text-[13px] xs:text-sm ${
                  selected
                    ? 'border-brand-600 font-bold text-brand-700'
                    : 'border-transparent font-medium text-neutral-500'
                }`}
              >
                {count === null ? item.label : `${item.label} ${count}`}
              </button>
            );
          })}
        </div>

        {/* 활성 탭 패널만 렌더한다 — 찜 탭의 병원별 조회가 미리 나가지 않도록. */}
        <div
          id={`mypage-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`mypage-tab-${tab}`}
          tabIndex={0}
          className="px-4 pb-3 pt-1"
        >
          {tab === 'consults' ? (
            <ConsultsPanel
              query={myConsults}
              deepLinkId={deepLinkConsultId}
              onDeepLinkHandled={clearConsultParam}
            />
          ) : null}
          {tab === 'inquiries' ? (
            <InquiriesPanel
              query={myInquiries}
              deepLinkId={deepLinkInquiryId}
              onDeepLinkHandled={clearInquiryParam}
            />
          ) : null}
          {tab === 'favorites' ? <FavoritesPanel query={favorites} /> : null}
        </div>
      </section>

      <MenuList />

      {/* 권한이 있는 계정에만 보여준다. 예전에는 로그인 여부와 무관하게 노출되어
          우연히 관리자 화면에 들어가는 경로가 됐다 (`docs/features/known-issues.md` 🔴). */}
      {isHospitalAdmin ? (
        <Pressable
          onPress={() => router.push('/admin')}
          className="mt-1 min-h-[52px] flex-row items-center justify-between rounded-xl border border-dashed border-neutral-300 px-4"
        >
          <Text className="text-sm text-neutral-600">병원 관리자 페이지</Text>
          <Text className="text-xs text-neutral-400">관리자 전용</Text>
        </Pressable>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ 화면 */

export default function MyPage() {
  const { user, isHospitalAdmin, isRestoring } = useSession();
  const setScrolled = useScrollShadowStore((state) => state.setScrolled);
  const scrollOffsetRef = useRef(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = offsetY;
    setScrolled(offsetY > SCROLL_SHADOW_THRESHOLD);
  };

  useFocusEffect(
    useCallback(() => {
      setScrolled(scrollOffsetRef.current > SCROLL_SHADOW_THRESHOLD);
    }, [setScrolled])
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerClassName={cx(containerClass('content'), 'pb-10 pt-3')}
      >
        <h1 className="mb-4 text-2xl font-extrabold text-neutral-900">마이페이지</h1>

        {isRestoring ? (
          // 세션을 되살리는 중에 로그인 카드를 그리면 새로고침마다 `로그인이 필요해요` 가 번쩍인다.
          <div
            className="mb-6 h-[92px] animate-pulse rounded-2xl bg-neutral-100"
            role="status"
            aria-label="내 정보를 불러오는 중이에요"
          />
        ) : user ? (
          <SignedInView user={user} isHospitalAdmin={isHospitalAdmin} />
        ) : (
          <LoginCard />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
