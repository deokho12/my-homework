import type { BusinessHourEntry } from '@/types/domain';

/**
 * 진료시간 문자열 판정. **DB 도 요청도 모르는 순수 함수**라 경계값을 테스트로 고정할 수 있다
 * (`AGENTS.md` — 판정 규칙은 순수 함수로).
 *
 * `hours` 는 관리자가 직접 적는 자유 문자열이다 (`10:00 - 19:00`, `휴진`, `예약제`…).
 * **못 읽으면 지어내지 않고 `unknown` 을 돌려준다** — 화면은 그때 배지를 숨긴다.
 * 기준 시간대는 서울이다 (서버의 광고 기간 판정과 같은 기준).
 */

const SEOUL = 'Asia/Seoul';

/** 요일만 한국어로 꺼낸다 — `businessHours[].day` 가 `월`/`월요일` 로 적혀 있다. */
const SEOUL_WEEKDAY = new Intl.DateTimeFormat('ko-KR', { timeZone: SEOUL, weekday: 'short' });

/** 시각은 숫자로만 받는다 (ko-KR 은 `오후 9시` 처럼 꾸며서 준다). */
const SEOUL_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: SEOUL,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

/** `10:00 - 19:00` · `10:00~19:00` · `오전 9시…` 중 읽을 수 있는 것은 `HH:MM` 두 쌍뿐이다. */
const HOURS_PATTERN = /(\d{1,2}):(\d{2})\s*[-~–—]\s*(\d{1,2}):(\d{2})/;

export type OpenStatus = 'open' | 'closed' | 'unknown';

export interface TodayHours {
  /** 오늘 요일 줄. 오늘 요일이 등록돼 있지 않으면 null. */
  entry: BusinessHourEntry | null;
  /** `진료중`(open) · `진료 종료`(closed) · 배지를 숨김(unknown). */
  status: OpenStatus;
  /** `open` 일 때의 종료 시각 `21:00`. 그 밖에는 null. */
  closesAt: string | null;
}

function seoulNow(now: Date): { weekday: string; minutes: number } | null {
  const weekday = SEOUL_WEEKDAY.formatToParts(now).find((part) => part.type === 'weekday')?.value.trim();
  const clock = SEOUL_CLOCK.formatToParts(now);
  const hour = Number(clock.find((part) => part.type === 'hour')?.value);
  const minute = Number(clock.find((part) => part.type === 'minute')?.value);

  if (!weekday || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return { weekday, minutes: hour * 60 + minute };
}

function parseRange(hours: string): { start: number; end: number; endLabel: string } | null {
  const match = HOURS_PATTERN.exec(hours);

  if (!match) return null;

  const [, startHour, startMinute, endHour, endMinute] = match.map(Number);

  if (startHour > 24 || endHour > 24 || startMinute > 59 || endMinute > 59) return null;

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  // 자정을 넘는 표기(`21:00 - 01:00`)는 읽지 않는다 — 쓰는 병원이 없고, 추측하면 틀린
  // `진료중` 을 보여주게 된다. 읽을 수 없는 문자열과 같게 다룬다.
  if (end <= start) return null;

  return { start, end, endLabel: `${String(endHour).padStart(2, '0')}:${match[4]}` };
}

/**
 * 오늘 요일 줄을 찾는다. `진료시간` 목록의 오늘 강조와 요약 카드가 **같은 함수**를 쓴다 —
 * 두 곳이 다른 요일을 오늘이라고 말하지 않게.
 */
export function findTodayEntry(
  businessHours: readonly BusinessHourEntry[],
  now: Date
): BusinessHourEntry | null {
  const seoul = seoulNow(now);

  if (!seoul) return null;

  // `day` 가 `월` 이든 `월요일` 이든 같은 줄을 가리킨다.
  return businessHours.find((entry) => entry.day.startsWith(seoul.weekday)) ?? null;
}

/** 오늘 줄 + `진료중` 판정. 등록이 없거나 문자열을 못 읽으면 `unknown`. */
export function readTodayHours(
  businessHours: readonly BusinessHourEntry[],
  now: Date
): TodayHours {
  const entry = findTodayEntry(businessHours, now);

  if (!entry) return { entry: null, status: 'unknown', closesAt: null };
  if (entry.isClosed) return { entry, status: 'closed', closesAt: null };

  const seoul = seoulNow(now);
  const range = parseRange(entry.hours);

  if (!seoul || !range) return { entry, status: 'unknown', closesAt: null };

  // 시작 정각은 진료중, 종료 정각은 종료다 — 끝나는 시각에 가면 이미 닫혀 있다.
  const open = seoul.minutes >= range.start && seoul.minutes < range.end;

  return { entry, status: open ? 'open' : 'closed', closesAt: open ? range.endLabel : null };
}

/** `21:00` → `21시까지` (정각이 아니면 `21:30까지`). 접힌 요약 한 줄이 쓴다. */
export function closesAtLabel(closesAt: string): string {
  const [hour, minute] = closesAt.split(':');

  return minute === '00' ? `${Number(hour)}시까지` : `${Number(hour)}:${minute}까지`;
}
