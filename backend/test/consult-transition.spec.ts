import { describe, expect, it } from 'vitest';

import {
  cancelReasonOf,
  classifyEvent,
  isConsultCancelReason,
  nextVisitAt,
  periodRange,
  requiredInputs,
  seoulDateKey,
  truncateToMinute,
} from '../src/consult/transition';

/**
 * 상담 상태 변경의 판정 규칙 — **DB 도 요청도 쓰지 않는 순수 함수**다.
 *
 * 같은 표를 프런트의 `features/consult/lib/transition.ts` 도 구현한다. 두 구현이 갈리면
 * 폼이 "저장할 수 있다" 고 판정한 요청을 서버가 `422` 로 막는 화면이 된다 — 그래서
 * **프런트에 동기화 테스트**(이 파일을 상대 경로로 읽는다)가 따로 붙는다. 여기서 고정하는
 * 것은 경계값이고, 거기서 고정하는 것은 "두 구현이 같은 답을 내는가" 다.
 */

describe('requiredInputs — 전이는 전부 허용하고 입력만 본다', () => {
  it('예약확정은 확정 일시를 요구한다', () => {
    expect(requiredInputs('booked')).toEqual(['visitAt']);
  });

  it('취소는 사유를 요구한다', () => {
    expect(requiredInputs('cancelled')).toEqual(['cancelReason']);
  });

  it('나머지 셋은 추가 입력이 없다 — 막는 전이가 없다는 뜻이다', () => {
    expect(requiredInputs('new')).toEqual([]);
    expect(requiredInputs('contacted')).toEqual([]);
    expect(requiredInputs('visited')).toEqual([]);
  });
});

describe('truncateToMinute — 초·밀리초를 깎는다', () => {
  it('초와 밀리초가 0 이 된다', () => {
    expect(truncateToMinute('2026-10-09T05:00:59.999Z')).toBe('2026-10-09T05:00:00.000Z');
  });

  it('이미 분 단위면 그대로다 (멱등)', () => {
    expect(truncateToMinute('2026-10-09T05:00:00.000Z')).toBe('2026-10-09T05:00:00.000Z');
  });

  it('비었거나 읽을 수 없으면 null — 틀린 날짜를 지어내지 않는다', () => {
    expect(truncateToMinute(null)).toBeNull();
    expect(truncateToMinute(undefined)).toBeNull();
    expect(truncateToMinute('')).toBeNull();
    expect(truncateToMinute('내일 두시')).toBeNull();
  });
});

describe('nextVisitAt — 결과 일시는 상태가 정한다', () => {
  const current = '2026-10-09T05:00:00.000Z';
  const requested = '2026-10-12T02:00:00.000Z';

  it('booked: 요청값이 있으면 요청값', () => {
    expect(nextVisitAt('booked', current, requested)).toBe(requested);
  });

  it('booked: 요청값이 없으면 현재값을 유지한다 (일시 없이 다시 확정을 눌러도 지워지지 않는다)', () => {
    expect(nextVisitAt('booked', current, undefined)).toBe(current);
    expect(nextVisitAt('booked', current, null)).toBe(current);
  });

  it('visited: 보낸 값과 무관하게 현재값을 유지한다 (언제 오기로 했는가는 내원 기록의 일부다)', () => {
    expect(nextVisitAt('visited', current, requested)).toBe(current);
    expect(nextVisitAt('visited', null, requested)).toBeNull();
  });

  it('★ new·contacted·cancelled 는 지운다 — 취소된 건에 지난 약속이 남으면 환자에게 거짓이다', () => {
    expect(nextVisitAt('cancelled', current, requested)).toBeNull();
    expect(nextVisitAt('contacted', current, requested)).toBeNull();
    expect(nextVisitAt('new', current, requested)).toBeNull();
  });

  it('booked 의 결과도 분 단위로 깎인다', () => {
    expect(nextVisitAt('booked', null, '2026-10-12T02:00:45.123Z')).toBe('2026-10-12T02:00:00.000Z');
  });
});

