import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  CATEGORY_IDS,
  LEGACY_TO_SUB,
  SUB_PROCEDURES,
  SUB_PROCEDURE_IDS,
  categoryPath,
  categoryPathForLegacy,
  displayNameForLegacy,
  getCategory,
  getLegacyIdsOf,
  getSubProcedure,
  getSubProceduresOf,
  groupLegacyIdsByCategory,
  isCategoryId,
  isProcedureId,
  isSubProcedureId,
  searchTaxonomy,
  subFromLegacy,
} from '@/features/procedure/taxonomy';
import { procedures } from '@/mocks/fixtures/procedures';
import { CATEGORY_ICONS } from '@/utils/procedureIcons';
import { CATEGORY_SPECIALTIES } from '@/utils/specialty';

describe('분류 데이터의 모양', () => {
  it('대분류 9개, 세부 시술 31개', () => {
    expect(CATEGORIES).toHaveLength(9);
    expect(CATEGORY_IDS).toHaveLength(9);
    expect(SUB_PROCEDURES).toHaveLength(31);
    expect(SUB_PROCEDURE_IDS).toHaveLength(31);
  });

  it('id 가 전부 유일하다', () => {
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
    expect(new Set(SUB_PROCEDURES.map((s) => s.id)).size).toBe(SUB_PROCEDURES.length);
  });

  it('선언 배열과 데이터 배열의 id 순서가 같다', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
    expect(SUB_PROCEDURES.map((s) => s.id)).toEqual([...SUB_PROCEDURE_IDS]);
  });

  it('모든 세부 시술의 categoryId 가 실재하는 대분류다', () => {
    for (const sub of SUB_PROCEDURES) {
      expect(isCategoryId(sub.categoryId)).toBe(true);
    }
  });

  it('세부 시술이 하나도 없는 대분류는 없다', () => {
    for (const category of CATEGORIES) {
      expect(getSubProceduresOf(category.id).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('이름·설명·키워드가 비어 있지 않다', () => {
    for (const category of CATEGORIES) {
      expect(category.name.length).toBeGreaterThan(0);
      expect(category.description.length).toBeGreaterThan(0);
      expect(category.keywords.length).toBeGreaterThan(0);
    }
    for (const sub of SUB_PROCEDURES) {
      expect(sub.name.length).toBeGreaterThan(0);
      expect(sub.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe('서버 시술 13종과의 연결', () => {
  it('LEGACY_TO_SUB 는 13개이고 세부 시술의 legacyProcedureId 와 양방향으로 맞는다', () => {
    const entries = Object.entries(LEGACY_TO_SUB);
    expect(entries).toHaveLength(13);

    for (const [legacyId, subId] of entries) {
      expect(isSubProcedureId(subId)).toBe(true);
      expect(getSubProcedure(subId).legacyProcedureId).toBe(legacyId);
    }

    // 반대 방향: legacyProcedureId 가 있는 세부는 전부 표에 등장한다.
    const linked = SUB_PROCEDURES.filter((s) => s.legacyProcedureId !== null);
    expect(linked).toHaveLength(13);
    for (const sub of linked) {
      const legacyId = sub.legacyProcedureId;
      if (legacyId === null) continue;
      expect(LEGACY_TO_SUB[legacyId]).toBe(sub.id);
    }
  });

  it('같은 서버 id 를 두 세부 시술이 나눠 갖지 않는다', () => {
    const used = SUB_PROCEDURES.map((s) => s.legacyProcedureId).filter((id) => id !== null);
    expect(new Set(used).size).toBe(used.length);
  });

  /**
   * `mocks/fixtures/procedures.ts` 는 백엔드 seed 가 import 하는 파일이다
   * (`backend/prisma/seed/fixtures.ts`). 서버 시술 목록이 늘거나 줄면 이 단언이 먼저 깨져서,
   * 분류 표를 손보지 않은 채 배포되는 일을 막는다. **읽기만 한다 — fixture 는 수정하지 않는다.**
   */
  it('서버 시술 집합(fixture)과 LEGACY_TO_SUB 의 키 집합이 같다', () => {
    expect(new Set(Object.keys(LEGACY_TO_SUB))).toEqual(new Set(procedures.map((p) => p.id)));
  });

  it('isProcedureId 는 서버 13종만 통과시킨다', () => {
    expect(isProcedureId('crown')).toBe(true);
    expect(isProcedureId('gum-disease')).toBe(true);
    // 세부 시술 id 지 서버 id 가 아니다.
    expect(isProcedureId('root-canal')).toBe(false);
    expect(isProcedureId('bogus')).toBe(false);
    expect(isProcedureId(undefined)).toBe(false);
  });
});

describe('키 집합이 갈라지지 않는다', () => {
  it('CATEGORY_ICONS 의 키가 CATEGORY_IDS 와 같다', () => {
    expect(new Set(Object.keys(CATEGORY_ICONS))).toEqual(new Set(CATEGORY_IDS));
  });

  it('CATEGORY_SPECIALTIES 의 키가 CATEGORY_IDS 와 같다', () => {
    expect(new Set(Object.keys(CATEGORY_SPECIALTIES))).toEqual(new Set(CATEGORY_IDS));
  });
});

describe('getLegacyIdsOf', () => {
  it('세부가 전부 준비중인 대분류는 빈 배열', () => {
    expect(getLegacyIdsOf('prevention')).toEqual([]);
  });

  it('세부 선언 순서를 유지하고 준비중은 뺀다', () => {
    // 레진·인레이·[온레이 준비중]·크라운·[신경치료 준비중]
    expect(getLegacyIdsOf('cavity')).toEqual(['cavity', 'inlay', 'crown']);
  });

  it('서버 id 가 하나뿐인 대분류', () => {
    expect(getLegacyIdsOf('gum')).toEqual(['gum-disease']);
    expect(getLegacyIdsOf('implant')).toEqual(['implant']);
  });
});

describe('역매핑', () => {
  it('subFromLegacy / displayNameForLegacy 는 세부 시술 이름을 준다', () => {
    expect(subFromLegacy('cavity')?.id).toBe('resin');
    expect(displayNameForLegacy('cavity')).toBe('레진');
    expect(displayNameForLegacy('orthodontics')).toBe('일반(브라켓)교정');
    expect(displayNameForLegacy('botox')).toBe('이갈이 보톡스');
  });

  it('모르는 서버 id 는 null (배지를 건너뛴다)', () => {
    expect(subFromLegacy('zirconia-bridge')).toBeNull();
    expect(displayNameForLegacy('zirconia-bridge')).toBeNull();
  });

  it('groupLegacyIdsByCategory 는 대분류 선언 순서로 묶는다', () => {
    const groups = groupLegacyIdsByCategory(['botox', 'implant', 'laminate']);
    expect(groups.map((g) => g.category.id)).toEqual(['implant', 'aesthetic', 'botox']);
    expect(groups.map((g) => g.subs.map((s) => s.id))).toEqual([
      ['implant-general'],
      ['laminate'],
      ['bruxism-botox'],
    ]);
  });

  it('groupLegacyIdsByCategory 는 모르는 id 와 중복을 버리고 빈 그룹을 안 만든다', () => {
    const groups = groupLegacyIdsByCategory(['crown', 'crown', 'inlay', 'zirconia-bridge']);
    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe('cavity');
    expect(groups[0].subs.map((s) => s.id)).toEqual(['inlay', 'crown']);
    expect(groupLegacyIdsByCategory([])).toEqual([]);
  });
});

describe('categoryPath', () => {
  it('세부 시술이 있으면 ?sub= 를 붙인다', () => {
    expect(categoryPath('cavity', 'crown')).toBe('/category/cavity?sub=crown');
  });

  it('없으면 경로만', () => {
    expect(categoryPath('implant')).toBe('/category/implant');
    expect(categoryPath('implant', null)).toBe('/category/implant');
  });
});

describe('categoryPathForLegacy', () => {
  it('서버 시술 id 는 그 세부 시술이 선택된 카테고리 경로가 된다', () => {
    expect(categoryPathForLegacy('crown')).toBe('/category/cavity?sub=crown');
    expect(categoryPathForLegacy('implant')).toBe('/category/implant?sub=implant-general');
    expect(categoryPathForLegacy('gum-disease')).toBe('/category/gum?sub=gum-treatment');
  });

  it('모르는 id 는 null — 호출부가 대체 목적지를 정한다', () => {
    expect(categoryPathForLegacy('nope')).toBeNull();
  });
});

describe('searchTaxonomy', () => {
  it('대분류 이름이 가장 먼저 걸린다', () => {
    expect(searchTaxonomy('임플란트')).toEqual({ category: getCategory('implant'), sub: null });
  });

  it('세부 시술 이름', () => {
    const match = searchTaxonomy('크라운');
    expect(match?.category.id).toBe('cavity');
    expect(match?.sub?.id).toBe('crown');
  });

  it('준비중 세부의 키워드도 찾는다', () => {
    expect(searchTaxonomy('근관치료')?.sub?.id).toBe('root-canal');
    expect(searchTaxonomy('엔도')?.sub?.id).toBe('root-canal');
    expect(searchTaxonomy('엔도')?.category.id).toBe('cavity');
  });

  it('서버 id 가 있는 세부가 준비중 세부보다 먼저다', () => {
    // '이갈이' 는 이갈이장치(준비중)와 이갈이 보톡스(서버 id 있음) 양쪽에 걸린다.
    const match = searchTaxonomy('이갈이');
    expect(match?.category.id).toBe('botox');
    expect(match?.sub?.id).toBe('bruxism-botox');
  });

  it('병원 이름은 카테고리에 납치되지 않는다', () => {
    // 매칭 방향이 뒤집히면 '연세 바른교정치과'.includes('교정') 으로 교정 카테고리가 걸린다.
    expect(searchTaxonomy('연세 바른교정치과')).toBeNull();
    expect(searchTaxonomy('강남 임플란트치과의원')).toBeNull();
  });

  it('공백만 있거나 비어 있으면 null', () => {
    expect(searchTaxonomy('')).toBeNull();
    expect(searchTaxonomy('   ')).toBeNull();
  });

  it('앞뒤 공백과 대소문자를 무시한다', () => {
    expect(searchTaxonomy('  크라운 ')?.sub?.id).toBe('crown');
    expect(searchTaxonomy('TMJ')?.sub?.id).toBe('tmj-treatment');
  });

  it('아무 데도 안 걸리면 null', () => {
    expect(searchTaxonomy('치과')).toBeNull();
  });
});
