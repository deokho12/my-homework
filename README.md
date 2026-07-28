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
    (tabs)/              홈 / 카테고리 / 찜 탭
    hospitals/[procedureId].tsx   시술별 병원 리스트
    hospital/[id].tsx             병원 상세
    consult/[hospitalId].tsx      상담 신청 (모달)
  components/           SearchBar, HospitalCard 등 공용 컴포넌트
  data/                 목업 데이터 (procedures, hospitals, reviews, guides)
  store/                zustand 스토어 (찜하기, 상담 신청)
  types/                도메인 타입 정의
  utils/                포맷터 등 유틸
```

## 현재 구현된 MVP 플로우

홈 → 시술 카테고리 → 병원 리스트 → 병원 상세 → 상담 신청 → 찜하기

- `src/data/*`는 실제 API 연동 전까지 사용하는 목업 데이터입니다. 백엔드가 준비되면 `getHospitalsByProcedure`, `getHospitalById` 같은 함수들을 API 호출로 교체하면 됩니다.
- 찜하기·상담 신청 내역은 AsyncStorage에 로컬 저장되며, 서버 연동 전까지의 임시 저장소입니다.
- 병원 관리자용 대시보드는 별도 웹 프로젝트로 분리하는 것을 권장합니다 (이 저장소는 사용자용 앱 전용).

## 다음 단계 제안

- 실제 백엔드 API 연동 (인증 포함)
- 마이페이지 확장 (상담 내역, 후기 작성)
- 검색 기능 구현 (현재 검색바는 카테고리 화면으로 연결)
- 앱 아이콘/스플래시 이미지를 브랜드 리소스로 교체 (`assets/images`)
