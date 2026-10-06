# 시술 카테고리 2단 구조 (대분류 9 → 세부 시술 31) — 프론트엔드 매핑 계층

## Context

시술 13개가 평면 목록이라 "교정 전문 치과", "보존 치료 중심 치과"처럼 병원이 실제로 내세우는
진료 범위가 드러나지 않는다. 대분류 9개 → 세부 시술 31개로 바꿔, 대분류가 병원의 진료 범위를
나타내고 세부 시술이 실제 등록 단위가 되게 한다.

**조사 결과 시술 목록의 원본은 백엔드 DB다** (`GET /api/v1/procedures`, 13종). 백엔드는 협업자
영역이라 손대지 않으므로, 이번 작업은 **13개 서버 id 위에 얹는 프론트엔드 매핑 계층**이다.
서버가 모르는 세부 시술 18개는 "준비중"으로 보이되 서버로 보내지 않는다.

---

## 조사에서 확인한 제약 (설계를 가른 사실)

| 사실 | 영향 |
|---|---|
| 시술 13종은 백엔드 DB가 원본. 프론트 `mocks/fixtures/procedures.ts` 는 **백엔드 seed 가 import 하는 파일** (`backend/prisma/seed/fixtures.ts:31`) + 프론트 테스트 8개의 HTTP 스텁 | **이 fixture 는 1바이트도 안 건드린다.** 분류 체계는 새 파일에 둔다 |
| `GET /hospitals?procedureId=` 는 **값 하나만** 받음 (배열 → 422). `/doctors` 동일 | 대분류 하나가 서버 id 여러 개(충치치료=cavity+inlay+crown)에 걸치면 요청 1번으로 못 거른다 |
| `procedureId` 를 보낼 때만 **광고 우선 노출**이 켜짐 (`hospital.service.ts:80`) | 서버 id 없이 받은 목록은 광고 순서가 없다 |
| 쓰기(`POST/PATCH /hospitals`)는 `procedureIds` 를 **DB 행 존재**로 검증 → 없는 id 는 422 `unknown_procedure` | 새 세부 시술 id 는 저장 불가. 서버 13종만 저장 가능 |
| `hospital.procedureIds` 는 서버 13종 문자열 배열 | 화면은 이걸 세부 시술 → 대분류로 **역매핑**해서 보여준다 |
| 전공↔시술 표가 FE `utils/specialty.ts` / BE `doctor/specialty-procedures.ts` 둘 다 있음 | FE 는 대분류 기준으로 다시 쓰고, BE 와의 차이를 기록만 한다 |
| 홈 그리드·탐색 탭·검색·관리자 폼이 모두 `useProcedures()`(서버 13종)로 목록을 그림 | 이 넷은 정적 taxonomy 로 바뀌고 로딩 스켈레톤이 사라진다 |
| 11개 시드 병원의 시술 조합: 13종 전부 1곳 이상 사용 | 매핑 후 어느 대분류에도 안 걸리는 병원은 없다 (QA 2번) |

---

## 사용자와 확정한 결정

1. 서버 id 없는 세부 시술 18개 → **보이되 비활성 + "준비중"** (칩·체크박스 모두)
2. "스케일링·예방"(세부 4개 전부 서버 id 없음) → **보이되 "준비중"**, 누르면 "등록된 병원이 아직 없어요"
3. 이름이 1:1 로 안 맞는 3개 → `cavity`→레진, `orthodontics`→일반(브라켓)교정, `botox`→이갈이 보톡스

---

## 설계

### 1) 분류 데이터 — `frontend/src/features/procedure/taxonomy.ts` (신규, 순수 데이터)

```ts
CategoryId = 'implant'|'prevention'|'orthodontics'|'cavity'|'aesthetic'|'gum'|'tmj'|'botox'|'extraction'
ProcedureCategory { id; name; description(한 줄); keywords[] }           // ×9, 배열 순서 = 화면 순서
SubProcedure      { id; name; categoryId; keywords[]; legacyProcedureId: ProcedureId | null }  // ×31
LEGACY_TO_SUB: Record<ProcedureId, SubProcedureId>   // 13개 — 컴파일러가 전부 강제
```

