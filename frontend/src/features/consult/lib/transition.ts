import type { ConsultCancelReason, ConsultStatus, ConsultStatusChange } from '@/types/domain';

/**
 * 상담 상태 변경의 **판정 규칙**. 저장소도 요청도 React 도 모르는 순수 함수만 둔다 —
 * `docs/database/README.md` §12.7 이 서버에 요구한 것과 **같은 이름·같은 경계값**이고,
 * 서버가 생기면 그쪽 `consult/transition.ts` 와 이 파일이 같은 표를 구현하게 된다.
 *
 * 같은 판정을 두 곳에 두지 않기 위해, 화면(상태 폼)과 api 흉내(`api/consultApi.ts`)가
 * **둘 다 여기를 부른다** — 폼이 "저장할 수 있는가" 를 판정하는 규칙과 api 가 `422` 를
 * 던지는 규칙이 갈리면, 버튼이 눌리는데 저장이 안 되는 화면이 된다.
 *
 * `지연` 배지만 여기 없다. 그것은 저장·전이와 무관한 **표시 규칙**이라
 * `consultDisplay.ts`(`isConsultDelayed`)에 있다.
 */

/** 기간 필터 프리셋 (`GET /consult-requests` 의 `period`). */
export type ConsultPeriod = 'today' | 'thisWeek' | 'last30';

/** 이 요청이 무엇인지. `noop` 은 "부수효과 없음" 이지 오류가 아니다. */
export type ConsultEventKind = 'noop' | 'status_change' | 'reschedule';

export interface ConsultTransitionState {
  status: ConsultStatus;
  /** **이미 결정된** 확정 일시다 (`nextVisitAt` 의 결과). 요청 본문의 날것이 아니다. */
  visitAt: string | null;
  cancelReason: ConsultCancelReason | null;
}

/**
 * 1. **전이는 전부 허용한다. 검증하는 것은 "필요한 입력이 왔는가" 뿐이다.**
 *
 * 전이표를 두지 않은 이유: 막을 전이를 찾지 못했다 — 걸어 들어온 환자는 `신규` 에서 바로
 * `내원완료` 로 가고, 오기입 정정(`내원완료` 를 눌렀는데 안 왔다)은 역방향으로도 간다.
 */
export function requiredInputs(next: ConsultStatus): ReadonlyArray<'visitAt' | 'cancelReason'> {
  if (next === 'booked') return ['visitAt'];
  if (next === 'cancelled') return ['cancelReason'];

  return [];
}

/**
 * 초·밀리초를 0 으로 깎는다. 입력 단위가 분이고, 깎지 않으면 같은 약속이 초 자릿수로 갈려
 * **no-op 비교가 거짓 양성**을 낸다. 읽을 수 없는 값은 `null` 이다.
 */
export function truncateToMinute(iso: string | null | undefined): string | null {
  if (!iso) return null;

  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;

  return new Date(time - (time % 60_000)).toISOString();
}

/**
 * 2. 결과 일시는 **상태가 정한다** (`docs/database/README.md` §12.2).
 *
 * `booked` 는 요청값 ?? 현재값 — 둘 다 없으면 `requiredInputs` 쪽 검사가 먼저 막는다.
 * `visited` 는 현재값 유지(언제 오기로 했던 건인가는 내원 기록의 일부다), 그 밖은 `null`
 * (취소된 건의 카드와 환자 마이페이지에 지난 약속이 남으면 **환자에게 거짓**이 된다).
 */
export function nextVisitAt(
  next: ConsultStatus,
  currentVisitAt: string | null,
  requestedVisitAt?: string | null
): string | null {
  if (next === 'booked') return truncateToMinute(requestedVisitAt ?? currentVisitAt);
  if (next === 'visited') return truncateToMinute(currentVisitAt);

  return null;
}

function sameMinute(a: string | null, b: string | null): boolean {
  return truncateToMinute(a) === truncateToMinute(b);
}

