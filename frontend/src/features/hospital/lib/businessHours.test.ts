import { describe, expect, it } from 'vitest';

import { closesAtLabel, findTodayEntry, readTodayHours } from '@/features/hospital/lib/businessHours';

/**
 * 모든 시각은 **UTC 로 적고 서울로 읽는다** — 테스트를 돌리는 기계의 시간대가 달라도
 * 같은 답이 나와야 한다. `2026-10-23T01:00:00Z` 는 서울 금요일 10:00 이다.
 */
const FRIDAY_HOURS = [
  { day: '목', hours: '10:00 - 21:00' },
  { day: '금', hours: '10:00 - 19:00' },
  { day: '일', hours: '휴진', isClosed: true },
];

describe('readTodayHours — 오늘 줄과 진료중 판정', () => {
  it('진료 시작 1분 전에는 진료 종료다', () => {
    const today = readTodayHours(FRIDAY_HOURS, new Date('2026-10-23T00:59:00Z'));

    expect(today).toMatchObject({ status: 'closed', closesAt: null });
    expect(today.entry?.day).toBe('금');
  });

  it('시작 정각에는 진료중이고 종료 시각을 함께 돌려준다', () => {
    expect(readTodayHours(FRIDAY_HOURS, new Date('2026-10-23T01:00:00Z'))).toMatchObject({
      status: 'open',
      closesAt: '19:00',
    });
  });

  it('종료 1분 전에는 아직 진료중이다', () => {
    expect(readTodayHours(FRIDAY_HOURS, new Date('2026-10-23T09:59:00Z'))).toMatchObject({
      status: 'open',
    });
  });

  it('종료 정각에는 진료 종료다 — 끝나는 시각에 가면 이미 닫혀 있다', () => {
    expect(readTodayHours(FRIDAY_HOURS, new Date('2026-10-23T10:00:00Z'))).toMatchObject({
      status: 'closed',
      closesAt: null,
    });
  });

  it('휴진인 요일은 시각과 무관하게 진료 종료다', () => {
    const today = readTodayHours(FRIDAY_HOURS, new Date('2026-10-25T02:00:00Z'));

    expect(today).toMatchObject({ status: 'closed', closesAt: null });
    expect(today.entry?.day).toBe('일');
  });

  it('읽을 수 없는 문자열은 모름이다 — 진료중이라고 지어내지 않는다', () => {
    const today = readTodayHours([{ day: '금', hours: '예약제로 운영해요' }], new Date('2026-10-23T01:00:00Z'));

    expect(today).toMatchObject({ status: 'unknown', closesAt: null });
    expect(today.entry?.day).toBe('금');
  });

  it('자정을 넘는 표기도 모름이다', () => {
    expect(readTodayHours([{ day: '금', hours: '21:00 - 01:00' }], new Date('2026-10-23T13:00:00Z'))).toMatchObject({
      status: 'unknown',
    });
  });

  it('오늘 요일이 등록돼 있지 않으면 오늘 줄도 모름도 없다', () => {
    expect(readTodayHours([{ day: '월', hours: '10:00 - 19:00' }], new Date('2026-10-23T01:00:00Z'))).toEqual({
      entry: null,
      status: 'unknown',
      closesAt: null,
    });
  });

  it('진료시간이 하나도 없으면 모름이다', () => {
    expect(readTodayHours([], new Date('2026-10-23T01:00:00Z'))).toEqual({
      entry: null,
      status: 'unknown',
      closesAt: null,
    });
  });

  it('`금요일` 처럼 길게 적힌 줄도 같은 오늘로 읽는다', () => {
    expect(readTodayHours([{ day: '금요일', hours: '10:00 - 19:00' }], new Date('2026-10-23T01:00:00Z'))).toMatchObject({
      status: 'open',
    });
  });

  it('물결표로 적은 범위도 읽는다', () => {
    expect(readTodayHours([{ day: '금', hours: '10:00~19:00' }], new Date('2026-10-23T01:00:00Z'))).toMatchObject({
      status: 'open',
      closesAt: '19:00',
    });
  });
});

describe('findTodayEntry — 오늘 줄 찾기', () => {
  it('서울 요일에 맞는 줄을 돌려준다', () => {
    expect(findTodayEntry(FRIDAY_HOURS, new Date('2026-10-23T01:00:00Z'))).toEqual({
      day: '금',
      hours: '10:00 - 19:00',
    });
  });

  it('한국 시간으로 날이 바뀌면 다음 요일을 가리킨다 — UTC 금요일 15시는 서울 토요일이다', () => {
    expect(findTodayEntry(FRIDAY_HOURS, new Date('2026-10-23T15:00:00Z'))).toBeNull();
  });
});

describe('closesAtLabel — 접힌 요약 한 줄의 문구', () => {
  it('정각이면 시 단위로만 적는다', () => {
    expect(closesAtLabel('21:00')).toBe('21시까지');
  });

  it('정각이 아니면 분까지 적는다', () => {
    expect(closesAtLabel('21:30')).toBe('21:30까지');
  });

  it('앞의 0은 떼고 읽는다', () => {
    expect(closesAtLabel('09:00')).toBe('9시까지');
  });
});