**대분류 → 세부 시술 → 서버 id**

| 대분류 | 세부 시술 (★ = 서버 id 있음) |
|---|---|
| 임플란트 | ★일반 임플란트(`implant`) · 뼈이식 · 상악동거상술 · 임플란트 틀니 |
| 스케일링·예방 | 스케일링 · 불소도포 · 실란트 · 구취관리 — **전부 준비중** |
| 교정 | 투명교정 · 설측교정 · ★일반(브라켓)교정(`orthodontics`) · 부분교정 |
| 충치치료 | ★레진(`cavity`) · ★인레이(`inlay`) · 온레이 · ★크라운(`crown`) · 신경치료 |
| 심미 | ★라미네이트(`laminate`) · ★치아미백(`whitening`) · 잇몸성형 |
| 잇몸치료 | ★잇몸치료(`gum-disease`) · 치주수술 · 잇몸이식 |
| 턱관절·스플린트 | ★턱관절장애 치료(`tmj`) · ★스플린트(`splint`) · 이갈이장치 · ★코골이장치(`snoring-device`) |
| 보톡스 | ★이갈이 보톡스(`botox`) · 사각턱(교근) 보톡스 |
| 사랑니·발치 | ★사랑니 발치(`wisdom-tooth`) · 일반 발치 |

keywords 예: 신경치료 `['신경치료','근관치료','엔도']`, 스케일링 `['스케일링','치석제거']`,
크라운 `['크라운','지르코니아','금니','씌우기']`, 턱관절 `['턱관절','악관절','턱통증','tmj']`.

헬퍼: `isCategoryId` `isSubProcedureId` `isProcedureId` `getCategory` `getSubProcedure`
`getSubProceduresOf` `getLegacyIdsOf` `subFromLegacy` `categoryFromLegacy`
`displayNameForLegacy`(카드 배지용, 모르는 id → null) `groupLegacyIdsByCategory`(상세 그룹핑)
`categoryPath(categoryId, sub?)`(`/category/:id?sub=` 단일 출처) `searchTaxonomy(query)`.

`searchTaxonomy` 매칭 방향은 **`이름.includes(검색어)`** 로 고정 — 반대로 하면 "연세 바른교정치과"가
교정 카테고리에 납치된다. 우선순위: 카테고리 이름/키워드 → 서버 id 있는 세부 → 준비중 세부.

### 2) 아이콘 — `utils/procedureIcons.ts` 에 `CATEGORY_ICONS: Record<CategoryId, IconComponent>`

전부 `lucide-react` 에 실존 확인함. 서로 겹치지 않음.

| 대분류 | 아이콘 | 비고 |
|---|---|---|
| 임플란트 | `Bolt` | 나사/식립 (기존 유지) |
| 스케일링·예방 | `Droplets` | 세정 |
| 교정 | `Braces` | 치아교정기 (기존 유지) |
| 충치치료 | `ShieldCheck` | 보존·치료 완료 (기존 cavity 유지) |
| 심미 | `Sparkles` | 반짝임 — **탐색 "추천" 탭이 쓰던 아이콘을 `Star` 로 바꿔 넘겨받음** |
| 잇몸치료 | `HeartPulse` | 기존 유지 |
| 턱관절·스플린트 | `Shield` | 장치/보호 (기존 splint 유지) |
| 보톡스 | `Syringe` | 기존 유지 |
| 사랑니·발치 | `Scissors` | 발치 (기존 임시 아이콘 `Frown` 대체) |

### 3) 전공 가중치 — `utils/specialty.ts` 를 대분류 기준으로 재작성

