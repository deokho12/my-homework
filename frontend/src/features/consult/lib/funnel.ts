import type { ConsultCancelReason, ConsultStatus } from '@/types/domain';

/**
 * `이번 달 상담 흐름` 깔때기의 **판정 규칙**. 저장소도 요청도 React 도 모르는 순수 함수다 —
 * `docs/database/README.md` §13.6 이 서버에 요구한 것과 **같은 이름·같은 규칙**이고,
 * 서버가 생기면 그쪽 `consult/funnel.ts` 와 이 파일이 같은 표를 구현하게 된다
 * (`transition.ts` 와 같은 규약).
 *
 * **각 단계는 `현재 상태`로 판정한다. 이력을 거슬러 세지 않는다** — 상담 목록의 상태 탭과
 * 같은 축이어야 담당자가 막대를 보고 탭을 눌러 숫자를 대조할 수 있다.
 */

/**
 * 한 건이 깔때기에 들어갈 때 필요한 값 전부.
 *
 * `cancelReason` 은 저장된 컬럼이 아니라 이력에서 파생한 현재 값이다 (`cancelReasonOf`) —
 * 이 함수는 **이미 파생된 값을 받는다**. 과거 취소 건은 `null` 이다.
 */
export interface FunnelInput {
  status: ConsultStatus;
  cancelReason: ConsultCancelReason | null;
}

export interface Funnel {
  requested: number;
  contacted: number;
  booked: number;
  visited: number;
  cancelled: number;
}

/**
 * `연락이 안 됨` 으로 닫힌 건은 **연락이 닿지 않았다는 병원 자신의 기록**이다.
 * 세면 `연락 완료` 막대가 "연락을 **시도**한 건" 이 되어 쓸모가 없어진다.
 */
function neverReached(consult: FunnelInput): boolean {
  return consult.status === 'cancelled' && consult.cancelReason === 'no_answer';
}

/**
 * 코호트(이번 달 접수 건) 하나의 깔때기.
 *
 * 단조 감소가 **구조적으로** 보장된다:
 * `visited ⊆ {booked, visited} ⊆ {신규가 아니고 연락 불발로 닫히지 않은 건} ⊆ 코호트`.
 * 깔때기가 중간에서 부풀어 오르는 그림은 나올 수 없다.
 *
 * ⚠ `contacted` 는 라벨(`연락 완료`)과 규칙이 1:1 이 아니다 — 정확히는 "신규를 벗어났고,
 * 연락 불발로 닫히지 않은 건" 이다 (`docs/database/README.md` §13.6 이 적어 둔 한계).
 */
export function funnelOf(cohort: ReadonlyArray<FunnelInput>): Funnel {
  return {
    requested: cohort.length,
    contacted: cohort.filter((consult) => consult.status !== 'new' && !neverReached(consult)).length,
    booked: cohort.filter((consult) => consult.status === 'booked' || consult.status === 'visited').length,
    visited: cohort.filter((consult) => consult.status === 'visited').length,
    // 취소는 **단계가 아니라 옆에 적는 숫자**다 — 어느 단계에서든 일어나 단조 감소를 설명하지 못한다.
    cancelled: cohort.filter((consult) => consult.status === 'cancelled').length,
  };
}
