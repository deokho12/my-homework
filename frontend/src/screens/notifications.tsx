import { router, Stack } from '@/navigation';
import { ScrollView, Text, View, cx } from '@/primitives';
import { Pressable, SafeAreaView } from '@/primitives';

import { QueryState } from '@/components/QueryState';
import { containerClass } from '@/components/layout/Container';
import {
  NOTIFICATION_ICON_GLYPH,
  NOTIFICATION_ICON_LABEL,
  NOTIFICATION_ICON_TONE,
  notificationIcon,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
} from '@/features/notification';
import { formatDateTimeShort } from '@/lib/dateFormat';
import type { AppNotification } from '@/types/domain';

/**
 * 이 화면에는 페이지네이션 UI 가 없다. 계약이 허용하는 상한(`pageSize` 최대 100)까지
 * 한 번에 받아 예전처럼 전부 그린다. 페이지 이동 UI 가 생기면 이 상수는 사라진다.
 *
 * ⚠ **알림은 상담 접수·상태 변경마다 늘어나기만 하는 컬렉션이라 언젠가 100건을 넘는다.**
 * 그때 101번째부터는 화면에서 조용히 사라진다 (안 읽은 개수 배지는 전체를 세므로 목록에
 * 없는 알림이 숫자에만 남는다). 페이지 이동 UI 나 무한 스크롤이 그 시점의 숙제다.
 */
const LIST_PAGE_SIZE = 100;

const EMPTY_TITLE = '아직 도착한 알림이 없어요';

/**
 * 알림 한 줄.
 *
 * **문구를 여기서 만들지 않는다** — 저장된 `title`/`message` 를 그대로 그린다. 보낸 문구는
 * 기록이라, 문장을 다듬어도 과거 알림이 소급해 바뀌면 안 된다
 * (서버의 `backend/src/consult/notification-text.ts` 가 보낼 때 한 번 만든다).
 *
 * 행은 링크가 아니라 **버튼**이다 — 누르면 읽음 처리라는 상태 변경이 함께 일어나고,
 * 이동이 없는 `안내` 행도 그 변경은 일으킨다.
 */
