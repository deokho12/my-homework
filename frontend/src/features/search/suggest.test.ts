import { describe, expect, it } from 'vitest';

import { buildProcedureAvailability } from '@/features/procedure/availability';
import { SUB_PROCEDURE_IDS } from '@/features/procedure/taxonomy';
import {
  buildDoctorSuggestions,
  buildHospitalSuggestions,
  buildProcedureSuggestions,
  buildSuggestions,
  doctorNameFallbackQuery,
  filterDoctorsByNamePrefix,
  firstSuggestion,
  mergeSuggestions,
  shouldQueryNetwork,
  splitHighlight,
  suggestionHref,
  type SuggestionGroups,
} from '@/features/search/suggest';
import type { Doctor, Hospital } from '@/types/domain';

function hospital(overrides: Partial<Hospital> = {}): Hospital {
  return {
    id: 'h1',
    name: '강남 스마일 치과',
    specialty: '임플란트 전문의원',
    region: '서울 강남구',
    latitude: 37.5,
    longitude: 127,
    thumbnail: '',
    images: [],
    procedureIds: ['implant-general'],
    priceRange: { min: 0, max: 0 },
    rating: 4.8,
    reviewCount: 1,
    consultCount: 1,
    consultAvailable: true,
    businessHours: [],
    directions: '',
    features: {
      coordinator: false,
      painlessAnesthesia: false,
      digitalCare: false,
      parking: false,
      nightConsult: false,
      cctv: false,
    },
    isOneDay: false,
    isRecommended: false,
    isSponsored: false,
    sponsoredCategories: [],
    sponsoredRank: null,
    sponsoredStartDate: null,
    sponsoredEndDate: null,
    tags: [],
    address: '',
    introduction: '',
    events: [],
    sponsorship: { isActive: false, isPlacementEligible: false },
    representativeSpecialty: null,
    ...overrides,
  };
}

function doctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 'd1',
    name: '김민준',
    title: '원장',
    hospitalId: 'h1',
    photo: '',
    procedureIds: [],
    rating: 4.9,
    reviewCount: 1,
    consultCount: 1,
    certificateUrl: null,
    verificationStatus: 'approved',
    rejectionReason: null,
    isRecommended: false,
    yearsOfExperience: 10,
    career: [],
    visibleSpecialty: '치과보철전문의',
    isVerifiedSpecialist: true,
    ...overrides,
  };
}

function groupsOf(partial: Partial<SuggestionGroups>): SuggestionGroups {
  return { procedures: [], hospitals: [], doctors: [], ...partial };
}

/**
 * `GET /procedures` 가 내려준 가용성. 인자로 준 id 만 열려 있고 나머지는 준비중이다 —
 * `준비중` 은 서버가 센 값이라 테스트가 직접 쥔다.
 */
function availabilityWith(availableIds: readonly string[]) {
  return buildProcedureAvailability(
    SUB_PROCEDURE_IDS.map((id) => ({
      id,
      name: id,
      emoji: '',
      shortDescription: '',
      description: '',
      categoryId: 'cavity',
      isAvailable: availableIds.includes(id),
    }))
  );
}

/** 31개 전부 열린 상태. "준비중" 을 보지 않는 단언들이 쓴다. */
const ALL_AVAILABLE = availabilityWith(SUB_PROCEDURE_IDS);

/** 아직 `GET /procedures` 가 오지 않은 상태 — 아무것도 준비중이 아니다. */
const UNKNOWN_AVAILABILITY = buildProcedureAvailability(undefined);

