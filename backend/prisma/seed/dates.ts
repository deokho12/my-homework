/**
 * 시드의 날짜 정책. **한 곳에 모아 둔다** — 두 방식이 섞이면 나중에 아무도
 * 어느 쪽이 의도였는지 알 수 없다 (docs/database/README.md §8.5 의 경고).
 *
 * 규칙은 하나다 — **기준일 하나로 통째로 민다** (docs §8.5)
 * ---------------------------------------------------------------------------
 *   FIXTURE_TODAY = 2026-07-30            목 데이터의 "오늘" (consultRequests.ts 주석)
 *   SEED_TODAY    = env SEED_TODAY 또는 시드 실행 시각의 UTC 날짜
 *   shift         = SEED_TODAY - FIXTURE_TODAY   (일 단위 정수. UTC 라 DST 가 없다)
 *
 *   fixture 에 있는 모든 날짜 += shift
 *     - 시각('2026-07-28T09:15:00.000Z') → 그대로 더한다 (시:분:초 보존)  → clock.at()
 *     - 달력일('2026-07-05')             → 더한 뒤 다시 'YYYY-MM-DD' (§3.7) → clock.day()
 *
 * 성질이 곧 근거다.
 *  - 전부 같은 값을 더하므로 **샘플 사이의 간격과 순서가 원본 그대로다.** "상담보다
 *    먼저 도착한 상담 알림" 같은 역전이 구조적으로 생기지 않는다 (예전에는 상담별
 *    오프셋을 알림에 다시 적용하는 두 번째 규칙이 필요했다 — 그 규칙을 없앴다).
 *  - `SEED_TODAY=2026-07-30` 이면 shift = 0 이라 **fixture 원본이 그대로** 들어간다.
 *  - fixture 광고 창 4개가 모두 FIXTURE_TODAY 를 품고 있으므로, 민 뒤에도 반드시
 *    SEED_TODAY 를 품는다 → **광고는 언제 시드해도 보인다** (2026-09-15 에 마지막
 *    광고가 만료돼 테스트가 빨개진 일이 이 규칙을 만든 계기다).
 *
 * **fixture 에 날짜가 아예 없는 것**(프로모션 기간·전문의 검수 시각·약관 시행일)은
 * 밀 원본이 없다. 그것만 `SEED_TODAY` 기준 오프셋을 직접 준다 — `clock.fromToday()`
 * (docs §8.4). 두 방식이 섞인 것이 아니라 적용 대상이 다르다: 있는 날짜는 민다,
 * 없는 날짜는 만든다.
 *
 * 모든 `DateTime` 은 UTC 다. `@default(now())` 를 쓰지 않기로 했으므로(docs §3.6)
 * 시드가 전부 명시적으로 넣는다. 이 파일은 DB 도 요청도 모르는 **순수 함수**만 둔다 —
 * 경계값(달·해·윤일)을 DB 없이 검사하기 위해서다 (`test/seed-dates.spec.ts`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** consultRequests.ts 주석이 밝힌 목 데이터의 "오늘" (~2026-07-30). 미는 기준점이다. */
export const FIXTURE_TODAY = '2026-07-30';

/**
 * 서울 달력 날짜 `YYYY-MM-DD`. **시드의 `오늘` 은 KST 달력일이다** (요청서 15).
 *
 * 예전에는 실행 시각의 **UTC** 날짜였는데, 그러면 15:00Z~24:00Z(= KST 자정~오전 9시)에
 * 시드할 때 시드의 `오늘` 이 KST 의 `어제` 가 되어 **`오늘 내원 예정`·`오늘 들어온 상담`이
 * 0건**이 됐다. 그 지표들의 경계가 전부 `Asia/Seoul` 이므로 시드의 기준일도 KST 인 것이 맞다
 * (`docs/database/README.md` §12.13-B 가 backend-engineer 판단으로 남긴 항목).
 */
const SEOUL_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function seoulDateKey(date: Date): string {
  return SEOUL_DATE_FORMAT.format(date);
}

/**
 * 시드의 "오늘". `SEED_TODAY=YYYY-MM-DD` 로 고정할 수 있다(QA 재현용).
 * 비어 있으면 실행 시각의 **KST 달력 날짜**(위 `seoulDateKey` 참고).
 */
