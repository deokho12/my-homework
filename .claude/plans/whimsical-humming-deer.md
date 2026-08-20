# 진행 상황 검토 — 몰라몰라 (2026-08-18)

## Context

"어디까지 작업했었는지" 를 확인하기 위해 저장소 전체(계약 `docs/api/openapi.yaml`,
`backend/src`, `frontend/src`, 기능 문서)를 코드로 대조했다. 마지막 커밋은
2026-08-15 의 PR #1 머지(`4d74e8d`)이고 작업 트리는 깨끗하다. 브랜치는 `main` 하나뿐.

결론: **조각 1(`hospital-doctor-domain-api`, Task 1~21)까지 끝났고, 조각 2~4 는 손대지
않았다.** 계약 57 오퍼레이션 중 20개가 구현돼 있다.

---

## 1. 지금까지 끝난 것

### 백엔드 — 20/57 오퍼레이션

| 영역 | 오퍼레이션 | 상태 |
|---|---|---|
| auth | signUp · logIn · refreshTokens · logOut · getMe | ✅ 5 |
| procedures | listProcedures | ✅ 1 |
| hospitals | listHospitals · getHospital · createHospital · updateHospital · listHospitalReviews · listManagedHospitals | ✅ 6 |
| doctors | listDoctors · getDoctor · updateDoctor · deleteDoctor · listHospitalDoctors · replaceHospitalDoctors · listVerificationQueue · decideDoctorVerification | ✅ 8 |
| — | `GET /health` (접두어 밖) | ✅ |

기반 설비도 함께 들어와 있다: 가드 3층(`AuthGuard`/`RolesGuard`/`HospitalScopeGuard`),
리프레시 토큰 회전·재사용 감지·정리 배치, append-only 감사 로그, 운영자 승격 CLI,
Zod 환경변수 검증, dev 단계 추적 로그(`common/logging/dev-trace.ts`).
Prisma 모델은 31개 전부 정의돼 있어 **남은 도메인은 스키마 작업 없이 시작할 수 있다.**

테스트: `backend/test` 27파일 / 약 298 케이스. 프론트 테스트 파일 50개.

### 프론트엔드

- 병원·전문의·시술·후기 화면이 전부 실제 서버(`features/*/api` + TanStack Query)로 이동.
  `mockDb` 에서 `hospitals`/`doctors` 테이블이 빠졌다(Task 20).
- `/admin` 계열 7개 라우트 전부 `RequireAuth` 로 가드됨(`App.tsx` 의 `ROUTES` 테이블,
  `guard: 'admin' | 'operator'`). 평문 비밀번호 저장 문제도 해소.
- Expo/RN 제거 후 웹 전용 스택(Vite + React 19 + RR7 + Tailwind + Zustand) 정착.

---

## 2. 아직 안 한 것 — 37/57 오퍼레이션

| 조각 | 태그 | 미구현 오퍼레이션 |
|---|---|---|
| 2 | favorites (3) · notifications (4) | listMyFavorites, addFavorite, removeFavorite / listNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead |
| 2~3 | consult-requests (8) | createConsultRequest, listMyConsultRequests, getMyConsultRequest / listConsultRequests, getConsultSummary, getConsultRequest, updateConsultStatus, addConsultMemo |
| 4 | community (5) · content (4) · search (4) | listCommunityPosts, createCommunityPost, getCommunityPost, recordPostView, createCommunityAnswer / listGuides, getGuide, listPromotions, getLegalDocument / search, resolveSearch, getTrendingSearches, getSearchSuggestions |
| 미배정 | operator (3) · support (4) · auth (1) · geo (1) | listHospitalAdmins, assignHospitalAdmin, unassignHospitalAdmin / partner-inquiries 4개 / logInWithSocialProvider / searchAddress |