describe('시술 그룹', () => {
  it('"인레" → 인레이, 보조줄은 "충치치료 › 인레이"', () => {
    const [first] = buildProcedureSuggestions('인레', ALL_AVAILABLE);

    expect(first.title).toBe('인레이');
    expect(first.subtitle).toBe('충치치료 › 인레이');
    expect(first.comingSoon).toBe(false);
  });

  it('동의어로 걸리면 왜 떴는지 보조줄 끝에 적는다', () => {
    expect(buildProcedureSuggestions('금니', ALL_AVAILABLE)[0]).toMatchObject({
      title: '크라운',
      subtitle: '충치치료 › 크라운 · ‘금니’ 로 찾았어요',
    });
    expect(buildProcedureSuggestions('때우기', ALL_AVAILABLE)[0]).toMatchObject({ title: '레진' });
  });

  it('대분류 매치는 "분야 전체"', () => {
    expect(buildProcedureSuggestions('교정', ALL_AVAILABLE)[0]).toMatchObject({
      title: '교정',
      subtitle: '교정 분야 전체',
      comingSoon: false,
    });
  });

  it('준비중 세부도 그 세부로 열린다 — 목적지의 빈 상태와 같은 말을 한다', () => {
    const [first] = buildProcedureSuggestions('신경치료', availabilityWith([]));

    expect(first).toMatchObject({
      title: '신경치료',
      subtitle: '충치치료 › 신경치료 · 등록된 병원이 아직 없어요',
      comingSoon: true,
    });
  });

  it('대분류 전체가 준비중이면 카테고리 화면의 빈 상태와 같은 말을 한다', () => {
    const [first] = buildProcedureSuggestions('스케일링', availabilityWith([]));

    expect(first).toMatchObject({
      title: '스케일링·예방',
      subtitle: '분야 전체 · 등록된 병원이 아직 없어요',
      comingSoon: true,
    });
  });

  it('준비중 줄은 뒤로 밀린다 — 결과가 나오는 쪽이 먼저다 (Enter 목적지이기도 하다)', () => {
    // '이갈이' 는 이갈이장치(tmj, 선언 순서가 앞)와 이갈이 보톡스(botox) 양쪽에 걸린다.
    const soon = buildProcedureSuggestions('이갈이', availabilityWith(['bruxism-botox']));

    expect(soon[0]).toMatchObject({ title: '이갈이 보톡스', comingSoon: false });
    expect(soon[1]).toMatchObject({ title: '이갈이장치', comingSoon: true });
  });

  it('가용성을 아직 모르면(로딩·실패) 아무것도 준비중이 아니고 분류 순서 그대로다', () => {
    const unknown = buildProcedureSuggestions('이갈이', UNKNOWN_AVAILABILITY);

    expect(unknown.map((item) => item.title)).toEqual(['이갈이장치', '이갈이 보톡스']);
    expect(unknown.every((item) => !item.comingSoon)).toBe(true);
  });

  it('그룹당 3개까지만 만든다', () => {
    expect(buildProcedureSuggestions('교정', ALL_AVAILABLE)).toHaveLength(3);
  });
});

describe('suggestionHref', () => {
  it('시술은 categoryPath 한 함수로만 만든다 — 준비중 세부도 ?sub= 를 붙인다', () => {
    expect(suggestionHref(buildProcedureSuggestions('인레', ALL_AVAILABLE)[0])).toBe('/category/cavity?sub=inlay');
    expect(suggestionHref(buildProcedureSuggestions('신경치료', ALL_AVAILABLE)[0])).toBe(
      '/category/cavity?sub=root-canal'
    );
    expect(suggestionHref(buildProcedureSuggestions('교정', ALL_AVAILABLE)[0])).toBe('/category/orthodontics');
  });

  it('병원은 병원 상세, 원장님은 전문의 상세', () => {
    const [hospitalSuggestion] = buildHospitalSuggestions([{ item: hospital({ id: 'h7' }), matchedBy: 'name' }], null);
    const [doctorSuggestion] = buildDoctorSuggestions([{ item: doctor({ id: 'd9' }), matchedBy: 'name' }]);

    expect(suggestionHref(hospitalSuggestion)).toBe('/hospital/h7');
    expect(suggestionHref(doctorSuggestion)).toBe('/doctor/d9');
  });
});

describe('mergeSuggestions', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };
  const d = { id: 'd' };

  it('이름 일치가 앞, 시술 일치가 뒤', () => {
    expect(mergeSuggestions([a], [b])).toEqual([
      { item: a, matchedBy: 'name' },
      { item: b, matchedBy: 'procedure' },
    ]);
  });

  it('id 가 겹치면 먼저 들어온 쪽(이름)이 이긴다', () => {
    expect(mergeSuggestions([a], [a, b])).toEqual([
      { item: a, matchedBy: 'name' },
      { item: b, matchedBy: 'procedure' },
    ]);
  });

  it('3개 상한', () => {
    expect(mergeSuggestions([a, b], [c, d]).map((merged) => merged.item.id)).toEqual(['a', 'b', 'c']);
  });

  it('한쪽이 비어도 동작한다', () => {
    expect(mergeSuggestions([], [a]).map((merged) => merged.matchedBy)).toEqual(['procedure']);
    expect(mergeSuggestions([a], []).map((merged) => merged.matchedBy)).toEqual(['name']);
    expect(mergeSuggestions([], [])).toEqual([]);
  });
});

describe('병원 행', () => {
  it('지역 · 시술 이름 2개까지', () => {
    const [suggestion] = buildHospitalSuggestions(
      [{ item: hospital({ procedureIds: ['implant-general', 'crown', 'inlay'] }), matchedBy: 'name' }],
      null
    );

    expect(suggestion.subtitle).toBe('서울 강남구 · 일반 임플란트, 크라운');
  });

  it('시술로 걸린 병원은 걸린 시술을 맨 앞에 둔다 — 왜 여기 있는지가 먼저 읽힌다', () => {
    const [suggestion] = buildHospitalSuggestions(
      [{ item: hospital({ procedureIds: ['implant-general', 'crown', 'inlay'] }), matchedBy: 'procedure' }],
      new Set(['inlay'])
    );

    expect(suggestion.subtitle).toBe('서울 강남구 · 인레이, 일반 임플란트');
  });

  it('보여줄 시술 이름이 없으면 지역만', () => {
    const [suggestion] = buildHospitalSuggestions(
      [{ item: hospital({ procedureIds: [] }), matchedBy: 'name' }],
      null
    );

    expect(suggestion.subtitle).toBe('서울 강남구');
  });

  it('광고 표시는 병원 카드와 같은 조건(sponsorship.isActive)', () => {
    const [plain] = buildHospitalSuggestions([{ item: hospital(), matchedBy: 'name' }], null);
    const [sponsored] = buildHospitalSuggestions(
      [{ item: hospital({ sponsorship: { isActive: true, isPlacementEligible: true } }), matchedBy: 'name' }],
      null
    );

    expect(plain.sponsored).toBe(false);
    expect(sponsored.sponsored).toBe(true);
  });
});

