import type { BadgeTone } from '@/components/Badge';
import { seoulDateKey } from '@/features/consult/lib/transition';
import { categoryFromLegacy, subFromLegacy } from '@/features/procedure';
import { dateParts, formatDateTimeShort } from '@/lib/dateFormat';
import {
  CONSULT_CANCEL_REASON_LABEL,
  CONSULT_STATUS_LABEL,
  type ConsultStatus,
  type ConsultStatusChange,
  type ProcedureId,
} from '@/types/domain';

/** 문의 화면과 같은 `10/7 18:20` 을 쓴다 — 구현은 `lib/dateFormat.ts` 하나다. */
export { formatDateTimeShort };

/**
 * 상담 한 건을 **화면 문자열로 바꾸는 순수 모듈**. React 도 네트워크도 모른다.
 *
 * 마이페이지의 상담 내역과 관리자 상담 목록이 같은 판정을 쓰게 하려고 한 곳에 모았다 —
 * 예전에는 상태 칩 색이 관리자 화면에 `status === 'booked' ? 'brand' : 'neutral'` 로 박혀
 * 있어, 두 화면이 같은 상담을 다른 색으로 보여줄 수 있었다.
 */

/**
 * 상태 → 칩 색. `Record<ConsultStatus, BadgeTone>` 이라 상태가 늘면 **컴파일 에러로** 누락이 잡힌다.
 * 라벨은 여기서 정하지 않는다 — `CONSULT_STATUS_LABEL`(`types/domain.ts`) 하나뿐이다.
 */
export const CONSULT_STATUS_TONE: Record<ConsultStatus, BadgeTone> = {
  new: 'info', // 아직 병원이 보지 않았다 — 눈에 띄되 완료가 아니다
  contacted: 'warning', // 진행중
  booked: 'brand', // 사용자가 기다리던 상태
  // 내원완료에 brand 를 주지 않는 이유: 마이페이지가 같은 표를 쓰고, 거기서 brand 는
  // "예정된 방문이 있다" 는 뜻이다. 이미 다녀온 건은 할 일이 아니다.
  visited: 'neutral',
  cancelled: 'neutral', // 종결
};

/** 시술을 고르지 않고 신청한 건. 관리자 화면과 같은 말을 쓴다. */
export const NO_PROCEDURE_LABEL = '시술 미지정';

/**
 * 서버 시술 id → `{대분류} · {세부시술}` (`cavity` → `충치치료 · 레진`).
 *
 * taxonomy 가 모르는 id 면 `null` — 호출부는 그 줄을 그리지 않는다. 상담 신청 화면의 칩
 * 라벨도 같은 함수를 쓴다 (`pages/ConsultRequestPage.tsx`).
 */
export function procedurePairLabel(procedureId: ProcedureId): string | null {
  const category = categoryFromLegacy(procedureId);
  const sub = subFromLegacy(procedureId);

  return category && sub ? `${category.name} · ${sub.name}` : null;
}

/**
 * 상담 한 건의 시술 라벨. `null`(고르지 않음)은 `시술 미지정`, 모르는 id 는 `null` 이다 —
 * 모르는 id 를 "미지정" 이라 적으면 거짓말이 된다 (고르긴 골랐는데 우리가 모르는 것이다).
 */
export function consultProcedureLabel(procedureId: ProcedureId | null): string | null {
  return procedureId === null ? NO_PROCEDURE_LABEL : procedurePairLabel(procedureId);
}

/* ------------------------------------------------------------------ 날짜 */

const SEOUL = 'Asia/Seoul';

/**
 * 표시 시각은 **기기 시계가 아니라 `Asia/Seoul` 달력**이다 — 해외에서 접속해도 병원이 말한
 * 날짜와 같아야 한다. 상대 표기(`오늘 신청`)와 연도는 쓰지 않는다.
 */
const APPLIED_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL,
  month: 'numeric',
  day: 'numeric',
});