프론트에서 `mockDb`(브라우저 localStorage)가 아직 원본인 데이터는 3개 테이블이다 —
`consultRequests` · `communityPosts` · `notifications` (`useConsultStore`,
`useCommunityStore`, `useNotificationStore` 경유). `guides`/`promotions`/
`trendingSearches` fixture 는 화면이 직접 import 한다(`screens/events.tsx`,
`screens/tips/[id].tsx`, `screens/search.tsx`, `screens/tabs/index.tsx`).

### 조각 1 이 의도적으로 남긴 계약 격차 (backend/README "미룬 것들")

1. 관리자용 병원 로스터 GET 부재 → 미승인 전공 전문의가 있는 병원은 새 전문의 추가 저장이 막힘
2. 공개 `Doctor` 응답에 `hospitalName` 없음 → 카드마다 `useHospital()` N+1
3. 시술→전공 매핑이 프론트(`utils/specialty.ts`)·백엔드(`doctor/specialty-procedures.ts`) 양쪽에 중복
4. `POST /hospitals` 가 쓰기 금지 필드를 422 없이 조용히 버림 (PATCH 는 거절)
5. 계약이 "서버 기본값" 이라 적은 `thumbnail`·`photo` 두 곳이 구현에 없음

### 지금 남아 있는 🔴 결함

**다른 사람의 알림이 보인다** — `useNotificationStore` 에 `clear()` 가 없어
`clearAccountScopedState()` 가 알림을 비우지 않는다. 계정을 바꿔도 이전 계정 알림이 남는다.
찜 목록 쪽 같은 문제는 이미 닫혔다. 이건 조각 2 에서 함께 닫히는 항목이다.

---

## 3. 이번 검토에서 새로 발견한 문서 불일치 (코드로 확인)

- **`docs/features/README.md` 가 조각 1 이전 상태로 멈춰 있다.**
  - 10행 `이 앱은 아직 서버가 없습니다` — 병원·전문의·시술·후기는 실제 서버를 쓴다
  - 12행 `병원·의사·후기·이벤트는 전부 샘플 데이터` — 앞 셋은 DB 데이터다
  - 57행 `지금 관리자 화면에는 로그인 검사가 전혀 없습니다 ... 이 주소들을 외부에 공유하지 마세요`
    — **이미 해결된 사항**이다(`App.tsx` 라우트 7개 전부 `RequireAuth`).
    `known-issues.md` 는 2026-08-14 에 갱신하며 이 항목을 지웠는데 README 만 남았다.
    비개발자가 읽는 첫 문서라 오해 비용이 크다.
- **`backend/README.md` 가 참조하는 `.superpowers/sdd/...` 경로가 저장소에 없다.**
  "미룬 것들"·"다음 조각" 절이 `task-21-contract-followups.md`,`task-21-brief.md` 를
  근거로 가리키는데 두 파일 모두 실재하지 않는다(`.superpowers` 디렉터리 자체가 없음).
  `docs/superpowers/plans/` 에 계획 문서 2개, `docs/superpowers/specs/` 에 설계 1개만 남아 있다.
- **`backend/README.md` 의 모델 수 표기**: `27개 모델` 이라 적혀 있으나 실제 `schema.prisma`
  는 31개다.

---

## 4. 권장 다음 단계

우선순위 순. 1번은 문서만 고치는 작은 작업이고, 2번이 실제 다음 조각이다.

### (A) 문서 정합성 복구 — 작은 작업, 먼저 하기를 권함

- `docs/features/README.md`: 서두 3줄과 57행 관리자 경고를 현재 상태로 갱신.
  `known-issues.md` 의 2026-08-14 갱신 블록과 같은 톤으로 "무엇이 서버로 갔고 무엇이
  아직 브라우저 저장인지" 를 표로 구분.
- `backend/README.md`: 깨진 `.superpowers/sdd/...` 참조를 실재하는
  `docs/superpowers/plans/2026-08-13-hospital-doctor-domain-api.md` 로 바꾸거나,
  근거 본문을 `docs/features/known-issues.md` 안으로 옮긴다. 모델 수 27 → 31 정정.

### (B) 조각 2 — 찜 · 상담접수 · 알림

