/**
 * 날짜 표기 공용 구현. **표시 시각은 기기 시계가 아니라 `Asia/Seoul` 달력이다** —
 * 해외에서 접속해도 병원이 말한 날짜와 같아야 한다.
 *
 * `10/7 18:20` 한 형태를 상담(`features/consult/consultDisplay.ts`)과
 * 문의(`features/inquiry/inquiryDisplay.ts`)가 함께 쓴다. 두 파일이 각자 `Intl` 포맷터를
 * 들고 있던 동안 같은 값이었고, 한쪽만 고치면 두 관리자 화면의 시각 표기가 조용히 갈린다.
 */

export const SEOUL_TIMEZONE = 'Asia/Seoul';

const DATE_TIME_SHORT_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL_TIMEZONE,
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  // 자정을 `24:00` 이 아니라 `00:00` 으로 적는 것은 `hour12: false` 가 ko-KR 에서 h23 으로 풀리기 때문이다.
  // ECMA-402 는 `hour12` 가 있으면 `hourCycle` 을 무시한다 — 아래 줄은 그 동작을 문서로 남길 뿐이다.
  hour12: false,
  hourCycle: 'h23',
});

/**
 * 로케일이 끼우는 구두점(`10. 7.`)을 버리고 값만 꺼낸다 — 화면 표기(`10/7`)는 우리가 정한다.
 * 파싱할 수 없는 값이면 `null`.
 */
export function dateParts(format: Intl.DateTimeFormat, iso: string | null | undefined): Record<string, string> | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts: Record<string, string> = {};
  for (const part of format.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  return parts;
}

/** `10/7 18:20`. 읽을 수 없으면 `null` — 빈 칸을 지어내지 않는다. */
export function formatDateTimeShort(iso: string | null | undefined): string | null {
  const parts = dateParts(DATE_TIME_SHORT_FORMAT, iso);

  return parts ? `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}` : null;
}

const TODAY_LONG_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL_TIMEZONE,
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

/**
 * `10월 13일 월요일` — 대시보드 인사 줄. **기기 시계의 날짜가 아니라 서울 달력**이라,
 * 해외에서 접속한 담당자도 병원의 오늘을 본다 (숫자 카드의 `오늘` 과 같은 기준).
 */
export function formatTodayLong(now: Date): string {
  const parts = dateParts(TODAY_LONG_FORMAT, now.toISOString());

  return parts ? `${parts.month} ${parts.day}일 ${parts.weekday}` : '';
}