```ts
CATEGORY_SPECIALTIES: Record<CategoryId, readonly DentalSpecialty[]> = {
  implant:      ['구강악안면외과전문의'],
  prevention:   ['치주과전문의', '통합치의학과전문의'],      // 사용자 미지정 → 제안
  orthodontics: ['치과교정전문의'],
  cavity:       ['치과보철전문의', '통합치의학과전문의'],
  aesthetic:    ['치과보철전문의', '통합치의학과전문의'],
  gum:          ['치주과전문의'],
  tmj:          ['구강악안면외과전문의'],                   // 사용자 미지정 → 기존 유지
  botox:        ['구강악안면외과전문의'],                   // 사용자 미지정 → 기존 유지
  extraction:   ['구강악안면외과전문의'],
}
isSpecialtyForCategory(categoryId, specialty): boolean
```

기존 `PROCEDURE_SPECIALTY_MAP` / `getSpecialtyForProcedure` 는 **삭제** (유일한 소비자
`HospitalExploreCard` 가 새 함수로 바뀜). `implant` 가 치과보철→구강악안면외과로 바뀌는 등
**BE `specialty-procedures.ts` 와 달라지는 점은 known-issues 에 기록**.

### 4) 대분류로 병원 받아오기 — 요청 1번 + 필요할 때만 클라이언트 필터

`features/procedure/lib/resolveCategoryFilter.ts` (순수 함수) 가 선택 → 요청 방식을 정한다:

| 선택 | 방식 | 광고 순서 |
|---|---|---|
| 추천 | `{ recommended: true }` | 유지 |
| 세부 시술 (서버 id 있음) | `{ procedureId }` 서버 필터 | 유지 |
| 대분류 전체, 서버 id **1개** (임플란트·교정·잇몸·보톡스·발치) | `{ procedureId }` 서버 필터 | 유지 |
| 대분류 전체, 서버 id **2개 이상** (충치치료·심미·턱관절) | `{ pageSize: 100 }` 받아서 `procedureIds` 교집합으로 **클라이언트 필터** | **없음** (known-issues 기록) |
| 서버 id 0개 (스케일링·예방, 준비중 세부) | 요청 안 함 → 빈 결과 | — |

N개 병렬 요청 후 병합(fan-out)은 **채택하지 않음**: 서버의 정렬·광고 규칙을 클라이언트에 복제해야
하고(AGENTS.md "같은 판정을 두 곳에 두지 않는다"), `meta.totalItems` 합산 불가, 지도 모드에서
반경 요청이 N배가 된다. 클라이언트 필터가 걸리는 건 9개 중 3개뿐이다.

훅: `features/hospital/hooks/useHospitalsByCategory(selection, baseFilters, {enabled})`,
`features/doctor/hooks/useDoctorsByCategory(...)` — 탐색 페이지와 카테고리 페이지가 **같은 훅**을 쓴다.
기존 `useHospitals` / `useDoctors` 를 감싸므로 새 queryKey 불필요.

### 5) 라우트 `/category/:categoryId?sub=<subId>`

- `App.tsx` `ROUTES` 에 `{ path: '/category/:categoryId', element: <CategoryPage/>, options: { headerShown: false } }` — 공개, 탭 아님
- 화면이 자체 헤더(뒤로 + 대분류 이름 + 설명)를 그림. `title:''` + `Stack.Screen` 패턴은 쓰지 않음 —
  `known-issues.md:168` 에 그 패턴의 "뒤로 가기 버튼 두 개" 결함이 이미 기록돼 있다
- 세부 칩 선택은 react-router `useSearchParams` 로 URL 에 쓴다(`replace`). `router.setParams` 는
  키 삭제가 안 돼 "전체"로 못 돌아가고, `src/navigation/**` 는 수정 대상이 아니다(eslint 주석)
- `?sub=` 가 준비중 세부면 "{이름}은(는) 준비중이에요 — 전체를 보여드려요" 안내 후 전체로

---

## 구현 순서 (각 단계 후 typecheck·test 초록 유지)

