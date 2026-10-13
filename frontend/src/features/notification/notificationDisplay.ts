import { CalendarCheck, ClipboardList, Gift, Megaphone, MessageCircleReply, type LucideIcon } from 'lucide-react';

import type { AppNotification, ConsultStatus, NotificationType } from '@/types/domain';

/**
 * 알림 한 줄의 **종류 표식**을 정하는 순수 모듈. React 도 네트워크도 모른다.
 *
 * 서버가 내려주는 것은 `type`·`consultStatus` 라는 **사실**이고, 그 사실을 그림으로 바꾸는
 * 것은 표시 규칙이다 (`docs/database/README.md` §15.2 — `isDelayed` 를 서버 컬럼으로 두지
 * 않은 것과 같은 이유). 판정 지점이 사용자 알림함 한 곳뿐이라 "같은 판정을 두 곳에 두지
 * 않는다" 가 자동으로 지켜진다.
 *
 * **관리자 알림함(`screens/admin/notifications.tsx`)은 이 모듈을 쓰지 않는다.** 그쪽은
 * 종류가 둘(상담 신청·안내)뿐이라 아이콘의 득이 작고, 공통화하면 요청 없이 그 화면의
 * 겉모습이 바뀐다 (명세 §8).
 */

export type NotificationIcon = 'booking' | 'consult' | 'inquiry' | 'event' | 'notice';

/**
 * 아이콘의 **유일한 음성 대응**이다 — 아이콘 자체는 `aria-hidden` 이고, 낭독기는 행 맨 앞의
 * 숨김 텍스트에서 이 말을 듣는다 (`예약 알림.`).
 */
export const NOTIFICATION_ICON_LABEL: Record<NotificationIcon, string> = {
  booking: '예약',
  consult: '상담',
  inquiry: '문의',
  event: '이벤트',
  notice: '안내',
};

export const NOTIFICATION_ICON_GLYPH: Record<NotificationIcon, LucideIcon> = {
  // 마이페이지의 확정 일시 줄도 brand 다 — 두 화면에서 "예약" 이 같은 색을 갖는다.
  booking: CalendarCheck,
  // 마이페이지 상담 내역 빈 상태와 같은 그림이다 — 누르면 가는 곳의 그림과 출발지가 같다.
  consult: ClipboardList,
  inquiry: MessageCircleReply,
  event: Gift,
  notice: Megaphone,
};

/**
 * 칩 색. `chip` 은 **읽은 행(흰 카드)** 위의 배경이고, 안 읽은 카드(`bg-brand-50`) 위에서는
 * 호출부가 흰 원으로 뒤집는다 — 칩 배경은 늘 카드 배경의 반대쪽이다 (명세 §2.5).
 * 글자색은 양쪽 모두 같다 (`*-700`/`neutral-600` 이라 어느 배경에서도 4.5:1 이상).
 *
 * `Record<NotificationIcon, …>` 라 종류가 늘면 **컴파일 에러로** 누락이 잡힌다.
 */
export const NOTIFICATION_ICON_TONE: Record<NotificationIcon, { icon: string; chip: string }> = {
  booking: { icon: 'text-brand-700', chip: 'bg-brand-50' },
  // amber 는 경고가 아니라 "상담 진행 상황" 이다. 취소도 이 칸이라 rose 가 두 뜻을 갖지 않는다.
  consult: { icon: 'text-amber-700', chip: 'bg-amber-50' },
  inquiry: { icon: 'text-sky-700', chip: 'bg-sky-50' },
  event: { icon: 'text-rose-700', chip: 'bg-rose-50' },
  notice: { icon: 'text-neutral-600', chip: 'bg-neutral-100' },
};

/**
 * 알림 → 종류. 판정은 한 줄이다.
 *
 * `consultStatus === 'booked'` 하나가 **예약확정과 예약 일시 변경 둘 다** 집는다 —
 * `reschedule` 이벤트도 그 시점 상태가 `booked` 라서, 알림 행에 `event` 칸이 필요 없다.
 * 칸이 없는 과거 행(`undefined`/`null`)은 `consult` 다.
 */
export function notificationIcon({
  type,
  consultStatus,
}: Pick<AppNotification, 'type'> & { consultStatus?: ConsultStatus | null }): NotificationIcon {
  if (type === 'consult-status') return consultStatus === 'booked' ? 'booking' : 'consult';

  return OTHER_ICON[type];
}

/** `consult-status` 를 뺀 나머지는 `type` 과 1:1 이다. */
const OTHER_ICON: Record<Exclude<NotificationType, 'consult-status'>, NotificationIcon> = {
  'inquiry-answer': 'inquiry',
  event: 'event',
  system: 'notice',
};
