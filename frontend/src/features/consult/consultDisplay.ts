import type { BadgeTone } from '@/components/Badge';
import { categoryFromLegacy, subFromLegacy } from '@/features/procedure';
import type { ConsultStatus, ProcedureId } from '@/types/domain';

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

/**
 * 로케일이 끼우는 구두점(`10. 7.`)을 버리고 값만 꺼낸다 — 화면 표기(`10/7`)는 우리가 정한다.
 * 파싱할 수 없는 값이면 `null`.
 */
function partsOf(format: Intl.DateTimeFormat, iso: string): Record<string, string> | null {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return null;

  const parts: Record<string, string> = {};
  for (const part of format.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  return parts;
}

/** `10/7`. 읽을 수 없으면 `null`. */
export function formatAppliedAt(iso: string | null | undefined): string | null {
  const parts = iso ? partsOf(APPLIED_FORMAT, iso) : null;

  return parts ? `${parts.month}/${parts.day}` : null;
}

/** `10/9(목) 14:00`. 읽을 수 없으면 `null`. 호출부가 ` 방문` 을 붙인다. */
export function formatVisitAt(iso: string | null | undefined): string | null {
  const parts = iso ? partsOf(VISIT_FORMAT, iso) : null;

  return parts ? `${parts.month}/${parts.day}(${parts.weekday}) ${parts.hour}:${parts.minute}` : null;
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
 * 상담 줄의 세 번째 줄. **확정 방문 일시가 있으면 신청 보조 문구를 대체한다** —
 * 둘 다 보여주면 어느 날짜를 지켜야 하는지가 흐려진다.
 */
export function consultScheduleLine({
  createdAt,
  preferredTime,
  visitAt,
}: ConsultScheduleInput): ConsultScheduleLine | null {
  const visit = formatVisitAt(visitAt);

  if (visit) return { text: `${visit} 방문`, emphasized: true };

  const applied = formatAppliedAt(createdAt);
  const preferred = preferredTime.trim();
  const parts = [applied && `${applied} 신청`, preferred && `${preferred} 연락 희망`].filter(Boolean);

  // 읽을 수 있는 값이 하나도 없으면 줄 자체를 그리지 않는다 — 빈 칸을 지어내지 않는다.
  return parts.length > 0 ? { text: parts.join(' · '), emphasized: false } : null;
}