| # | 할 일 | 파일 |
|---|---|---|
| 1 | 분류 데이터 + 아이콘 + 전공 표 (추가만) | **신규** `features/procedure/taxonomy.ts`, `taxonomy.test.ts`, `utils/specialty.test.ts` · **수정** `features/procedure/index.ts`(re-export), `utils/procedureIcons.ts`(`CATEGORY_ICONS` 추가), `utils/specialty.ts`(`CATEGORY_SPECIALTIES` 추가) |
| 2 | 요청 방식 결정 + 대분류 훅 (추가만) | **신규** `features/procedure/lib/resolveCategoryFilter.ts`(+test), `features/hospital/hooks/useHospitalsByCategory.ts`(+test), `features/doctor/hooks/useDoctorsByCategory.ts`(+test) · **수정** 두 feature 의 `index.ts` |
| 3 | 공용 UI | **수정** `components/Chip.tsx`(`disabled` prop), `components/layout/CardGrid.tsx`(preset `categories: 'grid-cols-2 xs:grid-cols-3'` — 480px 미만 2열, 그 위 3열로 9개가 3×3), `features/hospital/hooks/useExploreFilters.ts`(`SORT_TO_SERVER` export) · **신규** `features/procedure/components/SubProcedureChips.tsx`, `features/hospital/components/ResultsHeader.tsx`(ExplorePage 에서 추출) |
| 4 | 카테고리 페이지 + 라우트 | **신규** `pages/CategoryPage.tsx`(+test) · **수정** `App.tsx` |
| 5 | 홈 "시술로 찾기" | **신규** `components/CategoryCard.tsx`(준비중 배지) · **수정** `screens/tabs/index.tsx`(`CATEGORIES` 9개, `columns="categories"`, 카드 → `/category/:id`) · **삭제** `components/ProcedureCategoryCard.tsx` |
| 6 | 탐색 페이지 | **수정** `features/hospital/hooks/useExploreFilters.ts`(카테고리 = 추천 \| CategoryId, `'all'` 제거, URL 파서가 **새 id 와 옛 13종 id 둘 다** 받음 — 옛 id 는 대분류로 변환, 모르면 추천), `pages/ExplorePage.tsx`(탭 = 추천(`Star`) + 9, 기타 제거, 스켈레톤 제거, 대분류 훅 사용), `features/hospital/components/HospitalExploreCard.tsx`(`activeCategory: CategoryId`, `isSpecialtyForCategory`) · **수정** `useExploreFilters.test.tsx`, `ExplorePage.test.tsx` |
| 7 | 검색 + 딥링크 | **수정** `screens/search.tsx`(`searchTaxonomy` → `/category/:id?sub=`, `useProcedures` 제거), `screens/tips/[id].tsx`(CTA → 카테고리 페이지) · **수정** `search.test.tsx` · `mocks/fixtures/trendingSearches.ts` 는 그대로(옛 id 가 카테고리 페이지로 해석됨) |
| 8 | 관리자 폼 | **수정** `components/admin/HospitalForm.tsx`(대분류 9개 접기/펼치기 섹션 → 세부 체크박스, 준비중은 비활성, 초기값 = `LEGACY_TO_SUB` 역매핑, 저장 = 서버 id 로 변환·중복 제거, 모르는 서버 id 는 그대로 보존) · **수정** `HospitalForm.test.tsx`, `AdminHospitalNewPage.test.tsx` |
| 9 | 카드·상세 배지 이름 | **수정** `HospitalCard.tsx`, `HospitalExploreCard.tsx`, `HospitalMapView.tsx`, `DoctorCard.tsx`, `DoctorDetailPage.tsx`(`displayNameForLegacy`), `HospitalDetailView.tsx`("대표 시술"을 대분류별로 그룹) · 커뮤니티·상담·관리자 상담 화면은 `useProcedureMap` 유지(서버 13종 그대로, 이번 범위 밖) |
| 10 | 정리 | `PROCEDURE_ICONS`, `PROCEDURE_SPECIALTY_MAP`, `getSpecialtyForProcedure` 삭제, 미사용 import 제거, `grep` 으로 잔존 참조 0 확인 |
| 11 | 문서 | **신규** `docs/features/category.md` · **수정** `home.md` `explore.md` `search.md` `admin-hospital-new.md` `admin-hospital-edit.md` `tip-detail.md` `hospital-detail.md` `doctor-detail.md` `known-issues.md` `README.md`(화면 표에 카테고리 페이지 추가) |

