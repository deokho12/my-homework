import { describe, expect, it } from 'vitest';

import { getProceduresForSpecialty, PROCEDURE_SPECIALTIES } from '../src/doctor/specialty-procedures';
import { procedures as seedProcedures } from '../prisma/seed/data/procedures';

/**
 * 전공 ↔ 시술 표와 로스터 자동 배정 (docs/database/README.md §17.11, 계약 §22.8).
 *
 * 자동 배정은 **전공 시술 ∩ 병원 시술** 이다. 교집합이 없으면 시술이 13 → 31 로 늘면서
 * 구강악안면외과 전문의 한 명에게 그 병원이 하지도 않는 시술 11개가 붙는다.
 */
describe('PROCEDURE_SPECIALTIES', () => {
  it('31개 시술을 모두 덮는다 — 빠진 시술은 자동 배정에서 조용히 사라진다', () => {
    expect(Object.keys(PROCEDURE_SPECIALTIES)).toEqual(seedProcedures.map((procedure) => procedure.id));
  });

  it('모든 시술에 전공이 1개 이상이다', () => {
    expect(Object.values(PROCEDURE_SPECIALTIES).every((specialties) => specialties.length > 0)).toBe(true);
  });

  it('기존 7개 전공 안의 값만 쓴다 — 새 전공을 만들지 않는다', () => {
    const allowed = new Set([
      '치과보철전문의',
      '치과교정전문의',
      '구강악안면외과전문의',
      '치주과전문의',
      '소아치과전문의',
      '통합치의학과전문의',
      '구강악안면방사선과전문의',
    ]);

    for (const specialties of Object.values(PROCEDURE_SPECIALTIES)) {
      for (const specialty of specialties) expect(allowed.has(specialty)).toBe(true);
    }
  });

  it('임플란트 분야는 보철과 구강악안면외과를 둘 다 둔다 (요청자 결정)', () => {
    expect(PROCEDURE_SPECIALTIES['implant-general']).toEqual(['치과보철전문의', '구강악안면외과전문의']);
  });

  it('소아치과는 불소도포·실란트로 해소되고, 구강악안면방사선과는 의도적으로 비어 있다', () => {
    const withSpecialty = (specialty: string): string[] =>
      Object.keys(PROCEDURE_SPECIALTIES).filter((id) => PROCEDURE_SPECIALTIES[id].includes(specialty));

    expect(withSpecialty('소아치과전문의')).toEqual(['fluoride', 'sealant']);
    expect(withSpecialty('구강악안면방사선과전문의')).toEqual([]);
  });
});

describe('getProceduresForSpecialty — 전공 시술 ∩ 병원 시술', () => {
  it('병원이 취급하지 않는 시술은 붙지 않는다', () => {
    // 구강악안면외과의 전공 시술은 11개지만, 이 병원은 그중 둘만 한다
    const result = getProceduresForSpecialty('구강악안면외과전문의', [
      'implant-general',
      'wisdom-tooth',
      'laminate',
    ]);

    expect(result).toEqual(['implant-general', 'wisdom-tooth']);
  });

  it('교집합이 비면 빈 배열이다 (전공과 무관한 병원)', () => {
    expect(getProceduresForSpecialty('치과교정전문의', ['scaling', 'crown'])).toEqual([]);
  });

  it('일반의는 병원 취급 시술 전체다 — 같은 교집합 규칙의 한 경우다', () => {
    const hospitalProcedures = ['scaling', 'crown', 'wisdom-tooth'];

    expect(getProceduresForSpecialty('일반의', hospitalProcedures)).toEqual(hospitalProcedures);
  });

  it('결과 순서는 병원 시술 목록의 순서를 따른다', () => {
    expect(getProceduresForSpecialty('치주과전문의', ['gum-graft', 'scaling', 'gum-treatment'])).toEqual([
      'gum-graft',
      'scaling',
      'gum-treatment',
    ]);
  });

  it('모르는 시술 id 는 조용히 빠진다 (옛 id 가 남은 병원이 있어도 전공 배정이 터지지 않는다)', () => {
    expect(getProceduresForSpecialty('치과보철전문의', ['implant', 'crown'])).toEqual(['crown']);
  });
});
