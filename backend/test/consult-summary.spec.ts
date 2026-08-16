import { describe, expect, it } from 'vitest';

import { CONSULT_STATUS_LABEL, seoulMonthStart } from '../src/consult/summary';

/**
 * `이번 달 신규 상담` 의 달 경계.
 *
 * 서버는 UTC 로 돌고 화면이 세는 "이번 달" 은 한국 달력이다. 9시간 차이 때문에 매달
 * 1일 0~9시(KST)에 접수된 상담이 지난달로 새기 쉬운데, 그 경계를 여기서 고정한다.
 */
describe('seoulMonthStart', () => {
  it('KST 기준 그 달 1일 자정이다 (UTC 로는 전달 말일 15:00)', () => {
    expect(seoulMonthStart(new Date('2026-08-16T03:00:00.000Z')).toISOString()).toBe(
      '2026-07-31T15:00:00.000Z',
    );
  });

  it('★ KST 로 새 달 1일 0시 30분은 이미 새 달이다', () => {
    // 2026-07-31T15:30Z = KST 2026-08-01 00:30
    const now = new Date('2026-07-31T15:30:00.000Z');

    expect(now.getTime()).toBeGreaterThanOrEqual(seoulMonthStart(now).getTime());
    expect(seoulMonthStart(now).toISOString()).toBe('2026-07-31T15:00:00.000Z');
  });

  it('★ KST 로 아직 지난달인 시각은 지난달 경계를 준다 (UTC 로 이미 새 달이어도)', () => {
    // 2026-08-01T00:30Z = KST 2026-08-01 09:30 → 8월
    expect(seoulMonthStart(new Date('2026-08-01T00:30:00.000Z')).toISOString()).toBe(
      '2026-07-31T15:00:00.000Z',
    );
    // 2026-07-31T14:30Z = KST 2026-07-31 23:30 → 아직 7월
    expect(seoulMonthStart(new Date('2026-07-31T14:30:00.000Z')).toISOString()).toBe(
      '2026-06-30T15:00:00.000Z',
    );
  });

  it('연말 경계를 넘긴다', () => {
    // 2026-12-31T16:00Z = KST 2027-01-01 01:00
    expect(seoulMonthStart(new Date('2026-12-31T16:00:00.000Z')).toISOString()).toBe(
      '2026-12-31T15:00:00.000Z',
    );
  });
});

describe('CONSULT_STATUS_LABEL', () => {
  it('계약의 네 상태를 화면 표기로 옮긴다', () => {
    expect(CONSULT_STATUS_LABEL).toEqual({
      new: '신규',
      contacted: '연락중',
      booked: '예약완료',
      cancelled: '취소',
    });
  });
});
