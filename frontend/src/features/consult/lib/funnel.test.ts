import { describe, expect, it } from 'vitest';

import { funnelOf, type FunnelInput } from '@/features/consult/lib/funnel';

/**
 * 깔때기 판정 (`docs/database/README.md` §13.6, 계약 `AdminDashboardFunnel`).
 *
 * 경계값을 여기서 고정하는 이유: 이 네 수는 화면에서 **막대 길이**로만 보여 틀려도 눈에
 * 띄지 않는다. 단조 감소와 `연락이 안 됨` 제외 두 가지가 이 함수의 전부다.
 */

function row(status: FunnelInput['status'], cancelReason: FunnelInput['cancelReason'] = null): FunnelInput {
  return { status, cancelReason };
}

describe('funnelOf', () => {
  it('빈 코호트는 전부 0 이다', () => {
    expect(funnelOf([])).toEqual({ requested: 0, contacted: 0, booked: 0, visited: 0, cancelled: 0 });
  });

  it('requested 는 코호트 전체다 — 상태를 가리지 않는다', () => {
    const cohort = [row('new'), row('contacted'), row('booked'), row('visited'), row('cancelled', 'etc')];

    expect(funnelOf(cohort).requested).toBe(5);
  });

  it('신규는 연락 완료가 아니다', () => {
    expect(funnelOf([row('new'), row('new')]).contacted).toBe(0);
  });

  it("'연락이 안 됨' 취소는 연락 완료에서 뺀다 — 연락이 닿지 않았다는 병원 자신의 기록이다", () => {
    const funnel = funnelOf([row('cancelled', 'no_answer'), row('cancelled', 'patient_request')]);

    expect(funnel.contacted).toBe(1);
    expect(funnel.cancelled).toBe(2);
  });

  it('사유가 null 인 과거 취소 건은 연락 완료에 포함된다 — 소급해 추측하지 않는다', () => {
    expect(funnelOf([row('cancelled', null)]).contacted).toBe(1);
  });

  it('예약확정은 booked ∪ visited 이고 내원완료는 visited 뿐이다', () => {
    const funnel = funnelOf([row('booked'), row('visited'), row('visited'), row('contacted')]);

    expect(funnel.booked).toBe(3);
    expect(funnel.visited).toBe(2);
  });

  it('단조 감소가 구조적으로 보장된다 — visited ⊆ booked ⊆ contacted ⊆ requested', () => {
    const cohort: FunnelInput[] = [
      row('new'),
      row('new'),
      row('contacted'),
      row('booked'),
      row('visited'),
      row('cancelled', 'no_answer'),
      row('cancelled', 'duplicate'),
      row('cancelled', null),
    ];

    const { requested, contacted, booked, visited } = funnelOf(cohort);

    expect(requested).toBeGreaterThanOrEqual(contacted);
    expect(contacted).toBeGreaterThanOrEqual(booked);
    expect(booked).toBeGreaterThanOrEqual(visited);
    expect([requested, contacted, booked, visited]).toEqual([8, 5, 2, 1]);
  });

  it('취소는 단계가 아니라 옆에 적는 숫자다 — 단조 사슬에 끼지 않는다', () => {
    const funnel = funnelOf([row('cancelled', 'etc'), row('visited')]);

    expect(funnel.cancelled).toBe(1);
    expect(funnel.booked).toBe(1);
  });
});