**건드리지 않는 것**: `backend/**` 전체, `docs/api/openapi.yaml`, `frontend/src/mocks/fixtures/procedures.ts`,
`types/domain.ts` 의 `ProcedureId`(서버 13종 그대로), `src/navigation/**`, `src/primitives/**`.

---

## 테스트

**바뀌는 기존 테스트**
- `useExploreFilters.test.tsx` — `?category=bogus`/`all` → 추천, `?category=crown` → 충치치료, 칩→`procedureId` 단언은 `useHospitalsByCategory.test` 로 이동
- `ExplorePage.test.tsx` — 기타 단언 삭제, 임플란트 탭 → `procedureId:'implant'`, 충치치료 탭 → `pageSize:100` + 클라이언트 필터 후 `총 N곳`, 스케일링·예방 탭 → 요청 없음 + 빈 상태, 콜드로드 스켈레톤 테스트 → 즉시 렌더 테스트로 교체
- `search.test.tsx` — 임플란트 → `/category/implant`, 근관치료 → `/category/cavity?sub=root-canal`, 병원명은 여전히 `q` 폴백
- `HospitalForm.test.tsx`, `AdminHospitalNewPage.test.tsx` — `'임플란트'` 라벨 → `'일반 임플란트'`
- 변경 없음: `useProcedureMap.test.tsx`(fixture 불변), `useCreateHospital/useUpdateHospital.test`

**새 테스트**
- `taxonomy.test.ts` — 9/31 개수, id 유일, 모든 세부의 categoryId 유효, 모든 대분류에 세부 ≥1, `LEGACY_TO_SUB` 13개 ↔ 세부의 `legacyProcedureId` 양방향 일치, 서버 id 공유하는 세부 없음, **`Object.keys(LEGACY_TO_SUB)` 가 `mocks/fixtures/procedures.ts` 의 id 집합과 동일**(seed 와의 결합 가드), `CATEGORY_ICONS`·`CATEGORY_SPECIALTIES` 키 = `CATEGORY_IDS`, `searchTaxonomy` 케이스, `categoryPath`
- `resolveCategoryFilter.test.ts` — 4가지 방식 분기 + 1개짜리 대분류는 서버 필터
- `useHospitalsByCategory.test.tsx` — 서버/클라이언트/빈/추천 네 모드의 실제 `fetchHospitals` 호출 인자
- `CategoryPage.test.tsx` — 헤더, 준비중 칩 `aria-disabled`, 크라운 칩 → `procedureId:'crown'` + 헤더 변경, `/category/prevention` 빈 상태 + 요청 없음, `?sub=root-canal` 안내, 다른 대분류 `sub` 무시, `/category/bogus`
- `HospitalForm.test.tsx` 추가 — 초기 `['implant','crown']` → 두 체크박스 `aria-pressed`, 준비중 클릭 무반응, 레진 선택 저장 → `procedureIds` 에 `'cavity'`, 전부 해제 → 저장 불가
- `specialty.test.ts`

---

## 엣지 케이스

| 상황 | 동작 |
|---|---|
| `/explore?category=bogus` 또는 `=all`(옛 기타 북마크) | 추천 |
| `/category/bogus` | "없는 카테고리예요" + 탐색으로 가기 |
| `procedureIds: []` 인 병원 | 어느 대분류에도 안 나옴, 상세에 "등록된 시술 정보가 없어요" |
| 스케일링·예방 | 홈·탐색에 준비중 표시, 선택 시 요청 없이 빈 상태 |
| `/category/cavity?sub=root-canal`(준비중) | 안내 문구 + 전체 |
| `/category/implant?sub=crown`(다른 대분류) | `sub` 무시 |
| 팁 CTA 의 옛 id | 카테고리 페이지로 (또는 탐색이 옛 id 를 받아 변환) |
| 한 병원이 여러 대분류 (h1: implant·laminate·botox) | 임플란트·심미·보톡스 세 곳에 모두 노출, 상세는 세 그룹 |
| 클라이언트 필터 + 지도/가격비교표 | 필터된 `items` 사용 |
| 미래에 서버가 모르는 id 를 내려줌 | 배지 건너뜀, 관리자 폼은 저장 시 그대로 보존 + 안내 |

