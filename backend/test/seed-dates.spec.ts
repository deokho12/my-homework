import { describe, expect, it } from 'vitest';

import {
  addDays,
  createSeedClock,
  FIXTURE_TODAY,
  parseFixtureDate,
  PROMOTION_WINDOWS,
  resolveSeedToday,
  startOfUtcDay,
  toDateString,
} from '../prisma/seed/dates';

/**
 * 시드 날짜 규칙 단위 테스트 — **DB 를 쓰지 않는다.**
 *
 * docs/database/README.md §8.5 의 규칙은 "fixture 의 모든 날짜에 같은 값(shift)을
 * 더한다" 하나뿐이다. 그 규칙의 성질(간격·순서·시각 보존, 기준일 왕복, 광고 창이
 * 기준일을 포함)을 여기서 고정한다. 경계값을 DB 없이 검사할 수 있는 것이
 * "밀기를 순수 함수로 떼어낸다" 의 이유다 (AGENTS.md — 규칙은 순수 함수).
 */

/** consultRequests.ts 의 createdAt 7개 (fixture 원본). 순서·간격 보존 검사용. */
const CONSULT_FIXTURE_CREATED_AT = [
  '2026-07-28T09:15:00.000Z', // cr1
  '2026-07-20T08:00:00.000Z', // cr2
  '2026-07-15T07:20:00.000Z', // cr3
  '2026-06-25T06:00:00.000Z', // cr4
  '2026-06-10T05:30:00.000Z', // cr5
  '2026-07-29T13:40:00.000Z', // cr6
  '2026-07-05T04:00:00.000Z', // cr7
];

/**
 * hospitals fixture 의 광고 기간 4개 (docs §8.5 의 표).
 *
 * 원본(`prisma/seed/data/hospitals.ts`)을 import 하지 않는다 — 그 파일은
 * `@/config/stockImages` 별칭을 쓰고, 그 별칭은 시드 전용 tsconfig 에만 있다
 * (vitest 는 별칭을 모른다). 값이 갈라지면 `test/seed-data.spec.ts` 가 실제 DB 행으로
 * 잡는다: 거기서 광고 5행이 전부 오늘을 포함하는지 확인한다.
 */
