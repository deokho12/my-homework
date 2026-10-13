import { describe, expect, it } from 'vitest';

import {
  cancelReasonOf,
  classifyEvent,
  nextVisitAt,
  periodRange,
  requiredInputs,
  truncateToMinute,
} from '@/features/consult/lib/transition';
import type { ConsultStatusChange } from '@/types/domain';

describe('requiredInputs', () => {
  it('예약확정은 확정 일시를, 취소는 사유를 요구한다', () => {
    expect(requiredInputs('booked')).toEqual(['visitAt']);
    expect(requiredInputs('cancelled')).toEqual(['cancelReason']);
  });

  it('신규·연락중·내원완료는 추가 입력이 없다', () => {
    expect(requiredInputs('new')).toEqual([]);
    expect(requiredInputs('contacted')).toEqual([]);
    expect(requiredInputs('visited')).toEqual([]);
  });
});

describe('truncateToMinute', () => {
  it('초·밀리초를 0 으로 깎는다', () => {
    expect(truncateToMinute('2026-10-09T05:00:42.123Z')).toBe('2026-10-09T05:00:00.000Z');
  });

  it('읽을 수 없는 값과 null 은 null 이다', () => {
    expect(truncateToMinute(null)).toBeNull();
    expect(truncateToMinute('not-a-date')).toBeNull();
    expect(truncateToMinute(undefined)).toBeNull();
  });
});

describe('nextVisitAt', () => {
  const current = '2026-10-09T05:00:00.000Z';

  it('예약확정은 요청값을 쓰고, 없으면 현재값을 유지한다', () => {
    expect(nextVisitAt('booked', current, '2026-10-10T02:00:00.000Z')).toBe('2026-10-10T02:00:00.000Z');
    expect(nextVisitAt('booked', current, null)).toBe(current);
    expect(nextVisitAt('booked', current, undefined)).toBe(current);
  });

  it('예약확정으로 들어오는 요청값도 분 단위로 깎인다', () => {
    expect(nextVisitAt('booked', null, '2026-10-10T02:00:59.999Z')).toBe('2026-10-10T02:00:00.000Z');
  });

  it('내원완료는 현재 값을 유지한다 — 언제 오기로 했던 건인가는 내원 기록의 일부다', () => {
    expect(nextVisitAt('visited', current, null)).toBe(current);
    // 보낸 값은 무시한다. 결과값은 상태가 정한다.
    expect(nextVisitAt('visited', current, '2026-11-01T00:00:00.000Z')).toBe(current);
  });

  it('신규·연락중·취소로 나가면 지운다 — 남겨 두면 환자에게 거짓이 된다', () => {
    expect(nextVisitAt('cancelled', current, null)).toBeNull();
    expect(nextVisitAt('contacted', current, null)).toBeNull();
    expect(nextVisitAt('new', current, '2026-11-01T00:00:00.000Z')).toBeNull();
  });
});

describe('classifyEvent', () => {
  const booked = { status: 'booked' as const, visitAt: '2026-10-09T05:00:00.000Z', cancelReason: null };

  it('상태가 다르면 상태 변경이다', () => {
    expect(classifyEvent(booked, { ...booked, status: 'visited' })).toBe('status_change');
  });

  it('예약확정 그대로이고 일시만 다르면 일시 변경이다', () => {
    expect(classifyEvent(booked, { ...booked, visitAt: '2026-10-10T02:00:00.000Z' })).toBe('reschedule');
  });

  it('세 값이 모두 같으면 no-op 이다', () => {
    expect(classifyEvent(booked, { ...booked })).toBe('noop');
  });

  it('초 자릿수만 다른 같은 약속은 no-op 이다 (분 단위 비교)', () => {
    expect(classifyEvent(booked, { ...booked, visitAt: '2026-10-09T05:00:59.000Z' })).toBe('noop');
  });

  it('예약확정이 아닌 상태에서 일시가 달라도 일시 변경이 아니다', () => {
    const contacted = { status: 'contacted' as const, visitAt: null, cancelReason: null };

    expect(classifyEvent(contacted, { ...contacted, visitAt: '2026-10-10T02:00:00.000Z' })).toBe('noop');
  });
});