const VISIT_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL,
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  // 자정을 `24:00` 이 아니라 `00:00` 으로 적는 것은 `hour12: false` 가 ko-KR 에서 h23 으로 풀리기 때문이다.
  // ECMA-402 는 `hour12` 가 있으면 `hourCycle` 을 무시한다 — 아래 줄은 그 동작을 문서로 남길 뿐이다.
  // `hour12` 를 빼고 `hourCycle` 만 두면 hourCycle 을 모르는 엔진에서 12시간제로 떨어져 오전/오후가
  // 버려진 틀린 시각이 나온다. 지금 형태가 더 안전한 쪽으로 실패한다 (테스트가 00:30 을 고정).
  hour12: false,
  hourCycle: 'h23',
});

/** `10/7`. 읽을 수 없으면 `null`. */
export function formatAppliedAt(iso: string | null | undefined): string | null {
  const parts = dateParts(APPLIED_FORMAT, iso);

  return parts ? `${parts.month}/${parts.day}` : null;
}

/** `10/9(금) 14:00`. 읽을 수 없으면 `null`. 호출부가 ` 방문` 을 붙인다. */
export function formatVisitAt(iso: string | null | undefined): string | null {
  const parts = dateParts(VISIT_FORMAT, iso);

  return parts ? `${parts.month}/${parts.day}(${parts.weekday}) ${parts.hour}:${parts.minute}` : null;
}

/**
 * `10월 9일(금) 14:00` — **환자에게 가는 알림 문구 전용**이다 (계약
 * `AppNotification.message`: `예약 일시가 '{...}'(으)로 변경되었어요`).
 * 화면 안에서는 좁은 자리에 들어가는 `formatVisitAt` 을 쓴다.
 */
export function formatVisitAtLong(iso: string | null | undefined): string | null {
  const parts = dateParts(VISIT_FORMAT, iso);

  return parts ? `${parts.month}월 ${parts.day}일(${parts.weekday}) ${parts.hour}:${parts.minute}` : null;
}

/** `2026-10-13` — 서울 달력의 오늘. `<input type="date" min>` 이 쓴다. */
export function todayInSeoul(now: Date): string {
  return seoulDateKey(now);
}

const VISIT_INPUT_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: SEOUL,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

/**
 * 확정 일시 → 폼의 두 칸(`날짜`·`시간`). **저장값은 UTC 한 시각이고 입력은 서울 달력**이라
 * 변환이 필요하다. 읽을 수 없으면 빈 칸이다 (틀린 값을 미리 채우지 않는다).
 */
export function toVisitAtInputs(iso: string | null | undefined): { date: string; time: string } {
  const parts = dateParts(VISIT_INPUT_FORMAT, iso);

  if (!parts || !iso) return { date: '', time: '' };

  return { date: seoulDateKey(new Date(iso)), time: `${parts.hour}:${parts.minute}` };
}

/**
 * 폼의 두 칸 → 저장값(UTC). 한 칸이라도 비면 `null` 이다 — **반쪽짜리 약속은 만들지 않는다.**
 * 한국은 서머타임이 없어 오프셋이 `+09:00` 하나다.
 */
