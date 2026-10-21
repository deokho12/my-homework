import { describe, expect, it } from 'vitest';

import { buildProcedureAvailability, comingSoonDescription } from '@/features/procedure/availability';
import { SUB_PROCEDURES } from '@/features/procedure/taxonomy';
import type { Procedure } from '@/types/domain';

/**
 * `준비중` 판정의 **유일한** 자리 (계약 §22.3). 홈 격자·탐색 탭·세부 칩·카테고리 화면·
 * 검색 추천이 전부 이 함수를 본다 — 경계값은 여기서만 고정하면 된다.
 */
function response(availableIds: readonly string[]): Procedure[] {
  return SUB_PROCEDURES.map((sub) => ({
    id: sub.id,
    name: sub.name,
    emoji: '',
    shortDescription: '',
    description: '',
    categoryId: sub.categoryId,
    isAvailable: availableIds.includes(sub.id),
  }));
}

describe('buildProcedureAvailability', () => {
  it('응답이 없으면(로딩·실패) 아무것도 준비중이 아니다', () => {
    const availability = buildProcedureAvailability(undefined);

    expect(availability.isKnown).toBe(false);
    // 모르는 상태를 준비중으로 그리면 첫 프레임에 9칸 전부 배지가 번쩍인다.
    expect(availability.isSubComingSoon('scaling')).toBe(false);
    expect(availability.isCategoryComingSoon('prevention')).toBe(false);
  });

  it('세부 시술은 isAvailable 을 그대로 뒤집은 값이다', () => {
    const availability = buildProcedureAvailability(response(['scaling']));

    expect(availability.isKnown).toBe(true);
    expect(availability.isSubComingSoon('scaling')).toBe(false);
    expect(availability.isSubComingSoon('halitosis')).toBe(true);
  });

  it('분야는 세부가 **전부** 닫혀 있을 때만 준비중이다 — 1곳이면 열린다', () => {
    const availability = buildProcedureAvailability(response(['scaling']));

    // 스케일링 한 개만 열려도 분야는 열린 것이다 (요청서의 "1곳 이상" 규칙).
    expect(availability.isCategoryComingSoon('prevention')).toBe(false);
    expect(availability.isCategoryComingSoon('implant')).toBe(true);
  });

  it('하나도 열리지 않은 응답에서는 9개 분야가 모두 준비중이다', () => {
    const availability = buildProcedureAvailability(response([]));

    expect(availability.isCategoryComingSoon('prevention')).toBe(true);
    expect(availability.isCategoryComingSoon('implant')).toBe(true);
  });

  it('응답에 없는 id 는 준비중으로 본다 — 분야 판정과 같은 집합 하나를 본다', () => {
    const availability = buildProcedureAvailability([]);

    expect(availability.isKnown).toBe(true);
    expect(availability.isSubComingSoon('crown')).toBe(true);
    expect(availability.isSubComingSoon('bogus')).toBe(true);
  });
});

describe('comingSoonDescription', () => {
  const closed = buildProcedureAvailability(response([]));
  const open = buildProcedureAvailability(response(['scaling', 'crown']));

  it('분야 전체를 보는 중이면 "분야" 라고 말한다', () => {
    expect(comingSoonDescription(closed, { kind: 'category', categoryId: 'prevention', subProcedureId: null })).toBe(
      '이 분야는 준비중이에요'
    );
  });

  it('세부 시술 하나를 고른 상태면 "시술" 이라고 말한다', () => {
    expect(
      comingSoonDescription(closed, { kind: 'category', categoryId: 'cavity', subProcedureId: 'root-canal' })
    ).toBe('이 시술은 준비중이에요');
  });

  it('준비중이 아니면 아무 말도 하지 않는다 — 빈 목록의 이유가 조건이기 때문이다', () => {
    expect(
      comingSoonDescription(open, { kind: 'category', categoryId: 'prevention', subProcedureId: null })
    ).toBeUndefined();
    expect(
      comingSoonDescription(open, { kind: 'category', categoryId: 'cavity', subProcedureId: 'crown' })
    ).toBeUndefined();
  });

  it('열린 분야 안의 닫힌 세부는 세부 쪽 판정을 따른다 — 분야가 열렸다고 덮지 않는다', () => {
    expect(
      comingSoonDescription(open, { kind: 'category', categoryId: 'cavity', subProcedureId: 'root-canal' })
    ).toBe('이 시술은 준비중이에요');
  });

  it('추천 탭은 분야가 없다 — 준비중 문장도 없다', () => {
    expect(comingSoonDescription(closed, { kind: 'recommended' })).toBeUndefined();
  });
});
