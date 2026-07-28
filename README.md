# 몰라몰라

시술 중심으로 병원을 탐색하는 치과 정보 플랫폼. React Native + Expo Router로 웹/iOS/안드로이드를 하나의 코드베이스로 지원합니다.

## 스택

- Expo SDK 57 / React Native 0.86 / React 19
- Expo Router (파일 기반 라우팅, 웹/네이티브 공용)
- NativeWind 4 (Tailwind CSS)
- Zustand + AsyncStorage (찜하기, 상담 신청 내역 로컬 저장)
- TypeScript

## 시작하기

```bash
npm install
npm run web      # 웹
npm run ios      # iOS 시뮬레이터 (macOS 필요)
npm run android  # 안드로이드 에뮬레이터
```

## 폴더 구조

```
src/
  app/                  화면 및 라우팅 (expo-router)
    _layout.tsx          루트 Stack (+ 웹 와이드 화면에서만 보이는 TopNavBar)
    (tabs)/              홈 / 병원(탐색) / 커뮤니티 / 마이페이지 탭 (모바일 하단 탭바)
    (tabs)/explore.tsx    병원 탐색: [시술]/[병원] 토글, 카테고리 탭, 정렬·필터, 2열/1열 반응형 카드 그리드
    hospital/[id].tsx             병원 상세
    consult/[hospitalId].tsx      상담 신청 (모달, 로그인 필요)
    community/[id].tsx            질문 상세
    community/new.tsx             질문 작성 (모달)
    auth/login.tsx                로그인 (모달)
    auth/signup.tsx                회원가입 (모달)
    events.tsx                     전체 이벤트 목록
    admin/index.tsx                병원 관리자: 병원 목록
    admin/hospital/new.tsx         병원 등록
    admin/hospital/[id].tsx        병원 정보 수정
  components/           SearchBar, HospitalCard, HospitalExploreCard, PromotionCard, PriceCompareTable, TopNavBar 등
  data/                 목업 데이터 (procedures, hospitals, reviews, guides, promotions, qaPosts)
  hooks/                 useRequireAuth, useIsWideWeb 등 커스텀 훅
  store/                zustand 스토어 (인증, 병원 디렉터리, 찜하기, 상담 신청, 커뮤니티)
  types/                도메인 타입 정의
  utils/                포맷터 등 유틸
```

## 반응형 네비게이션 (웹 상단 / 모바일 하단)

- `src/hooks/useIsWideWeb.ts`가 `Platform.OS === 'web' && width >= 768`일 때만 `true`를 반환합니다.
- 이 값이 `true`면 루트 레이아웃이 `TopNavBar`(로고 / 홈·이벤트·병원·커뮤니티 메뉴 / 검색·로그인·회원가입 또는 마이페이지 아이콘)를 렌더링하고, 동시에 하단 탭바는 `tabBarStyle: { display: 'none' }`로 숨깁니다.
- 좁은 화면(모바일, 또는 네이티브 iOS/Android)에서는 반대로 하단 탭바만 보입니다.
- 넓은 화면에서는 루트 레이아웃(`src/app/_layout.tsx`)이 전체 페이지 콘텐츠를 `maxWidth: 1200` + 가운데 정렬 컨테이너로 감싸, `TopNavBar`와 동일한 폭으로 여백을 맞춥니다 (모바일/좁은 화면에서는 이 제약이 사라지고 기존처럼 꽉 채웁니다).
- 브라우저 창 너비를 줄이거나 늘려서 레이아웃이 전환되는지 확인해보세요.

## 병원 탐색 화면 (`/explore`)

- 상단 `[의사] / [병원]` 토글로 같은 카테고리·정렬·필터 조건에서 의사 프로필 카드 또는 병원 카드를 전환해 볼 수 있습니다 (바비톡의 의사/병원 탭 구조 참고).
- 카테고리 가로 탭: **추천** + 전체 + 12개 시술. "추천"은 `isRecommended` 플래그가 있는 병원/의사만 보여주는 에디터 추천 필터입니다.
- 정렬·필터 칩: 인기순/후기순/상담많은순/상담가능/원데이 — 의사 모드에서는 상담가능·원데이 필터가 해당 의사의 소속 병원 속성을 기준으로 동작합니다.
- 반응형 카드 그리드(웹 2열 · 모바일 1열), "가격 비교표 보기"로 기존 `PriceCompareTable`도 재사용 가능합니다.
- 홈 화면의 시술 카테고리, 검색바, 꿀팁 카드, 상단 네비게이션의 "병원" 메뉴가 모두 이 화면으로 연결됩니다 (`mode`, `category` 쿼리 파라미터로 초기 상태 지정).