function NotificationRow({ notification }: { notification: AppNotification }) {
  const markAsRead = useMarkNotificationAsRead();

  const kind = notificationIcon(notification);
  const Icon = NOTIFICATION_ICON_GLYPH[kind];
  const tone = NOTIFICATION_ICON_TONE[kind];
  const at = formatDateTimeShort(notification.createdAt);
  const unread = !notification.isRead;

  const handlePress = () => {
    // 읽음 처리는 이동을 막지 않는다 — 실패해도 알림을 열지 못할 이유가 없다.
    markAsRead.mutate(notification.id);

    if (notification.type === 'consult-status' && notification.relatedId) {
      // **고정 주소다.** 예전에는 그 상담의 병원을 비동기로 찾아 병원 상세로 보냈는데,
      // 주인이 없는 샘플 상담은 찾을 수 없어 조용히 이동하지 않았다. 상담 내역은
      // 알림이 말한 바로 그 상담이 있는 곳이라 id 만으로 갈 수 있다.
      router.push(`/mypage?tab=consults&consult=${notification.relatedId}`);
      return;
    }

    if (notification.type === 'inquiry-answer' && notification.relatedId) {
      // 마이페이지 `내 문의` 의 그 문의를 펼친 채 연다. 병원 상세의 공개 Q/A 로 보내지 않는다 —
      // 비공개로 물었거나 병원이 비공개로 답한 건은 그곳에 없고, 알림만 보고는 알 수 없다.
      router.push(`/mypage?tab=inquiries&inquiry=${notification.relatedId}`);
      return;
    }

    if (notification.type === 'event') {
      router.push('/events');
      return;
    }
    // 'system' notifications just get marked read, no navigation.
  };

  return (
    <button
      type="button"
      onClick={handlePress}
      className={cx(
        'mb-2 flex w-full flex-row items-start gap-3 rounded-2xl border p-4 text-left',
        'active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        unread ? 'border-brand-100 bg-brand-50' : 'border-neutral-100 bg-white'
      )}
    >
      {/* 낭독기에만 들리는 머리말. `aria-label` 로 전체를 덮지 않는 이유: 본문 글자를
          선택·번역·확대할 수 있어야 하고, 라벨과 보이는 글이 어긋날 길을 만들지 않는다.
          읽은 행은 `읽음,` 을 말하지 않는다 — 메일함의 관습대로 차이는 "말하느냐"로 전한다. */}
      <span className="sr-only">{`${unread ? '안 읽음, ' : ''}${NOTIFICATION_ICON_LABEL[kind]} 알림.`}</span>

      {/* 칩 배경은 늘 카드 배경의 반대쪽이다 — 안 읽음 카드(brand-50) 위의 brand 칩은
          사라져 보인다. 읽었다고 아이콘을 흐리게 하지는 않는다 (종류는 읽음과 무관한 사실). */}
      <span
        aria-hidden="true"
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          unread ? 'bg-white' : tone.chip
        )}
      >
        <Icon size={18} className={tone.icon} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-row items-start justify-between gap-2">
          <span
            className={cx(
              'min-w-0 flex-1 text-sm',
              unread ? 'font-bold text-neutral-900' : 'font-medium text-neutral-500'
            )}
          >
            {notification.title}
          </span>
          {/* 읽은 행도 같은 크기의 빈 자리를 남긴다 — 읽음 전후로 제목 칸 폭이 흔들리지 않게.
              점은 위 숨김 텍스트와 중복이라 낭독기에서 숨긴다. */}
          <span
            aria-hidden="true"
            className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread && 'bg-brand-600')}
          />
        </span>

        {/* 병원 이름이 길어도 자르지 않고 줄바꿈한다 — 이름을 `…` 로 자르면 어느 병원인지
            모르게 된다. 넘치는 쪽은 문장 꼬리이고, 병원명·일시는 앞에 있다. */}
        {/* `block` 을 함께 주지 않는다 — `line-clamp-*` 는 `display:-webkit-box` 로 동작하는데
            Tailwind 가 `.block` 을 뒤에 내보내서 `display:block` 이 이기고 clamp 가 조용히
            죽는다 (md 이상에서만 살아나 좁은 화면이 오히려 안 잘리는 거꾸로가 된다).
            `-webkit-box` 도 블록 상자라 줄바꿈 자리는 그대로다. */}
        <span
          className={cx(
            'mt-1 line-clamp-3 text-sm leading-relaxed md:line-clamp-2',
            // 읽음 본문을 neutral-400(2.6:1)에서 올렸다 — 본문이 이제 핵심 정보다.
            notification.isRead ? 'text-neutral-500' : 'text-neutral-600'
          )}
        >
          {notification.message}
        </span>

        {at ? (
          <time dateTime={notification.createdAt} className="mt-1.5 block text-[11px] text-neutral-400">
            {at}
          </time>
        ) : null}
      </span>
    </button>
  );
}

export default function NotificationsScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useNotifications('user', { pageSize: LIST_PAGE_SIZE });
  const markAllAsRead = useMarkAllNotificationsAsRead();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '알림' }} />
      <View className={cx(containerClass('content'), 'flex-row items-center justify-between pb-2 pt-4')}>
        <Text className="text-lg font-bold text-neutral-900">알림함</Text>
        <Pressable onPress={() => markAllAsRead.mutate('user')} hitSlop={8}>
          <Text className="text-sm font-semibold text-brand-700">모두 읽음</Text>
        </Pressable>
      </View>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        // 0건은 아래 목록의 기존 빈 상태(🔔)가 그대로 맡는다.
        isEmpty={() => false}
        emptyState={{ title: EMPTY_TITLE }}
      >
        {(page) => (
          <ScrollView contentContainerClassName={cx(containerClass('content'), 'py-2')}>
            {page.items.length === 0 ? (
              <View className="items-center px-8 py-16">
                <Text className="mb-2 text-4xl">🔔</Text>
                <Text className="text-center text-sm text-neutral-500">{EMPTY_TITLE}</Text>
              </View>
            ) : (
              // 목록으로 감싸 "목록, 항목 N개" 가 먼저 들리게 한다.
              <ul>
                {page.items.map((item) => (
                  <li key={item.id}>
                    <NotificationRow notification={item} />
                  </li>
                ))}
              </ul>
            )}
          </ScrollView>
        )}
      </QueryState>
    </SafeAreaView>
  );
}