describe('periodRange — Asia/Seoul 달력, 반열린 구간 [from, to)', () => {
  // 서울 2026-10-12(월) 23:00. UTC 로는 아직 10/12 14:00 이다.
  const mondayNight = new Date('2026-10-12T14:00:00.000Z');

  it('오늘은 서울 자정부터 다음 자정까지다', () => {
    expect(periodRange('today', mondayNight).map((date) => date.toISOString())).toEqual([
      '2026-10-11T15:00:00.000Z',
      '2026-10-12T15:00:00.000Z',
    ]);
  });

  it('자정을 넘기면(서울 기준) 하루가 넘어간다 — 기기 시계의 날짜가 아니다', () => {
    // UTC 10/12 15:30 = 서울 10/13 00:30.
    const pastSeoulMidnight = new Date('2026-10-12T15:30:00.000Z');

    expect(periodRange('today', pastSeoulMidnight).map((date) => date.toISOString())).toEqual([
      '2026-10-12T15:00:00.000Z',
      '2026-10-13T15:00:00.000Z',
    ]);
  });

  it('이번 주는 월요일에 시작한다', () => {
    // 서울 10/15(목) 09:00.
    const thursday = new Date('2026-10-15T00:00:00.000Z');

    expect(periodRange('thisWeek', thursday).map((date) => date.toISOString())).toEqual([
      '2026-10-11T15:00:00.000Z', // 서울 10/12(월) 00:00
      '2026-10-18T15:00:00.000Z', // 서울 10/19(월) 00:00
    ]);
  });

  it('일요일은 지난 월요일이 시작이다 (주의 끝이지 시작이 아니다)', () => {
    // 서울 10/18(일) 09:00.
    const sunday = new Date('2026-10-18T00:00:00.000Z');

    expect(periodRange('thisWeek', sunday).map((date) => date.toISOString())).toEqual([
      '2026-10-11T15:00:00.000Z',
      '2026-10-18T15:00:00.000Z',
    ]);
  });

  it('최근 30일은 오늘을 포함한 30일이다', () => {
    expect(periodRange('last30', mondayNight).map((date) => date.toISOString())).toEqual([
      '2026-09-12T15:00:00.000Z', // 서울 9/13 00:00 = 오늘 − 29일
      '2026-10-12T15:00:00.000Z', // 서울 10/13 00:00 = 내일 자정
    ]);
  });

  /** 대시보드 카드 ④ 와 깔때기의 모집단 (`docs/database/README.md` §13.2). */
  it('이번 달은 서울 달력 1일 00:00 부터 다음 달 1일 00:00 까지다', () => {
    expect(periodRange('thisMonth', mondayNight).map((date) => date.toISOString())).toEqual([
      '2026-09-30T15:00:00.000Z', // 서울 10/1 00:00
      '2026-10-31T15:00:00.000Z', // 서울 11/1 00:00
    ]);
  });

  it('서울 기준으로 달이 바뀌면 UTC 가 아직 지난달이어도 새 달이다', () => {
    // UTC 10/31 16:00 = 서울 11/1 01:00.
    const seoulNovember = new Date('2026-10-31T16:00:00.000Z');

    expect(periodRange('thisMonth', seoulNovember).map((date) => date.toISOString())).toEqual([
      '2026-10-31T15:00:00.000Z', // 서울 11/1 00:00
      '2026-11-30T15:00:00.000Z', // 서울 12/1 00:00
    ]);
  });

  it('12월은 다음 해 1월 1일이 끝이다', () => {
    const december = new Date('2026-12-20T00:00:00.000Z');

    expect(periodRange('thisMonth', december).map((date) => date.toISOString())).toEqual([
      '2026-11-30T15:00:00.000Z', // 서울 12/1 00:00
      '2026-12-31T15:00:00.000Z', // 서울 2027-1/1 00:00
    ]);
  });

  it('달의 첫 순간은 구간에 들어가고 마지막 순간의 1ms 뒤는 들어가지 않는다 (반열린 구간)', () => {
    const [from, to] = periodRange('thisMonth', mondayNight);

    expect(from.getTime()).toBeLessThanOrEqual(new Date('2026-09-30T15:00:00.000Z').getTime());
    expect(new Date('2026-10-31T14:59:59.999Z').getTime()).toBeLessThan(to.getTime());
    expect(new Date('2026-10-31T15:00:00.000Z').getTime()).toBeGreaterThanOrEqual(to.getTime());
  });
});

describe('cancelReasonOf', () => {
  function change(overrides: Partial<ConsultStatusChange>): ConsultStatusChange {
    return { status: 'new', changedAt: '2026-10-07T00:00:00.000Z', ...overrides };
  }

  it('현재 상태가 취소일 때 가장 최근 취소 행의 사유다', () => {
    const history = [
      change({ status: 'cancelled', cancelReason: 'duplicate', changedAt: '2026-10-07T00:00:00.000Z' }),
      change({ status: 'contacted', changedAt: '2026-10-08T00:00:00.000Z' }),
      change({ status: 'cancelled', cancelReason: 'no_answer', changedAt: '2026-10-09T00:00:00.000Z' }),
    ];

    expect(cancelReasonOf('cancelled', history)).toBe('no_answer');
  });

  it('취소가 아니면 항상 null 이다 — 재오픈에 지우는 절차가 없는 이유다', () => {
    const history = [change({ status: 'cancelled', cancelReason: 'no_answer' })];

    expect(cancelReasonOf('contacted', history)).toBeNull();
  });

  it('사유 없이 취소된 과거 행은 null 이다', () => {
    expect(cancelReasonOf('cancelled', [change({ status: 'cancelled' })])).toBeNull();
  });
});