## 의사 프로필 & 추천 (`src/data/doctors.ts`)

- `Doctor` 타입(`src/types/domain.ts`)은 병원과 별도 엔티티로, `hospitalId`로 소속 병원을 참조합니다. 이름/직함/전문분야/사진/전문의 여부/추천 여부/시술 태그/후기·상담 수를 가집니다.
- 의사 카드의 "상담신청"은 소속 병원의 상담 신청 화면으로 연결됩니다 (의사별 상담 데이터는 아직 분리하지 않았습니다).
- `Hospital.isRecommended`, `Doctor.isRecommended`로 "추천" 배지·필터를 지원합니다. 목업 데이터는 병원 6곳 중 3곳(`h1`, `h2`, `h6`), 의사 6명 중 3명(`d1`, `d3`, `d6`)을 추천으로 설정해뒀습니다.

## 원데이보철 (병원 속성)

- "원데이보철"은 시술 카테고리가 아니라 **병원 속성**으로 모델링했습니다: `Hospital.isOneDay: boolean` (`src/types/domain.ts`).
- 병원 카드(`HospitalCard`, `HospitalExploreCard`)와 상세 화면의 "병원 특징" 섹션에 "⚡ 원데이 가능" 배지로 노출됩니다.
- 병원 탐색 화면의 "원데이" 필터 칩을 켜면 `isOneDay === true`인 병원만 남도록 필터링합니다.
- 목업 데이터(`src/data/hospitals.ts`)는 6곳 중 3곳을 `true`, 3곳을 `false`로 섞어 필터 동작을 바로 확인할 수 있게 했습니다.

## 광고/추천 슬롯 (`src/utils/sponsorship.ts`)

- `Hospital`에 `isSponsored`, `sponsoredCategories`(`ProcedureId[]` — 스펙 예시는 한글 문자열이었지만, 기존 필터링 로직과 일관되게 슬러그로 통일했습니다), `sponsoredRank`, `sponsoredStartDate`/`sponsoredEndDate`(ISO 날짜 문자열)를 추가했습니다.
- `isSponsorshipActive(hospital)`은 오늘 날짜가 광고 기간 안에 있을 때만 `true`를 반환합니다. `isEligibleForSponsoredPlacement(hospital, category)`는 여기에 더해 **해당 카테고리가 `sponsoredCategories`에 포함되고 평점이 3.5 이상**일 때만 상단 노출 대상으로 인정합니다 (신뢰도 보호 장치).
- 병원 탐색 화면에서 특정 시술 카테고리(또는 "추천" 탭)를 선택하면, 조건을 만족하는 광고 병원을 `sponsoredRank` 오름차순으로 맨 위에 배치하고 그 아래로 일반 병원을 기존 정렬 기준(인기순/후기순/상담많은순)으로 이어붙입니다. "전체" 탭에서는 광고 우선노출을 적용하지 않습니다.
- 평점 미달로 상단에서 제외된 광고 병원도 "광고" 배지 자체는 계속 표시됩니다 — 순위만 조정될 뿐, 유료 게재라는 사실은 항상 정직하게 노출합니다.
- 카드(`HospitalCard`, `HospitalExploreCard`)와 상세 화면 "병원 특징"에 옅은 회색 배경의 작은 **"광고"** 배지로 표시합니다 (원데이·추천 배지보다 톤을 낮춰 눈에 띄지 않게 처리).
- 목업 데이터(`src/data/hospitals.ts`)는 의도적으로 "광고가 조직 순위를 뒤집는" 사례를 포함합니다: `laminate` 카테고리에서 평점이 가장 낮은 `h2`가 광고로 1위, `implant`에서는 `h3`가 광고로 조직 1위인 `h1`을 앞서고, `h5`는 `sponsoredRank: 1`이어도 평점(3.2)이 기준 미달이라 상단에서 제외됩니다.

## 병원 관리자 페이지 (`/admin`, 목업)