describe('classifyEvent — no-op 판정과 이벤트 종류를 한 함수가 정한다', () => {
  const booked = { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z', cancelReason: null } as const;

  it('상태가 다르면 상태 변경이다', () => {
    expect(classifyEvent(booked, { ...booked, status: 'visited' })).toBe('status_change');
  });

  it('예약확정인데 일시만 다르면 일시 변경이다', () => {
    expect(classifyEvent(booked, { ...booked, visitAt: '2026-10-12T02:00:00.000Z' })).toBe('reschedule');
  });

  it('★ 세 값이 같으면 no-op — 오탭으로 이력과 알림이 중복되는 것을 막는다', () => {
    expect(classifyEvent(booked, { ...booked })).toBe('noop');
  });

  it('★ 초 자릿수만 다른 것은 변경이 아니다 (분 단위 비교)', () => {
    expect(classifyEvent(booked, { ...booked, visitAt: '2026-10-09T05:00:59.000Z' })).toBe('noop');
  });

  it('★ 예약확정이 아닌 상태에 일시만 보내면 no-op 이다', () => {
    const contacted = { status: 'contacted', visitAt: null, cancelReason: null } as const;

    expect(classifyEvent(contacted, { ...contacted, visitAt: '2026-10-12T02:00:00.000Z' })).toBe('noop');
  });

  it('★ 취소 그대로 사유만 바꾸는 것도 no-op 이다 — 사유만 고치는 경로는 두지 않는다', () => {
    const cancelled = { status: 'cancelled', visitAt: null, cancelReason: 'no_answer' } as const;

    expect(classifyEvent(cancelled, { ...cancelled, cancelReason: 'duplicate' })).toBe('noop');
  });
});

describe('periodRange — Asia/Seoul 달력, 반열린 구간 [from, to)', () => {
  // 2026-10-13(KST)은 **화요일**이고 그 주의 월요일은 10-12 다.
  const tuesday = new Date('2026-10-13T01:00:00.000Z');

  it('today 는 KST 자정부터 다음 KST 자정까지다', () => {
    const [from, to] = periodRange('today', tuesday);

    expect(from.toISOString()).toBe('2026-10-12T15:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-13T15:00:00.000Z');
  });

  it('★ KST 자정 직후(=UTC 로는 전날)도 같은 날로 묶인다', () => {
    const justAfterMidnightKst = new Date('2026-10-12T15:30:00.000Z');
    const [from, to] = periodRange('today', justAfterMidnightKst);

    expect(from.toISOString()).toBe('2026-10-12T15:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-13T15:00:00.000Z');
  });

  it('thisWeek 은 월요일 시작이다 (화요일에 물어도 월요일부터)', () => {
    const [from, to] = periodRange('thisWeek', tuesday);

    // KST 2026-10-12(월) 00:00 ~ 2026-10-19(월) 00:00
    expect(from.toISOString()).toBe('2026-10-11T15:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-18T15:00:00.000Z');
  });

  it('★ 일요일은 그 주의 마지막 날이다 (주의 시작이 월요일)', () => {
    const sunday = new Date('2026-10-18T05:00:00.000Z');
    const [from, to] = periodRange('thisWeek', sunday);

    expect(from.toISOString()).toBe('2026-10-11T15:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-18T15:00:00.000Z');
  });

  it('thisMonth 는 1일부터 다음 달 1일까지이고 해를 넘긴다', () => {
    const [from, to] = periodRange('thisMonth', tuesday);

    expect(from.toISOString()).toBe('2026-09-30T15:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-31T15:00:00.000Z');

    const december = new Date('2026-12-20T05:00:00.000Z');

    expect(periodRange('thisMonth', december)[1].toISOString()).toBe('2026-12-31T15:00:00.000Z');
  });

  it('★ last30 은 오늘을 포함한 30일이다 (오늘 00:00 − 29일)', () => {
    const [from, to] = periodRange('last30', tuesday);

    expect(from.toISOString()).toBe('2026-09-13T15:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-13T15:00:00.000Z');
    expect((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)).toBe(30);
  });
});

describe('seoulDateKey', () => {
  it('UTC 날짜가 아니라 서울 달력 날짜다', () => {
    expect(seoulDateKey(new Date('2026-10-12T15:00:00.000Z'))).toBe('2026-10-13');
    expect(seoulDateKey(new Date('2026-10-12T14:59:00.000Z'))).toBe('2026-10-12');
  });
});

describe('cancelReasonOf — 현재 취소 사유는 이력에서 파생한다', () => {
  const history = [
    { status: 'new', cancelReason: null },
    { status: 'cancelled', cancelReason: 'no_answer' },
    { status: 'contacted', cancelReason: null },
    { status: 'cancelled', cancelReason: 'duplicate' },
  ];

  it('가장 최근 취소 이벤트의 사유다', () => {
    expect(cancelReasonOf('cancelled', history)).toBe('duplicate');
  });

  it('★ 현재 상태가 취소가 아니면 자동으로 null — 재오픈에 지우는 절차가 없다', () => {
    expect(cancelReasonOf('contacted', history)).toBeNull();
    expect(cancelReasonOf('booked', history)).toBeNull();
  });

  it('취소 행이 없으면 null 이다', () => {
    expect(cancelReasonOf('cancelled', [{ status: 'new', cancelReason: null }])).toBeNull();
  });
});

describe('isConsultCancelReason', () => {
  it('다섯 코드만 참이다', () => {
    expect(isConsultCancelReason('duplicate')).toBe(true);
    expect(isConsultCancelReason('중복 신청')).toBe(false);
    expect(isConsultCancelReason(null)).toBe(false);
    expect(isConsultCancelReason(undefined)).toBe(false);
  });
});
