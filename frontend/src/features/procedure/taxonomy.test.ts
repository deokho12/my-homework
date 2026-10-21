import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  CATEGORY_IDS,
  LEGACY_PROCEDURE_ID_ALIASES,
  SUB_PROCEDURES,
  SUB_PROCEDURE_IDS,
  categoryPath,
  categoryPathForProcedure,
  procedureDisplayName,
  findSubProcedure,
  getCategory,
  getSubProcedureIdsOf,
  getSubProceduresOf,
  groupProcedureIdsByCategory,
  isCategoryId,
  isProcedureId,
  isSubProcedureId,
  resolveLegacyProcedureId,
  searchTaxonomy,
  searchTaxonomyAll,
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

describe('서버가 아는 시술 집합', () => {
  /**
   * `mocks/fixtures/procedures.ts` 는 `GET /procedures` 응답의 목이다 — 서버 원본과의
   * 동기화는 `taxonomy.sync.test.ts` 가 본다.
   */
  it('목 응답의 id 순서가 세부 시술 31개와 같다', () => {
    expect(procedures.map((p) => p.id)).toEqual([...SUB_PROCEDURE_IDS]);
  });

  it('isProcedureId 는 세부 시술 31개만 통과시킨다 (= isSubProcedureId)', () => {
    expect(isProcedureId('crown')).toBe(true);
    expect(isProcedureId('root-canal')).toBe(true);
    // 요청 14 에서 사라진 옛 서버 id. 서버로 보내면 422 다.
    expect(isProcedureId('gum-disease')).toBe(false);
    expect(isProcedureId('bogus')).toBe(false);
    expect(isProcedureId(undefined)).toBe(false);

    for (const id of SUB_PROCEDURE_IDS) {
      expect(isProcedureId(id)).toBe(isSubProcedureId(id));
    }
  });
});