- `src/store/useHospitalStore.ts`가 병원 디렉터리의 반응형 소스입니다. 목업 시드 데이터로 시작해 AsyncStorage에 영속되며, 병원 상세·탐색 화면이 모두 이 스토어를 구독합니다.
- `/admin`에서 등록된 병원 목록을 보고, "새 병원 등록" 또는 각 병원을 눌러 수정할 수 있습니다.
- 등록/수정 폼(`src/components/admin/HospitalForm.tsx`)에 시술 다중 선택, 가격대, 태그와 함께 **"원데이 진료 가능 여부"**, **"추천 병원으로 노출"** 체크박스가 있어 병원이 직접 설정할 수 있습니다.
- 광고 필드는 이 폼에 없습니다 — `/admin/hospital/[id]` 수정 화면 상단에 **읽기 전용 "광고 현황"** 카드만 보여줍니다 (예: "임플란트 카테고리 광고 중 · 2026-08-15까지"). 광고 신청/결제 플로우는 다음 단계에서 별도로 구현할 예정입니다.
- 인증 없이 누구나 접근 가능한 목업 관리자 화면입니다. 실 서비스에서는 병원 담당자 전용 로그인/권한 체계가 필요합니다.

## 현재 구현된 MVP 플로우

홈 → 시술 카테고리 → 병원 리스트 → 병원 상세 → 상담 신청 → 찜하기

강남언니·바비톡을 참고해 아래 요소를 추가로 반영했습니다.

- **이벤트/할인가 표시**: 홈 상단 이벤트 캐러셀, 병원 카드·상세의 정가/할인율/최종가 표시 (`src/data/promotions.ts`)
- **실제 후기 사진**: 후기에 사진 첨부 가능 (`Review.photos`), 병원 상세 후기 섹션에서 가로 스크롤로 노출
- **가격 비교 테이블**: 시술별 병원 리스트 화면에서 "카드로 보기 / 가격 비교표" 토글
- **커뮤니티 Q&A**: 질문 등록, 답변(치과의사 답변 배지 구분) 열람 (`src/store/useCommunityStore.ts`)

## 사용자 인증 (목업)

- `src/store/useAuthStore.ts`가 로컬 전용 "가짜 백엔드"입니다. 회원가입 시 계정(이메일/이름/비밀번호)을 AsyncStorage에 저장하고, 로그인 시 대조합니다. **비밀번호를 평문으로 저장**하므로 이 스토어는 프로토타입 전용이며, 실제 서비스 전에 Supabase/Firebase 같은 실 백엔드로 교체해야 합니다.
- `User.provider` 필드에 `'email' | 'google' | 'kakao'`를 열어두어 소셜 로그인을 나중에 추가할 수 있게 했습니다. 로그인 화면의 "구글/카카오로 계속하기" 버튼은 현재 "준비중" 안내만 띄우는 자리표시자입니다.
- `useRequireAuth` 훅(`src/hooks/useRequireAuth.ts`)으로 찜하기·상담 신청 버튼을 감싸, 비로그인 사용자가 누르면 `/auth/login`으로 이동하고 로그인 후 원래 하려던 동작(상담 신청 화면 등)으로 돌아갑니다. 상담 신청 화면 자체에도 직접 URL 접근을 막는 가드를 넣었습니다.
- 마이페이지 탭에서 로그인 상태에 따라 프로필/로그아웃 또는 로그인·회원가입 유도 카드를 보여주고, 그 아래 찜한 병원 목록을 표시합니다.

메모:
- `src/data/hospitals.ts`는 이제 `useHospitalStore`의 시드 데이터 역할만 합니다. 병원을 조회할 땐 `getHospitalById`/`getHospitalsByProcedure`(`@/store/useHospitalStore`)나 스토어 훅을 사용하세요.
- 찜하기·상담 신청·커뮤니티 글·계정 정보·병원 디렉터리는 모두 AsyncStorage에 로컬 저장되며, 서버 연동 전까지의 임시 저장소입니다.
- 상담 신청은 단일 병원 신청폼 방식으로 유지했습니다 (강남언니식 여러 병원 동시 견적요청은 백엔드/데이터 구조가 커져 추후 별도 검토).

## 다음 단계 제안

- 실제 백엔드 인증 연동 (Supabase/Firebase 등으로 `useAuthStore` 교체, 비밀번호 해싱)
- 소셜 로그인 (구글/카카오) 실제 연동
- 관리자 페이지에 병원 담당자 전용 인증/권한 추가
- 병원 탐색 화면의 텍스트 검색(현재는 카테고리 브라우징만 지원) 구현
- 마이페이지 확장 (상담 내역, 후기 작성)
- 앱 아이콘/스플래시 이미지를 브랜드 리소스로 교체 (`assets/images`)
