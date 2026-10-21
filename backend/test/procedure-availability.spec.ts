import { describe, expect, it } from 'vitest';

import { computeProcedureAvailability } from '../src/procedure/availability';

/**
 * `준비중` 판정의 경계값 (docs/database/README.md §17.7).
 *
 * DB 없이 돈다 — 판정이 집계 결과만 받는 순수 함수이기 때문이다. "앱에 노출되는
 * 병원" 의 정의(삭제된 병원 제외)는 이 함수가 아니라 집계 질의의 몫이라
 * `procedure.e2e.spec.ts` 가 실제 DB 로 고정한다.
 */
describe('computeProcedureAvailability', () => {
  it('등록한 공개 병원이 0곳이면 준비중이다', () => {
    const result = computeProcedureAvailability(['scaling'], new Map([['scaling', 0]]));

    expect(result.get('scaling')).toBe(false);
  });

  it('집계에 아예 없는 시술도 0곳이므로 준비중이다', () => {
    const result = computeProcedureAvailability(['halitosis'], new Map());

    expect(result.get('halitosis')).toBe(false);
  });

  it('1곳이면 열린다 (경계)', () => {
    const result = computeProcedureAvailability(['scaling'], new Map([['scaling', 1]]));

    expect(result.get('scaling')).toBe(true);
  });

  it('시술마다 따로 판정한다 — 31개를 한 번에 받는다', () => {
    const result = computeProcedureAvailability(
      ['implant-general', 'scaling', 'crown'],
      new Map([
        ['implant-general', 4],
        ['crown', 2],
      ]),
    );

    expect([...result]).toEqual([
      ['implant-general', true],
      ['scaling', false],
      ['crown', true],
    ]);
  });

  it('집계에만 있고 카탈로그에 없는 id 는 결과에 넣지 않는다', () => {
    // 옛 id 가 남은 자식 행이 있어도 응답에 유령 시술이 생기지 않아야 한다.
    const result = computeProcedureAvailability(['scaling'], new Map([['implant', 3]]));

    expect([...result.keys()]).toEqual(['scaling']);
  });
});
