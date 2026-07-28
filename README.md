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
    (tabs)/explore.tsx    병원 탐색: [의사]/[병원] 토글, 리스트/지도 보기, 카테고리·정렬·필터, 반응형 카드 그리드
    hospital/[id].tsx             병원 상세 (전문의 소개 포함)
    consult/[hospitalId].tsx      상담 신청 (모달, 로그인 필요)
    community/[id].tsx            질문 상세
    community/new.tsx             질문 작성 (모달)
    auth/login.tsx                로그인 (모달)
    auth/signup.tsx                회원가입 (모달)
    events.tsx                     전체 이벤트 목록
    admin/index.tsx                병원 관리자: 병원 목록
    admin/hospital/new.tsx         병원 등록 (전문의 등록 포함)
    admin/hospital/[id].tsx        병원 정보 수정 (광고 현황 읽기전용 + 전문의 관리)
    admin/specialists.tsx          운영자용 전문의 자격증 검수 (승인/반려)
  components/           SearchBar, HospitalCard, HospitalExploreCard, DoctorCard, HospitalMapView, TopNavBar 등
  components/map/        KakaoMap.web.tsx(JS SDK) / KakaoMap.tsx(WebView 폴백) 플랫폼 분기 컴포넌트
  config/                kakaoMap.ts — EXPO_PUBLIC_ 환경변수 래퍼
  data/                 목업 데이터 (procedures, hospitals, doctors, reviews, guides, promotions, qaPosts)
  hooks/                 useRequireAuth, useIsWideWeb, useUserLocation 등 커스텀 훅
  store/                zustand 스토어 (인증, 병원 디렉터리, 전문의, 찜하기, 상담 신청, 커뮤니티)
  types/                도메인 타입 정의
  utils/                포맷터, 거리계산(geo), 전문분야 매핑(specialty) 등 유틸