---

## 백엔드 인계 (보고만 — 지금은 아무것도 안 바꿈)

협업자가 이걸 네이티브로 만들 때 바꿀 것:
1. `ProcedureCategory` 테이블(9행) + `Procedure.categoryId` FK + **세부 시술 18행 추가** + 준비중 플래그
2. `GET /procedures` 응답에 `categoryId` (또는 `GET /procedure-categories`)
3. `GET /hospitals` / `GET /doctors` 에 `categoryId=` 또는 반복 `procedureId=` → Prisma `{ in: [...] }`; `categoryId` 있을 때도 광고 우선 노출 켜기
4. `backend/src/doctor/specialty-procedures.ts` 에 새 18개 id + `implant` 전공 재검토 (FE 는 구강악안면외과로 바뀜)
5. `docs/api/openapi.yaml` `ProcedureId` enum 확장 + `categoryId` 파라미터
6. seed 의 시술 원본을 `frontend/src/mocks/fixtures/procedures.ts` 에서 `backend/prisma/seed/data/` 로 이전
→ 그 뒤 프론트는 `legacyProcedureId` 를 직접 id 로, 클라이언트 필터 분기 삭제, 관리자 폼 31개 전부 활성화

**known-issues 에 남길 것**: 충치치료·심미·턱관절 "전체"는 광고 순서 없음 + 100곳 상한 / 화면 이름이
서버 이름과 다름(레진·일반(브라켓)교정·이갈이 보톡스 등) / 18개 준비중·스케일링·예방 빈 카테고리 /
커뮤니티·상담 시술 선택은 서버 13종 그대로 / FE·BE 전공 표 차이 / fixture 가 seed 원본

---

## 검증

```bash
cd frontend
npm run typecheck && npm run lint && npm run test:run && npm run build
npm run dev   # 백엔드(:3000)도 떠 있어야 함
```

사용자 요청 QA 5항목 ↔ 확인 방법:

| QA 항목 | 확인 |
|---|---|
| 1. 대분류 클릭 → 카테고리 페이지 → 세부 칩이 목록을 실제로 바꿈 | `/` 임플란트 카드 → `/category/implant`; `/category/cavity` 전체 = h3·h7·h10(3곳) → 크라운 칩 → `?sub=crown`, h7·h10(2곳). `CategoryPage.test` + `useHospitalsByCategory.test` 로 고정 |
| 2. 시드 병원 11곳이 빠짐없이 대분류에 걸림 | 11곳의 `procedureIds` 13종이 `LEGACY_TO_SUB` 로 전부 매핑됨 — `taxonomy.test` 의 fixture 집합 동일성 가드 + QA 가 11곳을 대분류별로 전수 대조 |
| 3. 세부 시술 이름으로 검색 | `/search?q=인레이` → `/category/cavity?sub=inlay`; `근관치료`(키워드) → `?sub=root-canal` 안내; `search.test` |
| 4. 관리자가 고른 세부 시술이 사용자 화면에 반영 | `/admin/hospital/h7` 에서 레진 체크 → 저장 → `/hospital/h7` 대표 시술에 "충치치료 > 레진", `/category/cavity?sub=resin` 에 h7 노출. `HospitalForm.test` 가 payload 를 고정 |
| 5. 좁은 화면에서 그리드 안 깨짐 | `CardGrid` preset 이 Tailwind 리터럴(`grid-cols-2 xs:grid-cols-3`)이라 런타임 계산 없음; 480px 미만 2열(9개 → 5줄), 이상 3열(3×3). 긴 라벨 "턱관절·스플린트" 가 2열에서 줄바꿈 없이 들어가는지 QA 가 확인 |

구현 완료 후 CLAUDE.md 순서대로 **code-reviewer → qa-master** 를 거치고, qa-master 가 위 5항목에
"QA 통과"를 내기 전까지 완료로 보지 않는다.