DB 모델(`Favorite`, `ConsultRequest`, `ConsultStatusChange`, `ConsultMemo`,
`Notification`, `NotificationRecipient`)이 이미 있어 마이그레이션 없이 시작 가능하다.

백엔드 (`AGENTS.md` 의 "컨트롤러는 배선, 서비스는 조합, 규칙은 순수 함수" 를 그대로 따른다):

1. `favorite/` 모듈 — `listMyFavorites` · `addFavorite` · `removeFavorite`.
   `AuthGuard` 만 붙인다(`@Roles('user')` 아님 — 역할이 누적형이라 담당자·운영자도 쓴다).
2. `notification/` 모듈 — 목록·안 읽은 수·읽음·모두 읽음 4개.
   **검수(`doctor/verification.service.ts`)가 이미 만들고 있는 알림 행을 읽는 쪽**이라,
   기존 쓰기 경로와 필드 이름이 어긋나지 않는지가 첫 검증 포인트.
   투영은 `*.projection.ts` 패턴(`hospital.projection.ts` 참고)으로 분리.
3. `consult/` 모듈의 사용자 측 3개 — `createConsultRequest`(전문의 지정 포함),
   `listMyConsultRequests`, `getMyConsultRequest`.
   상담은 비공개 자원이라 범위 밖/부재 모두 `404 CONSULT_REQUEST_NOT_FOUND` 로
   **구분되지 않아야** 한다(`test/authorization.e2e.spec.ts` 가 고정한 규칙).
   상담 상세 열람은 `AuditLogService.recordFromRequest()` 배선 지점이다(결정 3).
4. 페이지네이션은 `common/pagination.ts` 재사용, 스코프는 기존
   `@HospitalScope({ resource: 'consultRequest' })` 를 그대로 쓴다.

프론트:

5. `features/favorite` · `features/notification` · `features/consult` 을
   `features/hospital` 과 같은 구조(`api/` + `hooks/` + TanStack Query)로 추가.
6. `useConsultStore` · `useNotificationStore` 제거, `mockDb` 에서 해당 테이블 삭제.
   `useFavoritesStore` 는 서버 상태로 대체 — 단, `useAuthStore.clearAccountScopedState()`
   가 캐시를 비우는 경로는 유지해야 한다(찜에서 이미 겪은 회귀 패턴).
7. **🔴 알림 계정 분리**가 이 조각으로 닫힌다 — 서버가 `NotificationRecipient` 로
   수신자를 가르므로. `admin/notifications.tsx:14` 의 "종류 구분 없이 상담 상세로 이동"
   도 이때 함께 고친다.
8. 해소되는 known-issues 항목: 🔴 알림 누수, 🟠 "상담 신청 내역을 볼 화면이 없습니다",
   🟠 "전문의 지정이 저장되지 않습니다", 🟠 "상담 마감인 병원도 접수됩니다"(서버 검증),
   🟡 "같은 상태를 다시 눌러도 처리됩니다"(멱등 처리), 🟡 "검수 결과 통보" 절반 해결분.

### 검증 방법

```bash
cd backend && npm run typecheck && npm run lint && npm run test:run   # 289+ → 신규 포함
cd frontend && npm run typecheck && npm run build && npx vitest run
```

- 백엔드 e2e 는 `.env` 의 SQLite 를 쓰므로 `npm run prisma:migrate && npm run prisma:seed` 선행.
- 수동 확인: `NODE_ENV=development npm run dev` 로 띄우고 단계 추적 로그로 어느 가드에서
  막혔는지 확인(`X-Request-Id` 앞 6자 기준).
- 계정 분리 확인은 `seed-3@molarmolar.example`(안 읽은 알림 1건)과 다른 시드 계정을
  번갈아 로그인해 알림함이 실제로 갈리는지 본다.
- CLAUDE.md 규칙대로 구현 후 code-reviewer → **qa-master 통과 전까지 완료로 보지 않는다.**
  QA 필수 항목: 로그인/로그아웃, 상담신청, 찜하기, 필터/검색, 폼 제출.
