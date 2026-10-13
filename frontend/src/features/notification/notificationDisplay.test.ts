import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_ICON_GLYPH,
  NOTIFICATION_ICON_LABEL,
  NOTIFICATION_ICON_TONE,
  notificationIcon,
} from '@/features/notification/notificationDisplay';
import type { ConsultStatus } from '@/types/domain';

describe('notificationIcon — 종류 판정', () => {
  it('예약확정 상태의 상담 알림만 예약(booking)이다', () => {
    expect(notificationIcon({ type: 'consult-status', consultStatus: 'booked' })).toBe('booking');
  });

  it('일시 변경 알림도 그 시점 상태가 `booked` 라 같은 아이콘을 받는다', () => {
    // 알림 행에 `event` 칸이 없어도 되는 이유다 — `reschedule` 은 상태가 `booked` 인 채로 일어난다.
    expect(notificationIcon({ type: 'consult-status', consultStatus: 'booked' })).toBe('booking');
  });

  it.each<ConsultStatus>(['new', 'contacted', 'visited', 'cancelled'])(
    '그 밖의 상담 상태(%s)는 상담(consult)이다',
    (consultStatus) => {
      expect(notificationIcon({ type: 'consult-status', consultStatus })).toBe('consult');
    }
  );

  it('상태 칸이 없는 과거 행·시드 알림은 상담(consult)으로 떨어진다', () => {
    // 옛 문구가 `상담 상태가 '예약완료'(으)로 변경되었어요` 라 예약 아이콘을 붙이면 지어낸 말이 된다.
    expect(notificationIcon({ type: 'consult-status', consultStatus: null })).toBe('consult');
    expect(notificationIcon({ type: 'consult-status' })).toBe('consult');
  });

  it('나머지 종류는 type 그대로다', () => {
    expect(notificationIcon({ type: 'inquiry-answer', consultStatus: null })).toBe('inquiry');
    expect(notificationIcon({ type: 'event', consultStatus: null })).toBe('event');
    expect(notificationIcon({ type: 'system', consultStatus: null })).toBe('notice');
  });

  it('상담이 아닌 알림에 상태가 묻어 있어도 예약으로 넘어가지 않는다', () => {
    expect(notificationIcon({ type: 'event', consultStatus: 'booked' })).toBe('event');
  });
});

describe('종류별 표시 값', () => {
  it('다섯 종류 모두 낭독용 라벨·아이콘·색을 갖는다', () => {
    for (const kind of ['booking', 'consult', 'inquiry', 'event', 'notice'] as const) {
      expect(NOTIFICATION_ICON_LABEL[kind]).toBeTruthy();
      expect(NOTIFICATION_ICON_GLYPH[kind]).toBeTruthy();
      expect(NOTIFICATION_ICON_TONE[kind].icon).toMatch(/^text-/);
      expect(NOTIFICATION_ICON_TONE[kind].chip).toMatch(/^bg-/);
    }
  });

  it('아이콘 다섯이 서로 다른 그림이다 — 색을 못 봐도 구분된다', () => {
    expect(new Set(Object.values(NOTIFICATION_ICON_GLYPH)).size).toBe(5);
  });
});