export function resolveSeedToday(raw: string | undefined): Date {
  if (raw && raw.trim()) {
    const value = raw.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`SEED_TODAY 형식이 잘못되었습니다: '${value}' (YYYY-MM-DD 여야 합니다)`);
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`SEED_TODAY 가 실제 날짜가 아닙니다: '${value}'`);
    }

    return parsed;
  }

  // 날짜는 KST 로 고르고, 그 날짜를 **UTC 자정 Date** 로 들고 다닌다 (기존 규약 유지 —
  // `clock.today`·`toDateString` 과 밀기 계산이 전부 그 모양을 전제한다).
  return new Date(`${seoulDateKey(new Date())}T00:00:00.000Z`);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** 'YYYY-MM-DD' (KST 달력일로 쓰는 문자열 날짜. docs §3.7) */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** 내부용. 밖에서 ms 를 직접 더할 일이 없다 — 미는 일은 전부 SeedClock 이 한다. */
function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/**
 * fixture 의 ISO 문자열을 Date 로. 날짜만 있으면 UTC 자정으로 승격한다.
 * (KST 는 UTC+9 라서 UTC 자정은 같은 날 09:00 KST — 화면에 보이는 날짜가 바뀌지 않는다)
 */
export function parseFixtureDate(value: string): Date {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`fixture 날짜를 해석할 수 없습니다: '${value}'`);
  }

  return parsed;
}

/** docs §8.4 의 프로모션 기간(일). 4건 모두 SEED_TODAY 기준 '진행중' 이 된다. */
export const PROMOTION_WINDOWS: Record<string, { start: number; end: number }> = {
  p1: { start: -30, end: 30 },
  p2: { start: -15, end: 45 },
  p3: { start: -45, end: 15 },
  p4: { start: -7, end: 60 },
};

/**
 * 시드가 쓰는 시계. 시드 전체에서 날짜를 만드는 **유일한 통로**다.
 *
 * - `at` / `day` — fixture 에 있는 날짜를 민다 (§8.5)
 * - `fromToday` — fixture 에 날짜가 없어 시드가 만들어 주는 값 (§8.4)
 */
export interface SeedClock {
  /** SEED_TODAY (UTC 자정) */
  readonly today: Date;
  /** SEED_TODAY - 기준일. 일 단위 정수의 ms 값이다 */
  readonly shiftMs: number;
  /** fixture 의 시각/날짜 → 민 Date (시:분:초 보존) */
  at(fixtureIso: string): Date;
  /** fixture 의 달력일 'YYYY-MM-DD' → 민 'YYYY-MM-DD' */
  day(fixtureDay: string): string;
  /** SEED_TODAY ± n일 */
  fromToday(days: number): Date;
  /**
   * **SEED_TODAY(+n일)의 KST 벽시계 시각** → UTC Date (docs §12.13-B).
   *
   * `seoulAt(0, '14:00')` = 오늘 14:00 KST = 오늘 05:00Z. 상담·알림 샘플처럼 **밀 원본이
   * 없는** 데이터가 "오늘 오후 2시" 같은 자리를 잡을 때 쓴다 — `fromToday` 는 UTC 자정
   * 기준이라 시각을 적을 수 없다. 한국은 서머타임이 없어 오프셋이 `+09:00` 하나다.
   */
  seoulAt(days: number, hhmm: string): Date;
}

export function createSeedClock(seedToday: Date, anchor: string = FIXTURE_TODAY): SeedClock {
  const today = startOfUtcDay(seedToday);
  const shiftMs = today.getTime() - parseFixtureDate(anchor).getTime();

  const at = (fixtureIso: string): Date => addMs(parseFixtureDate(fixtureIso), shiftMs);

  return {
    today,
    shiftMs,
    at,
    // day 는 at 위에 세운다 — 두 경로가 따로 계산하면 언젠가 갈라진다
    day: (fixtureDay: string): string => toDateString(at(fixtureDay)),
    fromToday: (days: number): Date => addDays(today, days),
    seoulAt: (days: number, hhmm: string): Date => {
      if (!/^\d{2}:\d{2}$/.test(hhmm)) {
        throw new Error(`시각 형식이 잘못되었습니다: '${hhmm}' (HH:mm 이어야 합니다)`);
      }

      const at = new Date(`${toDateString(addDays(today, days))}T${hhmm}:00.000+09:00`);

      if (Number.isNaN(at.getTime())) {
        throw new Error(`KST 시각을 만들 수 없습니다: day=${days} time='${hhmm}'`);
      }

      return at;
    },
  };
}
