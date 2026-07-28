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
    _layout.tsx          루트 Stack
    (tabs)/              홈 / 카테고리 / 커뮤니티 / 마이페이지 탭
    hospitals/[procedureId].tsx   시술별 병원 리스트 (카드/가격비교 뷰)
    hospital/[id].tsx             병원 상세
    consult/[hospitalId].tsx      상담 신청 (모달, 로그인 필요)
    community/[id].tsx            질문 상세
    community/new.tsx             질문 작성 (모달)
    auth/login.tsx                로그인 (모달)
    auth/signup.tsx                회원가입 (모달)
  components/           SearchBar, HospitalCard, PromotionCard, PriceCompareTable 등
  data/                 목업 데이터 (procedures, hospitals, reviews, guides, promotions, qaPosts)
  hooks/                 useRequireAuth 등 커스텀 훅
  store/                zustand 스토어 (인증, 찜하기, 상담 신청, 커뮤니티)
  types/                도메인 타입 정의
  utils/                포맷터 등 유틸
```

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
- `src/data/*`는 실제 API 연동 전까지 사용하는 목업 데이터입니다. 백엔드가 준비되면 `getHospitalsByProcedure`, `getHospitalById` 같은 함수들을 API 호출로 교체하면 됩니다.
- 찜하기·상담 신청·커뮤니티 글·계정 정보는 모두 AsyncStorage에 로컬 저장되며, 서버 연동 전까지의 임시 저장소입니다.
- 병원 관리자용 대시보드는 별도 웹 프로젝트로 분리하는 것을 권장합니다 (이 저장소는 사용자용 앱 전용).
- 상담 신청은 단일 병원 신청폼 방식으로 유지했습니다 (강남언니식 여러 병원 동시 견적요청은 백엔드/데이터 구조가 커져 추후 별도 검토).

## 다음 단계 제안

- 실제 백엔드 인증 연동 (Supabase/Firebase 등으로 `useAuthStore` 교체, 비밀번호 해싱)
- 소셜 로그인 (구글/카카오) 실제 연동
- 마이페이지 확장 (상담 내역, 후기 작성)
- 검색 기능 구현 (현재 검색바는 카테고리 화면으로 연결)
- 앱 아이콘/스플래시 이미지를 브랜드 리소스로 교체 (`assets/images`)
