import type { ProcedureId } from '@/types/domain';

/**
 * 시술 분류 체계 — 대분류 9개 → 세부 시술 31개.
 *
 * **서버 시술 id = 여기 세부 시술 id 다** (2026-10-21 요청 14). 전에는 서버가 13종만 알아서
 * 그 사이를 잇는 번역 계층(`legacyProcedureId`)이 있었지만, 이제 `GET /api/v1/procedures` 가
 * 같은 31개를 같은 순서로 내려준다 (`types/domain.ts` 의 `ProcedureId`, 계약 §22.2).
 *
 * **사본이 둘인 이유** (원본은 `backend/prisma/seed/data/procedures.ts`·`procedure-categories.ts`):
 * 홈 격자·탐색 분야 탭·관리자 폼 섹션은 **첫 프레임**에 9개 분야를 그려야 한다. 네트워크를
 * 기다리면 격자가 깜빡이므로 이름·순서는 번들에 들어 있어야 하고, 그래서 분야 엔드포인트도
 * 만들지 않았다 (계약 §22.4). 두 사본이 갈라지면 `taxonomy.sync.test.ts` 가 먼저 깨진다.
 *
 * 순수 데이터 + 순수 함수만 둔다 (React · 네트워크 없음).
 *
 * **`준비중` 판정은 여기 없다.** "그 시술을 하는 병원이 1곳 이상인가" 는 서버만 아는 사실이고
 * (`Procedure.isAvailable`), 화면 쪽 유도는 `features/procedure/availability.ts` 함수 하나다.
 */