```

## 반응형 네비게이션 (웹 상단 / 모바일 하단)

- `src/hooks/useIsWideWeb.ts`가 `Platform.OS === 'web' && width >= 768`일 때만 `true`를 반환합니다.
- 이 값이 `true`면 루트 레이아웃이 `TopNavBar`(로고 / 홈·이벤트·병원·커뮤니티 메뉴 / 검색·로그인·회원가입 또는 마이페이지 아이콘)를 렌더링하고, 동시에 하단 탭바는 `tabBarStyle: { display: 'none' }`로 숨깁니다.
- 좁은 화면(모바일, 또는 네이티브 iOS/Android)에서는 반대로 하단 탭바만 보입니다.
- 넓은 화면에서는 루트 레이아웃(`src/app/_layout.tsx`)이 전체 페이지 콘텐츠를 `maxWidth: 1200` + 가운데 정렬 컨테이너로 감싸, `TopNavBar`와 동일한 폭으로 여백을 맞춥니다 (모바일/좁은 화면에서는 이 제약이 사라지고 기존처럼 꽉 채웁니다).
- 브라우저 창 너비를 줄이거나 늘려서 레이아웃이 전환되는지 확인해보세요.

## 검색 화면 (`/search`)

- 바비톡의 돋보기 검색 화면을 참고해 만든 전체화면 검색 UI입니다. 홈 검색바와 상단 네비게이션의 검색 아이콘이 여기로 연결됩니다.
- 뒤로가기 + 브랜드 컬러 테두리의 검색창, 그 아래 스폰서/추천 검색어 칩(✦ 아이콘), "인기 검색어" 섹션(현재 시각 "HH:MM 기준" 표시), 전체/시술/병원/의사 언더라인 탭, 순위·검색어·전일 대비 추세(▲빨강/▼파랑/NEW/－)로 구성된 랭킹 리스트 순서입니다 (`src/data/trendingSearches.ts`).
- 순위 항목을 누르면 시술은 탐색 화면의 해당 카테고리로, 병원·의사는 병원 상세로 바로 이동합니다. 실제 사용자 검색 순위 집계 없이 목업 랭킹(전체 10 / 시술 10 / 병원 6 / 의사 8 — 실제 목업 엔티티 수에 맞춤)을 고정해뒀습니다.
- 검색창에 직접 입력 후 제출하면 시술명 → 병원명 → 원장님 이름 순으로 부분일치를 시도해 가장 먼저 매칭되는 곳으로 이동합니다. 매칭이 없으면 안내 문구만 보여주고 화면에 머뭅니다 (실 검색 엔진 연동 전 임시 로직).

## 병원 탐색 화면 (`/explore`)

- 상단 `[의사] / [병원]` 토글로 같은 카테고리·정렬·필터 조건에서 의사 프로필 카드 또는 병원 카드를 전환해 볼 수 있습니다 (바비톡의 의사/병원 탭 구조 참고).
- 카테고리 가로 탭: **추천** + 전체 + 12개 시술. "추천"은 `isRecommended` 플래그가 있는 병원/의사만 보여주는 에디터 추천 필터입니다.
- 정렬·필터 칩: 인기순/후기순/상담많은순/상담가능/원데이 — 의사 모드에서는 상담가능·원데이 필터가 해당 의사의 소속 병원 속성을 기준으로 동작합니다.
- 반응형 카드 그리드(웹 2열 · 모바일 1열), "가격 비교표 보기"로 기존 `PriceCompareTable`도 재사용 가능합니다.
- 홈 화면의 시술 카테고리, 검색바, 꿀팁 카드, 상단 네비게이션의 "병원" 메뉴가 모두 이 화면으로 연결됩니다 (`mode`, `category` 쿼리 파라미터로 초기 상태 지정).

## 지도 보기 (카카오맵)

- 병원 탐색 화면의 "병원" 모드에 **리스트 보기 / 지도 보기** 토글이 있습니다. 지도 보기는 카테고리·정렬·필터가 이미 적용된 병원 목록(`filteredHospitals`)을 그대로 받아, 그 위에 반경 필터(500m/1km/3km/5km 칩)를 추가로 적용합니다.
- `useUserLocation` 훅(`src/hooks/useUserLocation.ts`)이 `expo-location`으로 현재 위치 권한을 요청합니다. 거부되거나 실패하면 서울시청 좌표로 조용히 폴백합니다.
- 마커를 누르면 하단에 미니 카드(이름/대표시술/거리/후기수/상담신청 버튼)가 뜨고, 카드를 누르면 병원 상세로 이동합니다. 거리 계산은 `src/utils/geo.ts`의 `distanceKm`(하버사인 공식, km 단위)을 사용합니다.
- **플랫폼 분기**: `src/components/map/KakaoMap.web.tsx`는 카카오맵 JavaScript SDK를 웹 페이지에 직접 로드합니다. `KakaoMap.tsx`(확장자 없는 기본 파일 — Metro가 iOS/Android 번들링 시 이 파일을 사용)는 안정적인 RN 전용 카카오맵 라이브러리가 없어서, `react-native-webview`로 같은 JS SDK를 담은 HTML을 띄우는 방식으로 구현했습니다. 자세한 트레이드오프는 `src/components/map/README.md` 참고.
- **API 키**: `.env.example`을 `.env`로 복사한 뒤 `EXPO_PUBLIC_KAKAO_MAP_JS_KEY`(필수, 웹·네이티브 WebView 공용)와 `EXPO_PUBLIC_KAKAO_MAP_NATIVE_KEY`(향후 진짜 네이티브 SDK로 전환할 때를 대비한 자리, 현재는 미사용)를 채워주세요. 카카오 디벨로퍼스 콘솔의 JavaScript 키 허용 도메인에 로컬 개발 주소(`http://localhost:포트`)도 등록해야 웹에서 지도가 뜹니다. 키가 없으면 지도 대신 "카카오맵 API 키가 설정되지 않았어요" 안내만 보여주고 앱은 정상 동작합니다.
- 병원 데이터 모델에 `latitude`/`longitude`가 추가됐고, 목업 6곳은 강남·서초·성남·마포·인천·송파 등 서울 권역 곳곳에 흩어져 있습니다. 관리자 등록/수정 폼에서도 위도·경도를 직접 입력할 수 있습니다.

## 의사 프로필 & 추천 (`src/data/doctors.ts`, `src/store/useDoctorStore.ts`)