/**
 * 3. 이 요청이 무엇인가 — **no-op 판정과 이벤트 종류를 한 함수가 정한다.**
 *
 * 부르는 쪽은 `requested.visitAt` 에 `nextVisitAt` 의 결과를 넣는다. 날것의 요청값을 넣으면
 * "`booked` 를 일시 없이 다시 보냄" 이 일시 변경으로 잘못 읽힌다.
 *
 * ⚠ 계약의 표는 "세 값이 모두 같다 → no-op" 이라고만 적고, **상태가 `cancelled` 그대로인데
 * 사유만 다른 요청**은 어느 칸에도 넣지 않았다. 여기서는 DB 문서의 순수 함수를 따라 `noop`
 * 으로 떨어뜨린다 (화면도 그 요청을 만들지 않는다 — 현재 상태를 다시 고르면 staged 를 비운다).
 */
export function classifyEvent(current: ConsultTransitionState, requested: ConsultTransitionState): ConsultEventKind {
  if (requested.status !== current.status) return 'status_change';
  if (current.status === 'booked' && !sameMinute(requested.visitAt, current.visitAt)) return 'reschedule';

  return 'noop';
}

/* ------------------------------------------------------------------ 기간 */

const SEOUL = 'Asia/Seoul';

/** `2026-10-12` — **기기 시계가 아니라 서울 달력의 오늘**. */
const SEOUL_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 서울 달력 날짜 `YYYY-MM-DD`. `<input type="date" min>` 과 기간 경계가 같은 값을 쓴다. */
export function seoulDateKey(now: Date): string {
  return SEOUL_DATE_FORMAT.format(now);
}

/**
 * 서울 달력 날짜의 자정(그 순간의 UTC 시각). 한국은 서머타임이 없어 오프셋이 `+09:00` 하나라,
 * 문자열에 오프셋을 적는 것이 가장 짧고 틀리지 않는 방법이다.
 */
function seoulMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

/** 서울 달력에서 `days` 일 뒤의 날짜 키. 달·해 넘김은 `Date.UTC` 가 처리한다. */
function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** 월요일을 0 으로 세는 요일 번호. 주의 시작이 월요일이라 일요일이 6 이다. */
function mondayBasedWeekday(dateKey: string): number {
  return (new Date(`${dateKey}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * 5. 기간 필터 경계 — **`Asia/Seoul` 달력, 반열린 구간 `[from, to)`**.
 *
 * | 값 | 범위 (KST) |
 * |---|---|
 * | `today` | 오늘 00:00 ~ 내일 00:00 |
 * | `thisWeek` | 이번 주 **월요일** 00:00 ~ 다음 주 월요일 00:00 |
 * | `last30` | 오늘 00:00 − 29일 ~ 내일 00:00 (**오늘을 포함한** 30일) |
 *
 * 경계를 여기서 못 박는 이유: 주의 시작 요일과 30일의 포함 범위는 문서마다 다르게 읽히는
 * 값이고, 목록과 탭 숫자가 **같은 함수**에서 나오지 않으면 둘이 어긋난다.
 */
export function periodRange(period: ConsultPeriod, now: Date): readonly [Date, Date] {
  const today = seoulDateKey(now);
  const tomorrow = addDays(today, 1);

  if (period === 'today') return [seoulMidnight(today), seoulMidnight(tomorrow)];

  if (period === 'thisWeek') {
    const monday = addDays(today, -mondayBasedWeekday(today));

    return [seoulMidnight(monday), seoulMidnight(addDays(monday, 7))];
  }

  return [seoulMidnight(addDays(today, -29)), seoulMidnight(tomorrow)];
}

/**
 * 6. 현재 취소 사유는 **저장하지 않고 이력에서 파생한다** (`docs/database/README.md` §12.4).
 *
 * 현재 상태가 `cancelled` 가 아니면 자동으로 `null` 이라, 재오픈(취소 → 연락중)에 사유를
 * 지우는 절차가 따로 없다.
 */
export function cancelReasonOf(
  status: ConsultStatus,
  history: readonly ConsultStatusChange[]
): ConsultCancelReason | null {
  if (status !== 'cancelled') return null;

  return [...history].reverse().find((change) => change.status === 'cancelled')?.cancelReason ?? null;
}