export const CATEGORY_IDS = [
  'implant',
  'prevention',
  'orthodontics',
  'cavity',
  'aesthetic',
  'gum',
  'tmj',
  'botox',
  'extraction',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const SUB_PROCEDURE_IDS = [
  'implant-general',
  'bone-graft',
  'sinus-lift',
  'implant-denture',
  'scaling',
  'fluoride',
  'sealant',
  'halitosis',
  'clear-aligner',
  'lingual-braces',
  'bracket-braces',
  'partial-ortho',
  'resin',
  'inlay',
  'onlay',
  'crown',
  'root-canal',
  'laminate',
  'whitening',
  'gum-contouring',
  'gum-treatment',
  'periodontal-surgery',
  'gum-graft',
  'tmj-treatment',
  'splint',
  'bruxism-device',
  'snoring-device',
  'bruxism-botox',
  'masseter-botox',
  'wisdom-tooth',
  'general-extraction',
] as const;
export type SubProcedureId = (typeof SUB_PROCEDURE_IDS)[number];

export interface ProcedureCategory {
  id: CategoryId;
  name: string;
  description: string;
  keywords: readonly string[];
}

export interface SubProcedure {
  id: SubProcedureId;
  name: string;
  categoryId: CategoryId;
  /** 검색 동의어. 서버는 모른다 — 요청서 14 가 "동의어는 화면에 두어도 된다" 고 했다. */
  keywords: readonly string[];
}

/** 배열 순서 = 화면 순서 (홈 격자, 탐색 탭, 관리자 폼 섹션). */
export const CATEGORIES: readonly ProcedureCategory[] = [
  { id: 'implant', name: '임플란트', description: '상실된 치아를 인공 치근으로 대체해요', keywords: ['임플란트', '임플'] },
  { id: 'prevention', name: '스케일링·예방', description: '치석 제거부터 충치 예방까지', keywords: ['스케일링', '예방', '예방치료'] },
  { id: 'orthodontics', name: '교정', description: '치열과 교합을 가지런히', keywords: ['교정', '치아교정'] },
  { id: 'cavity', name: '충치치료', description: '초기 충치부터 신경치료·보철까지', keywords: ['충치', '충치치료', '보존치료'] },
  { id: 'aesthetic', name: '심미', description: '치아 색과 모양을 아름답게', keywords: ['심미', '심미치료', '미용'] },
  { id: 'gum', name: '잇몸치료', description: '잇몸 염증과 치주 질환 관리', keywords: ['잇몸', '잇몸치료', '치주'] },
  { id: 'tmj', name: '턱관절·스플린트', description: '턱 통증·이갈이·코골이 장치', keywords: ['턱관절', '스플린트'] },
  { id: 'botox', name: '보톡스', description: '이갈이 완화와 사각턱 개선', keywords: ['보톡스'] },
  { id: 'extraction', name: '사랑니·발치', description: '사랑니와 보존이 어려운 치아 발치', keywords: ['사랑니', '발치'] },
];

export const SUB_PROCEDURES: readonly SubProcedure[] = [
  { id: 'implant-general', name: '일반 임플란트', categoryId: 'implant', keywords: ['임플란트', '임플', '인공치아', '식립'] },
  { id: 'bone-graft', name: '뼈이식', categoryId: 'implant', keywords: ['뼈이식', '골이식', '치조골'] },
  { id: 'sinus-lift', name: '상악동거상술', categoryId: 'implant', keywords: ['상악동거상술', '상악동', '사이너스'] },
  { id: 'implant-denture', name: '임플란트 틀니', categoryId: 'implant', keywords: ['임플란트틀니', '틀니', '오버덴처', '의치'] },

  { id: 'scaling', name: '스케일링', categoryId: 'prevention', keywords: ['스케일링', '치석제거', '치석'] },
  { id: 'fluoride', name: '불소도포', categoryId: 'prevention', keywords: ['불소도포', '불소'] },
  { id: 'sealant', name: '실란트', categoryId: 'prevention', keywords: ['실란트', '치아홈메우기', '홈메우기'] },
  { id: 'halitosis', name: '구취관리', categoryId: 'prevention', keywords: ['구취관리', '구취', '입냄새'] },

  { id: 'clear-aligner', name: '투명교정', categoryId: 'orthodontics', keywords: ['투명교정', '인비절라인'] },
  { id: 'lingual-braces', name: '설측교정', categoryId: 'orthodontics', keywords: ['설측교정', '설측'] },
  { id: 'bracket-braces', name: '일반(브라켓)교정', categoryId: 'orthodontics', keywords: ['브라켓교정', '브라켓', '메탈교정', '세라믹교정', '치아교정'] },
  { id: 'partial-ortho', name: '부분교정', categoryId: 'orthodontics', keywords: ['부분교정', '앞니교정'] },

  { id: 'resin', name: '레진', categoryId: 'cavity', keywords: ['레진', '레진치료', '충전', '때우기'] },
  { id: 'inlay', name: '인레이', categoryId: 'cavity', keywords: ['인레이', '골드인레이', '세라믹인레이'] },
  { id: 'onlay', name: '온레이', categoryId: 'cavity', keywords: ['온레이'] },
  { id: 'crown', name: '크라운', categoryId: 'cavity', keywords: ['크라운', '지르코니아', '금니', '씌우기'] },
  { id: 'root-canal', name: '신경치료', categoryId: 'cavity', keywords: ['신경치료', '근관치료', '엔도'] },

  { id: 'laminate', name: '라미네이트', categoryId: 'aesthetic', keywords: ['라미네이트', '비니어'] },
  { id: 'whitening', name: '치아미백', categoryId: 'aesthetic', keywords: ['치아미백', '미백', '화이트닝'] },
  { id: 'gum-contouring', name: '잇몸성형', categoryId: 'aesthetic', keywords: ['잇몸성형', '잇몸라인', '거미스마일'] },

  { id: 'gum-treatment', name: '잇몸치료', categoryId: 'gum', keywords: ['잇몸치료', '치주치료', '잇몸염증', '치은염', '치주염'] },
  { id: 'periodontal-surgery', name: '치주수술', categoryId: 'gum', keywords: ['치주수술', '잇몸수술'] },
  { id: 'gum-graft', name: '잇몸이식', categoryId: 'gum', keywords: ['잇몸이식', '치은이식', '잇몸퇴축'] },

  { id: 'tmj-treatment', name: '턱관절장애 치료', categoryId: 'tmj', keywords: ['턱관절', '턱관절장애', 'tmj', '악관절', '턱통증'] },
  { id: 'splint', name: '스플린트', categoryId: 'tmj', keywords: ['스플린트', '교합안정장치', '마우스피스'] },
  { id: 'bruxism-device', name: '이갈이장치', categoryId: 'tmj', keywords: ['이갈이장치', '이갈이', '나이트가드'] },
  { id: 'snoring-device', name: '코골이장치', categoryId: 'tmj', keywords: ['코골이장치', '코골이', '수면무호흡', '구강내장치'] },

  { id: 'bruxism-botox', name: '이갈이 보톡스', categoryId: 'botox', keywords: ['이갈이보톡스', '보톡스', '이갈이'] },
  { id: 'masseter-botox', name: '사각턱(교근) 보톡스', categoryId: 'botox', keywords: ['사각턱보톡스', '사각턱', '교근보톡스', '교근', '턱보톡스'] },

  { id: 'wisdom-tooth', name: '사랑니 발치', categoryId: 'extraction', keywords: ['사랑니', '사랑니발치', '매복사랑니'] },
  { id: 'general-extraction', name: '일반 발치', categoryId: 'extraction', keywords: ['발치', '치아발치'] },
];

/**
 * **옛 서버 시술 id(2026-10-21 이전의 13종) → 지금의 세부 시술 id.**
 *
 * 쓰는 자리는 **바깥에 이미 나간 값** 둘뿐이다 (DB §17.5):
 * - 북마크된 주소 (`/explore?category=gum-disease`, `/category/cavity?sub=crown`)
 * - 브라우저 저장소에 남은 행 (`lib/localCollection.ts` 의 상담·커뮤니티)
 *
 * **서버로 나가는 값에는 절대 쓰지 않는다** — 서버는 옛 id 를 받지 않고(`422
 * unknown_procedure`), 목록 필터로 오면 0건이다 (계약 §22.2).
 *
 * 아래 7개는 id 가 그대로다. 항등 항목을 **남겨 두는 이유**: 이 표가 "서버가 2026-10-21
 * 이전에 알던 13종" 의 완전한 목록이라는 사실 자체가 문서다. 항목이 6개뿐이면 다음 사람이
 * 나머지 7개는 어떻게 됐는지 다시 조사한다.
 */
export const LEGACY_PROCEDURE_ID_ALIASES: Record<string, SubProcedureId> = {
  implant: 'implant-general',
  orthodontics: 'bracket-braces',
  cavity: 'resin',
  'gum-disease': 'gum-treatment',
  tmj: 'tmj-treatment',
  botox: 'bruxism-botox',
  inlay: 'inlay',
  crown: 'crown',
  laminate: 'laminate',
  whitening: 'whitening',
  splint: 'splint',
  'snoring-device': 'snoring-device',
  'wisdom-tooth': 'wisdom-tooth',
};

/**
 * 옛 id 든 지금 id 든 **지금의 세부 시술 id 하나**로 푼다. 둘 다 아니면 `null`.
 *
 * 옛 값을 받는 **모든** 경계(주소·브라우저 저장소)가 이 함수 하나를 거친다 — 두 곳이 각자
 * 변환을 적으면 한쪽만 고쳐져 조용히 갈라진다.
 */
export function resolveLegacyProcedureId(value: string | undefined | null): SubProcedureId | null {
  if (value == null) return null;
  if (isSubProcedureId(value)) return value;
  return LEGACY_PROCEDURE_ID_ALIASES[value] ?? null;
}

/* ------------------------------------------------------------------ 색인 */

// 조회는 전부 아래 Map 들을 거친다 — 화면이 카드마다 `find` 를 돌리면 O(n²) 가 된다.
const CATEGORY_BY_ID = new Map<CategoryId, ProcedureCategory>(CATEGORIES.map((c) => [c.id, c]));
const SUB_BY_ID = new Map<SubProcedureId, SubProcedure>(SUB_PROCEDURES.map((s) => [s.id, s]));
const SUBS_BY_CATEGORY = new Map<CategoryId, SubProcedure[]>(CATEGORIES.map((c) => [c.id, []]));
for (const sub of SUB_PROCEDURES) {
  SUBS_BY_CATEGORY.get(sub.categoryId)?.push(sub);
}
const CATEGORY_ID_SET: ReadonlySet<string> = new Set(CATEGORY_IDS);
const SUB_ID_SET: ReadonlySet<string> = new Set(SUB_PROCEDURE_IDS);

/* ------------------------------------------------------------------ 타입 가드 */

export function isCategoryId(value: string | undefined | null): value is CategoryId {
  return value != null && CATEGORY_ID_SET.has(value);
}

export function isSubProcedureId(value: string | undefined | null): value is SubProcedureId {
  return value != null && SUB_ID_SET.has(value);
}

/**
 * 서버가 아는 시술 id 인가. **세부 시술 31개가 곧 그 집합이다** (요청 14) — `isSubProcedureId`
 * 와 같은 판정이고, `ProcedureId`(계약 타입)로 좁혀 준다는 점만 다르다. 두 이름을 남겨 둔 것은
 * 호출부가 "계약 값을 검사한다"(폼·쿼리 파라미터)와 "화면 분류를 검사한다"를 구분해 읽기
 * 위해서다 — `taxonomy.test.ts` 가 두 집합이 같음을 고정한다.
 */
export function isProcedureId(value: string | undefined | null): value is ProcedureId {
  return isSubProcedureId(value);
}

/* ------------------------------------------------------------------ 조회 */

export function getCategory(id: CategoryId): ProcedureCategory {
  // `CategoryId` 로 좁혀진 값만 들어오므로 Map 에 반드시 있다.
  return CATEGORY_BY_ID.get(id) as ProcedureCategory;
}

export function getSubProcedure(id: SubProcedureId): SubProcedure {
  return SUB_BY_ID.get(id) as SubProcedure;
}

/** 대분류의 세부 시술 — 선언 순서 그대로(= 화면 순서). */
export function getSubProceduresOf(categoryId: CategoryId): readonly SubProcedure[] {
  return SUBS_BY_CATEGORY.get(categoryId) ?? [];
}

/**
 * 대분류에 속한 시술 id 들 (선언 순서 = 화면 순서).
 *
 * 목록 조회는 이 배열이 아니라 `?categoryId=` 한 값으로 간다 (계약 §22.6). 쓰는 곳은
 * **분야 조건을 받지 않는 오퍼레이션** 하나뿐이다 — 관리자 상담 목록의 반복 `procedureId`.
 */
export function getSubProcedureIdsOf(categoryId: CategoryId): SubProcedureId[] {
  return getSubProceduresOf(categoryId).map((sub) => sub.id);
}

/**
 * 서버가 준 시술 id → 세부 시술. 모르는 id 면 `null` (계약 §15 의 enum 방어 — 서버가
 * 미래에 새 id 를 내려줄 수 있다). **옛 id 는 풀지 않는다** — 서버 응답에 옛 id 는 없고,
 * 바깥에서 들어온 값은 호출부가 먼저 `resolveLegacyProcedureId` 를 거친다.
 */
export function findSubProcedure(procedureId: string): SubProcedure | null {
  return SUB_BY_ID.get(procedureId as SubProcedureId) ?? null;
}

/** 시술 id → 대분류. 모르는 id 면 `null`. */
export function categoryOfProcedure(procedureId: string): ProcedureCategory | null {
  const sub = findSubProcedure(procedureId);
  return sub ? getCategory(sub.categoryId) : null;
}

/**
 * 카드 배지에 쓰는 표시 이름. 서버 이름과 같은 값이지만 **네트워크를 기다리지 않는다** —
 * 배지는 카드가 그려지는 첫 프레임에 필요하다. 모르는 id 는 `null` — 호출부는 배지를 건너뛴다.
 */
export function procedureDisplayName(procedureId: string): string | null {
  return findSubProcedure(procedureId)?.name ?? null;
}

export interface ProcedureCategoryGroup {
  category: ProcedureCategory;
  subs: SubProcedure[];
}

/**
 * 병원·전문의의 `procedureIds` 를 대분류별로 묶는다 (상세 화면의 "대표 시술").
 * 대분류 순서는 `CATEGORIES` 순서, 그룹 안은 `SUB_PROCEDURES` 순서. 빈 그룹과
 * 모르는 id 는 결과에 없다.
 */
export function groupProcedureIdsByCategory(procedureIds: readonly string[]): ProcedureCategoryGroup[] {
  const matched = new Set<SubProcedureId>();
  for (const id of procedureIds) {
    const sub = findSubProcedure(id);
    if (sub) matched.add(sub.id);
  }

  const groups: ProcedureCategoryGroup[] = [];
  for (const category of CATEGORIES) {
    const subs = getSubProceduresOf(category.id).filter((sub) => matched.has(sub.id));
    if (subs.length > 0) groups.push({ category, subs });
  }
  return groups;
}

/** 카테고리 페이지 URL 의 단일 출처. `sub` 가 없으면 쿼리 자체를 붙이지 않는다. */
export function categoryPath(categoryId: CategoryId, sub?: SubProcedureId | null): string {
  return sub ? `/category/${categoryId}?sub=${sub}` : `/category/${categoryId}`;
}

/**
 * 시술 id 를 들고 있는 링크(인기검색어 `SearchTarget`, 꿀팁 CTA)의 목적지.
 * 모르는 id 면 `null` — 호출부가 대체 목적지를 정한다. 두 화면이 같은 변환을 각자
 * 적어 두면 한쪽만 고쳐져 조용히 갈라진다.
 */
export function categoryPathForProcedure(procedureId: string): string | null {
  const sub = findSubProcedure(procedureId);
  return sub ? categoryPath(sub.categoryId, sub.id) : null;
}

/* ------------------------------------------------------------------ 검색 */

export interface TaxonomyMatch {
  category: ProcedureCategory;
  /** 대분류 자체가 걸렸으면 `null` — 카테고리 페이지를 "전체"로 연다. */
  sub: SubProcedure | null;
  /**
   * 검색어가 **처음 걸린 후보 문자열**(표시 이름 또는 동의어). 검색 추천이
   * `‘금니’ 로 찾았어요` 를 적을 때 쓴다 — 표시 이름(`크라운`)에 검색어가 없으면
   * 왜 그 줄이 떴는지 설명이 필요하다.
   */
  matchedAlias: string;
}

/** 검색어·후보를 비교하기 전에 거치는 정규화. 추천 목록의 굵게 표시도 같은 규칙을 쓴다. */
export function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

/** 걸린 후보 문자열(원본 그대로). 안 걸리면 `null`. */
function findAlias(candidates: readonly string[], query: string): string | null {
  return candidates.find((candidate) => normalizeSearchTerm(candidate).includes(query)) ?? null;
}

/**
 * 검색어 → 걸린 카테고리·세부 시술 **전부** (화면 순서대로).
 *
 * 매칭 방향은 **`후보.includes(검색어)`** 로 고정한다. 반대로 하면 "연세 바른교정치과" 가
 * `'연세 바른교정치과'.includes('교정')` 으로 교정 카테고리에 납치돼, 병원 이름 검색이
 * 통째로 카테고리 이동이 된다.
 *
 * 순서: ① 대분류(선언 순서) → ② 세부 시술(선언 순서). **준비중을 뒤로 미루는 규칙은 여기
 * 없다** — 그 판정의 입력(`Procedure.isAvailable`)은 서버에만 있고 이 파일은 네트워크를
 * 모른다. 추천 목록이 받아 온 가용성으로 다시 줄 세운다 (`features/search/suggest.ts`).
 *
 * 상한을 두지 않는다 — 몇 개를 보여줄지는 화면이 정한다(추천 목록은 3개).
 */
export function searchTaxonomyAll(query: string): TaxonomyMatch[] {
  const q = normalizeSearchTerm(query);
  if (q.length === 0) return [];

  const result: TaxonomyMatch[] = [];

  for (const category of CATEGORIES) {
    // 이름과 동의어 중 **처음 걸린 하나만** 담는다 — 양쪽에 걸려도 줄이 두 번 생기지 않는다.
    const alias = findAlias([category.name, ...category.keywords], q);
    if (alias) result.push({ category, sub: null, matchedAlias: alias });
  }

  for (const sub of SUB_PROCEDURES) {
    const alias = findAlias([sub.name, ...sub.keywords], q);
    if (alias) result.push({ category: getCategory(sub.categoryId), sub, matchedAlias: alias });
  }

  return result;
}

/**
 * 검색어 → 카테고리(+세부 시술) **한 개**. Enter 가 가는 곳이자 추천 목록의 첫 줄이다.
 *
 * `searchTaxonomyAll` 의 첫 원소로 정의한다 — 규칙이 한 벌이어야 "추천 목록 맨 위"와
 * "Enter 목적지"가 영원히 같은 곳을 가리킨다.
 */
export function searchTaxonomy(query: string): TaxonomyMatch | null {
  return searchTaxonomyAll(query)[0] ?? null;
}
