---
name: react-ui
description: Use when building or refining UI components, layouts, styling, or responsive/accessibility behavior in frontend/ — including work on existing screens' appearance.
---

# UI 구현

## 구현 전

1. `frontend/src/components/` 를 실제로 열어본다
2. 비슷한 UI가 이미 있으면 **재사용한다** — 유사 컴포넌트를 새로 만들지 않는다
3. 기존 화면에서 쓰이는 간격·글자 크기·색·라운드 값을 확인하고 그대로 따른다

현재 있는 것: `AppHeader`, `TopNavBar`, `BottomTabBar`, `Footer`, `SearchBar`, `SectionHeader`,
`PrimaryButton`, `Chip`, `Badge`, `HospitalCard`, `HospitalExploreCard`, `DoctorCard`, `GuideCard`,
`PromotionCard`, `ProcedureCategoryCard`, `HeroBanner`, `PriceCompareTable`, `HospitalMapView`, `StockImage`.

## 스타일

- **Tailwind 3** 유틸리티 클래스로 쓴다. 다른 CSS 프레임워크나 CSS-in-JS를 추가하지 않는다
- 브랜드 색은 `tailwind.config.js`의 `brand.50`–`brand.900` 팔레트를 쓴다.
  (`brand-500` = `#22a696`) 임의의 hex를 새로 박아 넣지 않는다
- 중립색은 Tailwind 기본 `neutral-*` 계열을 쓴다 (기존 화면이 쓰는 값)
- 간격도 Tailwind 스케일을 쓴다. 임의 `[13px]` 같은 값은 기존에 같은 게 있을 때만

## primitives vs 평범한 HTML

`src/primitives/` 는 옛 react-native 컴포넌트(`View`/`Text`/`Pressable`/`ScrollView` …)를 DOM으로 옮긴 레이어다.
이미 포팅된 화면이 재작성 없이 돌게 하려고 남겨둔 것이며 **강제 규약이 아니다.**

- 기존 화면을 수정할 때는 그 화면이 쓰는 방식을 유지한다 (섞으면 flex 기본 방향이 어긋난다)
- 새 화면/컴포넌트는 평범한 `div`/`p`/`button`을 써도 된다
- primitives는 RN식 기본값을 재현한다 — **flex 방향이 기본 column이다.** 가로 배치는 `flex-row`

## 반응형

- 데스크톱/모바일 분기는 `useIsWideWeb()` 훅을 쓴다 (`@/hooks/useIsWideWeb`). 새 미디어쿼리 훅을 만들지 않는다
- 넓은 화면에서는 `TopNavBar` + `max-width: 1200px` 중앙 정렬, 좁은 화면에서는 `BottomTabBar` — `App.tsx`의 `Shell`이 처리한다
- 모바일과 데스크톱 두 폭에서 레이아웃이 깨지지 않는지 확인한다

## 접근성

- 시맨틱 HTML을 쓴다
- **클릭 가능한 요소는 `button`** (또는 primitives의 `Pressable`). 클릭 핸들러 달린 `div`를 만들지 않는다
- 폼 입력에는 라벨을 연결한다
- 의미 있는 이미지에는 alt 텍스트를 준다. 장식용 이미지는 `alt=""`
- 키보드로 조작 가능한지 확인한다 (Tab 이동, Enter/Space 실행)

## 컴포넌트 경계

- 같은 UI가 두 곳 이상에서 쓰이면 `src/components/` 로 뽑는다
- 한 컴포넌트가 서로 무관한 책임을 여러 개 갖지 않게 한다
- 컴포넌트 안에서 스토어를 직접 mutate하지 않는다 — 스토어 액션을 호출한다

## 완료 전 확인

- [ ] 데스크톱 폭 레이아웃
- [ ] 모바일 폭 레이아웃
- [ ] loading / empty / error 상태 표시
- [ ] 키보드 조작
- [ ] `npm run typecheck && npm run build` 통과

## Red Flags

- `src/components/` 를 보지 않고 새 카드/버튼을 만들고 있다
- `#`으로 시작하는 색 값을 새로 적고 있다 (`brand-*`에 있는지 먼저 확인)
- `onClick` 달린 `div`를 만들고 있다
- 기존 화면의 primitives와 평범한 HTML을 한 트리에서 섞고 있다