const SPONSORSHIP_WINDOWS = [
  { hospitalId: 'h2', start: '2026-07-05', end: '2026-08-20' },
  { hospitalId: 'h3', start: '2026-07-10', end: '2026-08-15' },
  { hospitalId: 'h5', start: '2026-07-01', end: '2026-08-31' },
  { hospitalId: 'h6', start: '2026-07-15', end: '2026-09-15' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

describe('createSeedClock — fixture 날짜를 기준일 하나로 민다 (docs §8.5)', () => {
  it('SEED_TODAY 가 FIXTURE_TODAY 면 shift 가 0 이고 fixture 원본이 그대로 들어간다', () => {
    const clock = createSeedClock(parseFixtureDate(FIXTURE_TODAY));

    expect(clock.shiftMs).toBe(0);

    for (const value of CONSULT_FIXTURE_CREATED_AT) {
      expect(clock.at(value).toISOString()).toBe(value);
    }

    expect(clock.day('2026-07-05')).toBe('2026-07-05');
    expect(clock.at('2026-07-05').toISOString()).toBe('2026-07-05T00:00:00.000Z');
  });

  it('기준일(FIXTURE_TODAY)은 언제나 SEED_TODAY 로 간다', () => {
    for (const seed of ['2026-10-21', '2025-01-01', '2030-12-31', FIXTURE_TODAY]) {
      const seedToday = parseFixtureDate(seed);
      const clock = createSeedClock(seedToday);

      expect(clock.today.toISOString()).toBe(seedToday.toISOString());
      expect(clock.at(FIXTURE_TODAY).getTime()).toBe(seedToday.getTime());
      expect(clock.day(FIXTURE_TODAY)).toBe(seed);
    }
  });

  it('shift 는 일 단위 정수다 (UTC 라 DST 가 없다)', () => {
    for (const seed of ['2026-10-21', '2025-01-01', '2027-03-01', '2028-02-29']) {
      const clock = createSeedClock(parseFixtureDate(seed));

      expect(Math.abs(clock.shiftMs % DAY_MS)).toBe(0);
    }
  });

  it('간격과 순서가 원본 그대로다 (상담 7건)', () => {
    const clock = createSeedClock(parseFixtureDate('2026-10-21'));

    const original = CONSULT_FIXTURE_CREATED_AT.map((v) => parseFixtureDate(v).getTime());
    const shifted = CONSULT_FIXTURE_CREATED_AT.map((v) => clock.at(v).getTime());

    // 모든 값이 같은 양만큼 움직였다 → 차이가 보존된다
    for (let i = 0; i < original.length; i += 1) {
      expect(shifted[i] - original[i]).toBe(clock.shiftMs);
    }

    // 정렬 순서가 바뀌지 않는다 ("상담보다 먼저 도착한 알림" 이 생기지 않는 근거)
    const orderOf = (times: number[]): number[] =>
      times.map((_, index) => index).sort((a, b) => times[a] - times[b]);

    expect(orderOf(shifted)).toEqual(orderOf(original));
  });

  it('시:분:초를 보존한다 (날짜만 밀고 시각은 그대로)', () => {
    const clock = createSeedClock(parseFixtureDate('2027-03-01'));
    const shifted = clock.at('2026-07-28T09:15:30.250Z');

    expect(shifted.getTime() - startOfUtcDay(shifted).getTime()).toBe(
      9 * 60 * 60 * 1000 + 15 * 60 * 1000 + 30 * 1000 + 250,
    );
  });

  it('날짜만 있는 값은 UTC 자정으로 승격된 뒤 밀린다 → day() 가 항상 YYYY-MM-DD', () => {
    for (const seed of ['2026-10-21', '2027-01-01', '2028-02-29', '2025-11-30']) {
      const clock = createSeedClock(parseFixtureDate(seed));

      for (const window of SPONSORSHIP_WINDOWS) {
        expect(clock.day(window.start)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(clock.day(window.end)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // day() 는 at() 위에 세워져 있다 — 두 경로가 갈라지지 않는다
        expect(clock.day(window.start)).toBe(toDateString(clock.at(window.start)));
      }
    }
  });

  it('달·해 경계를 넘어도 맞다', () => {
    // 2027-01-01: 해를 넘긴다
    const newYear = createSeedClock(parseFixtureDate('2027-01-01'));
    expect(newYear.day(FIXTURE_TODAY)).toBe('2027-01-01');
    // FIXTURE_TODAY 하루 전 → SEED_TODAY 하루 전 (전년 12-31)
    expect(newYear.day('2026-07-29')).toBe('2026-12-31');

    // 2028-02-29: 윤일
    const leap = createSeedClock(parseFixtureDate('2028-02-29'));
    expect(leap.day(FIXTURE_TODAY)).toBe('2028-02-29');
    expect(leap.day('2026-07-31')).toBe('2028-03-01');
    expect(leap.day('2026-07-29')).toBe('2028-02-28');
  });

  it('fromToday 는 SEED_TODAY 기준 오프셋이다 (docs §8.4 — fixture 에 날짜가 없는 것)', () => {
    const seedToday = parseFixtureDate('2026-10-21');
    const clock = createSeedClock(seedToday);

    expect(clock.fromToday(0).getTime()).toBe(seedToday.getTime());
    expect(clock.fromToday(-7).getTime()).toBe(addDays(seedToday, -7).getTime());
    expect(toDateString(clock.fromToday(-1))).toBe('2026-10-20');

    // 프로모션 4건은 모두 SEED_TODAY 를 감싼다
    for (const [id, window] of Object.entries(PROMOTION_WINDOWS)) {
      const start = toDateString(clock.fromToday(window.start));
      const end = toDateString(clock.fromToday(window.end));
      const today = toDateString(seedToday);

      expect(start <= today, `${id} start`).toBe(true);
      expect(end >= today, `${id} end`).toBe(true);
    }
  });

  it('★ 광고 기간 4개는 shift 후에도 반드시 SEED_TODAY 를 포함한다 (docs §8.5 의 보장)', () => {
    const seeds = [
      FIXTURE_TODAY,
      '2026-10-21',
      '2027-01-01',
      '2027-03-01',
      '2028-02-29',
      '2030-06-15',
    ];

    for (const seed of seeds) {
      const clock = createSeedClock(parseFixtureDate(seed));

      for (const window of SPONSORSHIP_WINDOWS) {
        const start = clock.day(window.start);
        const end = clock.day(window.end);

        // 문자열 비교로 충분하다 — 'YYYY-MM-DD' 는 사전순 = 시간순이고,
        // 서버의 광고 판정도 같은 형태의 문자열 비교다 (docs §3.7)
        expect(start <= seed, `${window.hospitalId} start=${start} seed=${seed}`).toBe(true);
        expect(end >= seed, `${window.hospitalId} end=${end} seed=${seed}`).toBe(true);
      }
    }
  });
});

describe('resolveSeedToday', () => {
  it('비어 있으면 실행 시각의 UTC 자정', () => {
    const resolved = resolveSeedToday(undefined);

    expect(resolved.getTime()).toBe(startOfUtcDay(new Date()).getTime());
    expect(resolveSeedToday('').getTime()).toBe(resolved.getTime());
    expect(resolveSeedToday('   ').getTime()).toBe(resolved.getTime());
  });

  it('YYYY-MM-DD 를 UTC 자정으로 읽는다', () => {
    expect(resolveSeedToday('2026-08-12').toISOString()).toBe('2026-08-12T00:00:00.000Z');
    expect(resolveSeedToday(' 2026-08-12 ').toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });

  it('형식이 틀리거나 실제 날짜가 아니면 던진다', () => {
    expect(() => resolveSeedToday('2026/08/12')).toThrow(/형식/);
    expect(() => resolveSeedToday('오늘')).toThrow(/형식/);
    expect(() => resolveSeedToday('2026-13-01')).toThrow(/실제 날짜/);
  });
});