describe('원장님 행', () => {
  it('이름 + 직함이 제목', () => {
    expect(buildDoctorSuggestions([{ item: doctor(), matchedBy: 'name' }])[0].title).toBe('김민준 원장');
  });

  it('visibleSpecialty 가 null 이면 전공을 싣지 않는다 — 인증 판정을 새로 만들지 않는다', () => {
    const [suggestion] = buildDoctorSuggestions([{ item: doctor({ visibleSpecialty: null }), matchedBy: 'name' }]);

    expect(suggestion.specialty).toBeNull();
  });
});

describe('firstSuggestion', () => {
  it('시술 > 병원 > 원장님 순서', () => {
    const procedures = buildProcedureSuggestions('인레', ALL_AVAILABLE);
    const hospitals = buildHospitalSuggestions([{ item: hospital(), matchedBy: 'name' }], null);
    const doctors = buildDoctorSuggestions([{ item: doctor(), matchedBy: 'name' }]);

    expect(firstSuggestion(groupsOf({ procedures, hospitals, doctors }))?.kind).toBe('procedure');
    expect(firstSuggestion(groupsOf({ hospitals, doctors }))?.kind).toBe('hospital');
    expect(firstSuggestion(groupsOf({ doctors }))?.kind).toBe('doctor');
    expect(firstSuggestion(groupsOf({}))).toBeNull();
  });
});

describe('buildSuggestions', () => {
  it('세 그룹을 한 번에 만든다', () => {
    const groups = buildSuggestions({
      query: '인레',
      hospitalsByName: [],
      hospitalsByProcedure: [hospital({ procedureIds: ['inlay'] })],
      doctorsByName: [doctor()],
      doctorsByProcedure: [doctor()],
      matchedProcedureIds: new Set(['inlay']),
      availability: ALL_AVAILABLE,
    });

    expect(groups.procedures.map((item) => item.title)).toEqual(['인레이']);
    expect(groups.hospitals).toHaveLength(1);
    // 이름·시술 양쪽에 같은 전문의가 있어도 한 줄이다.
    expect(groups.doctors).toHaveLength(1);
  });
});

describe('shouldQueryNetwork', () => {
  it('2자 미만이면 묻지 않는다', () => {
    expect(shouldQueryNetwork('ㅇ')).toBe(false);
    expect(shouldQueryNetwork('인')).toBe(false);
    expect(shouldQueryNetwork('a')).toBe(false);
    expect(shouldQueryNetwork('')).toBe(false);
    expect(shouldQueryNetwork(' 인 ')).toBe(false);
  });

  it('마지막 글자가 미완성 자모면 묻지 않는다', () => {
    expect(shouldQueryNetwork('인ㄹ')).toBe(false);
    expect(shouldQueryNetwork('임플란ㅌ')).toBe(false);
  });

  it('완성된 2자 이상이면 묻는다', () => {
    expect(shouldQueryNetwork('인레')).toBe(true);
    expect(shouldQueryNetwork('ab')).toBe(true);
    expect(shouldQueryNetwork('강남 스마일')).toBe(true);
  });
});

describe('직함이 붙은 전문의 검색어', () => {
  it('마지막 낱말을 뗀 2차 조회어', () => {
    expect(doctorNameFallbackQuery('김민준 원장')).toBe('김민준');
    expect(doctorNameFallbackQuery('김민준')).toBeNull();
  });

  it('2차 조회 결과는 검색어가 그 이름으로 시작하는 것만 받는다', () => {
    const matched = doctor({ id: 'd1', name: '김민준' });
    const other = doctor({ id: 'd2', name: '김민준서' });

    expect(filterDoctorsByNamePrefix('김민준 원장', [matched, other]).map((item) => item.id)).toEqual(['d1']);
  });
});

describe('splitHighlight', () => {
  it('겹치는 첫 구간만 굵게 가른다', () => {
    expect(splitHighlight('인레이', '인레')).toEqual([
      { text: '인레', match: true },
      { text: '이', match: false },
    ]);
    expect(splitHighlight('강남 스마일 치과', '스마일')).toEqual([
      { text: '강남 ', match: false },
      { text: '스마일', match: true },
      { text: ' 치과', match: false },
    ]);
  });

  it('안 걸리면 통째로 한 조각', () => {
    expect(splitHighlight('크라운', '금니')).toEqual([{ text: '크라운', match: false }]);
    expect(splitHighlight('크라운', '')).toEqual([{ text: '크라운', match: false }]);
  });
});