- `Doctor` 타입(`src/types/domain.ts`)은 병원과 별도 엔티티로, `hospitalId`로 소속 병원을 참조합니다. 이름/직함/전문분야/사진/자격증 URL/검수 상태/추천 여부/시술 태그/후기·상담 수를 가집니다.
- `useDoctorStore`가 반응형 소스입니다 (목업 시드 → AsyncStorage 영속). 관리자 등록/수정, 운영자 검수, 병원 상세·탐색 화면이 모두 이 스토어를 구독합니다.
- 의사 카드의 "상담신청"은 소속 병원의 상담 신청 화면으로 연결됩니다 (의사별 상담 데이터는 아직 분리하지 않았습니다).
- `Hospital.isRecommended`, `Doctor.isRecommended`로 "추천" 배지·필터를 지원합니다. 목업 데이터는 병원 6곳 중 3곳(`h1`, `h2`, `h6`), 의사 8명 중 3명을 추천으로 설정해뒀습니다.

## 전문의 자격증 검수 (`src/utils/specialty.ts`, `/admin/specialists`)

- 전문분야는 8종 고정 목록입니다: 치과보철전문의 / 치과교정전문의 / 구강악안면외과전문의 / 치주과전문의 / 소아치과전문의 / 통합치의학과전문의 / 구강악안면방사선과전문의 / 일반의. `DENTAL_SPECIALTIES` (`src/types/domain.ts`)에 정의되어 있습니다.
- `Doctor.verificationStatus`는 `'pending' | 'approved' | 'rejected'`입니다. **승인된 경우에만** 이름 옆에 전문분야와 "전문의" 배지가 노출됩니다. 대기/반려 상태는 이름만 보이고 전문분야는 숨겨집니다 (`getVisibleSpecialtyLabel`/`isVerifiedSpecialist`). "일반의"는 검수 대상이 아니라 항상 그대로 표시됩니다.
- 병원 관리자 등록/수정 폼(`HospitalForm`)에 "전문의" 섹션이 있어, 전문의를 추가(이름/직함/전문분야/자격증 이미지 URL)하거나 삭제할 수 있습니다. 새로 추가된 전문의는 항상 `pending`으로 시작합니다 — 검수 상태 자체는 이 폼에서 바꿀 수 없습니다.
- 운영자는 `/admin/specialists`(관리자 홈의 "전문의 인증 검수" 버튼)에서 업로드된 자격증 이미지를 보고 승인/반려할 수 있습니다. 반려 시 사유 입력이 필수이며, 상세·리스트 화면에 반려 사유가 그대로 노출됩니다.
- `src/utils/specialty.ts`의 `PROCEDURE_SPECIALTY_MAP`이 12개 시술 카테고리를 8개 전문분야에 매핑합니다 (예: 임플란트/라미네이트/인레이/크라운 → 치과보철전문의). 탐색 화면에서 시술 카테고리를 선택하면, 그 카테고리와 매핑된 승인된 전문의가 있는 병원의 "OO전문의 상주" 태그가 강조(브랜드 컬러) 처리됩니다. 카테고리를 선택하지 않았거나 매칭되지 않으면 같은 태그가 옅은 회색으로 표시됩니다.
- 병원 상세 화면에 사진/이름·직함/전문분야 카드형 "전문의 소개" 섹션을, 병원 카드에는 대표 전문의(첫 번째 승인된 전문의) 태그를 노출합니다.
- 목업 데이터(`src/data/doctors.ts`, 8명)는 승인(5) / 대기(2) / 반려(1) 상태와 7개 전문분야 + 일반의를 섞어뒀습니다.

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
- 관리자 페이지에 병원 담당자 전용 인증/권한 추가 (전문의 검수와 병원 프로필 수정 권한 분리 포함)
- 카카오맵 API 키 발급 및 도메인 등록, 네이티브 WebView 지도의 마커 diff 업데이트(현재는 전체 리로드)
- 실제 파일 업로드(자격증 이미지/PDF)로 교체 — 현재는 URL 텍스트 입력으로 대체
- `/search`의 인기 검색어 랭킹을 실제 사용자 검색 로그 기반 집계로 교체, 자유 검색을 부분일치가 아닌 실 검색 엔진(형태소 분석 등) 연동으로 고도화
- 마이페이지 확장 (상담 내역, 후기 작성)
- 앱 아이콘/스플래시 이미지를 브랜드 리소스로 교체 (`assets/images`)