describe('옛 id 별칭 표', () => {
  it('2026-10-21 이전의 서버 시술 13종이 전부 들어 있다', () => {
    expect(Object.keys(LEGACY_PROCEDURE_ID_ALIASES)).toHaveLength(13);
  });

  it('별칭의 목적지가 전부 실재하는 세부 시술이다', () => {
    for (const subId of Object.values(LEGACY_PROCEDURE_ID_ALIASES)) {
      expect(isSubProcedureId(subId)).toBe(true);
    }
  });

  it('이름이 바뀐 6개를 푼다', () => {
    expect(resolveLegacyProcedureId('implant')).toBe('implant-general');
    expect(resolveLegacyProcedureId('orthodontics')).toBe('bracket-braces');
    expect(resolveLegacyProcedureId('cavity')).toBe('resin');
    expect(resolveLegacyProcedureId('gum-disease')).toBe('gum-treatment');
    expect(resolveLegacyProcedureId('tmj')).toBe('tmj-treatment');
    expect(resolveLegacyProcedureId('botox')).toBe('bruxism-botox');
  });

  it('지금 id 는 그대로 통과한다', () => {
    for (const id of SUB_PROCEDURE_IDS) {
      expect(resolveLegacyProcedureId(id)).toBe(id);
    }
  });

  it('모르는 값과 빈 값은 null', () => {
    expect(resolveLegacyProcedureId('zirconia-bridge')).toBeNull();
    expect(resolveLegacyProcedureId(undefined)).toBeNull();
    expect(resolveLegacyProcedureId(null)).toBeNull();
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

describe('getSubProcedureIdsOf', () => {
  it('세부 선언 순서를 그대로 준다 — 준비중도 빠지지 않는다', () => {
    expect(getSubProcedureIdsOf('cavity')).toEqual(['resin', 'inlay', 'onlay', 'crown', 'root-canal']);
    expect(getSubProcedureIdsOf('prevention')).toEqual(['scaling', 'fluoride', 'sealant', 'halitosis']);
  });

  it('모든 분야의 합이 31개이고 중복이 없다', () => {
    const all = CATEGORY_IDS.flatMap((id) => getSubProcedureIdsOf(id));
    expect(all).toHaveLength(31);
    expect(new Set(all).size).toBe(31);
  });
});

describe('id → 세부 시술', () => {
  it('findSubProcedure / procedureDisplayName 는 세부 시술 이름을 준다', () => {
    expect(findSubProcedure('resin')?.id).toBe('resin');
    expect(procedureDisplayName('resin')).toBe('레진');
    expect(procedureDisplayName('bracket-braces')).toBe('일반(브라켓)교정');
    expect(procedureDisplayName('bruxism-botox')).toBe('이갈이 보톡스');
  });

  it('모르는 id 와 옛 id 는 null — 호출부가 배지를 건너뛴다', () => {
    expect(findSubProcedure('zirconia-bridge')).toBeNull();
    expect(procedureDisplayName('zirconia-bridge')).toBeNull();
    // 옛 id 는 여기서 풀지 않는다 — 경계에서 `resolveLegacyProcedureId` 가 푼다.
    expect(procedureDisplayName('gum-disease')).toBeNull();
  });

  it('groupProcedureIdsByCategory 는 대분류 선언 순서로 묶는다', () => {
    const groups = groupProcedureIdsByCategory(['bruxism-botox', 'implant-general', 'laminate']);
    expect(groups.map((g) => g.category.id)).toEqual(['implant', 'aesthetic', 'botox']);
    expect(groups.map((g) => g.subs.map((s) => s.id))).toEqual([
      ['implant-general'],
      ['laminate'],
      ['bruxism-botox'],
    ]);
  });

  it('groupProcedureIdsByCategory 는 모르는 id 와 중복을 버리고 빈 그룹을 안 만든다', () => {
    const groups = groupProcedureIdsByCategory(['crown', 'crown', 'inlay', 'zirconia-bridge']);
    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe('cavity');
    expect(groups[0].subs.map((s) => s.id)).toEqual(['inlay', 'crown']);
    expect(groupProcedureIdsByCategory([])).toEqual([]);
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

describe('categoryPathForProcedure', () => {
  it('시술 id 는 그 세부 시술이 선택된 카테고리 경로가 된다', () => {
    expect(categoryPathForProcedure('crown')).toBe('/category/cavity?sub=crown');
    expect(categoryPathForProcedure('implant-general')).toBe('/category/implant?sub=implant-general');
    expect(categoryPathForProcedure('gum-treatment')).toBe('/category/gum?sub=gum-treatment');
  });

  it('모르는 id 는 null — 호출부가 대체 목적지를 정한다', () => {
    expect(categoryPathForProcedure('nope')).toBeNull();
  });
});

describe('searchTaxonomy', () => {
  it('대분류 이름이 가장 먼저 걸린다', () => {
    expect(searchTaxonomy('임플란트')).toEqual({
      category: getCategory('implant'),
      sub: null,
      matchedAlias: '임플란트',
    });
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

  it('세부끼리는 선언 순서다 — 준비중 여부는 여기서 보지 않는다', () => {
    // '이갈이' 는 이갈이장치(tmj)와 이갈이 보톡스(botox) 양쪽에 걸린다. 가용성으로 다시
    // 줄 세우는 것은 검색 추천의 몫이다 (`features/search/suggest.ts`).
    const match = searchTaxonomy('이갈이');
    expect(match?.category.id).toBe('tmj');
    expect(match?.sub?.id).toBe('bruxism-device');
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

describe('searchTaxonomyAll', () => {
  /**
   * **Enter 가 오늘과 같은 곳으로 간다는 보장이 이 한 줄이다.** 추천 목록의 첫 줄과
   * Enter 목적지가 같은 규칙에서 나오는지를 검색어 표본 전체로 고정한다.
   */
  it('searchTaxonomy 는 searchTaxonomyAll 의 첫 원소다', () => {
    const samples = [
      '임플란트', '교정', '크라운', '금니', '때우기', '인레', '스케일링', '근관치료', '엔도',
      '이갈이', '연세 바른교정치과', '강남', 'TMJ', '치과', '', '   ', '사랑니', '잇몸',
      '보톡스', '라미네이트', '충치치료', '턱관절', '코골이', '미백',
    ];

    for (const sample of samples) {
      expect(searchTaxonomy(sample)).toEqual(searchTaxonomyAll(sample)[0] ?? null);
    }
  });

  it('부분 입력도 걸린다 — "인레" → 인레이', () => {
    const matches = searchTaxonomyAll('인레');
    expect(matches.map((match) => match.sub?.id)).toEqual(['inlay']);
  });

  it('동의어로 걸리면 걸린 후보 문자열을 함께 돌려준다', () => {
    expect(searchTaxonomyAll('금니')[0]).toMatchObject({ matchedAlias: '금니' });
    expect(searchTaxonomyAll('금니')[0].sub?.id).toBe('crown');
    expect(searchTaxonomyAll('때우기')[0]).toMatchObject({ matchedAlias: '때우기' });
    expect(searchTaxonomyAll('때우기')[0].sub?.id).toBe('resin');
  });

  it('대분류가 세부보다 먼저, 세부끼리는 선언 순서', () => {
    const matches = searchTaxonomyAll('교정');
    expect(matches[0].sub).toBeNull();
    expect(matches[0].category.id).toBe('orthodontics');
    expect(matches.slice(1).map((match) => match.sub?.id)).toEqual([
      'clear-aligner',
      'lingual-braces',
      'bracket-braces',
      'partial-ortho',
    ]);
  });

  it('같은 항목이 이름과 동의어 양쪽에 걸려도 한 번만 담는다', () => {
    // 라미네이트는 표시 이름이자 동의어다(`keywords: ['라미네이트', '비니어']`).
    const ids = searchTaxonomyAll('라미네이트').map((match) => match.sub?.id ?? match.category.id);
    expect(ids).toEqual([...new Set(ids)]);
    expect(ids.filter((id) => id === 'laminate')).toHaveLength(1);
  });

  it('아무 데도 안 걸리면 빈 배열', () => {
    expect(searchTaxonomyAll('치과')).toEqual([]);
    expect(searchTaxonomyAll('  ')).toEqual([]);
  });
});