export function visitAtFromInputs(date: string, time: string): string | null {
  if (!date || !time) return null;

  const at = new Date(`${date}T${time}:00+09:00`);

  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export interface ConsultScheduleInput {
  createdAt: string;
  /** 예전 데이터에는 빈 문자열이 있다 (`mocks/fixtures/consultRequests.ts`). */
  preferredTime: string;
  /**
   * 병원이 확정한 방문 일시. **아직 어떤 데이터 소스에도 없다** — 요청서 `2026-10-12-04`
   * 에서 `MyConsultRequest.visitAt` 이 생기면 화면이 이 인자에 그 값을 넘긴다.
   */
  visitAt: string | null;
}

export interface ConsultScheduleLine {
  text: string;
  /** 확정 일시는 사용자가 기다리던 정보라 강조한다. 보조 문구는 그렇지 않다. */
  emphasized: boolean;
}

/**
 * 관리자 카드·상세의 방문 줄. **확정 방문 일시가 있으면 희망 시간을 대체한다** —
 * 둘 다 보여주면 어느 날짜를 지켜야 하는지가 흐려진다.
 *
 * 마이페이지의 `consultScheduleLine` 과 **같은 규칙을 공유한다** (그쪽은 신청일이 한 조각 더
 * 붙을 뿐이다). 두 화면이 각자 판정하면 같은 상담이 두 날짜를 말하게 된다.
 */
export function consultVisitLine({
  preferredTime,
  visitAt,
}: Omit<ConsultScheduleInput, 'createdAt'>): ConsultScheduleLine | null {
  const visit = formatVisitAt(visitAt);

  if (visit) return { text: `${visit} 방문`, emphasized: true };

  const preferred = preferredTime.trim();

  return preferred ? { text: `${preferred} 연락 희망`, emphasized: false } : null;
}

/**
 * 마이페이지 상담 줄의 세 번째 줄. 확정 일시가 있으면 `consultVisitLine` 과 같은 줄이고,
 * 없을 때만 `M/D 신청` 이 앞에 붙는다.
 */
export function consultScheduleLine({
  createdAt,
  preferredTime,
  visitAt,
}: ConsultScheduleInput): ConsultScheduleLine | null {
  const line = consultVisitLine({ preferredTime, visitAt });

  if (line?.emphasized) return line;

  const applied = formatAppliedAt(createdAt);
  const parts = [applied && `${applied} 신청`, line?.text].filter(Boolean);

  // 읽을 수 있는 값이 하나도 없으면 줄 자체를 그리지 않는다 — 빈 칸을 지어내지 않는다.
  return parts.length > 0 ? { text: parts.join(' · '), emphasized: false } : null;
}

/* ------------------------------------------------------------------ 지연 */

/** `지연` 판정 기준. 경과 시간이라 **시간대와 무관하다**. */
export const CONSULT_DELAY_MS = 24 * 60 * 60 * 1000;

/**
 * `지연` 배지 — **서버가 저장하지도 내려주지도 않는다.** 받는 순간부터 늙기 시작하는 값이라
 * 캐시에 남으면 거짓이 되고, 판정에 필요한 두 값이 이미 응답에 있다 (계약 `GET /consult-requests`).
 *
 * 목록 카드와 상세가 **같은 함수**를 쓴다 — 한쪽만 고치면 같은 상담이 한 화면에서 지연,
 * 다른 화면에서 정상으로 보인다.
 */
export function isConsultDelayed(
  { status, createdAt }: { status: ConsultStatus; createdAt: string },
  now: number
): boolean {
  if (status !== 'new') return false;

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;

  return now - created >= CONSULT_DELAY_MS;
}

/* ------------------------------------------------------------------ 처리 이력 */

/** 접수 행 = 행위자가 없는 `신규` 행. 그 줄만 "누가" 와 알림이 없다. */
function isIntakeRow(change: ConsultStatusChange): boolean {
  return change.event !== 'reschedule' && change.status === 'new' && !change.changedByName;
}

/**
 * 처리 이력 한 줄 — `{M/D HH:mm} {무엇} · {누가}[ · 환자 알림 발송]`.
 *
 * **알림 문구는 저장된 사실(`notified`)이 말할 때만** 붙인다. "모든 변경은 알림을 보낸다" 는
 * 규칙으로 파생하면, 억제 규칙이 생기는 날 과거 이력의 표시가 소급해 거짓이 된다.
 *
 * 모르는 상태 코드는 **죽지 않고 원문을 그대로** 보여준다 (계약 §15 의 enum 방어).
 */
export function consultHistoryLine(change: ConsultStatusChange): string {
  const at = formatDateTimeShort(change.changedAt);
  const visit = formatVisitAt(change.visitAt);
  const label = CONSULT_STATUS_LABEL[change.status] ?? change.status;

  const what = isIntakeRow(change)
    ? '앱에서 상담 신청'
    : change.event === 'reschedule'
      ? ['일시 변경', visit].filter(Boolean).join(' ')
      : // 확정 일시 스냅샷은 그것이 이 이벤트의 결과인 `예약확정` 행에만 붙인다 —
        // `내원완료` 행에도 붙이면 "언제 왔는가"(= `changedAt`)와 섞여 읽힌다.
        [label, change.status === 'booked' ? visit : null].filter(Boolean).join(' ');

  const reason = change.status === 'cancelled' ? change.cancelReason : null;

  return [
    [at, what].filter(Boolean).join(' '),
    reason ? CONSULT_CANCEL_REASON_LABEL[reason] : null,
    change.changedByName,
    change.notified ? '환자 알림 발송' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
