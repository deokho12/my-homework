/**
 * 시드의 날짜 정책. **한 곳에 모아 둔다** — 두 방식이 섞이면 나중에 아무도
 * 어느 쪽이 의도였는지 알 수 없다 (docs/database/README.md §8.5 의 경고).
 *
 * 정책 (선택한 것)
 * ---------------------------------------------------------------------------
 * 1. **상담 7건은 `SEED_TODAY` 기준 상대 오프셋**으로 넣는다 (docs §8.5 표 그대로).
 *    fixture 의 2026-06~07 고정 날짜를 그대로 넣으면 `/admin` 의
 *    '이번 달 신규 상담' 이 언제 시드해도 0 이 되기 때문이다.
 * 2. 상담의 **상태 변경 이력·메모**, 그리고 그 상담을 가리키는 **알림**은
 *    같은 상담의 delta 만큼 함께 밀어서 원본의 상대 간격을 보존한다.
 *    (알림이 상담보다 먼저 생긴 데이터가 되면 안 된다)
 * 3. **프로모션 4건**은 `SEED_TODAY` 를 감싸는 기간을 부여한다 (docs §8.4).
 * 4. 그 밖의 콘텐츠(후기·꿀팁·커뮤니티, 전체 공지 알림)는 **fixture 날짜를 그대로**
 *    쓴다. 날짜만 있는 값(`'2026-06-02'`)은 `T00:00:00.000Z` 로 승격한다 (docs §3.7).
 *
 * 모든 `DateTime` 은 UTC 다. `@default(now())` 를 쓰지 않기로 했으므로(docs §3.6)
 * 시드가 전부 명시적으로 넣는다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** consultRequests.ts 주석이 밝힌 목 데이터의 "오늘" (~2026-07-30). */
export const FIXTURE_TODAY = '2026-07-30';

/**
 * 시드의 "오늘". `SEED_TODAY=YYYY-MM-DD` 로 고정할 수 있다(QA 재현용).
 * 비어 있으면 실행 시각의 UTC 날짜.
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

  return startOfUtcDay(new Date());
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

export function addMs(date: Date, ms: number): Date {
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

/**
 * docs §8.5 의 상담별 오프셋(일). `SEED_TODAY` 에서 이만큼 뺀 날짜로 옮긴다.
 * 원본의 시각(hh:mm:ss)은 유지한다.
 */
export const CONSULT_DAY_OFFSETS: Record<string, number> = {
  cr1: -2,
  cr2: -10,
  cr3: -15,
  cr4: -45,
  cr5: -50,
  cr6: -1,
  cr7: -25,
};

/** docs §8.4 의 프로모션 기간(일). 4건 모두 SEED_TODAY 기준 '진행중' 이 된다. */
export const PROMOTION_WINDOWS: Record<string, { start: number; end: number }> = {
  p1: { start: -30, end: 30 },
  p2: { start: -15, end: 45 },
  p3: { start: -45, end: 15 },
  p4: { start: -7, end: 60 },
};

/**
 * 상담 한 건의 시간 이동량을 계산한다.
 *
 * @returns `shiftedCreatedAt` 과, 그 상담에 딸린 모든 시각에 더할 `deltaMs`
 */
export function consultShift(
  consultId: string,
  originalCreatedAt: string,
  seedToday: Date,
): { createdAt: Date; deltaMs: number } {
  const original = parseFixtureDate(originalCreatedAt);
  const offsetDays = CONSULT_DAY_OFFSETS[consultId];

  if (offsetDays === undefined) {
    // fixture 에 새 상담이 추가되면 여기서 걸린다. 조용히 원본 날짜를 쓰지 않는다.
    throw new Error(
      `상담 '${consultId}' 의 날짜 오프셋이 prisma/seed/dates.ts 에 없습니다. ` +
        `docs/database/README.md §8.5 표에 맞춰 추가하세요.`,
    );
  }

  const timeOfDayMs = original.getTime() - startOfUtcDay(original).getTime();
  const createdAt = addMs(addDays(seedToday, offsetDays), timeOfDayMs);

  return { createdAt, deltaMs: createdAt.getTime() - original.getTime() };
}
