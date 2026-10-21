# 몰라몰라 REST API — 설계 판단

이 문서는 **왜 이렇게 나눴는지**를 적는다. 계약(엔드포인트·스키마·에러)은 [`openapi.yaml`](openapi.yaml) 에 있다.

근거는 전부 `docs/features/` 의 27개 화면 문서와 `frontend/src/` 의 현재 코드다.
화면 문서에 근거가 없는 것은 "제안" 으로 분리해 적었다.

> 작성 시점: 2026-08-12
> **개정: 2026-08-12 — `docs/decisions/0001-roles-and-pii.md` 확정 반영.** 역할 3개(`user`/`hospital_admin`/`operator`),
> 운영자 주도 입점 흐름, 상담 PII 마스킹, 감사 로그. 초안의 미결 사항 1·2·3·12 가 해소됐다.
> DB 스키마(`docs/database/`)는 병렬로 설계됐다. 이 API 는 **저장 구조가 아니라 화면이 필요한 형태**를 기준으로 응답을 정했다.
> **개정: 2026-10-21 — 혼자 개발 체제 (요청서 12).** 협업자가 프로젝트를 떠나 **서버도 이 저장소에서 직접 만든다.**
> 그래서 이 문서의 "협업자 확인 대기 / 협업자 영역 / 협업자 인계" 표현을 지금 상태로 바꿨다 —
> §20·§21 의 제안은 **"요청자 답 반영 대기 → 요청서 18·19"** 이고(답은 그 요청서에 표로 있다),
> 요구사항만 넘기던 자리는 **그 일을 맡은 요청서 번호**(상담 예약 → 15, 문의 → 16)를 가리킨다.
> **계약의 동작·필드·enum·required 는 이 개정에서 한 줄도 바뀌지 않았다 — 표현과 표시만 고쳤다.**

---

## 목차

1. [리소스 목록과 지원 화면](#1-리소스-목록과-지원-화면)
2. [화면 ↔ 엔드포인트 대응표](#2-화면--엔드포인트-대응표)
3. [인증·인가](#3-인증인가)
4. [개인정보 마스킹과 감사 로그](#4-개인정보-마스킹과-감사-로그)
5. [페이지네이션·필터·정렬 규약](#5-페이지네이션필터정렬-규약)
6. [서버 필터 vs 클라이언트 필터](#6-서버-필터-vs-클라이언트-필터)
7. [검색 설계 판단](#7-검색-설계-판단)
8. [스폰서·광고 노출](#8-스폰서광고-노출)
9. [알림과 부수효과의 책임](#9-알림과-부수효과의-책임)
10. [카카오 관련 판단](#10-카카오-관련-판단)
11. [에러 응답 형식과 코드 체계](#11-에러-응답-형식과-코드-체계)
12. [프론트엔드 api 함수 → 엔드포인트 매핑](#12-프론트엔드-api-함수--엔드포인트-매핑)
13. [깨진 것 7개의 해결 경로](#13-깨진-것-7개의-해결-경로)
14. [테이블이 없는 엔드포인트 4개](#14-테이블이-없는-엔드포인트-4개)
15. [버전 관리 방침](#15-버전-관리-방침)
16. [캐싱·요청 한도](#16-캐싱요청-한도)
17. [미결 사항 — 제품 결정이 필요한 것](#17-미결-사항--제품-결정이-필요한-것)
18. [문서·타입 사이의 모순](#18-문서타입-사이의-모순)
19. [제안 — 화면 문서에 근거가 없는 것](#19-제안--화면-문서에-근거가-없는-것)
20. [🚧 병원 관리자 직접 가입 — **제안 — 요청자 답 반영 대기 → 요청서 18 (2026-10-13 제안)**](#20--병원-관리자-직접-가입--제안--요청자-답-반영-대기--요청서-18-2026-10-13-제안)
21. [🚧 병원 정보 확장 — 시술별 가격 · 사진 · 특징 — **제안 — 요청자 답 반영 대기 → 요청서 19 (2026-10-13 제안)**](#21--병원-정보-확장--시술별-가격--사진--특징--제안--요청자-답-반영-대기--요청서-19-2026-10-13-제안)

---

## 1. 리소스 목록과 지원 화면

리소스는 저장 테이블이 아니라 **도메인 개념** 단위로 잘랐다. `frontend/src/mocks/db.ts` 의 테이블은
`hospitals` / `doctors` / `consultRequests` / `communityPosts` / `notifications` 5개뿐이고 후기·이벤트·꿀팁·시술은
코드 안 고정 데이터인데, 화면은 그 넷을 독립적으로 읽는다. 그래서 리소스는 13개다
(2026-10-12 `hospital-inquiries` 가 더해져 14개).

| 리소스 | 경로 | 지원 화면 | 쓰기 주체 |
|---|---|---|---|
| **auth / session** | `/auth/*` | 로그인, 회원가입, 마이페이지 | 누구나 (가입·로그인) |
| **procedures** (시술 13종) | `/procedures` | 홈, 병원 탐색, 커뮤니티 작성, 상담 신청, 꿀팁 상세 | 없음 (읽기 전용 마스터) |
| **hospitals** | `/hospitals`, `/admin/hospitals` | 홈, 병원 탐색, 검색, 병원 상세, 마이페이지 찜, 꿀팁 상세, 관리자 홈/등록/수정 | **생성=`operator`**, 수정=담당 `hospital_admin` (+`operator`) |
| **hospital-admins** (담당자 배정) | `/hospitals/{id}/admins` | (운영자 콘솔 — 화면 미존재 🚧) | `operator` |
| **doctors** | `/doctors`, `/hospitals/{id}/doctors` | 병원 탐색(의사 모드), 병원 상세, 전문의 상세, 관리자 병원 수정 | 담당 `hospital_admin` (+`operator`) |
| **doctor-verification** (인증 검수) | `/doctors/verification-queue`, `/doctors/{id}/verification` | 전문의 인증 검수 | **`operator` 전용** |
| **reviews** | `/hospitals/{id}/reviews` | 병원 상세 | 없음 (작성 화면이 없다) |
| **consult-requests** | `/consult-requests`, `/me/consult-requests` | 상담 신청, 관리자 상담 관리/상세, 관리자 홈 숫자, (신설) 내 상담 내역 | `user`(접수) / 담당 `hospital_admin`(처리). `operator` 는 **조회만 + PII 마스킹** |
| **admin-dashboard** (병원 관리자 대시보드, 2026-10-13) | `/admin/dashboard` | 관리자 대시보드(`/admin`), 사이드 메뉴 배지 | 없음 — **읽기 전용 집계**. `hospital_admin` 전용, 선택 병원 1곳 (§3·§14) |
| **hospital-inquiries** (병원 문의, 2026-10-12) | `/hospital-inquiries`, `/me/inquiries`, `/hospitals/{id}/inquiries` | 문의하기, 병원 상세 `문의`, 마이페이지 `내 문의`, 관리자 문의, 관리자 홈 숫자 | `user`(접수) / 담당 `hospital_admin`(답변). `operator` 는 **조회만** (§14) |
| **favorites** | `/me/favorites` | 마이페이지, 병원 상세, 꿀팁 상세 | `user` |
| **notifications** | `/notifications` | 사용자 알림함, 관리자 알림함, 마이페이지 배지, 관리자 홈 배지 | **없음 — 부수효과로만 생성** |
| **community** (질문·답변) | `/community/posts` | 커뮤니티 목록, 글 상세, 글 작성 | `user` (답변은 신설) |
| **content** (꿀팁·이벤트·약관) | `/guides`, `/promotions`, `/legal-documents` | 홈, 꿀팁 상세, 이벤트, 병원 상세, 약관 3종, 소개 | 없음 (편집팀 백오피스 미정) |
| **search** | `/search*` | 검색, 홈 인기 검색어 | 없음 |
| **geo** | `/geo/address-search` | 관리자 병원 등록/수정 | 없음 (조회 전용, `hospital_admin`/`operator`) |
| **support** (입점 문의) | `/partner-inquiries` | 병원 입점 문의 | 접수=누구나, 심사=**`operator`** |

**초안에서 갈라낸 두 리소스** — `hospital-admins` 와 `doctor-verification` 은 원래 `hospitals` / `doctors` 안에
있었다. 역할 결정 이후 **소유자가 달라져서** 분리했다. 전문의 등록은 병원이 하고 판정은 운영자가 하며,
담당자 배정은 오직 운영자가 한다. 리소스 경계를 인가 경계와 맞추면 "이 경로는 누가 부르나" 가 경로만 봐도 드러난다.

### 리소스를 나눌 때 쓴 기준

프론트엔드 캐시 단위(`frontend/src/lib/queryKeys.ts`)와 **엔드포인트 경계를 일치시켰다.** 그게 안 맞으면
mutation 이 어느 캐시를 깨야 하는지가 흐려진다.

| 쿼리 키 | 대응 엔드포인트 | 무효화 주체 |
|---|---|---|
| `hospitals.all` | `GET /hospitals` | `POST /hospitals`, `PATCH /hospitals/{id}` |
| `hospitals.detail(id)` | `GET /hospitals/{id}` | `PATCH /hospitals/{id}` |
| `doctors.all` | `GET /doctors` | `PATCH /doctors/{id}`, `PUT /doctors/{id}/verification` |
| `doctors.detail(id)` | `GET /doctors/{id}` | 같음 |
| `doctors.byHospital(hospitalId)` | `GET /hospitals/{id}/doctors` | `PUT /hospitals/{id}/doctors` |
| `consultRequests.all` | `GET /consult-requests` | `POST /consult-requests`, 상태 변경, 메모 추가 |
| `consultRequests.detail(id)` | `GET /consult-requests/{id}` | 상태 변경, 메모 추가 |
| `communityPosts.all` | `GET /community/posts` | `POST /community/posts` |
| `communityPosts.detail(id)` | `GET /community/posts/{id}` | 답변 작성, 조회수 집계 |
| `notifications.byAudience(a)` | `GET /notifications?audience=a` | 읽음 처리, 모두 읽음, (서버 부수효과) |

**병원 상세에 의료진·후기를 임베드하지 않은 이유가 이 표다.** 임베드하면 전문의 검수 결과가 바뀔 때
`hospitals.detail` 캐시까지 깨야 하고, `doctors.byHospital` 키가 무의미해진다.

새로 추가해야 하는 쿼리 키 (지금 `queryKeys.ts` 에 없는 것):

```
me: {
  session:          ['me']
  favorites:        ['me', 'favorites']
  consultRequests:  ['me', 'consultRequests']
  consultRequest:   (id) => ['me', 'consultRequests', id]
}
notifications.unreadCount: (audience) => ['notifications', audience, 'unreadCount']
consultRequests.summary:   ['consultRequests', 'summary']
doctors.verificationQueue: ['doctors', 'verificationQueue']
reviews.byHospital:        (hospitalId) => ['reviews', 'byHospital', hospitalId]
guides.all / guides.detail(id)
promotions.all
procedures.all
search.trending(tab) / search.suggestions
legalDocuments.detail(slug)

// 역할 결정으로 추가된 것
hospitals.managed:         ['hospitals', 'managed']          // GET /admin/hospitals
hospitals.admins:          (hospitalId) => ['hospitals', hospitalId, 'admins']
partnerInquiries.all:      ['partnerInquiries']
partnerInquiries.detail:   (id) => ['partnerInquiries', id]
```

**`hospitals.managed` 를 `hospitals.all` 과 별도 키로 두는 것이 중요하다.** 같은 키를 쓰면 관리자 홈의
담당 병원 목록(11곳 중 1곳)이 공개 목록 캐시를 덮어써서, 병원 탐색 화면이 갑자기 1곳만 보여준다.
경로를 분리한 이유(§3)가 캐시 층에서도 그대로 적용된다.

**로그아웃·역할 변경 시 비워야 하는 캐시:** `['me']`, `['notifications']`, `['consultRequests']`,
`['hospitals', 'managed']`, `['hospitals', '*', 'admins']`, `['partnerInquiries']`, `['doctors', 'verificationQueue']`.
계정별·역할별 데이터가 잔상으로 남으면 그것 자체가 유출이다 (지금 찜 목록에서 실제로 벌어지는 일이다).

---

## 2. 화면 ↔ 엔드포인트 대응표

`상태` 는 화면 문서의 표시를 그대로 옮긴 것이다 (✅ 동작 · 🟡 화면은 되지만 샘플 데이터 · 🚧 껍데기 · 🔒 로그인 필요).

### 사용자 화면

| 화면 | 문서 | 엔드포인트 | 상태 |
|---|---|---|---|
| 홈 | `home.md` | `GET /procedures`<br>`GET /promotions`<br>`GET /guides`<br>`GET /search/trending?tab=all&limit=6` | ✅ 🟡 |
| | | 배너 3장 — **엔드포인트 없음.** 클라이언트 고정 콘텐츠이고 링크도 없다(🚧). §19 참고 | 🚧 |
| | | 앱 다운로드 QR / 회사 정보 — **엔드포인트 없음.** 정적 설정값 | 🚧 |
| 병원 탐색 | `explore.md` | `GET /hospitals` (병원 모드, 필터·정렬 전체)<br>`GET /doctors` (의사 모드)<br>`GET /procedures` (시술 칩)<br>`GET /promotions` (가격 비교표의 할인가) | ✅ 🟡 |
| | | 지도 자체는 카카오맵 JS SDK (클라이언트). 반경 필터는 `GET /hospitals?latitude&longitude&radiusKm` | 🚧 🟡 |
| 검색 | `search.md` | `GET /search/resolve?q=` (현재 동작 유지)<br>`GET /search/trending?tab=`<br>`GET /search/suggestions`<br>`GET /search` (결과 목록 화면이 생기면) | ✅ 🟡 |
| 커뮤니티 | `community.md` | `GET /community/posts` | 🟡 |
| 마이페이지 | `mypage.md` | `GET /auth/me`<br>`POST /auth/logout`<br>`GET /notifications/unread-count?audience=user`<br>`GET /me/favorites?expand=hospital`<br>`DELETE /me/favorites/{hospitalId}`<br>`GET /me/consult-requests` (신설)<br>`GET /me/inquiries` (신설, 🚧 서버 미구현) | ✅ 🔒 🚧 |
| 병원 상세 | `hospital-detail.md` | `GET /hospitals/{id}`<br>`GET /hospitals/{id}/doctors`<br>`GET /hospitals/{id}/reviews`<br>`GET /hospitals/{id}/inquiries` (공개 Q/A, 🚧 서버 미구현)<br>`GET /promotions?hospitalId=`<br>`PUT`/`DELETE /me/favorites/{id}` | ✅ 🟡 🔒 |
| 전문의 상세 | `doctor-detail.md` | `GET /doctors/{id}`<br>`GET /hospitals/{hospitalId}` (소속 병원 카드) | ✅ 🟡 🔒 |
| 상담 신청 | `consult-request.md` | `GET /hospitals/{id}` (병원명·시술 목록)<br>`POST /consult-requests` | ✅ 🔒 |
| 병원 상세 — `시술·가격` 섹션 (2026-10-13) | 요청 07 | 🚧 **제안 — 요청자 답 반영 대기 → 요청서 19**: `GET /hospitals/{id}` 하나로 끝난다 — 응답에 `procedures[]`(시술별 가격)와 기존 `priceRange`(폴백)가 **둘 다** 실리고 **화면이 규칙 하나로 고른다**(§21). 대분류 묶음·`원데이` 표시는 클라이언트 몫 | 🚧 |
| 문의하기 (2026-10-12) | `inquiry.md` | `GET /hospitals/{id}` (병원명·주소)<br>`POST /hospital-inquiries` (🚧 서버 미구현) | ✅ 🔒 🚧 |
| 커뮤니티 글 상세 | `community-post.md` | `GET /community/posts/{id}`<br>`POST /community/posts/{id}/views`<br>`POST /community/posts/{id}/answers` (신설) | ✅ 🟡 🚧 |
| 커뮤니티 글 작성 | `community-new.md` | `GET /procedures`<br>`POST /community/posts` | ✅ |
| 시술 꿀팁 상세 | `tip-detail.md` | `GET /guides/{id}`<br>`GET /hospitals/{id}` (관련 병원 카드)<br>`PUT`/`DELETE /me/favorites/{id}` | ✅ 🟡 🔒 |
| 이벤트 | `events.md` | `GET /promotions`<br>`GET /hospitals/{id}` (카드의 병원명·사진) | 🟡 |
| 알림 | `notifications.md` | `GET /notifications?audience=user` (항목에 **`consultStatus`** — 종류 아이콘 다섯의 유일한 근거, 2026-10-13)<br>`PATCH /notifications/{id}/read`<br>`POST /notifications/read-all` | ✅ 🟡 |
| | | 상담 알림을 누르면 **마이페이지 상담 내역**으로 간다 (`relatedResource=consultRequest` + `relatedId` = **상담 id**). 병원 id 를 먼저 조회하던 경로가 사라진다 — **엔드포인트 추가 없음** | ✅ |
| 로그인 | `login.md` | `POST /auth/login`<br>`POST /auth/social/{provider}` (🚧) | ✅ 🚧 |
| 회원가입 | `signup.md` | `POST /auth/signup` | ✅ |
| 회원가입 — `치과 관계자이신가요?` 토글 | 요청 06 | 🚧 **제안 — 요청자 답 반영 대기 → 요청서 18 (2026-10-13 제안)**: `POST /uploads` (사업자등록증, **비인증**)<br>`POST /auth/signup/hospital-admin`<br>`GET /geo/address-search` (주소·좌표, 기존)<br>`GET /legal-documents/partner-terms` (약관 전문) | 🚧 |

### 병원 관리자 화면

**역할에 따라 화면 접근 자체가 갈린다** (`docs/decisions/0001-roles-and-pii.md` 결정 1).
현재 인가가 전혀 없는 것이 확인된 보안 결함이다.

| 화면 | 문서 | 접근 역할 | 엔드포인트 | 상태 |
|---|---|---|---|---|
| 관리자 홈 | `admin-home.md` | `hospital_admin`(담당만)<br>`operator`(전체) | `GET /admin/dashboard?hospitalId=` (`hospital_admin` 시야 — 아래 행)<br>`GET /hospital-inquiries/summary` (`문의 N` — `operator` 에게는 숫자를 붙이지 않는다, §14)<br>`GET /admin/hospitals` (`scope` 로 범위 구분)<br>`GET /notifications/unread-count?audience=admin`<br>**운영자 시야(`OperatorHome`)는 병원 목록·검수 대기만 그린다 — 상담 숫자를 읽지 않는다** (§14) | ✅ 🟡 |
| | | | 병원 삭제 — **엔드포인트 없음** (🚧). §19 참고 | 🚧 |
| 관리자 대시보드 (2026-10-13) | 요청 05 | **`hospital_admin` 전용**, **선택한 병원 1곳** (`operator` 는 `403` — §3) | `GET /admin/dashboard?hospitalId=` (숫자 카드·보조 숫자, 목록 4개 — 지연 상담·반려 전문의·최근 상담·오늘 내원 —, 깔때기, 완성도를 **한 응답**으로 — §14, 정확한 필드는 계약 `AdminDashboard`)<br>`GET /notifications/unread-count?audience=admin` (상단 🔔)<br>카드 링크는 `GET /consult-requests` · `GET /hospital-inquiries` 의 필터로 **정확히 재현된다** | 🚧 |
| 병원 등록 | `admin-hospital-new.md` | **`operator` 전용** | `POST /hospitals` (전문의·담당자 동시 지정)<br>`GET /geo/address-search`<br>`GET /procedures` | ✅ 🟡 |
| 병원 정보 수정 | `admin-hospital-edit.md` | `hospital_admin`(담당만)<br>`operator`(전체) | `GET /hospitals/{id}`<br>`PATCH /hospitals/{id}`<br>`GET /hospitals/{id}/doctors`<br>`PUT /hospitals/{id}/doctors`<br>`GET /geo/address-search` | ✅ 🟡 |
| 병원 정보 수정 — 시술별 가격·사진·특징 (2026-10-13) | 요청 07 | 위와 같음 | 🚧 **제안 — 요청자 답 반영 대기 → 요청서 19**: `PATCH /hospitals/{id}` (`procedures[]` **머지** · `images[]` 교체 · `tagline` · 특징 2개)<br>`POST /uploads` (`purpose=hospital_photo`, **인증 필수** — 응답에 공개 URL)<br>`GET /admin/dashboard` 의 완성도 항목 **7 → 9** — **§21** | 🚧 |
| | | | 광고 신청·기간 변경 — **엔드포인트 없음.** 화면이 읽기 전용이고 "담당팀에 문의" 라고 안내한다 (🚧) | 🚧 |
| 전문의 인증 검수 | `admin-specialists.md` | **`operator` 전용** | `GET /doctors/verification-queue`<br>`PUT /doctors/{id}/verification` | ✅ 🟡 |
| 상담 관리 | `admin-consultations.md` | `hospital_admin`(담당만, 전체 PII)<br>`operator`(전체, 마스킹) | `GET /consult-requests`<br>`PATCH /consult-requests/{id}/status` (**`hospital_admin` 만**) | ✅ 🟡 |
| 상담 상세 | `admin-consultation-detail.md` | 위와 같음 | `GET /consult-requests/{id}` (**열람 로그 남음**)<br>`PATCH /consult-requests/{id}/status` (`hospital_admin` 만)<br>`POST /consult-requests/{id}/memos` (`hospital_admin` 만) | ✅ |
| 관리자 문의 (2026-10-12) | `admin-inquiries.md` | `hospital_admin`(담당만, 답변 가능)<br>`operator`(전체, **답변 불가**) — 문의자 이름은 **둘 다 마스킹**(§4) | `GET /hospital-inquiries` (`status`, `hospitalId`)<br>`GET /hospital-inquiries/summary`<br>`GET /hospital-inquiries/{id}`<br>`POST /hospital-inquiries/{id}/answer` (**`hospital_admin` 만**) — 🚧 서버 미구현 | ✅ 🚧 |
| 관리자 알림 | `admin-notifications.md` | `hospital_admin`, `operator` | `GET /notifications?audience=admin`<br>`PATCH /notifications/{id}/read`<br>`POST /notifications/read-all` | ✅ 🟡 |

`operator` 의 관리자 알림함은 **정상적으로 비어 있다** — 새 상담 알림과 검수 결과 알림 둘 다 담당자에게만 간다.

### 운영자 전용 화면 (아직 없음 🚧)

역할 결정으로 **화면이 없는 엔드포인트 4개**가 생겼다. 운영자 콘솔이 필요하다.

| 필요한 화면 | 엔드포인트 | 무엇을 하나 |
|---|---|---|
| 입점 문의 목록·상세 | `GET /partner-inquiries`<br>`GET /partner-inquiries/{id}`<br>`PATCH /partner-inquiries/{id}` | 문의 심사, 결과·사유 기록 |
| 병원 담당자 관리 | `GET /hospitals/{id}/admins`<br>`POST /hospitals/{id}/admins`<br>`DELETE /hospitals/{id}/admins/{userId}` | 담당자 지정·해제 |
| 🚧 **제안 (2026-10-13)** 병원 승인 검수 | `GET /admin/hospitals?approvalStatus=pending`<br>`GET /uploads/{id}/content`<br>`PATCH /hospitals/{id}/approval` | 가입한 병원의 사업자등록증 확인 → 승인·반려. **§20 — 요청자 답 반영 대기 → 요청서 18** |

`docs/features/` 에 이 화면 문서가 없다. 화면 문서에 근거가 없는 엔드포인트를 만들지 않는 원칙의 예외이며,
**결정 문서(`0001`)가 근거다.** 결정이 "운영자가 병원을 만들고 담당자를 지정한다" 이므로 그 행위의 API 는 필수다.
화면 문서는 구현 시점에 추가되어야 한다.

### 안내 화면

| 화면 | 문서 | 엔드포인트 | 상태 |
|---|---|---|---|
| 몰라몰라 알아보기 | `about.md` | `GET /legal-documents/about` | 🚧 |
| 병원 입점 문의 | `partner-inquiry.md` | `POST /partner-inquiries` (접수) | 🚧 |
| 서비스 이용약관 | `legal-terms.md` | `GET /legal-documents/terms` | 🚧 |
| 개인정보 처리방침 | `legal-privacy.md` | `GET /legal-documents/privacy` | 🚧 |
| 위치기반 서비스 이용약관 | `legal-location.md` | `GET /legal-documents/location` | 🚧 |

### 대응 엔드포인트를 만들지 않은 화면 요소와 그 이유

| 화면 요소 | 왜 만들지 않았나 |
|---|---|
| 홈 배너 3장 (`home.md`) | 클라이언트 고정 콘텐츠이고 **링크가 없는 것이 현재 정상 동작**이다. 서버가 내려줄 데이터 요구가 아직 없다. CMS 로 관리하기로 정해지면 그때 만든다 (§17-24) |
| 홈 앱 다운로드 QR / 스토어 링크 | 값 자체가 비어 있다. 앱 출시 후 정해지는 정적 설정값 |
| 홈 하단 회사 정보 | `frontend/src/mocks/fixtures/placeholder-company-info.ts` 의 정적 값. 화면 문서도 그 파일을 고치라고 안내한다 |
| 후기 작성 | 어느 화면에도 후기를 쓰는 기능이 없다 (`hospital-detail.md`: "읽기만 됩니다"). `POST` 를 만들면 근거 없는 엔드포인트가 된다. `rating`/`reviewCount` 집계 재계산과 함께 설계해야 한다 |
| 커뮤니티 글 수정·삭제 | 화면에 없다 (🚧). 다만 `QAPost.isMine` 을 응답에 넣어 두어 만들 때 필요한 정보는 준비됐다 |
| 좋아요·신고·스크랩·공유 | 화면에 없다 (🚧). 근거가 없다 |
| 알림 삭제 / 알림 수신 설정 | 화면에 없다 (🚧) |
| 병원 삭제 | 화면에 없다 (🚧). 상담 이력·찜·알림이 매달려 있어 삭제 정책부터 정해야 한다 (§17) |
| 광고 신청·결제 | 화면이 읽기 전용이고 "담당팀에 문의" 라고 안내한다. 결제가 붙는 별도 도메인이다 |
| 이벤트(프로모션) 등록·수정 | 관리자 화면에 없다. "개발자가 데이터를 직접 수정" 하는 상태다 |
| 꿀팁 작성·수정 | 관리자 화면에도 없다 |
| 프로필 수정 / 비밀번호 변경 / 회원 탈퇴 / 비밀번호 찾기 | 화면에 없다 (🚧). 특히 비밀번호 찾기는 없어서 "잊으면 다른 이메일로 새로 가입" 하는 상태다 (§17) |
| ~~입점 문의 조회~~ | **해소됨.** `GET /partner-inquiries` 를 추가했다 — 운영자 심사가 병원 생성의 전제가 되면서 조회 경로가 필수가 됐다 |
| 문의자 본인의 진행 조회 | 문의자는 계정이 없어 인증 수단이 없고, `id` 만으로 열면 남의 문의(병원명·담당자명·연락처)를 열거할 수 있다. 진행 안내는 운영자가 별도 수단으로 (§17) |

---

## 3. 인증·인가

### 토큰

- **JWT 액세스 토큰** — `Authorization: Bearer {token}`, 수명 **15분**.
  클레임: `sub`, `role`, `iat`, `exp`, `iss`, `aud`, `jti`.
- **리프레시 토큰** — 수명 **30일**, `POST /auth/refresh` 의 **본문**으로 전송.
- **세션 쿠키를 쓰지 않는다.** `mobile/` 자리표시자가 있고 나중에 Flutter 앱이 같은 API 를 쓴다.
  쿠키는 웹 브라우저 전용 메커니즘이라 앱에서 재현하려면 별도 저장·전송 코드가 필요하고,
  `SameSite`/`Secure` 조합도 앱 웹뷰에서 예측하기 어렵다.
- **회전(rotation)한다.** 재발급마다 새 리프레시 토큰을 주고 이전 것을 폐기한다.
  폐기된 토큰이 다시 오면 그 계정의 계열 전체를 무효화하고 `401 REFRESH_TOKEN_REUSED` 를 준다.
  본문으로 토큰을 다루면 탈취 시 만료까지 무제한으로 쓸 수 있으므로 회전이 필수다.

### `managedHospitalIds` 를 JWT 클레임에 넣지 않은 이유

담당 병원이 바뀌었을 때 토큰이 만료될 때까지 **낡은 권한이 유효**해진다. 액세스 토큰이 15분이라
최악 15분 동안 남의 병원을 고칠 수 있다. 토큰에는 `sub` 와 `role` 만 넣고, 담당 검사는 서버가 매 요청
`hospital_admins` 조회로 판단한다.

`role` 자체는 클레임에 있으므로 **승격·해제 시 그 계정의 리프레시 토큰을 전부 폐기한다.** 그러지 않으면
해제된 담당자가 최대 15분 동안 `hospital_admin` 으로 남는다 (담당 병원이 0개라 실제로 볼 것은 없지만,
`role` 로 화면 진입을 가드하는 구조에서 상태가 어긋난다).

`GET /auth/me` 가 화면 표시용으로 `role` 과 목록을 함께 내려준다.

### 역할 3개

| 역할 | 할 수 있는 것 |
|---|---|
| (비로그인) | 병원·전문의·후기·이벤트·꿀팁·커뮤니티·시술·검색·약관 조회, **병원 공개 문의(Q/A) 조회**, 입점 문의 접수. 전문의 `rating` 은 `null` 로 가려짐 |
| `user` | 위 + 상담 신청, 내 상담 내역, 찜, 사용자 알림함, 커뮤니티 작성·답변, **병원 문의 작성·내 문의 조회** |
| `hospital_admin` | 위 + **담당 병원**의 정보·전문의 수정, 담당 병원 상담의 조회·상태 변경·메모(**전체 PII**), **담당 병원 문의의 조회·답변**(문의자 이름은 **항상 마스킹**), 관리자 알림함, 주소 검색 |
| `operator` | 위 + **병원 생성**, **담당자 지정·해제**, **전문의 인증 검수**, **입점 문의 심사**, 전 병원 정보 수정, 전 상담 **조회**(**PII 마스킹**), 전 병원 문의 **조회**(이름 마스킹, **답변 불가**) |

`hospital_admin` 이 **할 수 없는** 것 — 전문의 인증 검수, 병원 생성, 담당자 지정, `isRecommended`(에디터 추천) 설정.
`operator` 가 **할 수 없는** 것 — 상담 상태 변경, 상담 메모 작성, 고객 연락처 전체 열람, 문의 답변 등록.

> 🚧 **제안 — 요청자 답 반영 대기 → 요청서 18 (2026-10-13 제안, §20): 위 표에 두 줄이 더해진다.**
>
> | 역할 | 더해지는 것 |
> |---|---|
> | (비로그인) | **사업자등록증 업로드**(`POST /uploads`) — 가입 전이라 토큰이 없어서다. **보안 결정이 열려 있다** |
> | `hospital_admin` | **가입하면서 자기 병원을 만든다**(`POST /auth/signup/hospital-admin`). 승인 전에도 관리자 화면 전부를 쓴다. 자기 병원의 **사업자등록증을 다시 열어볼 수는 없다** |
> | `operator` | **병원 승인·반려**(`PATCH /hospitals/{id}/approval`), **사업자등록증 열람**(`GET /uploads/{id}/content`, 감사 대상) |
>
> `operator` 가 여전히 **할 수 없는** 것에 하나가 늘지 않는다 — 승인은 운영자의 일이다.
> `hospital_admin` 이 할 수 없는 것에 **`자기 병원 승인`** 과 **`자기 서류 열람`** 이 더해진다.
> 전자는 검수의 의미가 사라지기 때문이고, 후자는 요청서의 "열람 권한을 운영자로 제한" 이다.

**`operator` 가 문의에 답할 수 없는 이유는 상담과 같다.** 답변은 그 병원의 진료시간·가격을 말하는
행위이고, 등록 즉시 환자에게 알림이 가고 공개 Q/A 로 노출될 수 있다. 운영자가 대신 답하면
그 병원이 하지 않은 말이 병원 이름으로 남는다.

**`operator` 가 상담을 조회만 할 수 있게 한 이유:** 상담 처리는 병원이 고객에게 연락하는 일이다.
운영자가 상태를 `예약완료` 로 바꾸면 고객에게 알림이 가는데 실제로 예약을 잡은 병원은 모르는 상태가 된다.
조회(`GET`)와 변경(`PATCH`)의 역할 범위가 다른 것은 의도된 비대칭이다.

**`operator` 를 담당자로 지정할 수 없다** (`422 CANNOT_ASSIGN_OPERATOR`). 운영자가 특정 병원의 담당자를
겸하면 그 병원 전문의를 스스로 검수할 수 있어 역할 분리가 무너진다. 결정 문서가 `operator` 를 만든
바로 그 이유를 되돌리는 셈이 된다.

### 인가 규칙 세 층

1. **인증 여부** — 토큰이 없으면 `401 UNAUTHENTICATED`, 만료면 `401 ACCESS_TOKEN_EXPIRED`.
   클라이언트는 후자에서 자동 재발급을 시도한다.
2. **역할** — 오퍼레이션의 `x-role` 에 없는 역할이면 `403 FORBIDDEN`.
   (`x-role` 값: `user` / `hospital_admin` / `operator` / 배열)
3. **담당 범위** — `hospital_admin` 이 `managedHospitalIds` 밖의 자원에 접근하면 `403` 또는 `404` (아래 규칙).

> **이 3층이 없는 것이 지금 가장 큰 결함이다.** `/admin` 으로 시작하는 7개 화면 전부에 로그인 검사가 없어서
> 주소만 알면 고객 실명·전화번호를 보고 아무 병원이나 고칠 수 있다.

### 담당 범위 밖 자원 — `403` 인가 `404` 인가

**자원이 공개적으로 존재를 확인할 수 있는 것이냐로 갈랐다.**

| 자원 | 응답 | 근거 |
|---|---|---|
| **병원** (`PATCH /hospitals/{id}`, `PUT /hospitals/{id}/doctors`) | `403 HOSPITAL_NOT_MANAGED` | `GET /hospitals/{id}` 로 누구나 존재를 확인할 수 있다. **존재를 숨겨서 얻는 것이 없다.** 대신 `403` 은 "담당 병원이 아니다" 라는 정확한 원인을 알려주어, 담당자가 병원 id 를 잘못 넣은 경우와 구분된다 |
| **전문의** (`PATCH`/`DELETE /doctors/{id}`) | `403 HOSPITAL_NOT_MANAGED` | 위와 같다. `GET /doctors/{id}` 가 공개다 |
| **상담** (`GET`/`PATCH`/`POST` on `/consult-requests/{id}`) | **`404 CONSULT_REQUEST_NOT_FOUND`** | 상담은 공개 자원이 아니고 **상담 id 가 고객 개인정보와 1:1로 대응**한다. `403` 을 주면 id 를 순차 대입해 "이 id 의 상담이 존재한다" 를 알아낼 수 있고, 그것만으로도 건수·활동량이 새는 열거(enumeration) 경로가 된다 |
| **입점 문의** (`/partner-inquiries/{id}`) | **`404 PARTNER_INQUIRY_NOT_FOUND`** | 위와 같다. 병원명·담당자 실명·연락처가 담긴다 |
| **병원 문의** (`/hospital-inquiries/{id}`, `.../answer`) | **`404 HOSPITAL_INQUIRY_NOT_FOUND`** | 문의 id 는 **공개 Q/A 로 노출되지 않는 건까지 포함**하므로 공개 자원이 아니다. `403` 을 주면 id 대입으로 "이 병원에 비공개 문의가 몇 건 있다" 가 새고, 그것이 §14 가 카운트에서 막은 바로 그 정보다. 비공개 문의 본문에는 환자가 자기 증상·예산을 적는다 |
| **내 상담** (`/me/consult-requests/{id}`) | **`404`** | 남의 상담 존재 여부를 흘리지 않는다 |
| **알림** (`/notifications/{id}/read`) | **`404`** | 남의 알림 id 존재 여부를 흘리지 않는다 |
| 🚧 **승인 전 병원** (`GET /hospitals/{id}`, 공개 시야) | **`404 HOSPITAL_NOT_FOUND`** | **제안 — 요청자 답 반영 대기 → 요청서 18 (2026-10-13 제안, §20).** 윗줄의 "병원 존재는 공개 정보" 는 **이미 공개된 병원**을 말한다. 승인 전 병원은 아직 공개 자원이 아니고, `403` 을 주면 "이 id 에 심사 중인 병원이 있다" 가 새어 **id 대입으로 입점 준비 중인 병원 수를 셀 수 있다.** `deleted_at` 된 병원을 `404` 로 다루는 것과 같은 취급 |
| 🚧 **업로드 파일** (`GET /uploads/{id}/content`, 운영자 아님) | **`403 FORBIDDEN`** | 제안(§20). 여기는 `404` 가 아니다 — **역할 부족**이지 범위 밖 자원이 아니고, id 를 알아도 이 경로를 호출할 수 있는 역할이 `operator` 하나뿐이라 열거로 얻을 것이 없다. 반대로 **파기된 파일은 `404`** 다 (바이트가 실제로 없다) |

> 🚧 두 줄은 **제안**이다. `PATCH /hospitals/{id}` 의 `403 HOSPITAL_NOT_MANAGED` 는 **그대로다** —
> 그쪽은 **공개된 병원**에 대한 담당 범위 문제이고, 승인 여부와 다른 축이다. 같은 `GET /hospitals/{id}`
> 가 담당자·운영자에게는 `200` 을 준다 (시야가 둘인 **유일한** 오퍼레이션이 된다).

**초안에서 뒤집은 판단:** `GET /consult-requests/{id}` 를 원래 `403` 으로 두고 "본인 관리 병원이 아니라는
사실 자체는 알려도 무해하다" 고 적었다. 틀렸다. 무해한 것은 **병원 존재**이고, 상담은 존재 자체가 정보다.
같은 "담당 범위 밖" 이라도 자원의 공개성에 따라 답이 달라진다.

### 사용자별 스코프

리소스 소유자가 명확한 것은 **경로로 스코프를 드러낸다** (`/me/...`, `/admin/...`).
"토큰 보고 알아서 걸러 주는" 방식은 그 필터를 빠뜨렸을 때 조용히 전체가 새기 때문에,
경로 자체로 구분되게 두면 리뷰와 캐시 키에서 잡힌다.

- `/me/consult-requests` — 신청자 본인의 것만
- `/me/favorites` — 본인 것만
- `/notifications?audience=user` — 본인에게 발송된 것만 (세 역할 모두 조회 가능)
- `/notifications?audience=admin` — 요청자를 수신자로 지정한 알림만 (`hospital_admin`/`operator`)
- `/admin/hospitals` — `hospital_admin` 은 담당 병원만, `operator` 는 전체. 응답의 `scope` 로 구분
- `/me/inquiries` — 문의자 본인의 것만 (공개·비공개, 미답변·답변완료 전부). 마이페이지 `내 문의`
- `/hospital-inquiries` — `hospital_admin` 은 담당 병원에 들어온 것만, `operator` 는 전체. `scope` 로 구분
- `/hospitals/{id}/inquiries` — **인증 불필요.** 공개 Q/A 만 (§14 의 `isPubliclyVisible`).
  경로가 `/me`·`/admin` 어디에도 속하지 않는 것이 "이것은 누구나 보는 목록" 이라는 표시다

`GET /consult-requests` 와 `GET /admin/hospitals` 는 **같은 경로에서 역할별로 범위가 달라지는** 곳이고,
`GET /hospital-inquiries` 가 세 번째로 같은 모양이다.
그래서 응답에 `scope: managed | all` 을 넣었다. 화면이 "내 병원" 과 "전체" 를 구분해야 하고,
목록이 0건일 때 "담당 병원이 아직 지정되지 않았어요" 와 "등록된 병원이 없어요" 를 구분해야 한다
(지금은 둘 다 그냥 빈 화면이다 — 확인된 결함).

### 관리자 대시보드는 `scope` 가 아니라 **병원 하나**다 (2026-10-13)

위 세 오퍼레이션은 "담당 병원 전부" 와 "전 병원" 두 범위를 `scope` 로 구분한다.
**관리자 대시보드(`/admin`)는 그 축을 쓰지 않는다 — 언제나 병원 한 곳이다.**

- `hospital_admin` **전용**이다. `operator` 는 `403 OPERATOR_CANNOT_USE_DASHBOARD`(계약) 이고, 운영자 홈은 기존
  `GET /admin/hospitals` 목록 + 전문의 검수다. 답할 수도 연락할 수도 없는 역할에게
  `답변 안 한 문의 N건` 을 보여주지 않는다 — `HospitalInquirySummary` 의 배지를
  `scope === 'all'` 일 때 생략하기로 한 것과 **같은 규칙**이다 (§14).
- 담당 병원이 여러 개면 **사이드 메뉴 위 드롭다운으로 하나를 고른다** (1개면 숨김).
  고른 값이 대시보드·사이드 배지·각 카드의 링크 모두의 축이다.
- `hospitalId` 를 **생략하면**: 담당 병원이 정확히 1곳일 때만 그 병원으로 응답하고,
  2곳 이상이면 `422 HOSPITAL_ID_REQUIRED` 다. **서버가 "첫 번째 병원" 을 골라 주지 않는다** —
  그 순간 화면의 드롭다운 값과 숫자가 갈릴 수 있고, 고른 적 없는 병원의 할 일이 보인다.
  기본 선택(마지막으로 고른 병원 → 없으면 `managedHospitalIds` 의 첫 번째)은 화면의 몫이다.
- 담당 병원 밖의 `hospitalId` 는 `403 HOSPITAL_NOT_MANAGED` 다 (`404` 가 아니다 —
  **병원 존재는 공개 정보**라 숨겨서 얻는 것이 없다. 위 표의 병원 자원 규칙 그대로).

`전체 내 병원` 합산 모드를 두지 않은 이유는 데이터 쪽 근거다 — `병원 정보 완성도` 와
`오늘 내원 예정` 은 **병원 단위 사실이라 합산할 대상이 아니다**(완성도 70% 와 40% 를 더할 수 없다).
자세한 판단은 `docs/database/README.md` §13.1.

### 병원 관리자 계정을 만드는 방법 — 기존 계정 승격

> 🚧 **이 절에 변경 제안이 올라와 있다 (2026-10-13 제안, 요청자 답 반영 대기 → 요청서 18 — §20).**
> 반영되면 승격은 **두 경로 중 하나**가 된다: 아래의 운영자 승격 **또는** 직접 가입
> (`POST /auth/signup/hospital-admin`). **아래 본문은 아직 유효하다.**
> 근거 문서는 `docs/decisions/0001-roles-and-pii.md` 결정 2 의 `변경 제안` 소절이고,
> **그 문서가 먼저 개정돼야 한다** (2026-10-21 개정 — 혼자 개발 체제. 그 개정도 요청서 12·18 의 일이다).

결정 2 는 "운영자가 병원 생성 + 담당자 계정 지정(또는 기존 계정 승격)" 이다. 둘 중 **기존 계정 승격**으로 정했다.

```
병원이 POST /partner-inquiries 로 문의
  → 운영자가 GET /partner-inquiries 로 심사, PATCH 로 결과 기록
  → 병원 담당자가 일반 회원가입 (POST /auth/signup)
  → 운영자가 POST /hospitals 로 병원 생성
  → 운영자가 POST /hospitals/{id}/admins { email } 로 담당자 지정 (role 승격)
```

**운영자가 계정을 새로 만들지 않는 근거:**

1. **초기 비밀번호를 전달할 방법이 없다.** 이 서비스에는 이메일 발송 인프라가 없고, 비밀번호 찾기·이메일
   인증도 없다(§17-10). 운영자가 평문 비밀번호를 알게 되는 구조는 **지금 고치려는 결함(브라우저 평문 저장)과
   같은 종류**다.
2. **병원 담당자도 일반 사용자로 앱을 쓴다.** 개인으로서 상담을 신청할 수 있고, 알림 설계가 이미 그것을
   전제한다 (`audience=user` 를 `hospital_admin` 도 조회한다). 별도 계정 체계를 만들면 같은 사람이 계정 두 개를 갖는다.
3. **`hospital_admins` 가 M:N 이라 승격은 "행 추가" 다.** 되돌리기가 한 줄이고 감사도 단순하다.
4. **계정 생성 엔드포인트를 두면 운영자가 임의 계정을 만들 수 있다.** 감사 부담이 커지고, 운영자 권한이
   "계정 발급" 까지 확장된다.

`POST /hospitals/{id}/admins` 는 `email` 로 계정을 찾는다. 없으면 `404 USER_NOT_FOUND` +
`그 이메일로 가입된 계정이 없어요. 먼저 회원가입을 안내해주세요` — 운영자가 다음 행동을 알 수 있는 문구다.
이메일 존재 여부가 노출되지만 이 오퍼레이션은 `operator` 전용이라 열거 위험이 없다.
(같은 이유로 **사용자 검색 엔드포인트(`GET /users?email=`)는 만들지 않았다** — 이메일 열거 표면을 늘리지 않는다)

**해제 시** 담당 병원이 하나도 남지 않으면 `role` 을 `user` 로 되돌린다. 담당 병원 없는 `hospital_admin` 은
관리자 화면에 들어와 빈 목록만 보는 애매한 상태다.

**`POST /hospitals` 가 등록자를 자동으로 담당자로 만드는 초안 설계는 폐기했다.** 운영자는 병원을 만들 뿐
담당자가 아니다. 한 번에 처리하고 싶으면 `adminEmails` 를 함께 보내면 되고, 그중 가입되지 않은 이메일이
있으면 **병원을 만들지 않고 전체를 되돌린다** — "병원은 생겼는데 담당자 지정만 실패" 라는 어중간한 상태를 막는다.

---

## 4. 개인정보 마스킹과 감사 로그

`docs/decisions/0001-roles-and-pii.md` 결정 3.

### 마스킹 규칙

| 보는 사람 | 이름 | 연락처 | `piiMasked` |
|---|---|---|---|
| `hospital_admin` (담당 병원) | `박서영` | `010-1234-5678` | `false` |
| `operator` | `박*영` | `010-****-5678` | `true` |
| 그 외 | 접근 불가 (`403`/`404`) | — | — |

마스킹 알고리즘: 이름은 가운데 글자를 `*` 로 (두 글자면 `박*`, 네 글자 이상은 첫·끝만 남겨 `남**수`).
전화번호는 가운데 블록만 가린다 — **뒤 4자리를 남기는 이유**는 운영자가 고객 문의를 받았을 때 어떤 상담
건인지 대조할 수 있어야 하고, 뒤 4자리만으로는 연락이 불가능하기 때문이다.

### 응답 스키마에 표현한 방식 — 같은 스키마 + `piiMasked` 플래그

**`ConsultRequest` 하나를 두고 값만 바꾼다.** 별도 투영 스키마(`ConsultRequestMaskedView`)를 만들지 않았다.

근거:

1. **필드 집합이 같다.** 마스킹은 값 변환이고 구조 변화가 아니다. 스키마를 나누면 `oneOf` 두 갈래가 생길
   뿐이고 클라이언트는 어차피 같은 카드 컴포넌트로 그린다.
   - 대조: `MyConsultRequest`(신청자 시야)는 **별도 스키마**다. `memos` 와 `statusHistory[].changedByName` 이
     **없어서** 구조가 다르다. **"구조가 다를 때만 투영을 나눈다"** 는 기준을 일관되게 적용한 결과다.
2. **관리자 화면 하나가 두 역할을 함께 쓴다.** `/admin/consultations` 는 담당자와 운영자가 같은 화면을 본다.
   스키마가 갈리면 화면이 응답 형태로 분기해야 한다.
3. **엔드포인트가 같다.** 경로가 같은데 응답 스키마가 다르면 생성되는 클라이언트 타입이 유니온이 되어
   모든 필드 접근에 좁히기(narrowing)가 필요해진다. 실익 없이 호출부가 전부 지저분해진다.

### 클라이언트가 마스킹 여부를 알아야 하는가 — **알아야 한다**

`piiMasked: boolean` 을 명시적으로 내려준다. 이유:

- 화면이 **"연락처는 담당 병원에서만 확인할 수 있어요"** 안내를 띄워야 한다. 값만 보고는
  `010-****-5678` 이 마스킹인지 잘못 저장된 데이터인지 구분할 수 없다.
- 마스킹된 값으로 **전화 걸기·복사 버튼을 활성화하면 안 된다.** (지금은 연락처가 글자로만 표시되지만
  전화 걸기는 예정된 개선 항목이다)
- 마스킹된 값을 **검색어로 넣어도 결과가 없는 것이 정상**임을 화면이 설명할 수 있다.
- **`role` 로 추론하지 않는 이유:** 추론은 클라이언트에 인가 규칙을 복제하는 것이다. 마스킹 정책이 바뀌면
  (예: 결정 문서가 적어둔 대로 "운영자에게 전체를 보이려면 마스킹 투영을 끄면 된다") 서버 한 곳만
  고치면 되게 둔다. 클라이언트가 `role === 'operator'` 로 판단하고 있으면 두 곳을 함께 고쳐야 한다.

### 마스킹하지 않는 것

| 자원 | 왜 |
|---|---|
| `PartnerInquiry` (병원명·담당자 실명·연락처) | 운영자가 심사를 위해 **직접 연락해야 하는** 정보다. 마스킹은 열람자 중 일부에게만 연락 필요가 있을 때 성립하는 장치이고, 입점 문의에는 "연락하지 않아도 되는 열람자" 가 없다 |
| `ConsultMemo.content` | 자유 텍스트라 마스킹할 필드가 없다. **담당자가 여기에 고객 연락처를 적으면 마스킹을 우회한다** — 화면 안내가 필요하다 (§17-21) |
| `ConsultSummary` | 숫자 두 개뿐이다 |
| `Review.authorName` | 이미 저장 시점에 마스킹돼 있다 (`김**`). 역할과 무관하게 항상 마스킹 |

### 상담 **목록**의 연락처는 역할과 무관하게 마스킹한다 (2026-10-13)

위 표는 **역할**로 갈리는 규칙이다. 상담에는 그 위에 **투영**으로 갈리는 규칙이 하나 더 붙는다 —
`GET /consult-requests` (목록)는 **담당 병원 관리자에게도** 전화번호 가운데를 가린다.
전체 번호는 `GET /consult-requests/{id}` (상세, **감사 기록 대상**)에만 있다.

| 투영 | 역할 | 이름 | 연락처 | `piiMasked` | 감사 로그 |
|---|---|---|---|---|---|
| 목록 | `hospital_admin` (담당 병원) | `박서영` | `010-****-4411` | **`true`** | 남기지 않음 |
| 목록 | `operator` | `박*영` | `010-****-4411` | `true` | 남기지 않음 |
| 상세 | `hospital_admin` (담당 병원) | `박서영` | `010-1234-4411` | `false` | **남김** (`pii_masked=false`) |
| 상세 | `operator` | `박*영` | `010-****-4411` | `true` | 남김 (`pii_masked=true`) |

**왜 담당자에게까지 목록을 가리나 — 대량 반출 방어선이 여기밖에 없기 때문이다.**
바로 아래 "목록 조회는 기록하지 않는다" 가 적은 대로, 목록은 **건별 열람 기록을 남기지 않는다**
(작업 화면이 목록을 반복 조회해서 로그가 의미 없이 불어난다). 그래서 목록에 전체 번호가 실리면
`pageSize=100` × 페이지 넘김으로 **무기록 반출**이 성립한다 — 지금까지 1차 방어선은 `pageSize` 상한과
요청 한도뿐이었다. 목록에서 값을 빼면 그 경로 자체가 사라지고, 전체 번호를 보는 모든 경로가
**기록이 남는 상세 한 곳**으로 모인다. 담당자의 정상 업무(전화 걸기)는 상세에서 하므로 잃는 것이 없다 —
요청서도 `전화 걸기` 버튼을 상세에만 둔다.

**넓은 화면의 오른쪽 상세 패널은 상세 오퍼레이션이다.** 목록 옆에 붙어 있어도 `GET /{id}` 를 호출하므로
**열 때마다 감사 행이 하나 남는다.** 이것은 부작용이 아니라 의도다 — 전체 번호를 본 횟수가 곧 감사 행 수다.

**`piiMasked` 의 뜻을 넓혔다: "이 응답에 마스킹된 개인정보 필드가 있다".**
역할 마스킹 여부만 뜻하던 값이라, 담당자 목록 응답(이름은 전체, 번호는 마스킹)에서 `false` 를 주면
화면이 `010-****-4411` 을 **잘못 저장된 데이터**로 읽게 된다 — §4 가 플래그를 둔 이유가 정확히 그
구분이었으므로 뜻을 넓히는 쪽이 맞다. 클라이언트 규칙은 그대로 한 줄이다: **`piiMasked === true` 면
전화 걸기·복사를 잠그고 "전체 번호는 상세에서 확인할 수 있어요" 를 띄운다.**

**`phoneMasked` 를 따로 두지 않는다.** 어느 필드가 가려졌는지는 위 표가 말하고, 화면이 묻는 질문은
"전화를 걸 수 있나" 하나뿐이다. 소비자 없는 두 번째 플래그는 두 값이 어긋날 자리만 만든다.

**검색(`q`)의 숫자 부분은 역할에 따라 범위가 다르다.** `hospital_admin` 은 번호 전체 부분일치,
`operator` 는 **뒤 4자리 접미 일치**로 제한한다 — 4자리를 넘게 넣으면 에러가 아니라 **뒤 4자리만 잘라** 비교한다
(검색은 0건이 정상 응답인 자리라 422 로 막지 않는다; 계약 `GET /consult-requests` 의 `q`). 운영자에게 뒤 4자리를 남긴 이유가 "고객 문의를 받았을 때
어떤 상담 건인지 대조" 이고(위), 그 대조는 4자리로 충분하다. 제한하지 않으면 전체 번호를 넣어
**"이 번호의 상담이 존재한다" 를 확인하는 오라클**이 되어 마스킹이 우회된다.
(`docs/database/README.md` §12.5 — `phone_digits` 컬럼과 같은 판정 함수)

### 병원 문의의 문의자 이름 — 역할과 무관하게 항상 마스킹

`hospital_inquiries` (§14) 는 상담과 **반대**다. 아무도 원본 이름을 보지 않는다.

| 보는 사람 | 문의자 이름 | 연락처 |
|---|---|---|
| `hospital_admin` (담당 병원) | `김*준` | **컬럼 자체가 없다** |
| `operator` | `김*준` | 〃 |
| 공개 Q/A (비로그인 포함) | **필드를 내려주지 않는다** | 〃 |
| 문의자 본인 (`/me/inquiries`) | 자기 이름이라 해당 없음 | 〃 |

마스킹 알고리즘은 위 상담과 **같은 함수**다 (`김민준` → `김*준`, 두 글자면 `박*`, 네 글자 이상은 `남**수`).
같은 판정을 두 곳에 두지 않는다 — 마스킹 함수는 하나이고 호출하는 투영이 둘이다.

**담당 병원에까지 마스킹하는 이유.** §4 의 마스킹은 "연락해야 하는 사람만 원본을 본다" 는 규칙인데,
문의에는 **연락해야 하는 사람이 아무도 없다.** 문의는 연락처 없이 앱 안에서 답을 받는 창구이고
(그것이 상담 신청과의 차이다), 답변도 같은 화면에서 끝난다. 전화번호 컬럼을 두지 않은 것이 같은 판단이다.

**`piiMasked` 플래그는 쓰지 않는다.** 그 플래그는 같은 스키마의 값이 역할에 따라 갈릴 때 필요했다.
문의는 분기가 없으므로 플래그가 가리킬 차이가 없다 — `Review.authorName` 과 같은 경우다.

**이름 스냅샷 컬럼도 두지 않는다.** `consult_requests.name` 은 **폼에 입력된 값**이라 계정 이름과
다를 수 있어서 별도 컬럼이었다. 문의 화면에는 이름 입력칸이 없으므로 `users.name` 을 조인해 마스킹한다.
계정 이름이 바뀌면 바뀐 이름의 마스킹이 보이는 것이 맞다.

**공개 Q/A 에는 작성자 필드를 아예 내려주지 않는다.** 빈 문자열이나 `익명` 을 채우면 언젠가 채워질
자리가 되고, 그 자리에 무엇이 들어가도 "공개 Q/A 에 작성자 표기 없음" 이라는 결정이 조용히 풀린다.

> ⚠️ 요청서(`docs/features/requests/2026-10-12-03-문의-기능-신규.md`)의 작성 화면 안내 문구는
> `공개해도 닉네임만 보임` 인데, 검토 결과는 **공개 Q/A 에 작성자 표기 없음**이다. 게다가 `users` 에
> 닉네임 컬럼이 없다. **화면 문구를 결정에 맞춰 고쳐야 한다** — 문구가 약속하는 것과 응답이 다르면
> 사용자는 자기 이름이 어딘가 보인다고 믿는다.

### 알림 문구도 마스킹 경계다

`새로운 상담 신청` 알림 내용은 `김민준님이 상담을 신청했어요` 로 **고객 이름이 문구에 박힌다.**
그래서 이 알림의 **수신자를 담당자로 한정했다.** `operator` 는 이 알림을 받지 않는다 —
응답에서 이름을 가려도 알림 문구로 새면 마스킹이 무의미하다.

결과적으로 `operator` 의 관리자 알림함은 비어 있는 것이 정상이다.

### 감사 로그

결정 3 이 "감사 로그는 이 결정에 따라오는 항목" 이라고 명시한다.
**마스킹으로 운영자 쪽 노출면을 막았으므로 남는 노출면은 담당자 쪽이다.**

#### 무엇을 기록하는가

| 오퍼레이션 | 기록 | 왜 |
|---|---|---|
| `GET /consult-requests/{id}` | **열람** | 실명·전화번호·문의 내용·내부 메모가 한 화면에 모이는 자리다. 남는 노출면의 핵심 |
| `GET /partner-inquiries/{id}` | **열람** | 병원명·담당자 실명·연락처 |
| `PATCH /consult-requests/{id}/status` | 변경 | 고객에게 알림이 나가는 행위. `statusHistory.changedByName` 으로 화면에도 노출 |
| 〃 (상태는 그대로, 예약 일시만 변경) | 변경 | **`action` 에 `consult_request.reschedule` 이 더해져 허용값이 9개 → 10개가 된다.** 같은 엔드포인트지만 기록은 갈라야 한다 — `before_value`/`after_value` 에 들어가는 것이 상태가 아니라 일시다. 기록하는 이유는 윗줄과 같다(고객에게 알림이 나가는 행위). 허용값 목록은 **`backend/prisma/schema.prisma` 의 `AuditLog` 주석에도 박혀 있으므로 두 곳을 함께 고쳐야 한다** |
| `POST /consult-requests/{id}/memos` | 작성 | `authorName` 으로 화면에도 노출 |
| `PUT /doctors/{id}/verification` | 결정 | 누가·언제·어떤 사유로 판정했는지. 현재는 반려 사유만 남고 승인 시 그것도 지워진다 |
| `POST /hospitals/{id}/admins` | 권한 부여 | 계정 승격이다. 권한 변경은 무조건 기록 대상 |
| `DELETE /hospitals/{id}/admins/{userId}` | 권한 회수 | 위와 같음 |
| `POST /hospitals` | 생성 | 운영자만 할 수 있는 행위 |
| `PATCH /partner-inquiries/{id}` | 심사 | 승인·반려 판정 |
| 🚧 `GET /uploads/{id}/content` | **열람** | **제안 (2026-10-13, §20).** 사업자등록증은 마스킹되지 않은 개인정보다. `action='hospital_document.view'`, `target_type='uploaded_file'`(**새 값**), **`pii_masked=false`** — `partner_inquiry.view` 와 같은 취급이다. 이 오퍼레이션이 존재하는 이유의 절반이 "열람을 한 자리로 모아 기록" 이다 (서명 URL 을 발급하지 않는 이유) |
| 🚧 `PATCH /hospitals/{id}/approval` | 결정 | **제안 (2026-10-13, §20).** `action` 이 갈린다 — `hospital.approve` / `hospital.reject`. `PUT /doctors/{id}/verification` 과 같은 모양이다 |

응답 헤더 `X-Audit-Logged: true` 로 기록됐음을 알린다 (클라이언트 동작에 영향은 없고 감사 파이프라인 점검용).

> 🚧 **자동 승인은 감사 로그를 남기지 않는다** (제안, §20). `audit_logs.actor_user_id` 는
> NOT NULL + Restrict 인데 **자동 승인에는 행위자가 없다.** 가짜 시스템 계정을 넣으면
> "행위자" 컬럼의 의미가 무너지고 `actor_role` 스냅샷도 거짓이 된다. 그 사실을 적는 자리는
> 감사 로그가 아니라 `hospitals.approval_source='auto'` 다 (DB §14.11).
> **가입 자체도 감사 대상이 아니다** — 감사는 **관리자 행위**를 기록하고, 본인이 자기 병원을
> 만드는 것은 사용자 행위다. 그 사실은 `hospitals.created_at` 에 남는다.

#### 목록 조회는 기록하지 않는다

`GET /consult-requests` 는 **건별 열람 로그를 남기지 않는다.** (2026-10-13 부터 목록의 연락처는 역할과 무관하게
가려서 내려가므로 — 위 절 — 목록으로는 전체 번호를 볼 수 없다. 실명은 담당자 목록에 그대로 실린다.)
상담 관리 화면이 목록을 반복 조회해서 로그가 의미 없이 불어난다.
**목록은 접근 통계로, 상세는 건별 열람 기록으로** 다루는 실무적 타협이다.

목록에서의 대량 반출에 대한 1차 방어선은 `pageSize` 상한(100)과 요청 한도다.
**엑셀 내려받기(`GET /consult-requests/export`)가 생기면 그때는 필수로 기록한다** — 그건 명백한 대량 반출이다.

#### 병원 문의는 열람도 답변도 기록하지 않는다

`hospital_inquiries` (§14) 는 감사 대상에 넣지 **않는다.**

감사가 답해야 하는 질문은 `pii_masked = false` — **누가 마스킹되지 않은 개인정보를 봤는가**다.
문의 응답에는 전화번호가 없고 이름은 누구에게나 마스킹된다(위). 그 질문에 해당하는 행이 한 건도
생기지 않으므로, 기록해도 `pii_masked = true` 행만 쌓여 **진짜 질의를 오염시킨다.**
관리자 문의 화면은 목록과 상세를 번갈아 여는 작업 화면이라 양도 상담 상세와 비교가 안 된다 —
바로 위 "목록 조회는 기록하지 않는다" 와 같은 실무 판단이다.

**답변 등록도 별도 감사 행을 만들지 않는다.** 상담 상태 변경·메모를 기록한 이유는 그 행위가
개인정보가 모인 화면 안에서 일어나고 행위자가 화면에 노출되기 때문인데, 문의는 행위자와 시각이
`answered_by_user_id` / `answered_at` 으로 **원본 테이블 그 자리에** 남고 답변은 수정·삭제가 없다(§14).
"언제 누가 무엇으로 바꿨나" 라는 질문이 아직 생기지 않는다.

**뒤집히는 조건은 하나다 — 답변 수정이 허용되는 순간.** 그때 `audit_logs.action` 에
`hospital_inquiry.answer_update` 를 추가하고 `before_value`/`after_value` 를 쓴다.
`action` 허용값 목록은 `backend/prisma/schema.prisma` 의 `AuditLog` 주석에도 박혀 있으므로
**두 곳을 함께 고쳐야 한다.** 지금 이 기능(문의)으로는 그 목록이 **한 줄도 바뀌지 않는다.**
(목록을 늘린 것은 상담 예약 쪽이다 — 위 표의 `consult_request.reschedule`, 2026-10-13)

#### 필요한 테이블 요구사항 (db-master 전달용)

`docs/database/README.md` 의 "제안 8. `audit_logs`" 가 이 요구사항을 받는다. 현재는
`consult_status_changes.changed_by_user_id` 와 `doctors.reviewed_by_user_id` 로 **변경 행위만 부분적으로**
남고, **열람 기록은 어디에도 없다.**

```
audit_logs
  id                pk
  actor_user_id     fk → users.id, not null   -- 행위자
  actor_role        varchar, not null          -- 행위 시점의 역할 스냅샷.
                                              -- users.role 을 조인하면 안 된다 — 승격/해제로 바뀐다
  action            varchar, not null          -- 'consult_request.view', 'consult_request.status_change',
                                              -- 'consult_request.reschedule' (2026-10-13 추가),
                                              -- 'partner_inquiry.view', 'doctor.verify',
                                              -- 'hospital_admin.assign', 'hospital_admin.unassign',
                                              -- 'hospital.create', 'partner_inquiry.review',
                                              -- 🚧 제안(§20): 'hospital.approve', 'hospital.reject',
                                              --               'hospital_document.view'
  target_type       varchar, not null          -- 'consult_request' | 'partner_inquiry' | 'doctor'
                                              -- | 'hospital' | 'user'
                                              -- | 🚧 제안(§20): 'uploaded_file'
  target_id         varchar, not null
  hospital_id       fk → hospitals.id, null    -- 병원 범위 행위일 때. 병원별 감사 조회용
  pii_masked        boolean, not null          -- 그 응답이 마스킹됐는지.
                                              -- "누가 전체 연락처를 봤는가" 가 핵심 질문이다
  request_id        varchar, not null          -- 에러 응답의 requestId 와 같은 값. 로그 상관관계
  ip                varchar, null
  user_agent        varchar, null
  metadata          json, null                -- action 별 부가정보 (예: 변경 전/후 상태)
  created_at        timestamp, not null

  Indexes
    (actor_user_id, created_at)                -- "이 담당자가 무엇을 열람했나"
    (target_type, target_id, created_at)       -- "이 상담을 누가 열람했나"
    (hospital_id, created_at)                  -- 병원별 감사
    (action, created_at)
    created_at                                 -- 보존기간 만료 삭제
```

설계 시 함께 정해야 하는 것:

- **보존 기간.** 개인정보 열람 기록은 통상 1년 이상 보존한다. `created_at` 인덱스가 만료 삭제를 받쳐준다.
- **불변성.** `UPDATE`/`DELETE` 를 애플리케이션 경로에서 막는다. 감사 로그를 고칠 수 있으면 감사가 아니다.
- **`actor_role` 을 스냅샷으로 저장하는 이유.** `users.role` 을 조인하면 승격·해제로 값이 바뀌어
  과거 행위의 역할을 알 수 없게 된다. 같은 이유로 `pii_masked` 도 스냅샷이다 (마스킹 정책이 바뀔 수 있다).
- **쓰기 실패 시 정책.** 감사 로그 쓰기가 실패하면 열람을 허용할 것인가. 상담 상세 열람은 로그 쓰기와
  같은 트랜잭션으로 묶어 **실패 시 열람도 실패**시키는 쪽이 안전하다. 대신 로그 저장소 장애가
  화면 장애가 된다 — 제품 판단이 필요하다 (§17-22).

---

## 5. 페이지네이션·필터·정렬 규약

### 페이지네이션 — offset 방식

```
GET /hospitals?page=1&pageSize=20
```

```json
{
  "items": [ ... ],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 11, "totalPages": 1 }
}
```

- `page` 는 1부터. `pageSize` 기본 20, 최대 100.
- 목록을 반환하는 모든 컬렉션이 같은 형태를 쓴다. 예외는 두 곳:
  - `GET /procedures`, `GET /promotions`, `GET /hospitals/{id}/doctors`, `GET /geo/address-search`,
    `GET /search/trending`, `GET /search/suggestions` — 건수가 구조적으로 작고 고정이라 **벌거벗은 배열**을 준다.
  - `GET /me/favorites` — 컬렉션이 아니라 "내 찜 상태" 라는 단일 리소스로 다뤘다.

**cursor 가 아니라 offset 을 쓴 이유:** 화면이 `총 11곳` / `총 14명` / `답변 3` 처럼 **전체 건수를 표시한다.**
cursor 페이지네이션은 총계를 싸게 줄 수 없어서 별도 count 요청이 필요해진다.
데이터 규모(병원 11, 전문의 14, 상담 7)를 보면 offset 의 깊은 페이지 성능 문제는 당분간 발생하지 않는다.
상담 목록이 수만 건으로 커지면 그때 `createdAt` 기준 cursor 를 **추가**한다 (기존 파라미터를 지우지 않는 additive 변경).

### 필터

- 필터는 전부 **쿼리 파라미터**이며 **AND 결합**이다. 병원 탐색의 조건 칩이 "켠 조건을 모두 만족하는 곳만 남긴다" 는 동작과 일치한다.
- 불리언 필터는 `true` 만 의미가 있다. `false` 를 보내면 "그 조건을 만족하지 않는 것만" 이 아니라 **필터를 걸지 않은 것과 같다** —
  화면의 칩은 켜짐/꺼짐 두 상태뿐이고 "상담 불가능한 병원만 보기" 라는 기능이 없다.
  혼동을 줄이려면 클라이언트가 꺼진 칩의 파라미터를 아예 보내지 않는 것이 옳다.
- 파라미터 이름은 응답 필드 이름과 맞췄다 (`consultAvailable`, `nightConsult`, `procedureId`).
  예외 두 개는 **화면 라벨이 실제 동작과 다르기 때문**에 동작을 따랐다:
  - 조건 칩 `진료시간` → `nightConsult` (실제로는 야간상담 필터다)
  - 정렬 `인기순` → `sort=rating` (실제로는 평점 순이다)

  화면 라벨을 파라미터에 쓰면 API 문서를 읽는 사람이 "시간대를 지정하는 필터" 로 오해한다.

### 정렬

```
sort=rating | reviewCount | consultCount
```

- 전부 **내림차순**이다. 화면의 정렬 칩 3개가 모두 "많은/높은 순" 이라 방향 선택이 필요 없다.
- 기본값 `rating` (화면 기본 `인기순`).
- `-` 접두사(`sort=-rating`) 같은 방향 문법을 도입하지 않았다. 방향이 필요해지면 그때 `order=asc|desc` 를 추가한다.
- 동일 값일 때의 순서는 서버가 `id` 로 안정화한다. 그러지 않으면 페이지 경계에서 항목이 중복·누락된다.

---

## 6. 서버 필터 vs 클라이언트 필터

**판단 기준 세 가지를 순서대로 적용했다.**

1. **다른 리소스와의 조인이 필요한가** → 서버. 클라이언트에서 하려면 그 리소스 전량을 받아야 한다.
2. **수익·신뢰에 관계된 규칙인가** → 서버. 클라이언트에 두면 위조·드리프트가 가능하고 기기 시계에 의존한다.
3. **개인정보나 큰 데이터를 줄이는가** → 서버.

세 개 다 아니고 순수 표현(presentation)이면 클라이언트.

### 병원 탐색 — 항목별 판단

| 화면 요소 | 판단 | 근거 |
|---|---|---|
| 모드 `의사`/`병원` | **서버** (다른 엔드포인트) | 반환 리소스 자체가 다르다. 카드 모양뿐 아니라 데이터가 통째로 바뀐다 |
| 보기 `리스트`/`지도`/`가격 비교표` | **클라이언트** | 같은 데이터를 다르게 그리는 것뿐이다. 가격 비교표의 최저가 정렬도 이미 받은 `priceRange.min`/할인가로 계산된다 |
| 시술 칩 `추천` | **서버** (`recommended=true`) | 스폰서 우선 노출 계산에 이 축이 필요하다 (`isEligibleForRecommendedSponsoredPlacement`). 클라이언트 필터로 두면 서버가 어떤 광고를 위로 올릴지 알 수 없다 |
| 시술 칩 13개 | **서버** (`procedureId=`) | 위와 같다. 스폰서 노출이 **카테고리별**로 계약되어 있어(`sponsoredCategories`) 서버가 선택된 시술을 알아야 순서를 정할 수 있다 |
| 시술 칩 `기타` (= 전체) | **서버** (파라미터 없음) | 이 경우에만 스폰서 우선 노출을 적용하지 않는다는 규칙이 있다 |
| 정렬 3개 | **서버** (`sort=`) | 페이지네이션과 정렬은 분리할 수 없다. 클라이언트가 한 페이지만 받아 정렬하면 전역 순서가 깨진다. 지금은 전량을 받아서 티가 안 나지만 페이지네이션을 넣는 순간 버그가 된다 |
| 조건 `상담가능` | **서버** | 병원 자체 속성이지만, 나머지 조건과 AND 로 묶여 페이지네이션 총계(`총 N곳`)에 영향을 준다. 일부만 서버로 보내면 `totalItems` 가 화면 표시와 어긋난다 |
| 조건 `원데이` | **서버** | 같음 |
| 조건 `진료시간` (야간상담) | **서버** | 같음 |
| 조건 `전문의` | **서버 (필수)** | **병원↔전문의 조인이 필요하다.** "인증 완료된 전문의가 1명 이상 있는 병원" 을 클라이언트에서 판정하려면 전문의 전량(현재 14명, 실서비스에서는 수천 명)을 받아야 한다. 예전 코드는 실제로 그렇게 했다(`useDoctorStore` 전체를 읽어 `doctorsByHospitalId` 맵을 만들었다) — 지금은 `hasVerifiedSpecialist`(병원)/`verifiedSpecialist`(전문의) 파라미터로 서버가 판정한다 |
| 조건 `경력` (10년+) | **서버 (필수)** | 같은 조인 문제 |
| 지도 반경 4개 | **서버** (`latitude`+`longitude`+`radiusKm`) | 반경 밖의 병원을 내려줄 이유가 없다. 실서비스에서 전국 병원을 받아 클라이언트가 거리 계산하는 것은 성립하지 않는다. `distanceKm` 도 서버가 계산해 내려준다 — 지도 카드가 거리를 표시한다 |
| `광고` 배지 / 상단 노출 | **서버** | §8 |
| `OO전문의 상주` 배지 | **서버 계산 필드** (`representativeSpecialty`) | 또 조인이다. 카드 배지 하나 때문에 전문의 전량을 받는 것을 없앤다 |
| `🔥` 이벤트 배지·할인가 | **클라이언트 조합** | `GET /promotions` 를 한 번 받아 `hospitalId` 로 맞춘다. 이벤트가 4건 규모이고 여러 화면이 같은 목록을 재사용한다 |
| 결과 개수 `총 N곳` | **서버** (`meta.totalItems`) | 필터 적용 후 건수라 서버만 알 수 있다 |

### 정리

**필터·정렬·페이지네이션은 전부 서버.** 그 이유를 한 줄로 줄이면:

> 조건 칩 5개 중 2개(`전문의`, `경력`)가 조인을 요구하고, `총 N곳` 이 필터 적용 후 총계이며,
> 광고 순서가 서버 판단이어야 한다. 이 셋 중 하나만 서버로 옮겨도 나머지를 클라이언트에 남겨 둘 이점이 사라진다
> — 어차피 요청은 가야 하고, 반쪽만 서버 필터면 `totalItems` 가 화면과 어긋난다.

**클라이언트에 남는 것은 표현뿐이다:** 리스트/지도/가격표 전환, 배지 조립, 시술 아이콘 매핑,
현재 상태를 URL 쿼리로 유지하기(`?mode=hospital&category=implant`).

### 그 밖의 화면

| 화면 | 필터 위치 |
|---|---|
| 커뮤니티 목록 | **서버** (`procedureId`, `sort`, `q`). 현재 화면에는 필터가 없지만(🚧) 파라미터를 미리 뒀다. 페이지네이션과 함께여야 의미가 있다 |
| 관리자 상담 목록 | **서버** (`status`, `hospitalId`, 기간, `q`). 개인정보를 담은 목록이라 필요한 것만 받는 게 원칙이다. 상태 칩은 지금도 동작하지만(✅) 클라이언트 필터다 |
| 관리자 전문의 검수 목록 | **서버**. 정렬 규칙(`대기→반려→승인`)과 `일반의` 제외가 서버 판단이다 |
| 알림 목록 | **서버** (`audience` 필수). 수신자 스코프 자체가 보안 경계다 |
| 이벤트 목록 | **서버** (`hospitalId`, `activeOnly`)이되 전량 조회도 허용. 4건 규모 |

---

## 7. 검색 설계 판단

### 현재 동작

검색 화면은 **목록을 걸러내지 않는다.** 입력한 글자와 맞는 것 하나를 찾아 그 화면으로 곧바로 이동시킨다.
찾는 순서는 ① 시술 → ② 병원 → ③ 전문의이고, 먼저 맞으면 멈춘다.
매칭은 `name.includes(query)` 이고, 전문의만 `query.startsWith(doctor.name)` 을 추가로 본다
(`김민준 원장` 같은 인기 검색어 문구 때문).

### 판단: **동작을 유지하되 규칙을 서버로 옮긴다. 그리고 결과 목록 API 를 함께 제공한다.**

두 개의 엔드포인트로 나눴다.

| 엔드포인트 | 역할 | 지금 쓰는 곳 |
|---|---|---|
| `GET /search/resolve?q=` | 검색어 → **이동 대상 하나** (`target`). 현재 동작을 그대로 재현 | 검색 화면, 홈 인기 검색어 알약 |
| `GET /search?q=` | 검색어 → **종류별 결과 목록** | 아직 없음 (결과 화면이 생기면) |

### 왜 현재 동작을 없애지 않았나

1. **화면 문서가 의도된 동작이라고 명시한다.** "검색 결과 목록이 안 나오는 것은 고장이 아닙니다.
   이 화면은 일부러 목록을 만들지 않고, 맞는 것 하나를 찾아 그 화면으로 바로 보냅니다."
   API 설계가 제품 동작을 바꾸는 결정을 대신 내리면 안 된다.
2. **홈의 인기 검색어 알약이 이 동작에 의존한다.** 태그를 누르면 검색 화면을 거쳐 자동 검색이 실행되고
   목적 화면으로 넘어간다. 결과 목록으로 바꾸면 그 흐름이 한 단계 늘어난다.
3. 결과 목록 화면은 **아직 존재하지 않는다.** 없는 화면을 위해 기존 동작을 깨는 것은 순서가 틀렸다.

### 왜 규칙을 서버로 옮기나

1. **매칭 규칙이 두 곳에 흩어질 것이다.** 결과 목록 API 와 resolve 가 서로 다른 규칙을 쓰면
   "검색은 되는데 목록에는 안 나온다" 가 생긴다. 규칙을 서버 한 곳에 둔다.
2. **Flutter 앱이 같은 규칙을 다시 구현해야 한다.** `includes` 와 전문의 이름 접두사 예외를 Dart 로 또 쓰면 어긋난다.
3. **`.getState()` 렌더 중 호출을 없앨 수 있다.** 지금 `search.tsx:96,108` 이 렌더 중 zustand 스냅샷을 읽는다.
4. **추천 검색어(광고) 알약 5개가 죽어 있는 것을 고칠 수 있다.** 아래 "추천 검색어(광고) 알약" 절 참고.
5. **개선 여지가 서버에 생긴다.** 초성 검색, 오타 교정, 동의어(`교정` ↔ `치아교정`), 검색량 집계.
   클라이언트 `includes` 로는 어느 것도 불가능하다.

### resolve 에서 현재 동작과 다르게 만든 것 하나

전문의가 매칭되면 `kind=doctor` + `doctorId` 를 반환한다. **지금 화면은 전문의를 찾고도 소속 병원 상세로 보낸다.**
전문의 상세 화면(`/doctor/:id`)이 있는데도 쓰지 않는 확인된 결함이다.

서버는 "무엇이 맞았는지" 만 말하고 "어디로 갈지" 는 클라이언트가 정한다. `hospitalId` 도 함께 주므로
**현재 동작(병원으로 보내기)을 유지하는 것도 그대로 가능하다.** 어느 화면으로 보낼지는 제품 결정이다 → §17.

### 추천 검색어(광고) 알약 — 문구와 이동 대상을 분리한다

현재 6개 중 5개는 눌러도 아무 일이 없다. `몰라몰라 PICK 인기 임플란트` 같은 광고 문구가
시술·병원 이름보다 길어서 그 문구로 검색하면 `검색 결과가 없어요` 로 떨어진다. **광고 지면이 죽어 있다.**

`GET /search/suggestions` 는 항목마다 `term`(보여줄 문구)과 `target`(이동 대상)을 **따로** 준다.

```json
[
  { "id": "s1", "term": "몰라몰라 PICK 인기 임플란트",
    "target": { "kind": "procedure", "procedureId": "implant", "label": "임플란트" } },
  { "id": "s4", "term": "원데이 가능 병원 모음", "target": null }
]
```

문구가 검색 가능한 이름일 필요가 없어진다. `target` 이 `null` 인 항목만 현재처럼 검색창을 채운다.
`원데이 가능 병원 모음` 처럼 "필터 조합" 을 가리키는 항목은 `SearchTarget` 으로 표현할 수 없다 → §17.

### 검색으로 고칠 수 없는 것

`known-issues.md` 의 **"검색으로 들어가면 홈으로 못 돌아갑니다"** 는 API 가 고칠 수 없다.
`q` 파라미터가 있으면 `useEffect` 가 검색을 자동 실행하고, 뒤로 가면 같은 URL 로 돌아와 또 실행되는
**클라이언트 라우팅 문제**다. 자동 실행을 한 번만 하도록(`router.replace` 또는 실행 플래그) 클라이언트에서 고쳐야 한다.

---

## 8. 스폰서·광고 노출

### 규칙은 서버가 계산한다

이제 서버(`backend/src/hospital/sponsorship.ts`)가 판단한다. 예전에는
`frontend/src/utils/sponsorship.ts`(삭제됨)가 클라이언트에서 `new Date()` 로 오늘을 구해
판단했다. 그때 서버로 옮기기로 한 이유:

1. **기기 시계에 의존한다.** 시계가 틀린 사용자에게 기간이 끝난 광고가 계속 노출되거나, 시작 전 광고가 미리 노출된다.
   유료 지면이므로 노출 기간은 신뢰할 수 있는 시계로 판단해야 한다.
2. **정렬과 분리할 수 없다.** 스폰서를 맨 앞에 넣는 것은 순서 결정이고, 순서는 페이지네이션과 함께 서버에 있어야 한다.
3. **Flutter 앱이 같은 규칙을 다시 구현해야 한다.** 광고 노출 순서가 플랫폼별로 달라지면 광고주에게 설명할 수 없다.
4. `rating >= 3.5` 라는 **신뢰 보호 규칙**이 클라이언트에 있으면 우회 가능하다.

### 두 조건을 각각 내려준다

배지 조건과 상단 노출 조건이 다르다. 화면 문서가 명시하는 지점이다 —
"평점이 3.5 미만이면 `광고` 배지는 붙지만 맨 위로 올라가지는 않습니다."

```json
"sponsorship": {
  "isActive": true,              // 기간 안. → 광고 배지 노출 조건
  "isPlacementEligible": true,   // 기간 + rating>=3.5 + 카테고리 일치. → 상단 노출 조건
  "placementRank": 1,
  "activeUntil": "2026-09-30"
}
```

`isSponsored` / `sponsoredRank` / `sponsoredStartDate` / `sponsoredEndDate` 원본 필드도 유지한다
(도메인 타입 보존 + 병원 수정 화면의 `광고 현황` 카드가 종료일을 표시한다).

### 응답 순서

`GET /hospitals` 는 **이미 정렬된 배열**을 준다. 클라이언트는 다시 정렬하지 않는다.

1. `procedureId` 지정 → `isActive && sponsoredCategories.includes(procedureId) && rating>=3.5`
2. `recommended=true` → `isActive && rating>=3.5`
3. 위 대상을 `sponsoredRank` 오름차순으로 앞에, 나머지는 `sort` 기준
4. **필터 없음(`기타`) → 스폰서 우선 노출 없음**

`GET /doctors`(의사 모드)에는 적용하지 않는다. 광고는 병원 단위 상품이고 현재 동작도 그렇다.

### 광고 노출 기간이 하드코딩된 문제

샘플 데이터의 광고 기간이 2026년 7~9월로 고정되어 있어 그 기간이 지나면 배지가 조용히 사라진다.
서버로 옮기면 최소한 **왜 사라졌는지** 를 알 수 있다 (`sponsorship.isActive=false`, `activeUntil` 이 과거).
기간이 끝난 계약의 갱신은 광고 신청·결제 기능이 붙어야 해결된다 (지금은 없다).

---

## 9. 알림과 부수효과의 책임

### 알림을 만드는 공개 엔드포인트는 없다

`POST /notifications` 를 만들지 않았다. 알림은 **다른 동작의 부수효과로만** 생긴다.
프론트엔드의 `notifyUser()` / `notifyAdmin()` 헬퍼(`frontend/src/services/notifications.ts`)는
서버로 이동해 사라진다.

클라이언트가 알림을 만들 수 있으면 위조 가능하고("상담이 예약완료됐다" 는 가짜 알림),
알림 생성이 원자적으로 묶이지 않아 상태는 바뀌었는데 알림이 없거나 그 반대가 생긴다.

### 부수효과의 소유자

| 부수효과 | 책임 엔드포인트 | 무엇이 생기나 |
|---|---|---|
| **새 상담 알림** | `POST /consult-requests` | `audience=admin`, `type=consult-status`, **`consultStatus=new`**, 제목 `새로운 상담 신청`, 내용 `{name}님이 상담을 신청했어요`, `relatedResource=consultRequest`, `relatedId={상담 id}`. **수신자는 그 병원의 관리자** |
| **상담 상태 변경 알림** | `PATCH /consult-requests/{id}/status` | `audience=user`, **`consultStatus=요청의 status`**, 문구는 상태별로 갈린다(아래 표). **수신자는 그 상담의 `userId`** |
| 상태 이력 한 줄 | `PATCH /consult-requests/{id}/status` | `statusHistory` 에 `{ event, status, changedAt, changedByName, visitAt, cancelReason, notified }` 추가 |
| **예약 일시 변경 알림** | `PATCH /consult-requests/{id}/status` (상태는 그대로 `booked`, `visitAt` 만 다름) | `audience=user`, `type=consult-status`(**새 값 없음**), **`consultStatus=booked`**, 제목 `예약 일시가 바뀌었어요`. 이력에는 `event='reschedule'` 행 하나. **수신자는 그 상담의 `userId`** |
| **문의 답변 알림** | `POST /hospital-inquiries/{id}/answer` (§14, 경로 확정 — `openapi.yaml`) | `audience=user`, `type=inquiry-answer`(**신규 값**), **`consultStatus=null`**, 제목 `문의에 답변이 왔어요`, 내용 `{병원명} · {답변 앞 60자}`, `relatedResource=hospitalInquiry`(**신규 값**), `relatedId={문의 id}`. **수신자는 그 문의의 `userId` 한 명.** 새 문의가 들어올 때 **관리자 알림은 만들지 않는다**(§14 — 배지는 미답변 수다) |
| **전문의 검수 결과 알림** | `PUT /doctors/{id}/verification` | `audience=admin`, `type=system`, **`consultStatus=null`**, `relatedResource=doctor`. **수신자는 그 전문의 소속 병원의 관리자.** 지금은 아무 알림도 생기지 않아 병원이 결과를 알 방법이 없다 |
| 검수 감사 로그 | `PUT /doctors/{id}/verification` | 누가·언제·어떤 결정을 했는지. 지금은 반려 사유만 남고 승인하면 그것도 지워진다 |
| 재검수 복귀 | `PUT /hospitals/{id}/doctors`, `PATCH /doctors/{id}` | `specialty` 또는 `certificateUrl` 이 바뀌면 `verificationStatus` → `pending`. 지금은 승인이 유지되어 검수 없이 다른 과 배지가 노출된다 |
| 조회수 증가 | `POST /community/posts/{id}/views` | **`GET` 이 아니다.** GET 이 상태를 바꾸면 캐시·프리페치·재시도가 조회수를 부풀린다 |

### 알림 문구와 `consultStatus` — 요청 08 (2026-10-13)

요청 08("예약 확정 일시 · 문의 답변")이 알림함에 요구한 네 가지 중 **데이터를 요구한 것은 하나**다 —
왼쪽의 **종류 아이콘 다섯**(예약 / 상담 / 문의 / 이벤트 / 안내). `type` 이 `consult-status` 하나라
예약확정과 연락중·취소가 같은 값이어서 **예약 아이콘을 상담 아이콘과 가를 수 없었다.**

**계약 변경은 `AppNotification.consultStatus` 하나다.** `ConsultStatus` enum 을 재사용하고,
**키는 항상 있고 값은 nullable** 이다. `NotificationType` 은 **한 값도 늘지 않았다.**

왜 `type='consult-booked'` 를 만들지 않았나: **`type` 은 이동 경로의 축**이다 — 화면이 `type` 으로
분기해 상담 내역·내 문의·이벤트로 보낸다. 아이콘 하나를 가르려고 라우팅 축을 쪼개면 그 분기가 전부
`consult-status || consult-booked` 두 줄이 되고, 하나를 빠뜨린 자리가 **조용히 이동하지 않는 알림**이
된다. (`docs/database/README.md` §15.2 가 버린 대안 넷을 모두 적는다.)

**서버는 아이콘을 모른다.** 내려보내는 것은 `type`·`consultStatus` 라는 사실이고, 그림으로 바꾸는 것은
표시 규칙이다 (`notificationIcon()` 은 클라이언트 순수 함수). 판정 지점이 화면 한 곳뿐이라
"같은 판정을 두 곳에 두지 않는다" 가 자동으로 지켜진다.

| 알림 | `consultStatus` | 아이콘 |
|---|---|---|
| 상담 접수 (`audience=admin`) | `new` | 상담 |
| 상태 변경 | **변경 후 상태** (= 요청의 `status`) | `booked` 면 **예약**, 그 밖은 상담 |
| 예약 일시 변경 (`reschedule`) | **`booked`** (상태는 그대로다) | **예약** |
| 문의 답변 · 검수 결과 · 이벤트 · 공지 | `null` | 문의 / 안내 / 이벤트 |
| **계약 확장 이전 행** | `null` (백필 없음) | 상담 — `null` 분기가 곧 변경 전 동작이다 |

#### 문구는 발송 시점에 확정된다 (방식 유지, 문장만 바뀐다)

`title`·`message` 는 알림을 만드는 트랜잭션 안에서 **완성된 문자열**로 저장한다. 렌더 시점에
`consultStatus` 로 다시 조립하지 않는다 — 조립식이면 병원이 개명했을 때 **과거 알림의 문장이 소급해
바뀌고**, 대상이 지워지면 문장이 사라진다. 알림은 **그때 보낸 통지의 사본**이다.

| 상태 / 이벤트 | 제목 | 본문 |
|---|---|---|
| 예약확정 (`booked`) | `상담 예약이 확정됐어요` | `{H} · {V} 방문. 변경이 필요하면 병원에 전화해 주세요` |
| 예약 일시 변경 (`booked`) | `예약 일시가 바뀌었어요` | `{H} · {V} 방문. 변경이 필요하면 병원에 전화해 주세요` |
| 연락중 (`contacted`) | `병원이 연락 중이에요` | `{H}{이\|가} 상담 신청을 확인했어요. 곧 전화가 올 거예요` |
| 취소 · `no_answer` | `상담이 취소됐어요` | `{H} · 연락이 닿지 않아 취소됐어요` |
| 취소 · `patient_request` | `상담이 취소됐어요` | `{H} · 요청하신 대로 취소했어요` |
| 취소 · `procedure_unavailable` | `상담이 취소됐어요` | `{H} · 이 병원에서 진료하지 않는 시술이에요` |
| 취소 · `duplicate` | `상담이 취소됐어요` | `{H} · 같은 신청이 있어 하나로 정리했어요` |
| 취소 · `etc` / 사유 없음 / 모르는 코드 | `상담이 취소됐어요` | `{H} · 자세한 사유는 병원에 문의해 주세요` |
| 내원완료 (`visited`) · 되돌림 | `상담 상태 변경` | `상담 상태가 '{라벨}'(으)로 변경되었어요` — **기존 문구 유지** |

`{H}` = 병원 이름 (없거나 빈 문자열이면 `병원`), `{V}` = `10/9(금) 14:00`.
예약확정인데 일시를 읽을 수 없는 방어 경로는 `{H} · 방문 일시는 병원에서 다시 알려드려요` 다.

세 가지 판단을 적어 둔다.

1. **일시 표기를 `10/9(금) 14:00` 하나로 통일했다** (DB §15.11-4 가 interface-master 에 넘긴 결정).
   계약이 쓰던 `10월 9일(금) 14:00` 표기는 **교체한다.** 같은 알림함에서 예약확정 알림과 일시 변경
   알림이 서로 다른 날짜 표기를 쓰면 안 되고, 마이페이지 상담 내역의 `10/9(금) 14:00 방문`·요청서 08 의
   예시와도 같은 기준이어야 한다. 짧은 쪽을 고른 것은 알림 본문이 360px 에서 세 줄 안에 들어가야 해서다.
   **이미 나간 알림의 옛 표기는 소급 수정하지 않는다.**
2. **`visited` 와 되돌림의 문구는 바꾸지 않는다.** 요청서가 그 두 경우의 문장을 적지 않았다 —
   지어내면 요청자가 검수하지 않은 문장이 환자에게 나간다. 아이콘은 `booked` 가 아니므로 '상담' 이고,
   그것은 규칙의 결과이지 예외가 아니다.
3. **연락중의 조사는 받침 판정 순수 함수가 정한다** (2026-10-13 결정). 끝 글자에 받침이 없으면 `가`
   (`강남 스마일 치과가`), 있으면 `이` (`○○치과의원이`, 폴백 `병원이`), 끝 글자가 한글이 아니면
   (영문·숫자) `이(가)`. `이(가)` 로 고정하면 대부분의 이름에서 어색한 문장이 나온다.
   이름 하나로 끝나는 판정이라 DB 도 요청도 모르는 함수로 떼어낼 수 있다.

#### 취소 사유는 알림 행에 저장하지 않는다

`notifications.cancelReason` 을 만들지 않았다 (DB §15.5). **`ConsultCancelReason` → 환자용 문장**
변환은 알림 행이 만들어지기 **전에** 끝나고, 결과는 `message` 문장 안에만 남는다.

- 소비자가 없다 — 아이콘은 `cancelled` 하나로 갈리고, 사유별 집계는 `consult_status_changes.cancel_reason`
  이 이미 답한다.
- **관리자 라벨(`연락이 안 됨`·`중복 신청`)을 환자 문구에 쓰지 않는다.** 같은 코드의 두 독자용 문장이라,
  한쪽을 다듬어도 다른 쪽이 흔들리지 않아야 한다. `연락이 안 됨` 은 환자에게 비난으로 읽힌다
  (`ConsultCancelReason` 이 신청자에게 내려가지 않는 것과 같은 이유).
- 대가: `etc` 취소 알림은 구조적으로 이유를 말할 수 없다 (`자세한 사유는 병원에 문의해 주세요`).
  `기타` 비율이 높게 나오면 **사유 코드를 늘리는 것이 먼저**다.

#### 상담 알림의 이동 대상이 바뀐다 — 계약 변경 없이

사용자 알림함의 상담 알림은 이제 **마이페이지 상담 내역**으로 간다 (요청 08 · 요청자 결정).
`relatedResource=consultRequest` + `relatedId` = **상담 id** 한 값이면 충분하므로 **엔드포인트도 필드도
늘지 않는다** — 화면이 병원 id 를 먼저 조회하던 경로가 사라질 뿐이다. 알림이 말하는 사실(내 상담이
어떻게 됐는가)은 병원 상세에 없다. `audience=admin` 의 접수 알림은 그대로 관리자 상담 상세로 간다.

#### 요청 08 에서 **계약이 바뀌지 않은 것**

| 요구 | 왜 변경이 없나 |
|---|---|
| 예약확정 알림에 방문 일시가 문장으로 | `message` 가 자유 문자열이다. `notifications.visitAt` 을 만들지 않는다 — 포맷을 서버가 정하므로 날짜 값을 다시 쓸 소비자가 없고, **과거 알림은 그때의 약속을 말해야** 맞다. 현재 일시는 `relatedId` 가 가리키는 상담에 있다 |
| 문의 답변 알림 | `type='inquiry-answer'` 가 **2026-10-12 에 이미 들어갔다.** 요청 08 의 문의 쪽은 계약 변경 0 |
| 상담 내역으로 이동 | `relatedResource` + `relatedId` 로 이미 된다 (위) |
| `GET /notifications` 파라미터·정렬 | 응답 항목에 필드 하나가 는 **additive** 변경이다 (§15). `?type=` 은 그대로 `NotificationType` 이고, `consultStatus` 로 거르는 질의는 없다 |
| 알림 생성 엔드포인트 | **여전히 없다.** 알림은 상담 접수·상태 변경·답변 등록의 부수효과로만 생긴다 |

### 중복 알림 방지 — "같은 상태면 no-op" 을 **"바뀐 것이 없으면 no-op"** 으로 고쳐 쓴다 (2026-10-13)

예약 일시 변경이 들어오면서 **상태가 같은데 바뀌는 요청**이 생겼다. `예약확정` 인 상담의 일시를
`10/9 14:00` → `10/12 11:00` 으로 옮기는 것이 그것이고, 이때 고객에게 알림이 **나가야 한다.**
기존 문장("같은 상태로 다시 보내면 no-op")을 그대로 두면 그 요청이 조용히 무시된다.

**비교 대상은 상태 하나가 아니라 세 값이다: `(status, visitAt, cancelReason)`.**

| 요청이 현재와 다른 곳 | 결과 | 이력 | 알림 | `X-Status-Changed` |
|---|---|---|---|---|
| `status` 가 다르다 | 상태 변경 | `event='status_change'` 1행 | 상태 변경 알림 | `true` |
| `status` 는 같고 `booked` 인데 `visitAt` 이 다르다 | 일시 변경 | `event='reschedule'` 1행 | **예약 일시 변경 알림** | `true` |
| 세 값이 모두 같다 | **no-op** | 없음 | 없음 | `false` |

`visitAt` 비교는 **분 단위**다 (서버가 초·밀리초를 0 으로 절삭해 저장한다 —
`docs/database/README.md` §12.2). 같은 시각을 다시 저장하는 것이 초 자릿수 때문에 변경으로 보이면
오탭 방어가 무너진다.

`X-Status-Changed` 는 **이름을 바꾸지 않고 뜻을 넓혔다: "이 요청이 이력 행을 만들었는가".**
소비자가 묻는 것은 "오탭으로 아무 일도 안 일어났는가" 하나이고, 일시 변경도 그 질문에는 같은 답이
필요하다. 헤더 이름과 뜻이 반 걸음 어긋나는 대가로 소비자 코드가 갈라지지 않는다.

오탭 방어는 그대로다. 지금은 `예약완료` 인 상담에 `예약완료` 를 다시 누르면 이력이 중복으로 쌓이고
고객 알림도 또 간다. 목록의 빠른 상태 버튼을 오탭하면 쉽게 발생하는데,
**오탭이 고객에게 중복 알림으로 나가는 것**을 서버가 막는다.

4xx 로 만들지 않은 이유: 요청 후의 상태가 요청자가 원한 상태와 같다. 실패로 다룰 이유가 없고,
클라이언트가 "이미 그 상태였습니다" 라는 에러를 사용자에게 보여줄 필요도 없다.

**no-op 과 입력 검증의 순서**: 필수 입력 검사(`예약확정`→`visitAt`, `취소`→`cancelReason`)가 **먼저**다.
`예약확정` 상담에 `visitAt` 없이 `예약확정` 을 다시 보내면 no-op 이 아니라 `422` 여야 한다 —
그 요청은 "바꿀 것이 없다" 가 아니라 **값을 빠뜨린 요청**이고, 화면은 "확정 일시를 입력해주세요" 를
띄워야 한다. (판정 함수는 `docs/database/README.md` §12.7)

**이력 행이 알림과 1:1 로 묶인다.** 알림 생성과 이력 행 생성은 같은 트랜잭션이고,
이력 행이 만들어진 알림의 id 를 들고 있다(§14 — `consult_status_changes.notification_id`).
화면의 `환자 알림 발송` 배지가 그 링크에서 나온다. "모든 변경은 알림을 보낸다" 는 **규칙으로 파생하지
않는다** — 규칙이 나중에 바뀌면 과거 이력의 표시가 소급해 거짓이 된다.

### 사용자용/관리자용 분리

`audience` 파라미터로 나눈다. 화면 문서가 두 알림함을 명확히 분리하고 있고
(`/notifications` vs `/admin/notifications`, `모두 읽음` 이 서로에게 영향 없음),
프론트엔드 캐시 키도 `queryKeys.notifications.byAudience(audience)` 로 나뉘어 있다.

**`audience` 는 역할이 아니라 알림함 이름이다.** 역할은 셋인데 알림함은 둘이다 —
화면이 `/notifications` 와 `/admin/notifications` 두 개뿐이기 때문이다. `audience` 값에 `admin` 이라는
문자열이 남아 있는 것은 화면·기존 데이터와의 호환 때문이며, `UserRole` 에는 `admin` 이 존재하지 않는다.

- `audience=user` → 토큰 주체 **본인에게 발송된** 알림만. **세 역할 모두 호출 가능**
  (병원 담당자도 개인으로서 상담을 신청한다).
- `audience=admin` → **`hospital_admin` 또는 `operator` 필수** (`user` 는 `403`).
  요청자를 수신자로 지정한 알림만.

`hospital_admin` 의 목록은 **담당 병원에 들어온 알림**이다. 담당 병원이 여러 개면 합쳐서 보인다.
`operator` 의 목록은 **정상적으로 비어 있다** — 새 상담 알림과 검수 결과 알림 둘 다 담당자에게만 간다.
새 상담 알림 문구에 고객 이름이 박혀 있어서(`김민준님이 상담을 신청했어요`) 운영자에게 보내면
§4 의 마스킹이 무의미해지기 때문이다.

이것이 "관리자가 상태를 바꾸면 자기 알림함에도 알림이 들어오는" 현재 결함의 해결책이다.
상태 변경 알림은 상담의 `userId` 에게만 가고, 담당자는 `audience=user` 로 그 알림을 볼 수 없다
(본인 상담이 아니므로).

### 읽음 처리

- `PATCH /notifications/{id}/read` — 멱등. 되돌리기(안 읽음) 없음. 화면에도 없다.
- `POST /notifications/read-all` — `audience` **필수**. 한쪽만 처리해야 하고 반대쪽 배지는 남아야 한다.
  선택 파라미터로 두면 그 규칙이 우연히 깨질 수 있다.
- `GET /notifications/unread-count` — 배지 전용. 배지는 여러 화면에서 필요하고,
  관리자 알림 내용에 고객 이름이 들어 있어(`김민준님이 상담을 신청했어요`) 배지 하나 때문에
  개인정보를 받아오는 것을 피한다.

### `relatedResource` 를 새로 추가했다

지금 관리자 알림함은 `relatedId` 만 보고 **무조건 상담 상세로** 보낸다(`admin/notifications.tsx:14`).
전문의 검수 알림이 생기면 잘못된 곳으로 이동한다. `relatedResource`(`consultRequest`|`hospital`|`doctor`|`promotion`|`hospitalInquiry`|`null`)를
함께 내려주어 이동 대상을 종류로 판단하게 한다.

**`hospitalInquiry` 알림은 마이페이지 `내 문의` 의 그 문의(`relatedId`)를 펼친 채 연다.** 병원 상세의 공개 Q/A 로
보내지 않는다 — 비공개로 물었거나 병원이 비공개로 답한 건은 그곳에 없고, 알림만으로는 공개 여부를 알 수 없다.
그래서 알림에 `hospitalId` 를 싣지 않고, **알림 행에 컬럼도 더하지 않는다.** (2026-10-12 화면 설계에서 확정.
처음 설계는 `hospital_inquiries` 조인으로 `hospitalId` 를 내려주는 것이었으나 그 값을 쓰는 화면이 없어 뺐다.)
`notifications.hospital_id` 는 `audience='admin'` 알림함이 "어느 병원의 알림함인가" 로 쓰는 필터 키이므로
사용자 알림에 채우지 않는다.

---

## 10. 카카오 관련 판단

### 결론: **주소 검색은 서버 경유, 지도 표시는 클라이언트 유지.**

키 두 개의 성격이 다르다.

| 키 | 지금 어디 | 판단 |
|---|---|---|
| `VITE_KAKAO_REST_API_KEY` | 브라우저 (`services/geocoding.ts` 가 `dapi.kakao.com` 직접 호출) | **서버로 옮긴다** → `GET /geo/address-search` |
| `VITE_KAKAO_MAP_JS_KEY` | 브라우저 (카카오맵 JS SDK) | **그대로 둔다** |

### 왜 REST 키를 옮기나

1. **번들에 그대로 인라인된다.** `VITE_` 접두사 변수는 Vite 가 빌드 시 문자열로 박아 넣는다.
   난독화가 아니라 **평문**이다. 브라우저 개발자 도구에서 검색하면 바로 나온다.
2. **REST 키는 도메인 제한을 걸 수 없다.** JS 키는 카카오 개발자 콘솔에서 허용 도메인을 등록할 수 있지만
   REST 키는 그런 제한이 없다. 꺼내간 사람이 **어디서든** 우리 계정 할당량으로 쓸 수 있다.
   할당량 소진 → 병원 등록 폼이 죽고, 유료 전환 시 → 우리에게 과금된다.
3. **Flutter 앱이 붙으면 노출면이 더 넓어진다.** 앱 바이너리에도 같은 키를 심어야 하고,
   앱 바이너리는 웹 번들보다 뜯기 쉽다. 서버 프록시로 두면 클라이언트가 몇 개든 키는 한 곳에만 있다.

### 왜 JS 키는 남기나

지도 렌더링은 카카오 SDK 가 브라우저에서 직접 타일을 그리는 방식이라 서버가 대신할 수 없다.
JS 키는 origin 제한이 가능하고 **애초에 클라이언트 노출을 전제로 발급되는 키**다.
서버로 옮길 이유도, 옮길 방법도 없다.

즉 **지도는 클라이언트, 주소 검색은 서버**로 나뉜다. 두 키의 성격이 다르므로 이 비대칭이 옳다.

### 서버 경유로 얻는 것

- **`hospital_admin` / `operator` 제한.** 주소 검색은 병원 등록·수정 폼에서만 쓴다
  (등록은 `operator`, 수정은 담당 `hospital_admin`). 공개로 두면 우리 서버가 누구나 쓰는
  무료 지오코딩 프록시가 된다.
- **캐시.** 폼이 0.3초 디바운스로 타이핑마다 호출한다. 같은 질의를 서버가 캐시한다 (10분).
- **요청 한도.** 계정당 분당 30회.
- **장애를 구분할 수 있다.** 지금은 실패를 `console.warn` 하고 빈 배열을 반환해서
  "일치하는 주소 없음" 과 "카카오가 죽었다" 가 구분되지 않는다.
  → `200 []` vs `502 GEOCODING_UPSTREAM_ERROR`.
- **가짜 결과 폴백을 없앤다.** 지금은 키가 없으면 입력 글자에 `로 12`, ` 12-3` 을 붙인 **가짜 주소**와
  서울시청 근처 임의 좌표를 만들어 저장한다. 그렇게 저장된 병원은 실제와 다른 위치에 찍히고,
  화면 문서도 "실제 주소를 조회한 게 아닙니다" 라고 경고하고 있다. 서버는 가짜를 만들지 않는다 —
  키가 없으면 `502` 로 정직하게 실패한다.

### 남는 문제

**지도가 안 보이는 것**(`known-issues.md`)은 API 가 고칠 수 없다. `VITE_KAKAO_MAP_JS_KEY` 가
설정되지 않은 환경 설정 문제이며, 병원 탐색의 지도 보기와 병원 상세의 지도 창 둘 다 해당한다.

---

## 11. 에러 응답 형식과 코드 체계

### 형식

모든 4xx/5xx 가 하나의 형태를 쓴다.

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "입력값을 확인해주세요",
    "details": [
      { "field": "phone", "code": "INVALID_PHONE_FORMAT",
        "message": "휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요" }
    ],
    "requestId": "01J9X8V0Q3"
  }
}
```

- `code` — 기계 판독용. 대문자 SNAKE_CASE.
- `message` — **사용자에게 그대로 보여줄 수 있는 한국어 문구.**
  프론트엔드가 코드별 문구 사전을 따로 들고 있지 않게 하려는 의도다. 이 앱은 화면 문구가
  `병원 정보를 찾을 수 없어요` 처럼 문서에 명시되어 있어서, 서버 문구를 화면 문구와 맞춰 두면
  같은 말을 두 곳에서 관리하지 않아도 된다. **문구를 바꿀 때는 화면 문서를 함께 확인해야 한다.**
- `details` — 필드 단위 오류. `VALIDATION_FAILED` 에서만 채워진다.
  `field` 는 점 표기이고 배열은 `doctors[2].name` 형태다 (병원 폼의 전문의 반복 항목 때문에 필요하다).
- `requestId` — 응답 헤더 `X-Request-Id` 와 같은 값. 로그 추적용.

### HTTP 상태 코드

| 코드 | 언제 |
|---|---|
| `400` | 본문이 JSON 이 아니거나 파라미터 타입이 깨짐 (구조적 오류) |
| `401` | 인증 없음·만료·리프레시 실패 |
| `403` | 역할 부족 또는 소유 아님 |
| `404` | 리소스 없음. 남의 리소스에 접근했을 때 존재를 숨겨야 하는 경우도 포함 |
| `409` | 현재 상태와 충돌 (중복 이메일, 상담 마감) |
| `413` | 🚧 본문이 상한보다 큼 (**제안 §20** — `POST /uploads` 에서만) |
| `415` | 🚧 허용되지 않는 파일 형식 (**제안 §20** — `POST /uploads` 에서만. 확장자가 아니라 **실제 바이트**로 판정) |
| `422` | 형식은 맞지만 값이 규칙 위반 (검증 실패) |
| `429` | 요청 한도 초과 |
| `500` | 서버 오류 |
| `502` | 외부 서비스(카카오) 실패 |
| `503` | 점검 중 |

`400` 과 `422` 를 나눈 이유: 프론트엔드의 처리가 다르다. `400` 은 클라이언트 버그이므로
"일시적인 문제가 발생했어요" 로 뭉뚱그리고, `422` 는 `details` 를 필드 아래에 뿌려야 한다.

### 코드 체계

`{도메인}_{사유}` 형태이며, 도메인이 없는 공통 코드는 사유만 쓴다.

**공통**

| 코드 | HTTP | 문구 |
|---|---|---|
| `MALFORMED_REQUEST` | 400 | 요청 형식이 올바르지 않아요 |
| `UNAUTHENTICATED` | 401 | 로그인이 필요해요 |
| `ACCESS_TOKEN_EXPIRED` | 401 | 로그인이 만료되었어요. 다시 로그인해주세요 |
| `FORBIDDEN` | 403 | 이 작업을 수행할 권한이 없어요 |
| `VALIDATION_FAILED` | 422 | 입력값을 확인해주세요 |
| `FIELD_NOT_WRITABLE` | 422 | 수정할 수 없는 항목이에요 |
| `RATE_LIMITED` | 429 | 요청이 너무 많아요. 잠시 후 다시 시도해주세요 |
| `INTERNAL_ERROR` | 500 | 일시적인 문제가 발생했어요. 잠시 후 다시 시도해주세요 |

**인증**

| 코드 | HTTP | 문구 |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호가 올바르지 않아요 |
| `EMAIL_ALREADY_REGISTERED` | 409 | 이미 가입된 이메일이에요 |
| `REFRESH_TOKEN_INVALID` | 401 | 로그인이 만료되었어요. 다시 로그인해주세요 |
| `REFRESH_TOKEN_REUSED` | 401 | 보안을 위해 로그아웃되었어요. 다시 로그인해주세요 |
| `PROVIDER_MISMATCH` | 409 | 이 이메일은 다른 방법으로 가입되어 있어요 |

`INVALID_CREDENTIALS` 는 이메일이 없는 경우와 비밀번호가 틀린 경우에 **같은 코드·같은 문구**다.
계정 존재 여부가 새는 것을 막고, 현재 화면 문구와도 일치한다.

🚧 **제안 — 요청자 답 반영 대기 → 요청서 18 (2026-10-13 제안, §20).** 병원 관리자 직접 가입이 더하는 코드.

| 코드 | HTTP | 문구 |
|---|---|---|
| `UPLOAD_NOT_FOUND` | 422 (+detail) | 사업자등록증을 다시 첨부해주세요 |
| `AGREEMENT_REQUIRED` | 422 (+detail) | 필수 약관에 모두 동의해야 가입할 수 있어요 |
| `AGREEMENT_VERSION_NOT_FOUND` | 422 | 약관 정보가 변경되었어요. 새로고침 후 다시 시도해주세요 |
| `FILE_TOO_LARGE` | 413 | 파일은 10MB까지 올릴 수 있어요 |
| `UNSUPPORTED_FILE_TYPE` | 415 | JPG, PNG, PDF 파일만 올릴 수 있어요 |
| `APPROVAL_NOTE_REQUIRED` | 422 (detail) | 반려 사유를 입력해주세요 |
| `INVALID_APPROVAL_TRANSITION` | 422 | 이미 승인이 끝난 병원이에요 |

세 가지 판단을 적어 둔다.

- **`EMAIL_TAKEN` 을 새로 만들지 않았다.** db-master 가 넘긴 목록은 `409 EMAIL_TAKEN` 이었지만,
  **같은 사실에 이미 `EMAIL_ALREADY_REGISTERED` 가 있다.** 코드를 둘 두면 화면이 문구 사전을
  두 벌 들게 되고, "`message` 를 그대로 보여준다"(§11 형식)는 규약이 무너진다.
- **`UPLOAD_NOT_FOUND` 는 `404` 가 아니라 `422` 다.** 없는 리소스를 **요청한** 것이 아니라
  요청 본문의 한 필드 값이 규칙을 어긴 것이고, 화면은 업로드 칸에 오류를 붙여야 한다.
  "없다 / 이미 주인이 있다 / 용도가 다르다 / 파기됐다" 네 경우를 **한 코드로 합친 것도 의도**다 —
  구분해 주면 id 대입으로 "그 자리에 남의 서류가 있다" 가 샌다.
- **`413`/`415` 는 이 문서에 없던 상태 코드다.** 업로드 오퍼레이션 하나 때문에 생긴다.
  `422` 로 뭉치지 않은 이유: 둘 다 **본문을 끝까지 읽지 않고도** 판정되는 전송 단계의 거절이고,
  프록시·게이트웨이가 우리 코드에 닿기 전에 같은 상태로 끊을 수 있다. 표준 코드를 쓰면
  그 두 경로의 응답이 갈리지 않는다.

**병원 / 전문의 / 담당자**

| 코드 | HTTP | 문구 |
|---|---|---|
| `HOSPITAL_NOT_FOUND` | 404 | 병원 정보를 찾을 수 없어요 |
| `HOSPITAL_NOT_MANAGED` | 403 | 담당하지 않는 병원이에요 |
| `DOCTOR_NOT_FOUND` | 404 | 전문의 정보를 찾을 수 없어요 |
| `USER_NOT_FOUND` | 404 | 그 이메일로 가입된 계정이 없어요. 먼저 회원가입을 안내해주세요 |
| `CANNOT_ASSIGN_OPERATOR` | 422 | 운영자 계정은 병원 담당자로 지정할 수 없어요 |

`SELF_VERIFICATION_FORBIDDEN` 은 **제거했다.** 역할이 둘뿐일 때 "자기 병원 전문의는 스스로 검수 금지" 로
막던 임시 방편이었고, `operator` 가 생겨 불필요해졌다. 검수는 `operator` 전용이므로 `hospital_admin` 의
호출은 그냥 `403 FORBIDDEN` 이다.

🚧 **제안 — 요청자 답 반영 대기 → 요청서 19 (2026-10-13 제안, §21).** 병원 정보 확장(시술별 가격·사진·특징)이 더하는 코드.
**전부 `422 VALIDATION_FAILED` 의 `details[]` 안**이고, `field` 는 인덱스 경로(`procedures[2].priceMin`)다.

| 코드 | HTTP | 문구 |
|---|---|---|
| `PRICE_RANGE_INVERTED` | 422 (detail) | 최소 금액이 최대 금액보다 클 수 없어요 |
| `PRICE_INCOMPLETE` | 422 (detail) | 최소·최대 금액을 모두 입력하거나 `상담 후 안내` 를 선택해주세요 |
| `PRICE_NOT_ALLOWED_ON_REQUEST` | 422 (detail) | `상담 후 안내` 를 선택한 시술에는 금액을 입력할 수 없어요 |
| `PRICE_OUT_OF_RANGE` | 422 (detail) | 금액을 다시 확인해주세요 |
| `PROCEDURE_DUPLICATED` | 422 (detail) | 같은 시술이 두 번 들어왔어요 |
| `TOO_MANY_IMAGES` | 422 (detail) | 사진은 11장까지 올릴 수 있어요 |
| `TAGLINE_TOO_LONG` | 422 (detail) | 한 줄 소개는 40자까지 쓸 수 있어요 |
| `FEATURE_NOT_WRITABLE` | 422 (detail) | 야간·주말 진료는 진료시간에서 자동으로 정해져요 |

판단 넷을 적어 둔다.

- **`UPLOAD_NOT_FOUND` 를 그대로 재사용한다** (위 06 표의 코드). 사진 URL 이 가리키는 파일이
  없거나·남의 것이거나·파기됐거나·이미 다른 병원이 가져갔을 때 **전부 이 코드**다. §20.3 이 네 경우를
  한 코드로 합친 이유가 여기서도 같다 — 구분해 주면 값을 바꿔 가며 **"그 자리에 남의 파일이 있다"**
  를 알아낼 수 있다. 문구만 사진 칸에 맞춰 바뀐다(`사진을 다시 올려주세요`).
- **`UPLOAD_ALREADY_CLAIMED` 를 만들지 않았다.** db-master 가 넘긴 후보에 `409` 로 들어 있었지만,
  **담당자가 자기 병원의 같은 사진을 다시 저장하는 것은 정상 동작**(claim 조건이 `hospital_id = 내 병원`
  을 허용한다)이라 이 코드가 뜨는 경우는 **남의 파일을 가리켰을 때뿐**이다. 그것을 별도 코드로 알려
  주는 것은 위와 정면으로 어긋난다.
- **`FEATURE_NOT_WRITABLE` 과 공통 `FIELD_NOT_WRITABLE` 을 합치지 않았다.** 뒤의 것은 "권한이 없어
  못 쓴다"(`isRecommended` — 운영자면 쓸 수 있다)이고, 앞의 것은 **누구도 못 쓴다**(진료시간이 정한다).
  화면이 보여줄 문구가 다르다 — 전자는 "권한", 후자는 "진료시간을 고치세요" 다.
- **가격 오류를 `INVALID_PRICE` 하나로 뭉치지 않았다.** 네 코드는 **화면이 고칠 칸과 안내가 전부
  다르다**(최대 금액 칸 / 비어 있는 칸 / `상담 후 안내` 체크 해제 / 자릿수). `message` 를 그대로
  보여주는 규약(§11 형식) 아래에서 하나로 합치면 "입력값을 확인해주세요" 로 되돌아간다.

**입점 문의**

| 코드 | HTTP | 문구 |
|---|---|---|
| `PARTNER_INQUIRY_NOT_FOUND` | 404 | 입점 문의를 찾을 수 없어요 |
| `INVALID_INQUIRY_STATUS_TRANSITION` | 422 | 이미 심사가 끝난 문의예요 |

**상담**

| 코드 | HTTP | 문구 |
|---|---|---|
| `CONSULT_REQUEST_NOT_FOUND` | 404 | 상담 정보를 찾을 수 없어요 |
| `CONSULT_CLOSED` | 409 | 지금은 이 병원의 상담 신청을 받지 않아요 |
| `PROCEDURE_NOT_OFFERED` | 422 | 이 병원에서 진행하지 않는 시술이에요 |
| `DOCTOR_NOT_AT_HOSPITAL` | 422 | 이 병원에 소속된 전문의가 아니에요 |
| `THIRD_PARTY_CONSENT_REQUIRED` | 422 | 개인정보 제3자 제공에 동의해야 상담을 신청할 수 있어요 |
| `INVALID_PHONE_FORMAT` | 422 (detail) | 휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요 |
| `VISIT_AT_REQUIRED` | 422 (detail) | 확정 일시를 입력해주세요 (2026-10-13) |
| `CANCEL_REASON_REQUIRED` | 422 (detail) | 취소 사유를 선택해주세요 (2026-10-13) |
| `PERIOD_FILTER_CONFLICT` | 422 | 기간 조건은 한 가지 방식으로만 보낼 수 있어요 (`period` 와 `createdFrom`/`createdTo` 를 함께 보냄, 2026-10-13) |

**병원 문의** (2026-10-12)

| 코드 | HTTP | 문구 |
|---|---|---|
| `HOSPITAL_INQUIRY_NOT_FOUND` | 404 | 문의를 찾을 수 없어요 (없는 문의 **와** 담당·본인 범위 밖 문의 모두 — §3) |
| `OPERATOR_CANNOT_ANSWER` | 403 | 운영자는 병원을 대신해 답변할 수 없어요 |
| `INQUIRY_ALREADY_ANSWERED` | 409 | 이미 답변한 문의예요. 답변 수정은 아직 지원하지 않아요 |
| `TOPIC_REQUIRED` | 422 (detail) | 문의 주제를 선택해주세요 |
| `CONTENT_TOO_SHORT` | 422 (detail) | 문의 내용을 5자 이상 입력해주세요 / 답변 내용을 5자 이상 입력해주세요 |
| `CONTENT_TOO_LONG` | 422 (detail) | 문의 내용은 1000자까지 쓸 수 있어요 |
| `ANSWER_PUBLIC_REQUIRED` | 422 (detail) | 이 답변을 공개할지 선택해주세요 |

**커뮤니티 / 콘텐츠 / geo**

| 코드 | HTTP | 문구 |
|---|---|---|
| `POST_NOT_FOUND` | 404 | 질문을 찾을 수 없어요 |
| `GUIDE_NOT_FOUND` | 404 | 꿀팁 정보를 찾을 수 없어요 |
| `LEGAL_DOCUMENT_NOT_FOUND` | 404 | 아직 등록되지 않은 문서예요 |
| `GEOCODING_UPSTREAM_ERROR` | 502 | 주소 검색 서비스가 일시적으로 응답하지 않아요. 잠시 후 다시 시도해주세요 |

### 화면의 "결과 없음" 은 에러가 아니다

- 검색 결과 없음 → `200` + `target: null`. 화면은 회색 안내 상자를 보여줄 뿐이다.
- 조건에 맞는 병원 없음 → `200` + `items: []`, `totalItems: 0`. 화면 문구 `조건에 맞는 병원이 없어요`.
- 주소 검색 결과 없음 → `200` + `[]`.
- 알림 없음 → `200` + `items: []`. 화면 문구 `아직 도착한 알림이 없어요`.

빈 결과를 404 로 만들면 클라이언트가 정상 흐름을 에러 경로로 처리하게 된다.

---

## 12. 프론트엔드 api 함수 → 엔드포인트 매핑

`frontend/src/features/{f}/api/` 의 함수 시그니처를 **최대한 보존한다.**
`hospitalApi.ts` 의 주석대로 "이 파일 내부만 HTTP 호출로 바꾸고 훅과 페이지는 손대지 않는" 것이 목표다.

### 이미 존재하는 함수 (`features/hospital/api/hospitalApi.ts`)

| 함수 | 엔드포인트 | 시그니처 보존 | 어댑터에서 하는 일 |
|---|---|---|---|
| `fetchHospitals(): Promise<Hospital[]>` | `GET /hospitals?pageSize=100` | ✅ 그대로 | 응답 envelope 에서 `items` 를 꺼내 반환 |
| `fetchHospitalById(id): Promise<Hospital \| null>` | `GET /hospitals/{id}` | ✅ 그대로 | `404` 를 `null` 로 변환 (throw 하지 않는다 — 화면이 `병원 정보를 찾을 수 없어요` 를 보여주는 경로다) |
| `createHospital(hospital): Promise<Hospital>` | `POST /hospitals` | ⚠️ 인자 축소 | 지금은 완성된 `Hospital` 을 받는다. 서버가 `id`·집계·광고 필드를 정하므로 요청 본문에서 그것들을 **빼고** 보낸다. 시그니처는 유지하되 무시되는 필드가 생긴다. 정리는 아래 신설 함수 참고 |
| `updateHospital(id, patch): Promise<Hospital>` | `PATCH /hospitals/{id}` | ✅ 그대로 | `patch` 를 그대로 본문에. 쓰기 불가 필드가 섞여 있으면 `422` → 던진다 (현재도 없는 id 에 throw 한다) |

**`fetchHospitals()` 가 배열을 반환하는 것을 유지한 방법:** 서버는 envelope 을 주고
어댑터가 `body.items` 를 꺼낸다. `pageSize=100` 으로 현재 규모(병원 11곳)를 한 번에 덮는다.
필터·정렬·페이지네이션을 실제로 쓰게 되면 아래 신설 함수를 추가하고, `fetchHospitals()` 는
"전량 조회" 용도로 남는다 (기존 호출부를 깨지 않는다).

### 계획된 함수 (`docs/superpowers/plans/2026-08-12-frontend-stack-alignment.md`)

이 함수들은 아직 목 DB 를 읽지만 시그니처가 이미 정해져 있다. 그에 맞춰 엔드포인트를 설계했다.

| feature | 함수 | 엔드포인트 | 비고 |
|---|---|---|---|
| doctor | `fetchDoctors(): Promise<Doctor[]>` | `GET /doctors?pageSize=100` | `items` 꺼내기 |
| doctor | `fetchDoctorById(id): Promise<Doctor \| null>` | `GET /doctors/{id}` | `404` → `null` |
| doctor | `fetchDoctorsByHospital(hospitalId): Promise<Doctor[]>` | `GET /hospitals/{hospitalId}/doctors` | 그대로 |
| doctor | `updateDoctor(id, patch): Promise<Doctor>` | `PATCH /doctors/{id}` | 그대로 |
| doctor | (`useVerifySpecialist`) | `PUT /doctors/{id}/verification` | 인자: `{ id, status, rejectionReason? }` |
| consult | `fetchConsultRequests(): Promise<ConsultRequest[]>` | `GET /consult-requests?pageSize=100` | **담당 병원으로 스코프된다.** 시그니처는 그대로지만 반환 내용이 줄어든다 (보안 수정). `operator` 호출 시 `name`/`phone` 이 마스킹되고 `piiMasked: true` 가 붙는다 |
| consult | `fetchConsultRequestById(id)` | `GET /consult-requests/{id}` | `404` → `null`. **담당 병원 밖의 상담도 `404` 다** (열거 방지) |
| consult | `createConsultRequest(input & { hospitalId })` | `POST /consult-requests` | `doctorId` 추가. **반환 타입이 `MyConsultRequest` 다** (`memos` 없음) — 신청자에게 내부 메모를 주지 않는다 |
| consult | `updateConsultStatus(id, status)` | `PATCH /consult-requests/{id}/status` | 그대로 |
| consult | `addConsultMemo(id, content)` | `POST /consult-requests/{id}/memos` | 그대로 |
| community | `fetchCommunityPosts(): Promise<QAPost[]>` | `GET /community/posts?pageSize=100` | ⚠️ 응답이 `QAPostSummary[]`(answers 없음, answerCount 있음). 목록 카드는 `답변 N` 만 쓰므로 화면은 영향 없지만 **타입을 좁혀야 한다** |
| community | `fetchCommunityPostById(id)` | `GET /community/posts/{id}` | `404` → `null` |
| community | `createCommunityPost(input & { authorName })` | `POST /community/posts` | ⚠️ **`authorName` 을 보내지 않는다.** 서버가 토큰에서 정한다. 인자에서 제거해야 한다 |
| community | `incrementPostView(id): Promise<void>` | `POST /community/posts/{id}/views` | 반환값을 `{ viewCount, viewCounted }` 로 쓰면 낙관적 갱신이 정확해진다 (선택) |
| notification | `fetchNotifications(audience)` | `GET /notifications?audience={audience}` | `items` 꺼내기. `unreadCount` 도 함께 오므로 배지 계산이 불필요해진다 |
| notification | `addNotification(input)` | **없음 (삭제)** | 알림은 서버 부수효과로만 생긴다. `services/notifications.ts` 의 `notifyUser`/`notifyAdmin` 과 함께 사라진다 |
| notification | `markNotificationAsRead(id)` | `PATCH /notifications/{id}/read` | 그대로 |
| notification | (`markAllAsRead(audience)`) | `POST /notifications/read-all` | 본문 `{ audience }` |
| content | `fetchGuides()` | `GET /guides?pageSize=100` | `items` 꺼내기 |
| content | `fetchPromotions()` | `GET /promotions` | 벌거벗은 배열 |
| procedure | `fetchProcedures()` | `GET /procedures` | 벌거벗은 배열. 계획은 `getProcedureById` 를 동기 조회로 유지한다 — 캐시된 목록에서 찾으면 된다 |
| favorites | `useFavorites()` (Zustand) | `GET /me/favorites`, `PUT`/`DELETE /me/favorites/{id}` | ⚠️ **Zustand 로컬 상태에서 서버 상태로 바뀐다.** 계정별이 되면서 서버 소유가 되므로 TanStack Query 로 옮겨야 한다. 계획의 "favorites 는 서버 상태가 아니다" 전제가 뒤집힌다 |
| search | `useSearch(query)` | `GET /search/resolve?q=`, `GET /search?q=` | 계획의 `useSearch` 는 클라이언트 필터다. resolve 로 대체된다 |
| auth | `signUp` / `logIn` / `logOut` (Zustand) | `POST /auth/signup` / `login` / `logout` | ⚠️ 동기 → 비동기. `AuthResult` 반환은 유지 가능하다 (`{ ok: false, message }` 에 `error.message` 를 그대로 넣는다) |
| auth | (`useSession()`) | `GET /auth/me` | `role`·`managedHospitalIds` 가 서버에서 온다. `VITE_ADMIN_EMAILS` allowlist(`config/adminAllowlist.ts`)는 삭제된다. ⚠️ **`UserRole` 이 `[user, admin]` → `[user, hospital_admin, operator]` 로 바뀐다.** 계획 문서(Task 7)의 `'admin'` 리터럴과 Task 8 의 `guard: 'admin'` 을 함께 고쳐야 한다 |
| geo | `searchAddress(query)` | `GET /geo/address-search?query=` | ✅ 시그니처 그대로. 목 폴백 제거, `VITE_KAKAO_REST_API_KEY` 삭제 |

### 신설이 필요한 함수

| feature | 함수 | 엔드포인트 | 지원 화면 |
|---|---|---|---|
| hospital | `fetchHospitalPage(params): Promise<{ items, meta }>` | `GET /hospitals` | 병원 탐색 (필터·정렬·페이지네이션) |
| hospital | `fetchManagedHospitals()` | `GET /admin/hospitals` | 관리자 홈 |
| hospital | `replaceHospitalDoctors(hospitalId, doctors)` | `PUT /hospitals/{id}/doctors` | 관리자 병원 폼 |
| hospital | `fetchHospitalReviews(hospitalId)` | `GET /hospitals/{id}/reviews` | 병원 상세 |
| doctor | `fetchVerificationQueue()` | `GET /doctors/verification-queue` | 전문의 인증 검수 |
| doctor | `deleteDoctor(id)` | `DELETE /doctors/{id}` | 관리자 병원 폼 |
| consult | `fetchMyConsultRequests()` | `GET /me/consult-requests` | **마이페이지 (신설 화면)** |
| consult | `fetchMyConsultRequestById(id)` | `GET /me/consult-requests/{id}` | 마이페이지, 사용자 알림 이동 |
| consult | ~~`fetchConsultSummary()`~~ | `GET /consult-requests/summary` | **소비 화면 없음** — 프런트 함수·훅은 2026-10-13 에 제거됐다. 병원 관리자 홈은 `GET /admin/dashboard`, 운영자 홈은 상담 숫자를 쓰지 않는다 (§14) |
| community | `createCommunityAnswer(postId, content)` | `POST /community/posts/{id}/answers` | **커뮤니티 답변 (신설 화면)** |
| notification | `fetchUnreadCount(audience)` | `GET /notifications/unread-count` | 마이페이지·관리자 홈 배지 |
| content | `fetchLegalDocument(slug)` | `GET /legal-documents/{slug}` | 약관 3종, 소개 |
| search | `fetchTrendingSearches(tab, limit)` | `GET /search/trending` | 검색, 홈 |
| search | `fetchSearchSuggestions()` | `GET /search/suggestions` | 검색 |
| support | `createPartnerInquiry(input)` | `POST /partner-inquiries` | 병원 입점 문의 |

### 역할 결정으로 새로 필요해진 함수 (운영자 콘솔용 — 화면 미존재 🚧)

| feature | 함수 | 엔드포인트 |
|---|---|---|
| operator | `fetchPartnerInquiries(params)` | `GET /partner-inquiries` |
| operator | `fetchPartnerInquiry(id)` | `GET /partner-inquiries/{id}` |
| operator | `reviewPartnerInquiry(id, input)` | `PATCH /partner-inquiries/{id}` |
| operator | `fetchHospitalAdmins(hospitalId)` | `GET /hospitals/{id}/admins` |
| operator | `assignHospitalAdmin(hospitalId, email)` | `POST /hospitals/{id}/admins` |
| operator | `unassignHospitalAdmin(hospitalId, userId)` | `DELETE /hospitals/{id}/admins/{userId}` |

`frontend/src/features/operator/` 슬라이스가 새로 생긴다. 계획 문서(`docs/superpowers/plans/...`)에는
없는 슬라이스이며, Task 8(인가 가드)이 3개 역할을 다루게 되면서 함께 필요해진다.

---

## 13. 깨진 것 7개의 해결 경로

| # | 깨진 것 | 해결 엔드포인트 | 어떻게 |
|---|---|---|---|
| 1 | **사용자가 자기 상담 신청 내역을 조회할 수 없다** | `GET /me/consult-requests`<br>`GET /me/consult-requests/{id}` | `POST /consult-requests` 가 토큰의 `sub` 를 `userId` 로 기록한다. 그것이 조회 경로의 근거다. 응답은 `MyConsultRequest` 투영으로 **내부 메모를 제외**하고, 병원명·전문의명·병원 사진을 함께 준다 (신청자는 id 를 모른다). 마이페이지·로그인 화면의 `상담 신청 내역을 확인할 수 있어요` 문구가 참이 된다 |
| 2 | **전문의 지정 상담에서 어느 전문의인지 전달되지 않는다** | `POST /consult-requests` 의 `doctorId` | 병원 상세·전문의 상세의 `전문의 상담신청` 이 `doctorId` 를 채워 보낸다. 서버가 병원 소속인지 검증한다 (`422 DOCTOR_NOT_AT_HOSPITAL`). 관리자 응답에 `doctorId`·`doctorName` 이 실려 상담 상세에서 지목된 전문의가 보인다. `남기고 싶은 말` 칸에 적는 우회가 사라진다 |
| 3 | **찜 목록이 브라우저 전역이라 계정 간 유출** | `GET /me/favorites`<br>`PUT /me/favorites/{hospitalId}`<br>`DELETE /me/favorites/{hospitalId}` | 찜이 **서버의 계정 소유 리소스**가 된다. A 로 찜 → 로그아웃 → B 로그인 하면 B 의 목록은 비어 있다. 로그아웃 시 클라이언트가 `['me']` 캐시를 비우면 잔상도 남지 않는다. `PUT`/`DELETE` 는 멱등이라 하트 오탭에 안전하다 |
| 4 | **알림이 계정별로 나뉘지 않는다** | `GET /notifications?audience=`<br>`GET /notifications/unread-count` | 알림에 수신자가 붙는다. `audience=user` → 토큰 주체 본인, `audience=admin` → **담당 병원의 담당자**. 상태 변경 알림은 상담의 `userId` 에게만 가므로 **담당자 자신의 알림함에 들어오지 않는다.** `audience=admin` 조회에 `hospital_admin`/`operator` 를 요구해 일반 사용자가 관리자 알림(고객 이름 포함)을 볼 수 없게 한다. 비로그인으로 `/notifications` 를 열어 목록이 보이던 것도 `401` 로 막힌다 |
| 5 | **커뮤니티 답변을 쓸 수 없다** | `POST /community/posts/{postId}/answers` | 답변 리소스에 쓰기 경로가 생긴다. **`isDentist` 를 요청으로 받지 않는다** — 서버가 작성자의 `verificationStatus=approved` 전문의 연결 여부로 유도한다. `치과의사 답변` 배지는 신뢰 표시라서 클라이언트가 정할 수 있으면 안 된다 (지금은 샘플 데이터의 플래그일 뿐 실제 인증과 무관하다) |
| 6 | **전문의 인증 검수 결과가 병원에 통보되지 않는다** | `PUT /doctors/{doctorId}/verification` (**`operator` 전용**) | 결정 저장과 **같은 트랜잭션**에서 그 전문의 소속 병원의 **담당자 전원**에게 `audience=admin`·`type=system` 알림을 만든다 (`relatedResource=doctor`, `relatedId=doctorId`). 승인·반려 모두 발송하고 반려 시 사유를 문구에 담는다. 검수 기록(누가·언제·어떤 사유)은 감사 로그에 남는다 — 지금은 반려 사유만 남고 승인하면 그것도 지워진다. 담당자가 아직 지정되지 않은 병원이면 수신자가 0명이 되지만 승인 자체는 성공한다 |
| 7 | **상담 마감 병원에 주소로 직접 들어가면 접수된다** | `POST /consult-requests` → `409 CONSULT_CLOSED` | 서버가 `hospital.consultAvailable` 을 검사한다. `/consult/:hospitalId` 로 직접 들어와도 제출이 거부된다. 클라이언트 버튼 잠금은 **UX**, 서버 검사는 **규칙**이다. 함께 있어야 한다 |

### 함께 해결되는 것들

| 결함 | 해결 |
|---|---|
| 관리자 화면에 로그인 검사가 없다 | 모든 관리자 오퍼레이션에 인증 + 역할 + 담당 범위 3층 검사 (§3) |
| 병원 관리자가 남의 병원 전문의를 심사한다 | 검수를 `operator` 전용으로 (§3) |
| 아무나 병원을 만들 수 있다 | `POST /hospitals` 를 `operator` 전용으로, 입점 심사 선행 (§3) |
| 운영자가 볼 필요 없는 고객 연락처를 본다 | 상담 응답의 PII 마스킹 + `piiMasked` (§4) |
| 담당자의 고객정보 열람이 기록되지 않는다 | `GET /consult-requests/{id}` 열람 감사 로그 (§4) |
| 비밀번호가 브라우저에 평문 저장 | 서버가 bcrypt/argon2 해시로 저장. `POST /auth/signup` |
| 같은 상태를 다시 눌러도 이력·알림이 중복 | `PATCH .../status` 가 no-op (§9) |
| 승인된 전문의의 전공을 바꿔도 재검수되지 않는다 | `PUT /hospitals/{id}/doctors`, `PATCH /doctors/{id}` 가 `specialty`/`certificateUrl` 변경 시 `pending` 복귀 |
| 전문의 이름을 비우면 삭제된다 | `DoctorUpsert.name` 이 `minLength: 1` → `422` |
| 커뮤니티 조회수가 방문마다 오른다 | `POST .../views` 가 24시간 중복 제거 (동작 변경 → §17) |
| 커뮤니티 글 작성자가 항상 `익명`, 로그인 검사 없음 | `POST /community/posts` 가 인증 필수 + 서버가 `authorName` 결정 + `isMine` 제공 |
| 연락처 형식을 검사하지 않는다 | `phone` 패턴 검증 |
| 관리자 알림 이동이 종류를 구분하지 않는다 | `AppNotification.relatedResource` 신설 |
| `일반의` 가 검수 목록에 포함된다 | `GET /doctors/verification-queue` 가 기본 제외 |
| 병원 목록·검수 목록이 0건일 때 빈 화면 | `meta.totalItems: 0` 으로 클라이언트가 안내 문구를 그릴 수 있다 (화면 작업) |
| `이번 달 신규 상담` 이 항상 0 | 기간 집계를 서버가 `Asia/Seoul` 기준으로 계산. 샘플 데이터 날짜 문제는 별개<br>(그 카드는 요청 05 에서 `GET /admin/dashboard` 의 `newThisMonth` 로 옮겨갔다 — `GET /consult-requests/summary` 가 아니다, §14) |
| 의사를 검색하면 병원 화면으로 간다 | `GET /search/resolve` 가 `kind=doctor` + `doctorId` 를 준다 (이동 대상은 제품 결정 → §17) |
| 추천 검색어 알약 5개가 죽어 있다 | `GET /search/suggestions` 가 `term` 과 `target` 을 분리 (§7) |
| 카카오 REST 키가 브라우저에 노출 | `GET /geo/address-search` (§10) |
| 마이페이지의 관리자 링크가 누구에게나 보인다 | `GET /auth/me` 의 `role` 로 링크 자체를 숨긴다 (§3) |

### API 가 고칠 수 없는 것

| 결함 | 왜 |
|---|---|
| 검색으로 들어가면 홈으로 못 돌아간다 | 클라이언트 라우팅 문제. `q` 파라미터 자동 실행이 뒤로 가기와 싸운다 |
| 지도가 보이지 않는다 | `VITE_KAKAO_MAP_JS_KEY` 환경 설정 |
| **수정** 화면에서 대표 이미지를 바꿔도 상세 캐러셀이 안 바뀐다 | 폼이 `images` 배열을 편집하지 않는다. `PATCH /hospitals/{id}` 에 `images` 가 있으니 **폼이 보내면 고쳐진다** — 화면 작업. **등록** 화면은 2026-08-14 에 `images: [thumbnail]` 을 보내도록 고쳤다(캐러셀이 비지는 않는다) — 남은 것은 수정 화면뿐이다 |
| 뒤로 가기 버튼 두 개 / 카드 여백 / 헤더 제목 빔 | 순수 UI |
| 이벤트에 기간 정보가 없다 | 데이터 자체에 없다. `Promotion.startsAt`/`endsAt` 스키마는 준비했지만 값을 채우는 것은 콘텐츠 작업 |
| 회사 정보가 임시값 | 정적 설정값 |
| 앱 다운로드 QR·스토어 링크가 비어 있다 | 앱 출시 후 |

---

## 14. 테이블이 없는 엔드포인트 4개

`docs/database/` 스키마는 "화면 문서에 근거 없는 테이블은 만들지 않는다" 는 원칙으로 설계됐다.
이 API 에는 🚧 기능을 위해 설계한 엔드포인트가 있어서 **간극이 생겼다.** 조정 결과를 여기 남긴다.

### 코드 상수로 서빙 — 테이블 없음 (확정)

| 엔드포인트 | 초기 구현 | 데이터 출처 |
|---|---|---|
| `GET /search/trending` | **정적 데이터.** 테이블 없음 | `frontend/src/mocks/fixtures/trendingSearches.ts` 의 내용이 백엔드 상수로 이동 |
| `GET /search/suggestions` | **정적 데이터.** 테이블 없음 | 같은 파일의 `SPONSORED_SEARCH_SUGGESTIONS` |

**API 계약은 그대로 둔다.** 응답 스키마·파라미터가 정적 구현과 DB 구현에서 동일하므로,
나중에 테이블이 생겨도 클라이언트는 아무 변화를 느끼지 않는다. 이것이 계약을 먼저 정하는 이점이다.

정적 구현이라도 **서버로 옮기는 것 자체에 의미가 있다:**

- `target` 을 함께 내려줄 수 있어 **죽어 있는 광고 알약 5개가 살아난다** (§7). 클라이언트 상수로는 불가능하다 —
  현재 fixture 에는 `SPONSORED_SEARCH_SUGGESTIONS` 가 문자열 배열일 뿐 `target` 이 없다.
- `calculatedAt` 을 실제 값으로 줄 수 있다. 지금 `14:32 기준` 은 화면을 연 시각이다 (§18-8).
- 앱 배포 없이 문구를 바꿀 수 있다. 광고 지면이라 이게 특히 중요하다.

**주의:** 정적 구현 단계에서는 `trendingSearches.ts` 의 `hospitalId`/`doctorId` 가 시드 데이터의 id
(`h1`, `d1` …)에 하드코딩되어 있다. 실데이터로 넘어가면 그 id 들이 존재하지 않아 `target` 이 깨진 링크가 된다.
서버는 **응답 시점에 대상 존재를 검증하고, 없는 항목은 조용히 제외**해야 한다.
(꿀팁의 `relatedHospitalIds` 에 이미 적용한 규칙과 같다)

### 기능 구현 시점에 테이블 추가 (요구사항 전달)

`docs/database/README.md` 의 "제안 3. `partner_inquiries`", "제안 4. `legal_documents`" 가 이것을 받는다.
초안에서는 "폼 항목이 정해지지 않아 컬럼을 추측할 수 없다" 였는데, **이제 정해졌다** — 이 스펙의 요청 스키마가
폼 항목이다.

#### `partner_inquiries`

역할 결정으로 **심사 흐름이 확정되었으므로 상태 컬럼이 필수다.** 접수만 받는 테이블이 아니다.

```
partner_inquiries
  id                  pk
  hospital_name       varchar, not null          -- 필수
  contact_name        varchar, not null          -- 필수. 개인정보
  phone               varchar, not null          -- 필수. 개인정보. 병원 대표번호도 오므로
                                                 -- 휴대폰보다 완화된 패턴
  email               varchar, null
  region              varchar, null
  message             text, null
  status              varchar, not null          -- received | reviewing | approved | rejected
                                                 -- 종결 상태에서 되돌아갈 수 없다 (앱 검증)
  review_note         text, null                 -- status='rejected' 면 not null 이어야 한다 (앱 검증)
  reviewed_by_user_id fk → users.id, null        -- 심사한 operator
  reviewed_at         timestamp, null
  linked_hospital_id  fk → hospitals.id, null    -- 이 문의로 만들어진 병원.
                                                 -- 승인이 곧 생성은 아니므로 생성 후 연결
  received_at         timestamp, not null

  Indexes
    (status, received_at)                        -- 운영자 심사 대기 목록
    received_at
```

주의점:
- **개인정보 테이블이다.** `contact_name`/`phone` 이 담긴다. 상세 열람이 감사 로그 대상이다.
- `linked_hospital_id` 를 `hospitals` 쪽이 아니라 여기 두는 이유: 문의 없이 만들어진 병원도 있을 수 있고
  (초기 데이터 이관), 문의:병원이 1:1이 아닐 수 있다 (반려 후 재문의).
- 보존 기간 정책이 필요하다. 반려된 문의의 개인정보를 영구 보관할 이유가 없다.

#### `legal_documents` (+ `user_agreements`)

```
legal_documents
  id            pk
  slug          varchar, not null      -- terms | privacy | location | about
  version       varchar, not null      -- '1.0'. 회원가입 동의 기록이 이 값을 가리킨다
  title         varchar, not null
  content       text, not null         -- 마크다운
  effective_at  timestamp, not null    -- 시행일
  created_at    timestamp, not null

  Indexes
    (slug, version) unique
    (slug, effective_at)               -- "지금 유효한 버전" 조회
```

`GET /legal-documents/{slug}` 는 **`effective_at <= now()` 인 것 중 가장 최신 버전**을 반환한다.
`about` 은 법적 문서가 아니지만 같은 구조(버전·본문)로 다루는 것이 화면 하나를 줄인다.

동의 이력은 별도 테이블이 필요하다 (§17-7 이 확정되면):

```
user_agreements
  id                 pk
  user_id            fk → users.id, not null
  legal_document_id  fk → legal_documents.id, not null
  agreed_at          timestamp, not null

  Indexes
    (user_id, legal_document_id) unique
    user_id
```

`SignUpRequest.agreedTermsVersions` 가 이 테이블을 채운다. 지금은 선택 필드이고,
약관 동의 절차가 도입되면 필수가 된다.

#### `audit_logs`

§4 의 "필요한 테이블 요구사항" 에 전체 정의가 있다. 역할·PII 결정에 딸려오는 필수 테이블이며,
`docs/database/README.md` 의 "제안 8" 이 이것을 받는다.

#### `hospital_inquiries` (2026-10-12 추가)

`docs/features/requests/2026-10-12-03-문의-기능-신규.md` 가 요구하는 **새 도메인**이다.
위 셋과 달리 초안에 없던 기능이라 이 절 제목의 "4개" 밖에 있다 — 2026-08-12 시점의 수를 보존하려고
제목은 그대로 두고 여기에 덧붙인다. 받는 곳은 `docs/database/` 의 새 테이블과
`backend/prisma/schema.prisma` 다 (2026-10-12 에는 백엔드가 협업자 영역이라 **요구사항만 전달했다**.
**2026-10-21 개정 — 혼자 개발 체제**: 서버도 이 저장소에서 직접 만들고, 이 요구사항을 받아
구현하는 것은 **요청서 16**(문의·찜·대시보드 서버로)이다).

읽는 화면은 셋이고 **테이블은 하나다.** 병원 상세 `문의` 탭(공개 Q/A), 사용자 `문의하기`·마이페이지
`내 문의`, 병원 관리자 `문의` 화면.

```
hospital_inquiries
  id                   pk
  hospital_id          fk → hospitals.id, not null, Restrict   -- 문의 대상 병원
  user_id              fk → users.id, not null, Restrict       -- 문의자. 작성 화면이 로그인을 강제한다
  topic                varchar, not null       -- price | hours | parking | procedure | etc
                                               -- 화면 라벨(가격 / 진료시간 / 주차·위치 / 시술 방법 / 기타)은
                                               -- 앱이 붙인다. **기본값 없음** — 고르지 않으면 제출 불가
  content              text, not null          -- 5~1000자 (trim 후, 앱 검증)

  is_public_by_user    boolean, not null, default true
                                               -- 작성 화면의 '다른 사람도 볼 수 있게 공개' (기본 켜짐)

  answer_content       text, null              -- 5~1000자. 미답변이면 null
  answer_public        boolean, null           -- ☆ 답변 시점에 **병원**이 고른 공개 허용 여부.
                                               --   미답변이면 null (아래 '왜 nullable 인가')
  answered_by_user_id  fk → users.id, null, Restrict  -- 답변을 등록한 담당자
  answered_at          timestamp, null         -- ★ 상태 판정의 유일한 근거

  created_at           timestamp, not null

  Indexes
    (hospital_id, answered_at)   -- 관리자 탭 카운트 · 미답변 배지 · 공개 Q/A 목록(answered_at DESC)
    (hospital_id, created_at)    -- 관리자 '전체' 탭 최신순
    (user_id, created_at)        -- 마이페이지 '내 문의'
    (created_at)                 -- operator 의 전 병원 목록 (병원 필터가 없는 유일한 질의)
```

**파생 규칙은 순수 함수 두 개이고 파일 하나에 있다** (`hospital/inquiry-visibility.ts` 정도).
카운트 질의·목록 질의·상세 투영이 **전부 이 둘을 쓴다.** 병원 카드 배지가 두 곳에서 갈렸던 전례
(AGENTS.md)가 여기서 더 위험하다 — 한쪽만 틀리면 **비공개 문의가 공개 목록에 뜬다.**

```ts
// 상태: 저장하지 않고 파생한다
inquiryStatus(i) = i.answeredAt === null ? 'unanswered' : 'answered'

// 공개 Q/A 노출: 환자·병원 둘 다 동의 + 답변완료
isPubliclyVisible(i) =
  i.isPublicByUser === true &&
  i.answerPublic === true &&
  inquiryStatus(i) === 'answered'
```

마지막 조건은 `answerPublic` 이 null 이 아닌 것과 사실상 같지만 **그대로 남긴다.** 읽는 사람이
"답변 전에도 공개될 수 있나" 를 함수 본문에서 바로 확인할 수 있어야 하고, `answerPublic` 의
nullable 규칙이 나중에 바뀌어도 노출 조건은 그대로여야 한다.

**상태를 컬럼으로 두지 않는 이유.** `doctors.verification_status` 는 **다른 테이블의 최신 행**을
캐시한 것이라 컬럼이 값을 한다. 여기서는 근거(`answered_at`)가 **같은 행**에 있다 —
컬럼을 더하면 같은 사실의 복사본이 두 개가 되고, 둘이 어긋날 때 무엇이 맞는지 정할 방법이 없다.
`WHERE answered_at IS NULL` 은 `(hospital_id, answered_at)` 인덱스가 그대로 받는다.

**`answer_public` 이 nullable 인 이유.** `not null default false` 로 두면 **"아직 안 물어봤다"** 와
**"병원이 비공개를 골랐다"** 가 같은 값이 된다. `audit_logs.pii_masked` 를 nullable 로 둔 것과 같은
판단이다. 미답변 행의 이 값은 존재하지 않는 사실이다.

**답변을 자식 테이블로 빼지 않은 이유.** 문의 1건에 답변 1건이고 수정이 없다. 자식 테이블은
조인 하나와 "0 또는 1행" 이라는 애플리케이션 불변식을 추가로 만들 뿐이다.
**답변 수정이 허용되면 그때 `hospital_inquiry_answers` 로 분리해 이력을 남긴다** (§4 감사 절도 같은
조건을 건다). 그 전까지 `POST .../answer` 는 `answered_at IS NULL` 조건부 쓰기라서,
동시 요청 두 개 중 하나만 성공하고 알림도 한 번만 나간다.

**이번 버전에서 답변 수정은 허용하지 않는다.** 공개 Q/A 는 환자가 읽는 의료광고 성격 문구이고,
"답변이 왔어요" 알림을 받고 본 내용이 나중에 조용히 바뀌면 그 알림이 거짓이 된다.

**없는 컬럼과 그 이유:**

| 두지 않은 것 | 왜 |
|---|---|
| `title` | 화면이 **본문 첫 줄**을 제목으로 쓴다. 입력칸이 없는 값을 저장하면 두 값이 어긋난다 |
| `status` | 위 — `answered_at` 에서 파생 |
| `updated_at` | 행이 바뀌는 사건이 '답변 등록' 하나뿐이고 그 시각은 `answered_at` 이 이미 들고 있다. `updated_at` 을 두면 "갱신될 수 있는 행" 이라는 틀린 신호가 스키마에 남는다 |
| `deleted_at` | 문의·답변을 지우는 화면이 없다. 신고·삭제가 생기면 그때 추가한다 |
| `read_at` / 관리자 읽음 상태 | 요청서의 `안 읽은 수` 배지를 **미답변 수**로 해석했다. 읽음을 따로 저장하려면 (관리자 × 문의) 테이블이 필요한데, 담당자가 여럿일 때 누구 기준인지 화면이 정의하지 않았다. 미답변 수는 담당자가 누구든 같은 숫자다 |
| `name` / `phone` | §4 — 문의는 연락처 없는 창구다. 이름은 `users` 조인 + 항상 마스킹 |

**FK 정책:** `hospital_id`·`user_id` 는 `Restrict` (`consult_requests` 와 같다 — 둘 다 soft delete 대상이라
물리 삭제가 일어나지 않고, 일어난다면 막아야 한다). `answered_by_user_id` 도 `Restrict`
(`doctor_verifications.reviewed_by_user_id` 와 같은 정책 — "이 결정을 누가 했는가" 필드의 FK 정책이
테이블마다 다르면 감사 때 한쪽만 행위자가 사라진다).

**카운트 세 벌 — 모집단이 서로 다르다. 이것이 이 설계에서 가장 틀리기 쉬운 곳이다.**

| 화면 | 숫자 | 모집단 |
|---|---|---|
| 병원 상세 `문의 N건 · 답변 N` | `문의 N` = `is_public_by_user = true` 인 문의 수<br>`답변 N` = 그중 `isPubliclyVisible` 인 수 | **환자가 공개로 남긴 문의만** |
| 관리자 탭 `미답변 N · 답변완료 N · 전체 N` | `answered_at IS NULL` / `IS NOT NULL` / 전체 | 담당 병원의 **모든** 문의 (공개 여부 무관) |
| 관리자 홈 배지 | `answered_at IS NULL` 인 수 | `managedHospitalIds` 전체 합. **`operator` 에게는 숫자를 붙이지 않는다** — 답할 수 없는 역할에게 "할 일 N건" 을 보여주는 셈이라서다(`summary.scope === 'all'` 이면 화면이 숫자를 생략) |

**공개 카운트가 전체 건수가 아닌 이유.** 전체를 세면 비공개 문의 볼륨이 샌다 — "이 병원에 문의가
40건인데 Q/A 는 3개" 는 비공개 37건을 말해 준다. 모집단을 공개 문의로 좁히면 그 수가 새지 않으면서도
`문의 N − 답변 N` 이 **"공개로 물었는데 아직 답이 없는 건수"** 라는 쓸모 있는 응답성 신호로 남는다.

**병원이 비공개로 답한 건을 `답변 N` 에 세지 않는 이유.** 세면 `답변 N` 과 목록에 실제로 보이는 Q/A
개수가 어긋난다. `답변 N` 은 항상 **아래 목록의 길이**여야 한다. 대가로 비공개 답변은 그 병원에
불리하게 집계되는데, 환자 시야에서는 "공개로 물었지만 아직 볼 수 없는 문의" 가 맞다.

**정하지 않은 것 (기능 구현 전에 필요해지면 그때):**

- **도배 방지.** 같은 사용자가 같은 병원에 연속으로 문의하는 것을 막는 규칙이 없다. 1차 방어선은
  §16 의 요청 한도다. 테이블은 `(user_id, created_at)` 인덱스로 "최근 N분 내 내 문의 수" 를 받을 수 있다
- **보존 기간.** 문의에는 연락처가 없지만 본문에 환자가 증상·예산을 적는다. 탈퇴(soft delete) 계정의
  **공개 Q/A 를 계속 노출할지**가 미결이다 (작성자 표기가 없어 식별 위험은 낮은 쪽이다)
- **신고·숨김.** 부적절한 문의/답변을 내리는 경로가 없다. 생기면 `deleted_at` 과 운영자 권한이 함께 온다

#### `consult_requests` 확장 — 상담 예약 (2026-10-13)

`docs/features/requests/2026-10-12-04-관리자-상담예약-개선.md` 가 요구하는 **기존 도메인의 확장**이다.
새 테이블은 없고 **기존 두 테이블에 컬럼이 붙는다.** 설계 판단과 근거는
`docs/database/README.md` §12 에 있고, 여기에는 **서버가 받을 요구사항**만 적는다
(2026-10-13 에는 백엔드가 협업자 영역이라 요구사항만 전달했다 — `hospital_inquiries` 와 같다.
**2026-10-21 개정 — 혼자 개발 체제**: 이 요구사항을 구현하는 것은 **요청서 15**(상담·알림 서버로)다).

```
consult_requests  (기존 테이블 — 컬럼 4개 추가)
  visit_at                           timestamp, null   -- ★ 확정 내원 일시. UTC 시각(달력 날짜 아님).
                                                       --   초·밀리초는 0 으로 절삭해 저장(입력 단위가 분)
                                                       --   status='booked' 로 들어갈 때 필수,
                                                       --   'visited' 로 가면 유지, 그 밖으로 나가면 null
  phone_digits                       varchar, not null -- 숫자만 남긴 연락처('01012344411').
                                                       --   목록 검색 q 의 숫자 매칭 전용. 표시는 phone
  third_party_consent_agreed_at      timestamp, null   -- 이미 계약에 있으나 스키마에 없던 것(아래)
  third_party_consent_notice_version varchar,   null   -- 〃. 둘은 함께 채워지거나 함께 null

  Indexes  (추가 1개)
    (hospital_id, status, created_at)   -- 상태 탭 5개 카운트 + 탭 선택 목록(최신순).
                                        --   화면 진입마다 도는 질의다
  Indexes  (그대로 두는 것)
    (hospital_id, created_at)           -- '전체' 탭 최신순
    (status, created_at)                -- operator 전 범위 상태 필터, 홈의 '처리 대기 중인 상담'
    (user_id, created_at) / (created_at) / (doctor_id)

consult_status_changes  (기존 테이블 — 이제 '상태 변경' 이 아니라 '처리 이벤트' 를 담는다)
  event            varchar, not null, default 'status_change'
                                       -- 'status_change' | 'reschedule'
  visit_at         timestamp, null     -- ★ 이 이벤트 **직후**의 확정 일시 스냅샷
  cancel_reason    varchar, null       -- no_answer | patient_request | procedure_unavailable
                                       -- | duplicate | etc.  status='cancelled' 인 행에만
  notification_id  fk → notifications.id, null, SetNull
                                       -- 이 이벤트가 만든 환자 알림. 화면의 '환자 알림 발송' 배지
  (기존) status, changed_at, changed_by_user_id, consult_request_id

  Indexes  변화 없음 — (consult_request_id, changed_at)
```

**`ConsultStatus` 는 값을 하나 더한다. 기존 값은 그대로다.**
`new` `contacted` `booked` `cancelled` **+ `visited`**. 라벨만 `예약완료` → **`예약확정`** 으로 바뀐다
(라벨은 계약 설명과 클라이언트 매핑에만 있다 — 저장값이 아니다).
`booked` 를 `confirmed` 로 **개명하지 않는 이유**는 §15 가 이미 정해 두었다 — **enum 값 제거는 breaking**
(`v2` 사유)이고, 얻는 것은 이름뿐이다. 데이터 쪽 대가도 실재한다: 두 테이블의 과거 행 전부와
백엔드 시드가 import 하는 `frontend/src/mocks/fixtures/consultRequests.ts` 의 `booked` 값을 함께 고쳐야 하고,
그 fixture 는 프런트 파일이라 **DB 변경이 프런트 수정을 끌고 들어온다.**
`예약완료` 와 `예약확정` 은 같은 사실을 가리키는 두 라벨이지 두 상태가 아니다.

**전이는 전부 허용한다. 검증하는 것은 필수 입력뿐이다** (판정 함수는 `docs/database/README.md` §12.7).

| 들어가는 상태 | 필수 입력 | 없으면 |
|---|---|---|
| `booked` | `visitAt` (요청 본문 또는 **현재 행에 이미 있는 값**) | `422` (`details[].code: VISIT_AT_REQUIRED`) |
| `cancelled` | `cancelReason` (위 5개 코드 중 하나) | `422` (`CANCEL_REASON_REQUIRED`) |
| 그 밖 | 없음 | — |

전이표를 두지 않은 이유는 제품 결정이다 — 오기입 정정이 일상이고(`내원완료` 를 눌렀는데 안 왔다),
걸어 들어온 환자는 `신규` 에서 바로 `내원완료` 로 간다. **막을 전이를 찾지 못했다.**
금지 전이가 없으면 전이표는 "모두 허용" 한 줄이고, 그 한 줄을 테이블로 적으면 읽는 사람이
**있지도 않은 규칙을 찾게 된다.**

**신청자 투영(`MyConsultRequest`)에 내려가는 것과 내려가지 않는 것:**

| | 신청자 | 왜 |
|---|---|---|
| `visitAt` | **내려간다** | 마이페이지가 `10/9(금) 14:00` 을 보여준다. 요청서의 확인 항목이다 |
| `cancelReason` | **내려가지 않는다** | 병원의 **내부 처리 분류**다. `연락이 안 됨` 은 환자에게 비난으로 읽히고, 어느 화면도 환자에게 사유를 보여주지 않는다 |
| `statusHistory` 의 `reschedule` 행 | **내려가지 않는다** (`status_change` 행만, 각 행은 `{status, changedAt, visitAt}`) | 신청자 이력은 **상태의 흐름**을 보여주는 자리다. 일시 변경 사실은 알림으로 이미 전달됐고, 지금의 결과는 최상위 `visitAt` 이 들고 있다 |
| `notified` | **내려가지 않는다** | 자기가 받은 알림이다 |

**관리자 투영(`ConsultRequest`)에 더해야 하는 것:** `visitAt`, 파생 `cancelReason`,
`statusHistory[]` 의 `event` / `visitAt` / `cancelReason` / `notified`.
`cancelReason` 은 **현재 행에 저장하지 않고 이력에서 파생한다** (근거: `docs/database/README.md` §12.4).
`notified` 는 **boolean 으로만** 내려준다 — 알림 id 로 이동하는 화면이 없고, id 를 내리면 그 자리가
"알림 상세로 갈 수 있다" 는 약속이 된다.

**목록 필터 3개 — 어느 쪽이 서버인가** (§6 의 기준을 그대로 적용했다):

| 화면 | 판단 | 파라미터 |
|---|---|---|
| 기간 `오늘`/`이번 주`/`최근 30일` | **서버** — 경계가 `Asia/Seoul` 달력이고 기기 시계를 쓰면 안 된다 (`ConsultSummary.timezone` 과 같은 이유) | `period=today\|thisWeek\|last30` (새 선택 파라미터). 기존 `createdFrom`/`createdTo` 와 **함께 오면 `422`** — 서버가 둘 중 하나를 임의로 고르면 화면과 결과가 조용히 어긋난다 |
| 시술 9개 대분류 | **서버가 받는 것은 시술 id 다.** 대분류 → id 매핑은 클라이언트(`frontend/src/features/procedure/taxonomy.ts`)에 있다 — 서버는 13개 id 만 안다 | `procedureId` **반복 허용** (같은 파라미터 안에서는 OR, 다른 필터와는 AND). 대분류 하나가 서버 id 여러 개로 풀린다 |
| 검색 `q` | **서버** (개인정보·페이지네이션) | 기존 `q`. 이름은 `name` 부분일치, 숫자는 `phone_digits` 부분일치. **역할별 범위는 §4** |
| `지연` 배지 | **클라이언트** (아래) | 없음 |

**`지연`(신규 24시간 경과)은 서버가 계산하지 않는다.** 판정에 필요한 두 값(`status`, `createdAt`)이
이미 응답에 있고, 기준이 **시간대 없는 경과 시간**이라 기기 시계의 시간대 설정에 영향받지 않는다
(§6 이 서버로 보내는 기준은 "기기 시계에 의존하는 규칙" 인데, 24시간 경과는 분 단위 오차가 판정을
바꾸지 않는다). 서버가 `delayed: true` 를 내리면 **응답을 받은 순간부터 거짓이 되기 시작하는 값**이
캐시·화면에 남는다. 클라이언트는 순수 함수 하나로 판정한다 (`isDelayed`, `docs/database/README.md` §12.7).

> 뒤집히는 조건: **`지연` 이 탭·필터·카운트가 되는 순간.** 그때는 서버가 세야 하고,
> 컬럼은 여전히 필요 없다 — `status='new' AND created_at < now()-24h` 로 표현되고
> `(hospital_id, status, created_at)` 인덱스가 그대로 받는다.

**카운트 세 벌 — 모집단이 다르다** (`hospital_inquiries` 에서와 같은 함정이다).

| 화면 | 숫자 | 모집단 |
|---|---|---|
| 목록 상태 탭 `전체 42 · 신규 5 · …` | 상태별 건수 | **지금 걸린 필터(병원·기간·시술·검색)를 모두 적용하고 `status` 필터만 뺀 범위.** 그래야 탭을 눌러도 숫자가 흔들리지 않는다 |
| 관리자 홈 `처리 대기 중인 상담` | `status='new'` | 담당 병원 **전체**. 목록 화면의 필터와 무관하다 |
| 관리자 홈 `이번 달 신규 상담` | `created_at` ∈ 이번 달(KST) | 〃 |

탭 카운트는 **목록 응답에 함께** 싣는다 — 계약의 `statusCounts` 필드(`ConsultStatusCounts`). 같은 필터를 두 번
보내게 하면 두 응답이 서로 다른 시점을 가리키기 때문이다 —
`GET /consult-requests/summary` 를 재사용할 수 없는 이유가 그것이다(모집단이 다르다).

**제3자 제공 동의 컬럼은 "추가" 가 아니라 "밀린 것" 이다.** `ConsultThirdPartyConsent` 는 이미
`openapi.yaml` 의 응답 필수 필드인데 `backend/prisma/schema.prisma` 에 받을 컬럼이 없다.
이번 변경과 같은 마이그레이션에 묶어 닫는다. 두 컬럼 모두 nullable 인 이유는 계약이 적어 둔 그대로다 —
**`null` 은 거절이 아니라 절차 도입 이전 접수**이고 소급해 채울 방법이 없다.

**두지 않은 컬럼과 그 이유:**

| 두지 않은 것 | 왜 |
|---|---|
| `consult_requests.cancel_reason` | 이력 행에 있다. 현재 행의 값은 "현재 상태가 `cancelled` 일 때의 최신 취소 이벤트 사유" 로 **파생**되고, 재오픈 시 지우는 절차 자체가 없어진다 (§12.4) |
| `delayed` / `is_delayed` | 시간이 지나면 값이 바뀌는 파생값이다. 컬럼으로 두면 배치가 필요하고, 배치가 늦으면 틀린 배지가 보인다 |
| `source`(유입 화면) | **지금 수집하지 않는다.** 요청서도 "데이터가 없으면 빼도 됩니다" 로 적었다. 신청 화면이 보내지 않는 값을 컬럼으로 만들면 전 건이 `null` 인 컬럼이 남고, 화면은 그것을 "알 수 없음" 으로 그려야 한다. 필요해지면 `POST /consult-requests` 에 `source` 를 더하는 것이 먼저이고, **과거 건은 영구히 `null`** 이라는 사실을 그때 화면이 받아들여야 한다 |
| `visit_date` + `visit_time` 두 컬럼 | 한 약속이 두 컬럼으로 갈리면 비교·정렬에 매번 결합이 필요하고 두 값이 어긋날 자리가 생긴다 (§12.2) |
| `consult_status_changes.updated_at` | 이력 행은 고쳐지지 않는다. `audit_logs` 와 같은 신호다 |
| 상태 전이표 테이블 | 금지 전이가 없다(위) |

**마이그레이션 메모 (요청서 15 가 받는다 — 2026-10-21 개정, 그 전에는 "협업자 전달" 이었다):**

1. `phone_digits` 는 `not null` 인데 기존 행이 있다. **현재 데이터가 시드뿐이면 컬럼 추가 후 시드 재실행**으로
   끝난다. 운영 데이터가 생긴 뒤라면 마이그레이션 SQL 에 백필 한 줄(`phone` 에서 숫자만 남기기)을 넣는다 —
   §3.8 의 "raw SQL 금지" 는 **애플리케이션 코드** 규칙이고 마이그레이션 파일에는 적용되지 않는다.
2. `event` 는 `default 'status_change'` 라 기존 이력 행이 그대로 유효하다.
3. **기존 `booked` 행에는 `visit_at` 이 없다.** 소급해 채우지 않는다 — `cr3` 의 메모
   `8/2 14:00 예약 확정` 를 파싱하는 것은 추측이다(그 메모가 바로 "적을 칸이 없어서 메모에 적었다" 는
   요청서의 근거다). **필수 입력 규칙은 쓰기 경로에만 건다.** 화면은 `visitAt === null` 인 `booked` 를
   `일시 미입력` 으로 보여주고 담당자가 채우게 한다.
4. 시드에 `visited` 건이 하나도 없다. 샘플이 필요하면 fixture 수정이 따라오는데 그 파일은 프런트
   영역이다 — **이 변경에 묶지 않는다.**

**정하지 않은 것:**

- **`operator` 의 상담 처리 권한** — `PATCH .../status` 는 여전히 `hospital_admin` 전용이다
  (결정 0001 미결 3). 상태가 5개가 되면서 "병원이 방치한 건을 운영자가 취소" 요구가 더 그럴듯해졌지만,
  요청서에 없으므로 바꾸지 않았다.
- **`내원완료` 이후의 되돌림을 화면이 경고할지** — 서버는 막지 않는다(자유 전이). 확인창은 화면의 몫이다.
- **상담 보존 기간** — 감사 보존 기간과 함께 정해야 한다(결정 0001 미결 5). 이번 변경으로
  `visit_at` 이 더해졌을 뿐 성격은 같다.

#### 관리자 대시보드 집계 (2026-10-13)

`docs/features/requests/2026-10-12-05-관리자-레이아웃-대시보드.md` 가 요구하는 화면이다.
**새 테이블도 새 컬럼도 없다** — 인덱스 하나(`consult_requests(hospital_id, visit_at)`)뿐이고,
나머지는 전부 기존 컬럼에서 파생한다. 설계 판단과 근거는 `docs/database/README.md` §13 에 있고,
여기에는 **계약이 받아야 할 것**만 적는다.

**이 절이 지켜야 할 불변식은 하나다:**

> **숫자 카드 = 사이드 메뉴 배지 = 그 카드를 눌렀을 때 열리는 목록이 보여주는 건수.**

이 문서가 이미 두 번 경고한 함정(§14 의 `hospital_inquiries` 카운트 세 벌,
`ConsultStatusCounts` vs `ConsultSummary`)을 한 화면에 13개 모아 놓은 자리다.

##### 권고: `GET /admin/dashboard?hospitalId=` 집계 **하나**

| 대안 | 판단 |
|---|---|
| 기존 요약·목록을 조합한다 (`/consult-requests/summary` + `/hospital-inquiries/summary` + 목록 3번 + 병원 1번) | **7회 왕복**이고, 더 나쁜 것은 **일곱 응답이 일곱 시점**을 가리킨다는 것이다. 카드 ① 의 보조 줄과 사이드 배지와 오늘 할 일 2번이 **같은 숫자여야 하는데** 서로 다른 응답에서 오면 1분 차이로 `신규 5건` 옆에 배지 `6` 이 붙는다 |
| 기존 `ConsultSummary` 를 키운다 | 일곱 숫자·세 목록·깔때기·**병원 정보 완성도**가 들어간다. 상담 도메인 요약에 병원 완성도가 들어오는 순간 이름이 거짓이 된다 |
| ✅ **전용 집계 오퍼레이션 하나** | 한 트랜잭션·한 시점. 카드와 배지가 **구조적으로** 어긋날 수 없다 |

새로 만드는 것은 **오퍼레이션 1개와 응답 스키마**뿐이다. 그 안의 투영과 판정은 전부 기존 것을
재사용한다 — 목록 항목은 `ConsultRequest` **그대로**(마스킹 포함, 아래), 상태 판정은
`inquiryStatus`, 기간 경계는 `periodRange`, 지연은 `isDelayed`. **새 규칙을 하나도 만들지 않는다.**

- `x-role: [hospital_admin]` — **`operator` 는 `403`**. 근거는 §3 의 "관리자 대시보드는 `scope` 가
  아니라 병원 하나다".
- `hospitalId` (선택): 생략 시 담당 병원이 1곳이면 그 병원, 2곳 이상이면 `422 HOSPITAL_ID_REQUIRED`.
  담당 병원 밖이면 `403 HOSPITAL_NOT_MANAGED`.
- `Cache-Control: no-store` + `Vary: Authorization` — 응답에 **마스킹된 상담 행**이 들어 있다.
- `timezone`(`Asia/Seoul`)과 `calculatedAt` 을 함께 내려준다 (`ConsultSummary` 의 선례. 달력 경계로
  갈리는 숫자가 다섯이다).
- 응답의 상담 행은 **목록과 같은 투영**이다 — 이름은 전체, **연락처는 마스킹**, `piiMasked: true`
  (§4 의 "목록은 담당자에게도 번호를 가린다"). 대시보드는 목록보다 더 가벼운 자리이고 감사 로그를
  남기지 않으므로 **전체 번호가 실릴 수 없다.**

##### 숫자 하나하나의 규칙과, 눌렀을 때 열리는 화면

전부 **선택한 병원 한 곳**, 달력 경계는 **`Asia/Seoul`**, 반열린 구간 `[from, to)` 다.

| 화면 요소 | 필드 | 규칙 | 링크 (= 같은 숫자가 나오는 질의) |
|---|---|---|---|
| ① 오늘 들어온 상담 | `todayNew` | `createdAt ∈ today`. **상태 무관** | `/consult-requests?hospitalId=&period=today` → `meta.totalItems` |
| ① 보조 `신규 전체 N건` | `statusNew` | `status='new'`, 기간 무관 | `…&status=new` → `meta.totalItems` = `statusCounts.new` |
| ② 처리 대기 | `pending` | `status ∈ {new, contacted}`, 기간 무관 | `…&status=new&status=contacted` → `meta.totalItems` (**`status` 반복 허용 필요** — 아래) |
| ② 보조 `24시간 지연 N건` | `delayed` | `status='new'` 이고 `now − createdAt ≥ 24h` | **링크 없음** (아래) |
| ③ 답변 안 한 문의 | `unansweredInquiries` | `answeredAt === null` | `/hospital-inquiries?hospitalId=&status=unanswered` → `meta.totalItems`, 요약의 `unanswered` |
| ③ 보조 `가장 오래된 것` | `oldestUnansweredAt` | 위 모집단의 `min(createdAt)`, 0건이면 `null` | 〃 |
| ④ `이번 달 신청 M건 중 N건 예약` | `newThisMonth` / `bookedThisMonth` | **M** = `createdAt ∈ thisMonth`<br>**N** = 그중 **현재 상태**가 `booked` 또는 `visited`<br>**퍼센트 필드는 없다** — 카드가 `M건 중 N건` 만 그린다. 필요해지면 화면이 두 값으로 계산하거나 그날 필드를 더한다 | `…&period=thisMonth` → `meta.totalItems` = **M**<br>`…&period=thisMonth&status=booked&status=visited` → **N** |
| 오늘 할 일 1 | `delayedConsults[]` | ② 보조와 같은 모집단, `createdAt` 오름차순, **최대 5행** + `외 N건` | 각 행 → 상담 상세 |
| 오늘 할 일 2 | `statusNew` | ① 보조와 **같은 필드** | `…&status=new` |
| 오늘 할 일 3 | `unansweredInquiries` | ③과 **같은 필드** | `…&status=unanswered` |
| 오늘 할 일 4 | `rejectedDoctors` | 그 병원 소속 전문의 중 `verificationStatus === 'rejected'` 인 수 | 의료진 영역 |
| 최근 상담 예약 | `recentConsults[]` | `createdAt` 내림차순 **5건**, 상태 무관 | `전체 보기` → `/consult-requests?hospitalId=` |
| 오늘 내원 예정 | `todayVisits[]` | `status='booked'` 이고 `visitAt ∈ today`, **`visitAt` 오름차순** | 각 행 → 상담 상세 (목록 파라미터는 만들지 않는다 — 아래) |
| 이번 달 상담 흐름 | `funnel` | 아래 | 막대 → 해당 `status` 탭 |
| 병원 정보 완성도 | `completeness` | 아래 | `남은 항목` → 병원 정보 수정의 해당 입력 칸 |
| 사이드 배지 `상담 예약` | `statusNew` | ① 보조와 **같은 필드** | — |
| 사이드 배지 `문의` | `unansweredInquiries` | ③과 **같은 필드** | — |

**같은 숫자는 같은 필드다.** `statusNew` 가 세 자리(카드 보조 줄·오늘 할 일·사이드 배지)에,
`unansweredInquiries` 가 세 자리에 쓰인다. **클라이언트가 더하거나 다시 세는 자리는 하나도 없다** —
`pending` 도 서버가 센 값이지 `statusCounts.new + statusCounts.contacted` 가 아니다
(그 덧셈이 또 하나의 판정 지점이 되는 것을 §14 가 이미 `total` 로 막아 두었다).

##### 기존 오퍼레이션에 필요한 변경 두 개 (둘 다 **additive**)

| 변경 | 왜 | breaking 인가 |
|---|---|---|
| `GET /consult-requests` 의 **`status` 를 반복 허용**으로 (`?status=new&status=contacted`, 같은 파라미터끼리 OR) | 카드 ②(`처리 대기`)와 카드 ④의 N 을 **목록에서 재현**할 유일한 방법이다. 지금은 단일 값이라 두 카드의 링크가 카드와 다른 숫자를 연다 | **아니다.** 값 하나를 보내던 기존 요청은 그대로 동작한다 (`procedureId` 가 이미 같은 모양이다). `statusCounts` 는 변함없이 **전 상태**를 내려준다. 계약의 등식 `status 필터를 건 요청에서는 meta.totalItems === statusCounts[그 상태]` 는 **값이 하나일 때**로 좁혀 적어야 한다 |
| `period` enum 에 **`thisMonth`** 추가 (`이번 달 1일 00:00 KST ~ 다음 달 1일 00:00 KST`) | 카드 ④와 깔때기의 모집단이 그것이고, 링크가 M 을 재현해야 한다 | **아니다.** 요청 파라미터의 enum 값 추가다 |

둘 다 **대시보드 때문에 생긴 소비자**가 있다. 소비자 없는 파라미터는 더하지 않는다.

##### `지연` — 서버가 세지만 **규칙은 상담 목록과 같은 함수 하나다**

§14 의 `consult_requests 확장` 절이 적어 둔 뒤집히는 조건("`지연` 이 탭·필터·카운트가 되는 순간")이
발동했다. **카운트가 되었으므로 서버가 센다. 컬럼은 여전히 만들지 않고, 두 번째 규칙도 만들지 않는다.**

계약 설명에 그대로 넣을 문구:

> `delayed` 는 **`status === 'new'` 이고 접수 후 24시간 **이상** 경과한 건의 수**다.
> 상담 목록의 `지연` 배지를 클라이언트가 판정하는 순수 함수(`isDelayed`,
> `docs/database/README.md` §12.7)와 **같은 부등식**이며, 서버는 그것을 이항해 질의한다:
> `now − createdAt ≥ 24h` ⟺ `createdAt ≤ now − 24h`.
> **경계는 포함이다** — 정확히 24시간 경과한 건은 지연이다.
> 24시간은 **경과 시간**이라 `Asia/Seoul` 이 개입하지 않는다 (`today`·`thisMonth` 와 다른 점).
> 클라이언트는 **이 숫자를 다시 계산하지 않는다.** 목록의 배지만 같은 함수로 칠하므로,
> 두 값은 **다른 시점**을 가리킬 수는 있어도 **다른 규칙**을 가리키지 않는다.

보조 줄에 **링크를 걸지 않는다.** `지연` 을 재현하는 목록 파라미터를 만들면 상태도 기간도 아닌
세 번째 필터 축이 탭 UI 옆에 생긴다. 지연 건은 `오늘 할 일` 에 **개별 줄로 이미 나열**되고
거기서 상세로 바로 간다.

##### 이번 달 상담 흐름 (`funnel`) — **현재 상태**로 센다

모집단은 카드 ④의 M 과 같다 (`createdAt ∈ thisMonth`). 네 막대가 같은 집합의 부분집합이다.

| 막대 | 규칙 (현재 상태 기준) |
|---|---|
| 상담 신청 `requested` | 코호트 전체 (= `newThisMonth`) |
| 연락 완료 `contacted` | `status ≠ 'new'` **그리고** `(status === 'cancelled' && cancelReason === 'no_answer')` 가 아님 |
| 예약확정 `booked` | `status ∈ {booked, visited}` — **카드 ④의 N 과 같은 값** |
| 내원완료 `visited` | `status === 'visited'` |
| *(별도)* 취소 `cancelled` | `status === 'cancelled'`. 단계가 아니라 옆에 적는 숫자 |

- **이력을 거슬러 세지 않는 이유**: 상담 목록의 **상태 탭과 같은 축**이어야 담당자가 막대를 보고
  탭을 눌러 숫자를 대조할 수 있다. "도달한 적 있는가" 기준은 **재현할 필터가 없어** 영영 대조되지 않는다.
- **`연락이 안 됨` 취소를 `연락 완료` 에서 빼는 이유**: 그 사유는 **연락이 닿지 않았다는 병원 자신의
  기록**이다. 세면 막대가 "연락을 **시도**한 건" 이 되어 쓸모가 없어진다. 나머지 네 사유
  (`patient_request`·`procedure_unavailable`·`duplicate`·`etc`)는 연락이 닿은 뒤에 나오는 사유라 센다.
- `cancelReason` 은 §14 가 정한 대로 **이력에서 파생한 현재 값**이다 (`cancelReasonOf`). 과거 취소 건은
  사유가 `null` 이라 `연락 완료` 에 포함된다 — 소급해 추측하지 않는다.
- 단조 감소가 구조적으로 보장된다: `visited ⊆ {booked, visited} ⊆ 연락 완료 ⊆ 코호트`.
- 판정은 순수 함수 하나다 (`funnelOf`, `docs/database/README.md` §13.6).

##### 병원 정보 완성도 (`completeness`) — 서버가 계산한다

**오늘 입력할 수 있는 항목만** 넣는다. 채울 수단이 없는 항목을 넣으면 `남은 항목` 을 눌러도 갈 곳이
없고 영원히 100%가 되지 않는 바가 된다.

| `key` | 라벨 | 충족 조건 | `target` (수정 화면 입력 칸) |
|---|---|---|---|
| `basicInfo` | 기본 정보 | `name`·`region`·`address` 가 trim 후 비어 있지 않고, `latitude`·`longitude` 가 둘 다 0이 아니며, `specialty` 가 trim 후 비어 있지 않음 | `name` |
| `businessHours` | 진료시간 | 7요일이 모두 있고, `isClosed === false` 인 요일의 `hours` 가 trim 후 공백이 아님 | `businessHours` |
| `procedures` | 진료 시술 | `procedureIds.length ≥ 1` | `procedureIds` |
| `thumbnail` | 대표 이미지 | 비어 있지 않고 **서버 기본 이미지가 아님** | `thumbnail` |
| `introduction` | 병원 소개 | trim 후 **30자 이상** | `introduction` |
| `directions` | 찾아오시는 길 | trim 후 **10자 이상** | `directions` |
| `doctors` | 의료진 | 소속 전문의 **1명 이상** (검수 상태 무관) | `doctors` |

- `percent = round(충족 수 / 전체 항목 수 × 100)`, **동일 가중치**. 전부 충족이 아니면 99를 넘기지 않는다.
- `items` 는 **충족한 것까지 전부**, **고정된 순서**로 내려간다. **배열 순서가 계약이다** —
  `남은 항목` 은 `items.filter(!done)` 이고 화면이 다시 정렬하지 않는다.
- `target` 은 **프런트에 이미 있는 폼 필드 키**다 (`HOSPITAL_FIELD_KEYS` —
  서버 `422` 의 `details[].field` 가 쓰는 바로 그 어휘). 완성도 항목과 검증 오류가 **같은 키로 같은
  입력 칸**을 가리키므로 화면은 포커스 이동 코드를 하나만 들고 있으면 된다.
- **서버가 계산하는 이유**: ① 같은 판정이 대시보드 바와 (07 이후) 병원 정보 화면의 섹션별 체크 두 곳에
  필요하다 ② 항목이 07 에서 둘 늘어난다(앱 배포 없이 바뀌어야 한다) ③ `doctors ≥ 1` 은 다른 리소스라
  병원 응답만으로 판정할 수 없다 ④ `images`/`thumbnail` 은 수정 화면이 보내지 않거나 서버가 기본값을
  채우는 자리라 **클라이언트가 든 값과 저장된 값이 갈린다.**

**`시술 0개` 경고는 백분율과 별개 필드다** (`noProcedures: boolean`). 7분의 1은 `86%` 로 보이지만
실제로는 환자가 시술로 병원을 찾을 수 없는 상태다.

> ⚠️ **문구를 `앱에 노출되지 않아요` 로 적으면 사실이 아니다.** 확인한 결과
> 시술 0개 병원은 **시술로 찾는 모든 경로**에서 빠지지만(홈 `시술로 찾기` 격자, 탐색의 시술 칩·세부
> 시술 `?procedureId=`, 가격 비교표의 시술 열, 클라이언트 대분류 전개) **이름 검색·찜 목록·꿀팁
> 관련 병원·병원 상세 직접 링크·탐색 `추천` 칩에서는 그대로 보이고 상담도 받는다.**
> 정확한 문구는 **`시술을 등록하지 않으면 환자가 시술로 검색할 때 병원이 나오지 않아요`** 쪽이다.
>
> 덧붙여 **계약상 시술 0개 병원은 만들어질 수 없다** — `procedureIds` 에 `minItems: 1` 이 걸려 있어
> `POST`/`PATCH` 를 통과하지 못한다. 이 경고가 뜨는 경우는 **계약 이전에 들어온 데이터**(시드·이관)
> 뿐이고, 프런트가 이미 그 상태를 방어하고 있다(`HospitalDetailView`·`HospitalMapView` 의
> `procedureIds: []` 주석). 그래서 경고를 둔다 — **막혀 있어야 할 상태가 실제로 존재한다.**

##### `GET /consult-requests/summary` 와의 관계 — **아무 화면도 쓰지 않는다**

요청 04 까지의 `/admin` 숫자 카드 둘이 이 오퍼레이션에서 왔다. **거기에 범위 구멍이 있다** —
`hospitalId` 파라미터가 없어 **담당 병원 전부를 합산**한다. 병원을 두 곳 맡은 담당자는 A 병원 화면을
보면서 A+B 의 숫자를 본다. 사이드 배지와 카드가 "선택한 병원" 을 말하기로 한 이상 그 합산은 거짓이다.

**결정: 오퍼레이션은 계약에 남기되, 지금은 소비 화면이 없고 서버 구현도 필요 없다.**

- **병원 관리자 홈**은 `GET /admin/dashboard` 하나로 받는다.
- **운영자 홈**(`frontend/src/features/admin/components/OperatorHome.tsx`)은 **상담 숫자를 그리지
  않는다** — 같은 레이아웃에 병원 목록과 검수 대기만 보여준다(사용자 결정). 요청 05 리뷰 전까지
  여기에 "운영자 홈이 전 범위 상담 숫자를 볼 유일한 자리라서 남긴다" 고 적혀 있었으나 **그 화면은
  그렇게 만들어지지 않았다.** 프런트의 `fetchConsultSummary()` 와 훅도 제거됐다(2026-10-13).
- **그래서 서버 구현은 소비 화면이 생기는 날까지 필요 없다.** 운영자 홈이 상담 숫자를 요구하게
  되는 날 구현한다. `x-screens` 는 **빈 목록**이다(`admin-home.md` 를 뺐다).
- **그래도 지우지 않는 이유**: 삭제는 더 큰 결정이라 이번 범위 밖이고, 아래 모집단 구분(합산 vs
  선택 병원, `pending` 의 정의 차이)은 그날 다시 필요한 근거다.
- **`hospitalId` 를 지금 더하지 않는 이유**: 더해도 쓰는 화면이 없다. 소비자 없는 파라미터는
  "이 숫자를 병원별로 봐도 된다" 는 잘못된 신호가 된다. 운영자 홈이 병원별 숫자를 요구하는 날 더한다.
- **계약 설명에 넣을 경계 문구**: `ConsultSummary` 는 **담당 병원 전체 합산**이고
  `pending` 은 **`new` 하나**다. 대시보드의 `pending` 은 **`new + contacted`** 이고 **선택 병원**이다.
  **이름이 같고 모집단도 뜻도 다르다 — 재사용 관계가 아니다.**
  (`ConsultStatusCounts` 와 `ConsultSummary` 사이에 이미 적어 둔 것과 같은 종류의 경고다)
- `HospitalInquirySummary` 는 `hospitalId` 를 이미 받으므로 **유일하게 재사용 가능**하다. 그래도
  대시보드는 자기 응답의 값을 쓴다 — 한쪽만 재사용하면 "어느 것이 기준인가" 가 다시 결정 사항이 된다.
  두 값은 **같은 규칙**이라 어긋나도 시점 차이뿐이다.

##### 만들지 않는 것

| 안 만드는 것 | 왜 |
|---|---|
| `visitDate`/`visitPeriod` 목록 파라미터 | `오늘 내원 예정` 에는 `전체 보기` 가 없다 — 하루치가 전부이고 각 행은 상세로 간다. **날짜별 내원 목록 화면이 생기는 날** `period` 와 같은 모양으로 더한다(경계는 서버 KST). 인덱스는 먼저 깔린다 |
| `지연` 필터 파라미터 | 위 |
| 깔때기의 `연락 완료` 를 재현하는 필터 | 취소 사유가 걸린 조건이라 상태 탭으로 표현되지 않는다. 막대는 `status` 탭으로 보내고, `연락 완료` 만 정확히 열 수 없다는 것을 화면이 받아들인다 |
| 대시보드 응답의 `delayed` 를 목록 항목에 싣는 것 | 받는 순간부터 거짓이 되기 시작하는 값이다 (이미 정한 규칙) |
| 알림 종 배지 · 상단 환자 검색 | 기존 `GET /notifications/unread-count` 와 상담 목록의 `q` 를 그대로 쓴다. 집계에 넣지 않는다 |
| 운영자용 집계 | 운영자는 이 화면을 쓰지 않는다 (§3) |

##### 정하지 않은 것

- **반려 전문의의 건별 줄과 사유 표시** — `rejectionReason` 은 `DoctorAdminView` 에만 있고
  **병원 소속 전문의를 관리자 시야로 읽는 GET 이 없다**(이미 적어 둔 계약 격차 —
  `GET /hospitals/{hospitalId}/doctors?view=admin` 후보). **세는 것은 지금 된다** — 공개 `Doctor` 에도
  `verificationStatus` 가 있다. 건별 줄은 그 GET 이 생기는 날이다.
- **승인 상태(`승인 완료 · 앱 노출 중` / `승인 대기`)와 담당자 직책** — 사이드 메뉴 하단이 요구하지만
  `hospitals` 에 승인 상태가, `hospital_admins` 에 직책이 없다. **요청 06 과 함께 설계한다.**
- **대시보드 응답의 캐시 수명** — `no-store` 로 둔다. 배지가 다른 관리자 화면에서도 보여야 해서
  클라이언트가 스토어에 들고 있는데, **상태 변경·답변 등록 뒤 무효화 책임**은 화면 쪽 결정이다.
- **`이번 주`·`지난달 대비` 같은 비교 숫자** — 요청서에 없다. `periodRange` 는 이미 받을 수 있다.

---

## 15. 버전 관리 방침

### 경로 버전 (`/v1`)

`https://api.molamola.kr/v1/hospitals`

헤더 버전(`Accept: application/vnd.mola.v1+json`)이 아니라 경로를 쓴다:
- 브라우저 주소창·`curl`·로그에서 바로 보인다
- 캐시(CDN)가 URL 만으로 버전을 구분한다
- Flutter·React 두 클라이언트가 서로 다른 버전을 쓰는 기간에 라우팅이 단순하다

### 무엇이 breaking 이 아닌가 (additive — `v1` 안에서 한다)

- 응답에 **필드 추가**
- **선택 파라미터** 추가
- 새 엔드포인트 추가
- enum 에 값 추가 — ⚠️ 단, **클라이언트가 모르는 값을 만나도 죽지 않도록** 방어해야 한다.
  `ProcedureId` 에 시술이 추가되면 아이콘 매핑이 없어 화면이 깨질 수 있다.
  클라이언트는 알 수 없는 enum 값을 조용히 무시하거나 기본 표시로 떨어뜨린다.
- 에러 `details` 항목 추가

### 무엇이 breaking 인가 (`v2` 가 필요하다)

- 필드 제거·이름 변경·타입 변경
- 필수 파라미터 추가
- 응답 구조 변경 (벌거벗은 배열 ↔ envelope)
- 기본값 변경으로 결과가 달라지는 것
- HTTP 상태 코드 의미 변경
- enum 값 제거

### 폐기 절차

1. **공지** — 대체 경로와 함께 이 문서에 기록
2. **헤더** — 폐기 예정 오퍼레이션 응답에 붙인다
   ```
   Deprecation: Wed, 12 Nov 2026 00:00:00 GMT
   Sunset: Wed, 11 Feb 2027 00:00:00 GMT
   Link: <https://api.molamola.kr/v2/hospitals>; rel="successor-version"
   ```
3. **최소 90일** 병행 운영. **모바일 앱 때문에 이 기간이 필수다** — 웹은 새로고침하면 최신 코드가 되지만
   앱은 사용자가 업데이트하지 않으면 낡은 버전이 계속 돈다. 앱 강제 업데이트 수단이 갖춰지면 단축 가능하다.
4. **Sunset 이후** `410 Gone`.

### 클라이언트가 알 수 없는 필드를 만났을 때

**응답의 모르는 필드는 무시한다.** 서버가 필드를 추가할 때 클라이언트 배포를 기다리지 않기 위한 규칙이다.
Zod 스키마를 쓸 때 `.strict()` 를 쓰지 않는다 — 필드 하나 추가에 앱이 죽는다.

### 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 1.0.0 | 2026-08-12 | 최초 설계. 화면 문서 27개 기준 |
| 1.1.0 | 2026-08-12 | `docs/decisions/0001-roles-and-pii.md` 반영. 역할 3개, 운영자 주도 입점 흐름, 상담 PII 마스킹, 감사 로그. **아직 배포 전이라 `v1` 안에서 breaking 변경을 허용했다** — `UserRole` enum 값 변경(`admin` → `hospital_admin`/`operator`)과 `SELF_VERIFICATION_FORBIDDEN` 제거는 배포 후라면 `v2` 사유다 |
| 1.2.0 | 2026-10-13 | **요청 08 — 알림 `consultStatus`** (§9). `AppNotification` 에 nullable 필드 하나 추가(**additive**), `NotificationType` 변경 없음, 엔드포인트·파라미터 변경 없음. 상담 알림 문구를 상태별 환자용 문장으로 교체하고 **일시 표기를 `10/9(금) 14:00` 하나로 통일**했다 — 문구·예시는 계약의 **설명과 `example`** 이지 스키마가 아니므로 breaking 이 아니다. 이미 나간 알림은 소급 수정하지 않는다 |
| (버전 없음) | 2026-10-21 | **요청서 12 — 혼자 개발 체제 정리.** 협업자가 떠나 서버도 이 저장소에서 직접 만든다. `openapi.yaml`·이 문서의 **"협업자 확인 대기" 표시를 "요청자 답 반영 대기 → 요청서 18(구 06)·19(구 07)"** 로 바꾸고, "협업자 영역/인계" 표현을 그 일을 맡은 요청서 번호(상담·알림 15, 문의·찜·대시보드 16)로 바꿨다. **계약의 동작·필드·enum·required 변경 없음** — 표현·표시만 고쳤으므로 버전을 올리지 않는다 |

> 🚧 **병원 관리자 직접 가입(§20)은 버전을 받지 않았다.** 아직 **제안**이고,
> **요청자 답 반영 대기 → 요청서 18** 이다 (2026-10-21 개정 — 혼자 개발 체제.
> 2026-10-13 에는 "협업자 확인 대기" 였다).
> 반영되면 `1.3.0` 으로 올라가며, 그 안에 **`v1` 안에서 할 수 없는 변경은 없다** —
> 새 오퍼레이션 3개 + 응답 필드 추가 + enum 값 추가뿐이고 기존 필드를 지우거나 바꾸지 않는다.
> 다만 **동작이 바뀌는 것이 하나 있다**: 공개 질의가 `approvalStatus='approved'` 를 걸기 시작한다.
> 스키마상 breaking 은 아니지만 **"같은 요청에 다른 결과"** 이므로 §15 의 "기본값 변경으로 결과가
> 달라지는 것" 에 가깝다. 마이그레이션이 기존 11곳을 `approved` 로 백필해 **실제 결과가 바뀌지
> 않게** 하는 것이 그 대비다 (DB §14.3).

**1.1.0 의 breaking 변경 목록** (구현 착수 전이므로 `v1` 유지):

- `UserRole` enum: `[user, admin]` → `[user, hospital_admin, operator]` (값 제거 + 추가)
- `ConsultRequest` 에 `piiMasked` 필수 필드 추가
- `POST /hospitals` 인가 축소 (`admin` → `operator`), 등록자 자동 담당자 지정 제거
- `GET /doctors/verification-queue`, `PUT /doctors/{id}/verification` 인가 축소 (`operator` 전용)
- `PATCH /consult-requests/{id}/status`, `POST .../memos` 인가 축소 (`hospital_admin` 전용)
- `GET /consult-requests/{id}` 담당 범위 밖 응답 `403` → `404`
- `SELF_VERIFICATION_FORBIDDEN` 에러 코드 제거

---

## 16. 캐싱·요청 한도

### 캐싱

| 대상 | 헤더 | 이유 |
|---|---|---|
| `GET /procedures` | `public, max-age=3600` + ETag | 13개 고정 마스터 데이터 |
| `GET /legal-documents/{slug}` | `public, max-age=3600` | 개정이 드물다 |
| `GET /guides`, `/guides/{id}` | `public, max-age=300` | 편집 콘텐츠 |
| `GET /promotions` | `public, max-age=300` | 할인 정보. 너무 길면 종료된 할인이 남는다 |
| `GET /search/trending`, `/search/suggestions` | `public, max-age=300` | 집계·광고 지면 |
| `GET /hospitals`, `/hospitals/{id}`, `/doctors*` | `public, max-age=60` + ETag | 관리자 수정이 반영되어야 한다. ETag 로 304 를 노린다 |
| `GET /hospitals/{id}/inquiries` | `public, max-age=60` | 공개 Q/A 뿐이고 작성자 필드가 없다. 답변 직후 최대 1분 늦게 보일 수 있다 |
| `GET /geo/address-search` | `private, max-age=600` | 개인화되지 않지만 인증이 필요하다. 서버 내부 캐시가 본체 |
| `/me/*`, `/consult-requests*`, `/hospital-inquiries*`, `/notifications*`, `/admin/*`, `/doctors/verification-queue`, `/partner-inquiries*`, `/hospitals/{id}/admins*` | **`no-store`** + `Vary: Authorization` | 개인정보(실명·전화번호·자격증)와 계정별·역할별 데이터. 중간 캐시에 남으면 안 된다 |

**`Vary: Authorization` 이 특히 중요해진 지점:** `GET /consult-requests`, `GET /consult-requests/{id}`,
`GET /admin/hospitals` 는 **같은 URL 에 대해 역할별로 다른 본문**을 반환한다 (PII 마스킹, `scope`).
공유 캐시가 응답을 섞으면 그 자체가 유출이다 — 담당자용 전체 연락처 응답이 운영자에게 서빙될 수 있다.
`no-store` 로 캐시를 아예 막고 `Vary` 를 함께 보내 이중으로 방어한다.

프론트엔드의 TanStack Query `staleTime` 은 이 값과 맞추는 것이 좋다.

### 요청 한도

| 범위 | 한도 | 이유 |
|---|---|---|
| `POST /auth/login`, `/auth/signup` | IP 당 **10회/분** | 크리덴셜 스터핑 |
| `POST /auth/refresh` | 토큰당 **30회/분** | 재발급 루프 방어 |
| `GET /geo/address-search` | 계정당 **30회/분** | 카카오 할당량 보호. 폼이 0.3초 디바운스로 호출한다 |
| `POST /hospitals/{id}/admins` | 계정당 **20회/시간** | 권한 부여다. 이메일 대입으로 계정 존재를 열거하는 것을 늦춘다 (`operator` 전용이라 위험은 낮지만 계정 탈취 대비) |
| `POST /consult-requests` | 계정당 **10회/시간** | 중복 신청을 막지는 않지만 스팸은 막는다 |
| `POST /hospital-inquiries` | 계정당 **10회/시간** | 도배 방지의 1차 방어선 (§14 미결 — 도배 규칙 자체는 아직 없다) |
| `POST /community/posts`, `.../answers` | 계정당 **20회/시간** | 스팸 |
| `POST /community/posts/{id}/views` | IP 당 **60회/분** | 조회수 조작 |
| `POST /partner-inquiries` | IP 당 **3회/분** | 인증이 없는 공개 폼 |
| 🚧 `POST /uploads` (`purpose=business_registration`) | IP 당 **10회/시간** | **제안 (§20)** — 인증 없이 바이트를 받는 자리라 한도의 축이 IP 다 |
| 🚧 `POST /uploads` (`purpose=hospital_photo`) | 계정당 **60회/시간** | **제안 (§21)** — 로그인한 담당자가 **사진 11장을 연달아** 올린다. IP 10회/시간이면 폼 하나를 채울 수 없고, 계정 축이라 IP 축보다 좁게 잡아도 안전하다 |
| 그 밖의 인증 요청 | 토큰당 **600회/분** | 일반 보호 |
| 그 밖의 비인증 요청 | IP 당 **300회/분** | 일반 보호 |

응답 헤더: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, 초과 시 `Retry-After`.

---

## 17. 미결 사항 — 제품 결정이 필요한 것

API 로 정할 수 없고 제품 판단이 필요한 것들이다. **우선순위 순.**

### 🔴 보안·권한

### ✅ 해소된 항목 (`docs/decisions/0001-roles-and-pii.md`)

초안의 미결 1·2·3·4·12 가 결정으로 닫혔다. 기록으로만 남긴다.

| 초안 미결 | 결정 |
|---|---|
| 1. `operator` 역할을 만들 것인가 | **만든다.** `[user, hospital_admin, operator]`. 검수·병원 생성·담당자 지정·입점 심사가 `operator` 전용. 임시 방편이던 `403 SELF_VERIFICATION_FORBIDDEN` 은 제거 |
| 2. 누가 병원을 등록하는가 / `admin` 역할은 누가 부여하는가 | **운영자가 병원을 만들고 담당자를 지정한다.** 입점 문의 → 운영자 심사 → 병원 생성 → 담당자 지정. `VITE_ADMIN_EMAILS` allowlist 는 삭제. 계정은 **기존 `user` 를 승격**한다 (§3) |
| 3. `isRecommended` 를 병원이 직접 켤 수 있는가 | **아니다. `operator` 만.** 다만 관리자 폼의 체크박스를 없애는 화면 작업이 남았다 → 아래 16번 |
| 4. 한 계정이 여러 병원을 담당할 수 있는가 | **가능하다.** `hospital_admins` M:N 확정. 그래서 `GET /consult-requests` 의 `hospitalId` 필터와 `/admin/hospitals` 의 `scope` 가 실제로 필요해졌다 |
| 12. 입점 문의를 어디서 볼 것인가 | **운영자가 본다.** `GET /partner-inquiries`, `GET /partner-inquiries/{id}`, `PATCH /partner-inquiries/{id}` 추가 |

### 🔴 새로 생긴 것 — 역할·PII 결정의 파급

1. **최초 `operator` 계정을 어떻게 만드는가 (부트스트랩).**
   모든 `operator` 행위는 `operator` 인증을 요구한다. 그런데 **첫 운영자를 만들 API 가 없다.**
   역할 승격은 `POST /hospitals/{id}/admins` 로 `hospital_admin` 만 가능하고,
   `POST /auth/signup` 은 항상 `role=user` 를 만든다.
   → 시드 마이그레이션으로 넣을지, 환경변수 allowlist(부트스트랩 한정)를 남길지, DB 직접 UPDATE 로 할지.
   **의도적으로 API 를 만들지 않았다** — 운영자를 API 로 만들 수 있으면 그 경로가 최고 권한 상승 표면이 된다.
   운영 절차로 다루는 것이 맞지만, 어떤 절차인지는 정해야 한다.

2. **운영자 콘솔 화면을 만들 것인가.**
   `GET /partner-inquiries`, `GET /hospitals/{id}/admins` 등 6개 오퍼레이션에 **대응 화면이 없다**(🚧).
   지금은 `/admin/*` 7개 화면이 담당자와 운영자를 뒤섞고 있고, 결정 문서가 화면 분기를 명시했지만
   운영자만 쓰는 화면(입점 심사·담당자 관리)은 아예 없다.
   → `/admin` 안에 역할별로 숨기는 방식으로 갈지, `/operator` 별도 영역을 만들지.
   `docs/features/` 에 화면 문서를 추가해야 한다.

3. **담당자 지정·해제를 당사자에게 통보할 것인가.**
   지금 설계는 알림을 만들지 않는다. 담당자가 된 사람은 마이페이지의 관리자 링크가 생긴 것을 스스로
   발견해야 한다. 전문의 검수 결과는 통보하는데 권한 부여는 통보하지 않는 것이 일관성이 없다.
   → `audience=admin` 알림을 만들지, 운영자가 별도로 연락할지.
   (해제 통보는 특히 필요할 수 있다 — 갑자기 관리자 화면이 사라진다)

4. **감사 로그 쓰기 실패 시 열람을 허용할 것인가.**
   상담 상세 열람을 로그 쓰기와 같은 트랜잭션으로 묶으면 **로그 저장소 장애가 화면 장애**가 된다.
   묶지 않으면 로그 없이 개인정보가 열람될 수 있다.
   → 개인정보 열람은 "기록 없으면 열람 없음" 이 원칙이지만, 병원 업무가 멈추는 비용이 있다.
   비동기 큐 + 유실 감지로 타협할지도 정해야 한다.

5. **감사 로그 보존 기간.**
   개인정보 열람 기록은 통상 1년 이상 보존한다. 상담 데이터 자체의 보존 기간과 어긋나면
   "이미 지운 상담을 누가 봤다" 는 기록만 남는다.
   → 상담 보존 기간과 함께 정해야 한다.

6. **`operator` 가 상담 상태를 바꿀 수 없는 것이 맞는가.**
   지금 설계는 조회만 허용했다 (§3). 병원이 응답하지 않는 상담을 운영자가 대신 `취소` 로 정리해야 하는
   CS 상황이 생길 수 있다.
   → 필요하면 `operator` 전용 상태 변경을 열고 감사 로그를 필수로 남긴다. 그때 고객에게 가는 알림 문구가
   "병원이 바꿨다" 로 읽히지 않게 해야 한다.

7. **반려된 입점 문의의 개인정보 보존.**
   `partner_inquiries` 에 담당자 실명·연락처가 남는다. 반려된 문의를 영구 보관할 이유가 없다.
   → 보존 기간과 삭제 방식(하드 삭제 vs 익명화).

### 🟠 동작 변경

8. **커뮤니티 조회수 중복 집계를 없앨 것인가.**
   지금은 상세 화면을 열 때마다 무조건 +1 이라 실제 관심도와 무관하다.
   스펙은 24시간 중복 제거를 넣었다. **숫자가 지금보다 작아진다.**
   → 기존 값을 유지하면서 규칙만 바꿀지, 아니면 리셋할지. 24시간이 맞는 창인지.

9. **커뮤니티 글 작성자를 실명으로 할 것인가.**
   지금은 항상 `익명` 이다. 스펙은 `isAnonymous` 를 받고 **기본값 `true`** 로 두어 현재 표시를 유지했다.
   → 기본값을 실명으로 바꾸면 같은 목록에서 표시 규칙이 갑자기 갈린다.
   **답변은 익명을 허용하지 않도록** 설계했다 (의료 정보에 답하는 주체는 드러나야 한다는 판단).
   이것도 확인이 필요하다.

10. **전문의 이름으로 검색했을 때 어디로 보낼 것인가.**
    지금은 소속 병원 상세로 간다. 전문의 상세 화면이 있는데도 쓰지 않는 것이 결함으로 기록돼 있다.
    스펙의 `GET /search/resolve` 는 `kind=doctor` + `doctorId` + `hospitalId` 를 주어 **양쪽 다 가능**하게 했다.
    → 전문의 상세로 보내는 것이 맞는지 확인 필요.

11. **`preferredTime` 을 코드 enum 으로 바꿀 것인가.**
    지금은 `평일 오전` / `평일 오후` / `평일 저녁` / `주말` 한국어 문자열이 그대로 저장된다
    (`평일 저녁` 은 2026-10-12 요청서 01 로 추가 — 그 이전 데이터에는 없다).
    스펙은 기존 데이터·타입 보존을 위해 유지했다. 다국어나 문구 변경이 생기면 `WEEKDAY_MORNING` 같은 코드가 필요하다.
    → 마이그레이션 비용 vs 앞으로의 유연성.

12. **날짜만 저장하는 필드를 시각까지 저장할 것인가.**
    `Review`·`QAPost`·`QAAnswer`·`GuideContent` 의 `createdAt` 은 날짜만이다
    (`community-new.md` 가 "시간은 저장하지 않습니다" 라고 명시). 알림·상담은 전체 시각이다.
    같은 목록에서 정렬 기준이 갈리고, 같은 날 올린 글의 순서를 결정할 수 없다.
    → 시각까지 저장하려면 기존 데이터를 어떻게 채울지 정해야 한다.

### 🟡 없는 기능 · 화면 정리

13. **비밀번호 찾기·재설정.**
    지금은 없어서 비밀번호를 잊으면 다른 이메일로 새로 가입해야 한다.
    이메일 발송 인프라가 필요하고, 이메일 인증조차 없는 현재 상태에서는 재설정 링크의 신뢰가 없다.
    **역할 결정으로 우선순위가 올라갔다** — 병원 담당자가 비밀번호를 잊으면 담당 병원 관리가 막히고,
    운영자가 대신 재설정해 줄 수단도 없다 (계정을 만들지 않는 설계이므로 비밀번호도 만질 수 없다).
    → 이메일 인증 → 비밀번호 재설정 순서로 함께 정해야 한다.

14. **회원가입 약관 동의.**
    약관 화면 3개가 있는데 가입 과정에 연결되어 있지 않다.
    스펙은 `SignUpRequest.agreedTermsVersions` 를 선택 필드로 넣어 두었다.
    → 법적으로 필수라면 이 필드가 필수가 되고, `GET /legal-documents` 에 실제 약관 문구가 채워져야 한다.
    **위치기반 서비스 약관**은 지도·반경 기능 때문에 특히 필요하다.
    테이블 요구사항은 §14 에 적었다.

15. **문의자가 자기 입점 문의 진행 상황을 볼 수 있어야 하는가.**
    지금은 조회 경로가 없다. 문의자는 계정이 없어 인증 수단이 없고, `id` 만으로 열면 남의 문의
    (병원명·담당자명·연락처)를 열거할 수 있다.
    → 진행 안내를 운영자가 전화·메일로 할지, 조회용 토큰(one-time link)을 발급할지.

16. **관리자 폼의 `추천 병원으로 노출 (에디터 추천)` 체크박스를 없앨 것인가.**
    소유자는 `operator` 로 확정됐다(해소 3). 그런데 폼에는 체크박스가 그대로 있어서,
    담당자가 켜고 저장하면 `422 FIELD_NOT_WRITABLE` 로 거절된다 — 화면이 이유를 설명하지 못하면
    "저장이 안 된다" 는 버그로 보인다.
    → 담당자 화면에서는 숨기고 운영자 화면에서만 노출해야 한다. 화면 작업이다.

17. **상담 메모에 고객 연락처를 적는 것을 막을 것인가.**
    `ConsultMemo.content` 는 자유 텍스트이고 `operator` 도 읽는다. 담당자가 메모에 연락처를 적으면
    **마스킹을 우회한다.**
    → 화면 안내로 충분한지, 서버가 전화번호 패턴을 감지해 거절/마스킹할지.
    과도하게 막으면 "010 문의 건" 같은 정상 메모도 걸린다.

18. **병원 삭제 정책.**
    삭제 엔드포인트를 만들지 않았다. 상담 이력·찜·알림·후기·`hospital_admins` 가 매달려 있다.
    → 소프트 삭제(숨김)인지 하드 삭제인지, 매달린 상담은 어떻게 되는지, 담당자의 `role` 은 어떻게 되는지.
    현재 화면들은 "병원을 찾지 못하면 `알 수 없는 병원`" 으로 견디게 돼 있으므로 소프트 삭제가 자연스럽다.

19. **후기 작성.**
    읽기만 가능하다. 작성이 생기면 `rating`/`reviewCount` 를 후기로부터 집계해야 하고,
    지금 병원 필드에 직접 들어 있는 값과 충돌한다. 실제 방문 검증(상담 완료 이력) 여부도 정해야 한다.

20. **이벤트(프로모션)의 기간.**
    화면이 `기간 한정` 이라고 안내하는데 데이터에 시작일·마감일이 아예 없다.
    스펙은 `startsAt`/`endsAt` 을 nullable 로 넣었다.
    → 기간을 넣으면 "기간이 지난 이벤트를 어떻게 보여줄지" 를 5개 화면에서 함께 정해야 한다.

21. **한 병원에 이벤트가 여러 개일 때 병원 카드에 무엇을 붙이나.**
    `events.md` 가 "확인 필요" 로 남긴 항목이다. 스펙은 `startsAt` 최신 → `id` 순으로 안정적인 순서만 보장했다.
    → 대표 이벤트를 병원이 지정할지, 할인율이 큰 것을 쓸지.

22. **`Hospital.events`(문자열 배열)와 `Promotion`(할인 카드)의 관계.**
    이름이 겹쳐 혼동을 부른다. §18 참고.

23. **`원데이 가능 병원 모음` 같은 필터 조합 검색어.**
    추천 검색어 알약 중 하나다. `SearchTarget`(procedure/hospital/doctor)으로 표현할 수 없다.
    → 필터 조합을 가리키는 `kind=filter` 를 추가할지, 그런 알약을 없앨지.

24. **홈 배너를 서버에서 관리할 것인가.**
    3장이 클라이언트 고정이고 링크가 없다(🚧). CMS 로 관리하면 엔드포인트가 필요하다. §19.

25. **푸시 알림.**
    알림함에만 쌓이고 밖으로 나가지 않는다. 담당자는 새 상담을 화면에 들어와야 안다.
    → FCM/APNs, 문자, 카카오 알림톡 중 무엇을 쓸지. `mobile/` 앱이 붙으면 디바이스 토큰 등록
    엔드포인트(`POST /me/devices`)가 필요해진다.
    **주의:** 새 상담 알림 문구에 고객 이름이 들어 있어(`김민준님이 상담을 신청했어요`) 푸시로 나가면
    잠금화면에 개인정보가 노출된다. 푸시 문구는 이름을 빼야 한다.

26. **상담 제3자 제공 동의 — 보유·이용 기간과 안내문 원문의 위치.** (2026-10-12 요청서 01)
    상담 신청마다 `thirdPartyConsent` 를 받도록 계약을 바꿨다 (`422 THIRD_PARTY_CONSENT_REQUIRED`).
    남은 결정 둘:
    (a) 안내문 4번 항목 **보유·이용 기간이 미정**이라 화면에 `[확정 필요]` 가 그대로 보인다. 안내문 문구 전체가 법무 검토 전이다.
    → 상담 데이터 보존 기간(위 5번 감사 로그 보존과 함께)을 정하고 문구를 확정해야 한다.
    (b) 안내문 원문이 **프론트엔드 상수**에 있고, `noticeVersion` 은 그 개정일(`2026-10-12`)이다. 서버는 대조할 원문이 없어 버전을 검증하지 않고 저장만 한다.
    → `GET /legal-documents/{slug}` 에 슬러그를 추가해 원문을 옮기면 `LegalDocument.version` 과 대조할 수 있다.
    또 **서버에 상담 모듈 자체가 아직 없다** — 이 절의 상담 계약은 구현보다 먼저 갔고, 그때까지 프론트엔드 저장 계층이 같은 모양을 흉내 낸다.

---

## 18. 문서·타입 사이의 모순

설계 중 발견한, 화면 문서끼리 또는 문서와 `domain.ts` 가 어긋나는 지점이다.

### 1. `Hospital.events` 와 `Promotion` 이 둘 다 "이벤트" 다

- `domain.ts` 의 `Hospital.events: string[]` — 병원 상세의 `진행중인 이벤트` 영역에 쓰이는 **문자열 배열**
- `domain.ts` 의 `Promotion` — 할인율·원가·할인가·배지를 가진 **이벤트 카드**. 홈·이벤트 화면·병원 카드 배지

`hospital-detail.md` 는 `진행중인 이벤트` 영역을 하나로만 설명해서 어느 쪽인지 모호하다.
`events.md` 는 `Promotion` 만 다룬다. **이름이 겹쳐 있어 "이벤트를 추가해달라" 는 요청이 어느 쪽인지 알 수 없다.**
스펙에서는 `Hospital.events` 를 유지하고 주석으로 다른 것임을 명시했다. 이름 정리가 필요하다 (§17-22).

### 2. 시술 개수가 문서마다 다르게 읽힌다

- `home.md`: "시술 13종"
- `explore.md`: "시술 칩 15개" (= 13 + `추천` + `기타`)
- `community-new.md`, `admin-hospital-new.md`: "시술 13개"
- `known-issues.md` 개발자 메모: `explore.tsx:44-46` 주석이 "12개 시술" 이라고 잘못 적혀 있다

실제로 `domain.ts` 의 `ProcedureId` 는 13개이고 `fixtures/procedures.ts` 도 13개다.
`explore.md` 의 15개는 특수 탭 2개를 포함한 수이며 문서가 그것을 명시하고 있어 모순은 아니지만,
읽는 사람이 "시술이 15종" 으로 오해할 여지가 있다. 스펙의 `ProcedureId` enum 은 13개다.

### 3. 병원의 `specialty` 와 전문의의 `specialty` 가 완전히 다른 개념인데 같은 이름이다

- `Hospital.specialty: string` — 자유 문자열. 폼 라벨은 `전문 분야 (예: 임플란트 전문의원)`
- `Doctor.specialty: DentalSpecialty` — 8개 enum. 폼 라벨도 `전문 분야`

**두 폼에서 같은 라벨(`전문 분야`)을 쓰면서 하나는 자유 입력, 하나는 8지선다다.**
`admin-hospital-new.md` 의 입력 항목 표에서 둘이 나란히 나와 특히 혼동된다.
스펙에서는 각각 `Hospital.specialty`(자유)와 `Doctor.specialty`(enum)로 유지하고 설명을 붙였다.

### 4. 알림함의 인증 요구가 문서 안에서 모순된다

`notifications.md`:
- 표: **"누가 보나요: 일반 사용자"**, 진입점은 로그인 상태에서만 보인다
- 알아두실 것: **"화면 자체는 로그인 없이도 열립니다. 주소창에 `/notifications` 를 직접 입력하면
  로그인하지 않은 상태에서도 알림 목록이 보입니다. 의도한 동작인지는 확인이 필요합니다. (확인 필요)"**

스펙은 인증 필수로 정했다. 계정별 알림이 되면 비로그인에게 보여줄 알림이 애초에 없다.

### 5. 커뮤니티 글쓰기의 로그인 요구도 문서 안에서 "확인 필요" 로 남아 있다

`community.md` 표: "누가 보나요: 누구나 (질문 쓰기도 로그인 없이 됩니다)"
`community-new.md`: "로그인하지 않아도 질문이 등록됩니다. (…) **의도한 동작인지는 확인이 필요합니다.**"

찜하기·상담 신청은 로그인을 요구하는데 글쓰기만 요구하지 않는 것은 일관성이 없다.
스펙은 인증 필수로 정했다 (작성자 식별·신고 대응·스팸 방지).

### 6. 전문의 상세의 잠금 문구가 실제와 다르다

문구: `로그인하면 실제 후기를 볼 수 있어요`
실제: **이 화면에 후기 목록이 없다.** 로그인하면 평균 평점 숫자만 드러난다.
`known-issues.md` 도 같은 지적을 하고 있다.

스펙은 `Doctor.rating` 만 비로그인에서 `null` 로 가린다 (`reviewCount` 는 가리지 않는다 — 화면이 비로그인에도 `후기 180` 을 보여준다).
문구를 `로그인하면 평점을 볼 수 있어요` 로 바꾸거나, 후기 목록을 실제로 넣어야 한다.

### 7. `이번 달 신규 상담` 의 기준 시간대가 정의되어 있지 않다

`admin-home.md`: "오늘이 속한 달" — **누구의 오늘인가.** 지금은 보는 기기의 시계다.
스펙은 `Asia/Seoul` 로 고정하고 `ConsultSummary.timezone` 으로 명시해 내려준다.

### 8. 검색 화면의 `14:32 기준` 이 집계 시각이 아니다

`search.md`: "화면을 연 시각을 그대로 보여주는 것뿐이고, 순위 목록은 언제 봐도 같습니다."
문구가 데이터에 대해 거짓을 말하고 있다. 스펙은 `GET /search/trending` 에
**실제 집계 시각** `calculatedAt` 을 넣어 문구가 정직해질 수 있게 했다.

### 9. `mockDb` 테이블 5개와 화면이 읽는 리소스 개수가 맞지 않는다

`mocks/db.ts` 의 테이블: `hospitals`, `doctors`, `consultRequests`, `communityPosts`, `notifications`.
후기·이벤트(프로모션)·꿀팁·시술은 코드 안 고정 데이터이고, 계정·찜은 **zustand persist 에 따로** 있다.

`known-issues.md` 개발자 메모가 이 갈라짐을 위험으로 지목한다 —
`molarmolar-community-posts` 키를 `useCommunityStore` 와 `mockDb.LEGACY_SOURCES` 가 동시에 소유하고,
`HospitalForm` 저장 한 번에 병원(mockDb)과 전문의(persist)가 서로 다른 저장소로 간다.
API 로 옮기면 이 문제는 사라지지만, **찜(favorites)이 zustand → 서버 상태로 성격이 바뀌는 것**은
계획 문서(`Task 11`: "favorites 는 서버 상태가 아니므로 Zustand 에 그대로 둔다")의 전제를 뒤집는다.
계정별 찜이 되는 순간 서버 소유가 되므로 TanStack Query 로 옮겨야 한다.

### 10. `admin-specialists.md` 가 `일반의` 를 검수 목록에 넣는 것을 스스로 모순이라고 적는다

"`일반의` 로 등록된 사람도 이 목록에 함께 나옵니다. `일반의` 는 검수할 자격증이 없어도
사용자 화면에 그대로 표시되는 값이라, 여기서 승인하거나 반려해도 사용자 화면 표시는 달라지지 않습니다."

즉 **아무 효과 없는 버튼**이 목록에 있다. 스펙은 기본 제외로 정했다.

### 11. `notifications.audience` 값은 `[user, admin]` 인데 역할은 `[user, hospital_admin, operator]` 다

DB 스키마(`docs/database/schema.dbml`)의 `notifications.audience` 는 `user | admin` 이고,
`users.role` 은 `user | hospital_admin | operator` 다. **`admin` 이라는 문자열이 한쪽에만 있다.**

의도된 것이다 — `audience` 는 **역할이 아니라 알림함(mailbox)** 이고 화면이 두 개뿐이라
(`/notifications`, `/admin/notifications`) 값도 둘이다. 하지만 이름이 겹쳐서
"`audience=admin` 은 `role=admin` 인 사람이 본다" 로 오독할 여지가 크다.
`hospital_admin` 과 `operator` 가 **같은 `admin` 알림함을 공유**한다.

스펙은 값을 유지하고 `NotificationAudience` 설명에 경고를 달았다.
`audience` 를 `personal | business` 처럼 개념 이름으로 바꾸는 것이 더 정확하지만,
기존 데이터·화면·프론트엔드 타입(`NotificationAudience`)을 모두 건드려야 해서 지금은 하지 않았다.

### 12. 결정 문서가 결정 2·3 을 "기본값, 미확답" 으로 적었는데 조정에서는 확정으로 전달됐다

`docs/decisions/0001-roles-and-pii.md` 의 결정 2·3 제목에 **"(기본값, 미확답)"** 이 붙어 있고
본문도 "사용자 답변을 받지 못해 가장 안전한 쪽으로 정했다" 고 적는다. 반면 문서 상태는 `확정` 이고
조정 메시지도 확정으로 전달됐다.

스펙은 **확정으로 반영했다.** 다만 결정 문서가 "바꾸고 싶으면" 절에 되돌리는 방법을 남겨 두었으므로
그 경로를 API 관점에서 적어 둔다:

- **초대 코드 방식으로 바꾸려면** — `hospital_admins` 에 `invite_code` 컬럼과 가입 엔드포인트
  (`POST /auth/signup-with-invite`) 하나가 추가된다. `POST /hospitals/{id}/admins` 는 초대 발급으로 바뀐다.
  기존 계약은 남겨도 된다 (두 경로 병존 가능).
- **운영자에게 PII 전체를 보이려면** — 마스킹 투영을 끄고 `piiMasked` 를 항상 `false` 로 내려준다.
  **응답 스키마 변경이 없다** — `piiMasked` 를 플래그로 둔 이유가 이것이다(§4).
  대신 결정 문서가 적은 대로 **열람 로그를 필수로** 남겨야 하고, 이미 `GET /consult-requests/{id}` 가
  기록 대상이므로 추가 작업이 없다.

---

## 19. 제안 — 화면 문서에 근거가 없는 것

아래는 **화면 문서에 데이터 요구가 없어서 스펙에 넣지 않았거나, 넣었지만 근거가 약한** 것들이다.
필요하다고 판단되면 별도 요청으로 진행한다.

| 제안 | 왜 지금 만들지 않았나 |
|---|---|
| `GET /home-banners` | 홈 배너 3장은 클라이언트 고정 콘텐츠이고 **링크가 없는 것이 현재 정상 동작**이다(🚧). 서버가 내려줄 데이터 요구가 아직 없다. CMS 로 관리하기로 정해지면 만든다 |
| `GET /company-info` | 홈 하단 회사 정보. 정적 설정값이고 화면 문서도 `placeholder-company-info.ts` 를 고치라고 안내한다 |
| `GET /app-release` (QR·스토어 링크) | 값이 비어 있고 앱 출시 후 정해진다 |
| `POST /me/devices` (푸시 토큰 등록) | 푸시 알림 자체가 없다. `mobile/` 앱이 실제로 붙을 때 필요하다 |
| `POST /hospitals/{id}/reviews` | 후기 작성 화면이 없다. `rating` 집계 재설계와 묶여 있다 |
| `PATCH`/`DELETE /community/posts/{id}` | 글 수정·삭제 화면이 없다(🚧). `QAPost.isMine` 만 미리 준비했다 |
| `POST /community/posts/{id}/likes`, `/reports` | 좋아요·신고 기능이 없다(🚧) |
| `DELETE /notifications/{id}` | 알림 삭제 기능이 없다(🚧) |
| `PATCH /me/notification-settings` | 알림 수신 설정이 없다(🚧) |
| `PATCH /me`, `PATCH /me/password`, `DELETE /me` | 프로필 수정·비밀번호 변경·탈퇴 화면이 없다(🚧). 탈퇴는 상담 이력 처리 정책이 먼저 필요하다 |
| `POST /auth/password-reset` | 비밀번호 찾기가 없다. 이메일 인프라·이메일 인증이 먼저다 (§17-13) |
| `DELETE /hospitals/{id}` | 병원 삭제 화면이 없고 삭제 정책이 미정이다 (§17-18) |
| `POST`/`PATCH /promotions` | 이벤트 등록·수정 화면이 관리자에도 없다 |
| `POST`/`PATCH /guides` | 꿀팁 작성·수정 화면이 없다 |
| `POST /hospitals/{id}/sponsorships` | 광고 신청·결제가 없고 화면이 "담당팀에 문의" 라고 안내한다. 결제 도메인이 붙는다 |
| `GET /users?email=` (계정 검색) | 담당자 지정에 필요해 보이지만 만들지 않았다. `POST /hospitals/{id}/admins` 가 `email` 을 직접 받아 조회하므로 별도 검색이 불필요하고, **이메일 열거 표면을 늘리지 않는다** (§3) |
| `POST /operators` (운영자 계정 생성) | **의도적으로 만들지 않았다.** 운영자를 API 로 만들 수 있으면 그 경로가 최고 권한 상승 표면이 된다. 부트스트랩은 운영 절차로 다룬다 (§17-1) |
| `PATCH /users/{id}/role` (임의 역할 변경) | 역할 변경은 `hospital_admins` 배정의 **부수효과**로만 일어난다. 역할을 직접 바꾸는 경로를 두면 `hospital_admins` 와 `users.role` 이 어긋날 수 있다 |
| ~~`POST /uploads` (이미지 업로드)~~ → **§20 으로 옮겼다** | 2026-10-13: 요청 06(사업자등록증)이 **구체적 소비자**를 만들었다. 다만 거기서도 **사진은 만들지 않는다** — 사진은 요청 07 의 것이고 접근 규칙이 반대(공개)다. 여기 적어 둔 "서명 URL 로 다루는 것이 좋다" 는 §20 에서 **뒤집혔다**: 서명 URL 을 발급하면 그 URL 을 가진 사람이 열람자가 되어 **감사 로그가 비어 버린다**. 서류는 `GET /uploads/{id}/content`(운영자 전용, 감사 대상) 하나로만 읽는다. 자격증 이미지(`certificateUrl`)가 공개 URL 인 문제는 **그대로 남아 있다** — 요청 06 의 범위가 아니다.<br>🚧 **2026-10-13 추가**: 요청 07 이 사진의 소비자를 만들었다 — `purpose=hospital_photo` 는 §21 에 있다. **같은 오퍼레이션이고 규칙만 값별로 갈린다**(인증 필수 · 이미지 전용 · 응답에 공개 URL). 자격증 이미지는 **여전히 범위 밖**이다 |
| `GET /hospitals/{id}/procedure-prices` | 시술별 가격표가 없다. 폼에 전체 가격대 최소/최대 두 숫자만 있다. 가격 비교표의 `최저가` 가 "선택한 시술의 가격이 아니다" 는 현재 한계의 원인이다 |
| `GET /consult-requests/export` (엑셀) | 내려받기 기능이 없다(🚧). 개인정보 대량 반출이라 감사 로그가 함께 필요하다 |
| `kind=filter` (`SearchTarget` 확장) | `원데이 가능 병원 모음` 같은 필터 조합 검색어를 표현하려면 필요하다 (§17-23) |
| `GET /audit-logs` | 감사 로그 **조회** API. 기록은 스펙에 반영했지만 조회 화면이 없다. 조회 자체가 개인정보 열람 이력 열람이라 접근 통제가 또 필요하다 — 내부 도구로 다루는 것이 맞을 수 있다 |

---

## 20. 🚧 병원 관리자 직접 가입 — **제안 — 요청자 답 반영 대기 → 요청서 18 (2026-10-13 제안)**

| | |
|---|---|
| **상태** | 🚧 **제안이다. 요청자 답 반영 대기 → 요청서 18** (2026-10-13 제안 · **2026-10-21 개정 — 혼자 개발 체제**). 이 절과 `openapi.yaml` 의 🚧 표시된 오퍼레이션·필드는 **확정 계약이 아니다.** 반영 전까지 **구현하지 않는다** — **반영은 요청서 18 을 처리할 때 한다** |
| **선행 조건** | `docs/decisions/0001-roles-and-pii.md` **결정 2** 개정. 2026-10-13 의 결정 2 는 "병원 관리자 계정은 운영자가 만든다" 이고, 그 문서의 `변경 제안` 소절이 **먼저** 개정돼야 한다 (요청서 12 가 그 개정을 맡는다) |
| **요구사항 출처** | `docs/features/requests/2026-10-12-06-병원관리자-직접가입.md` → 다시 쓴 **`2026-10-21-18-병원관리자-직접가입.md`**, 데이터 설계 `docs/database/README.md` **§14** 전부 |
| **이 절이 받는 것** | DB §14.16 체크리스트의 **②** (`interface-master 가 계약을 확정한다`) |

> **읽는 사람에게 (2026-10-21 개정 — 혼자 개발 체제)**: 이 절의 어떤 것도 "이미 정해졌다" 는
> 뜻이 아니다. `openapi.yaml` 에서 🚧 와 `x-proposal` 이 붙은 오퍼레이션·스키마·필드가
> 전부 여기에 해당한다. **아래 열린 질문의 답은 요청서 18 에 표로 있고, 계약에 반영하는 것은
> 그 요청서를 처리할 때다.** 그 밖의 제품 결정이 필요하면 요청자(안덕호)에게 묻는다 —
> 되돌리는 비용은 구현 전이 가장 싸다.
> (2026-10-13 에는 이 자리가 **"협업자에게 — 반대 의견이 있으면 구현 전에 말해 달라"** 였다.
> 협업자가 2026-10-21 에 프로젝트를 떠나 그 경로가 없어졌다.)

### 20.1 한눈에 — 계약이 어떻게 바뀌나

| | 새로 생기는 것 | 바뀌는 것 | **바뀌지 않는 것** |
|---|---|---|---|
| 오퍼레이션 | `POST /auth/signup/hospital-admin`<br>`POST /uploads`<br>`GET /uploads/{id}/content`<br>`PATCH /hospitals/{id}/approval` | `GET /admin/hospitals`(파라미터·항목)<br>`GET /hospitals/{id}`(시야 둘) | `POST /auth/signup`<br>`POST /hospitals`<br>`POST /hospitals/{id}/admins`<br>`POST /partner-inquiries` |
| 스키마 | `HospitalApprovalStatus`<br>`AdminPosition`<br>`ManagedHospital`<br>`HospitalAdminSignUpRequest`<br>`HospitalAdminAuthSession`<br>`FilePurpose` · `UploadedFileRef` | `Hospital`(+`phone`·`addressDetail`)<br>`GeocodeResult`(+`region`)<br>`HospitalAdminAssignment`(+`position`)<br>`LegalDocument.slug`(+`partner-terms`) | `SignUpRequest`(**enum 그대로**)<br>`HospitalCreateRequest` |
| 그 밖 | 에러 코드 7개 · 상태 코드 `413`/`415` · 감사 `action` 3개 + `target_type` 1개 | §3 권한 표 · §3 `403`-vs-`404` 표 · §4 감사 표 | 페이지네이션·정렬·마스킹 규약 |

**이메일 형식 검사는 손대지 않는다.** 요청서의 "지금은 검사가 없습니다" 는 낡은 기술이다 —
클라이언트 가입·로그인, 서버 가입 모두 이미 검사한다. **서버 로그인만 일부러 안 하는데,
그것도 그대로 둔다**: 형식으로 거절하면 "이상한 입력 = 없는 계정" 이 새고, 규칙 이전에 만든
계정이 로그인하지 못한다 (`INVALID_CREDENTIALS` 를 한 코드로 둔 것과 같은 이유 — §11).

### 20.2 A. 가입 — **오퍼레이션을 나눈다** (`POST /auth/signup` 확장이 아니라)

db-master 의 권장과 같은 결론이고, 근거를 계약 쪽 언어로 적는다.

**토글 하나로 required 가 달라지는 스키마는 `oneOf` 가 된다.** 그 순간 `422` 의
`details[].field` 가 **어느 가지의 경로인지** 읽는 쪽에서 판단해야 한다. 이 폼은 칸이 10개가
넘고(병원 정보가 중첩 객체다) 화면이 칸마다 오류를 붙여야 한다 — `details` 규약(§11)이
지키려는 것이 바로 그것이다.

그 밖의 셋:

1. **일반 가입 흐름을 한 글자도 건드리지 않는다.** 요청서가 못 박은 조건이다
   ("토글을 끈 상태에서 지금과 똑같이 동작"). 스키마를 공유하면 그 보장이 **리뷰어의 눈**에
   달리게 된다.
2. **일어날 수 없는 에러가 섞이지 않는다.** `UPLOAD_NOT_FOUND`·`AGREEMENT_*` 는 일반 가입에서
   영원히 발생하지 않는다. 한 오퍼레이션에 모으면 클라이언트가 "이 코드가 내게 올 수 있는가" 를
   **계약에서 읽어낼 수 없다.**
3. **약관 `slug` enum 이 서로 달라야 한다.** 일반 가입에 `partner-terms` 가 섞여 오면 `422` 다
   (동의할 이유가 없는 약관에 동의한 기록을 만들지 않는다 — DB §14.8).
   **그 규칙이 곧 두 경로를 가르는 규칙**이고, 한 스키마 안에서는 표현할 수 없다.
   같은 이유로 `HospitalAdminSignUpRequest` 를 `SignUpRequest` 의 `allOf` 로 만들지 **않았다** —
   하위 스키마가 상위의 enum 을 좁히지 못한다.

비용은 `name`/`email`/`password` 세 필드의 중복이다. 둘은 **같은 폼의 두 제출 경로**이고
클라이언트는 제출 시점에 토글 값을 이미 안다 — 그 값이면 싸다.

**요청 본문에 `region` 이 없다.** 폼에 지역 칸이 없고 `hospitals.region` 은 NOT NULL 이라
서버가 주소에서 파생한다 → **열린 질문 ④** 로 이어진다.

**응답은 `AuthSession` + `hospital{id, approvalStatus}`** 다. 병원 전체를 돌려보내지 않는 이유:
그 값은 방금 보낸 입력이고, 완료 화면이 쓰는 것은 `병원 정보 입력하기` 의 이동 대상(id)과
상태 안내 둘뿐이다.

**`409` 코드는 기존 `EMAIL_ALREADY_REGISTERED` 를 쓴다.** db-master 가 넘긴 목록은
`EMAIL_TAKEN` 이었으나 **같은 사실에 코드를 둘 두지 않는다** (§11 의 판단 세 줄 참고).

### 20.3 B. 업로드 — ⓑ 를 제안하되 **보안 결정이라 열린 질문으로 남긴다**

가입 전이라 **토큰이 없다.** 이것이 이 조각 전체의 난점이다.

| 안 | 판단 |
|---|---|
| ⓐ 가입 요청 자체를 multipart | **기각** — JSON 계약이 깨진다. 중첩 `hospital` 객체와 약관 배열을 평탄화해야 하고 `details[].field` 가 폼 필드명과 어긋난다 |
| **ⓑ 비인증 사전 업로드 → 가입이 `fileId` 참조** | **제안.** 가입 요청이 JSON 그대로이고, 업로드 실패와 가입 실패가 화면에서 분리된다(파일을 다시 고르지 않고 재시도) |
| ⓒ 계정부터 만들고 두 번째 요청에서 병원 등록 | **기각** — 요청서의 "가입 한 번" 이 깨지고, **담당 병원 0곳인 `hospital_admin`** 이 정상 경로가 된다. DB §14.5 가 트랜잭션으로 막으려던 바로 그 상태다 |

**ⓑ 가 만드는 것은 인증 없이 바이트를 받는 자리 하나다.** 받아들인다면 넷이 같이 와야 한다:
크기 상한 **10 MiB**(`413`), **실제 바이트로 판정하는** 타입 제한 jpeg·png·pdf(`415`),
**IP 당 시간당 10회**(`429`), **24시간 후 고아 파일 파기 배치**.
숫자 셋은 전부 **제안**이고 운영이 조정할 값이다.

**응답에 URL 이 없다.** `fileId`·`originalName`·`byteSize` 셋뿐이다. URL 을 한 번이라도
발급하면 그것을 아는 사람 전부가 열람자가 되고, 요청서의 "열람 권한을 운영자로 제한" 이 무너진다.

**깨지는 방향을 한쪽으로 고정했다.** 파일 바이트는 트랜잭션에 참여할 수 없으므로(객체 저장소
쓰기는 롤백되지 않는다) 업로드가 가입보다 **먼저** 끝나고, 가입 트랜잭션은 메타행을
**조건부 UPDATE 로 claim** 한다. 그래서 "주인 없는 파일이 남는다"(배치가 치운다)는 일어나고
**"가입은 됐는데 서류가 없다" 는 일어나지 않는다.**

### 20.4 C. 서류 열람 — `GET /uploads/{id}/content`, 운영자 전용, 감사 대상

**서명된 임시 URL 을 발급하지 않는다.** §19 가 "업로드를 만들 때 서명 URL 로 다루는 것이 좋다"
고 적어 두었는데, **여기서 뒤집는다** — URL 이 생기는 순간 그것을 가진 사람이 열람자가 되고
**감사 로그가 비어 버린다.** 이 오퍼레이션이 존재하는 이유의 절반이 "열람을 한 자리로 모아
기록하는 것" 이다.

- `operator` 전용. **올린 본인(담당 `hospital_admin`)도 다시 내려받을 수 없다** — 요청서 그대로다.
  관리자 화면은 파일명과 `제출 완료` 만 보여주고 링크를 걸지 않는다
- `Cache-Control: no-store` — 공유 캐시·브라우저 디스크에 개인정보가 남지 않게
- 감사 1행: `action='hospital_document.view'`, `target_type='uploaded_file'`(**새 값**),
  **`pii_masked=false`**. `partner_inquiry.view` 와 같은 취급이다 (§4)
- 파기된 파일은 **`404`** 다. 행은 남는다 — 감사 로그가 `target_id` 로 이 파일을 가리키므로
  행을 지우면 "대상 없는 열람 기록" 이 된다

> **`action` 허용값 목록은 `backend/prisma/schema.prisma` 의 `AuditLog` 주석에도 박혀 있다.**
> 이 제안이 합의되면 **두 곳을 함께 고쳐야 한다** (§4 가 `consult_request.reschedule` 에서
> 겪은 것과 같다).

### 20.5 D. 승인 검수 — 자리를 **예약한다**

검수 화면은 이번 범위 밖이다(요청서 · DB §14.3 이 "전이 경로 없음" 으로 적는다).
그런데도 두 자리를 계약에 적은 판단과 근거는 이렇다.

| 자리 | 판단 | 근거 |
|---|---|---|
| `GET /admin/hospitals?approvalStatus=` | **적는다** | 같은 목록의 부분집합이고 응답 모양도 `scope` 도 같다. 경로를 나누면(`/admin/hospitals/pending`) 운영자 콘솔이 두 캐시 키로 같은 화면을 그린다. 항목의 `approvalStatus` 필드는 **검수와 무관하게도 필요하다** — 사이드 메뉴 배지(E) |
| `PATCH /hospitals/{id}/approval` | **자리만 예약한다** | **이것이 이 제안이 만드는 `pending` 상태의 유일한 출구**다. `HOSPITAL_AUTO_APPROVE` 를 끈 환경에서 이 오퍼레이션이 없으면 가입한 병원이 **영원히 환자 앱에 뜨지 않는다.** 미래의 편의가 아니라 **새 상태의 탈출구**라서 적었다. 본문·응답 모양은 검수 화면이 생길 때 다시 본다 |

**`PATCH /hospitals/{id}` 에 `approvalStatus` 를 끼우지 않았다.** 그 오퍼레이션은
`hospital_admin` 도 쓴다. 같은 본문에 승인 필드를 두면 **필드 단위 인가**가 하나 더 생기고
(지금 `isRecommended` 가 `422 FIELD_NOT_WRITABLE` 로 걸러지는 그 자리), 담당자가 자기 병원을
스스로 승인하는 경로를 **거절로 막는** 모양이 된다. 역할이 다르면 오퍼레이션을 나눈다
(`PUT /doctors/{id}/verification` 과 같은 모양).

**`approved → 무엇이든` 전이는 없다.** 승인 취소는 상태 되돌리기가 아니라 `deleted_at` 이다 —
노출 판정이 `deletedAt === null && approvalStatus === 'approved'` 하나이므로, 두 수단을 겹쳐 두면
"왜 안 보이는가" 의 답이 둘이 된다. 같은 이유로 **`pending` 으로 되돌리는 값을 받지 않는다**
(재제출 화면이 없어 병원이 아무것도 할 수 없는 상태에 갇힌다 — 열린 질문 ①).

### 20.6 E. 기존 계약에서 바뀌는 것

**1. `GET /admin/hospitals` 항목 → `ManagedHospital`**
공개 `Hospital` + `approvalStatus` + **요청자 본인의** `position`.
두 필드를 `Hospital` 에 넣지 않은 이유: `Hospital` 은 비로그인 응답에도 쓰인다.
스키마를 나누면 공개 응답에 **새어 나갈 길 자체가 없다** — `piiMasked` 를 플래그로 둔 것과 달리
여기서는 *필드가 존재하지 않는 것*이 가장 싼 보장이다.
`position` 은 요청 05 에서 **저장될 곳이 없어 미뤄진** 사이드 메뉴 줄을 닫는다
(`{직책 라벨} · {승인 완료 · 앱 노출 중 | 승인 대기}`). `operator` 가 보는 목록에서는 항상 `null` 이다.
합의 전에는 두 필드가 `required` 가 아니다 — **그것이 "아직 제안" 의 기계적 표현**이다.

**2. 공개 응답에는 `approvalStatus` 가 없다.**
공개 응답에 실리는 병원은 **전부 `approved`** 다. 값이 하나뿐인 필드는 정보가 아니고,
클라이언트가 그 값으로 다시 거르기 시작하면 **같은 판정이 두 곳**에 생긴다.

**3. `Hospital.phone` · `Hospital.addressDetail` 추가 — 공개 노출은 열린 질문 ③**
`hospitals` 에 전화번호 칸이 **아예 없었다**(fixture 에도 없다 — 병원 상세에 전화번호가 보이지
않는 이유다). 가입 폼의 `치과 대표번호` 가 이 값을 만든다.
**공개하는 쪽을 권한다** — 요청 08 이 확정한 알림 문구가 `변경이 필요하면 **병원에 전화해
주세요**` 인데 **지금 그 번호가 앱 어디에도 없다.** 상세 주소도 찾아가는 데 필요한 정보다.
다만 제품 결정이라 열린 질문으로 둔다. 기존 11곳에는 값이 없어 `null` 이다.

**4. `GET /hospitals/{id}` 가 시야 둘을 갖는 유일한 오퍼레이션이 된다.**
공개 시야에서 승인 전 병원은 **`404`**(§3 표에 행을 더했다). `403` 이 아닌 이유는
"이 id 에 심사 중인 병원이 있다" 가 새면 **id 대입으로 입점 준비 중인 병원 수를 셀 수 있기**
때문이다. 목록·검색·지도·전문의 등 **다른 공개 질의는 분기가 없다** — 전부 `isPubliclyListed` 를
걸 뿐이다 (적용 자리 전체 목록은 DB §14.4 의 표).

**5. `POST /hospitals`(운영자) 계약은 그대로다.**
요청 스키마도 필수 항목도 바뀌지 않는다. 서버가 정하는 값에 `approvalStatus='approved'` +
`approvalSource='operator'` 가 더해질 뿐이다 — **기본값(`pending`)에 기대지 않고 명시해서 쓴다.**
운영자가 만든 병원을 `pending` 으로 두면 운영자가 자기가 만든 병원을 자기가 다시 승인해야 한다.
DB §14.16 이 가입 경로를 위해 `thumbnail`·`priceRange` 의 **DB 기본값**을 제안하지만
**계약은 느슨해지지 않는다.**

**6. `GeocodeResult.region` 추가** — `hospitals.region` 이 NOT NULL 인데 가입 폼에 지역 칸이 없다.
가장 정확한 출처는 주소 검색을 중계하는 이 응답(`region_2depth_name`)이고, 지금 서버가 그 값을
버리고 있다. → 열린 질문 ④.

**7. §3 권한 표 · §3 `403`-vs-`404` 표 · §4 감사 표** — 위 각 절에서 갱신했다.

**8. `LegalDocument.slug` 에 `partner-terms` 추가.** `SignUpRequest.agreedTermsVersions[].slug`
enum 은 **그대로 셋**이다 — 일반 가입에 파트너 약관이 섞여 오면 `422` 라는 규칙을 enum 이
그대로 표현한다. `legal_documents` 에 "누구에게 필수인가" 컬럼을 만들지 않는다:
필수성은 **문서의 성질이 아니라 가입 경로의 성질**이고, 판정은 `requiredAgreementSlugs(kind)`
순수 함수 하나다 (DB §14.8).

> ⚠️ **새 slug 가 만드는 유일한 회귀 위험**: §11.3 의 재동의 판정("`requires_agreement=true` 인
> 최신 버전 중 내가 동의하지 않은 것")을 그대로 두면 **전 일반 사용자에게 파트너 약관 재동의
> 팝업이 뜬다.** 대상 slug 집합을 먼저 `requiredAgreementSlugs(역할)` 로 좁혀야 한다.

### 20.7 열린 질문 — 여덟 개 (DB §14.17 그대로)

> **답: 요청서 18(`2026-10-21-18-병원관리자-직접가입.md`) 의 표.** (2026-10-21 개정 — 혼자 개발 체제.)
> 2026-10-13 에는 협업자 확인을 기다리던 목록이고, 질문 자체는 **기록으로 남겨 둔다** —
> 어떤 답이 무엇을 바꾸는지가 여기 적혀 있기 때문이다. 계약에 반영하는 것은 요청서 18 을 처리할 때다.

**번호는 DB §14.17 과 같게 두었다.**

1. **`rejected` 와 `approvalNote` 를 지금 만들 것인가.** 오늘 그 값을 쓰는 코드가 없다
   (검수 화면이 범위 밖). **지금 만들기를 권한다** — 값 하나와 nullable 컬럼 하나라 비용이 없고,
   노출 판정을 `=== 'approved'` 로 적어 두면 값이 늘어도 안전하다.
   반대면 `pending|approved` 둘로 시작해도 노출 판정은 그대로 성립한다.
   **재제출(`rejected → pending`) 화면이 없는 것**은 어느 쪽이든 남는 구멍이다.
2. **업로드를 어떤 모양으로 받을 것인가 — 가입 전이라 토큰이 없다.**
   ⓐ 가입 요청을 multipart / **ⓑ 비인증 사전 업로드 + id 참조** / ⓒ 계정부터 만들고 두 번째 요청.
   **ⓑ 를 제안하지만 보안 표면을 늘리는 결정이라 요청자 확인이 필요하다** (§20.3 —
   2026-10-13 에는 "협업자 확인" 이었다. 답은 요청서 18 의 표).
   크기 상한 10 MiB · IP 당 시간당 10회 · 24시간 고아 파기 — **숫자 셋 전부 제안**이다.
3. **사업자등록증을 교체하면 승인이 풀려야 하는가.** `doctor_verifications` 는 자격증이 바뀌면
   재검수를 강제한다. 병원도 같다면 새 파일 + `approvalStatus='pending'` 되돌림이 필요하고,
   **그 순간 앱에서 병원이 사라진다.** 교체 화면이 아직 없어 미결이다.
   (결정 문서 수준의 질문이다 — `0001` 이 그렇게 적는다.)
4. **주소 검색 응답에 지역(`region_2depth_name`)이 들어오는가.** `hospitals.region` 이 NOT NULL 인데
   가입 폼에 지역 칸이 없다. **이 값이 비면 탐색의 지역 표시가 깨진다.**
   계약에는 `GeocodeResult.region`(nullable)을 제안해 두었고, 카카오 응답에 실제로 실리는지
   확인이 필요하다. 없으면 서버가 주소 문자열에서 파생한다(`regionOf`).
5. **파일 보존 기간 숫자.** 고아 24시간 · 반려 30일은 제안이다.
   **반려 입점 문의의 보존 기간과 함께 정해야 한다** — 서로 다르면 "같은 병원의 서류는 지웠는데
   문의의 연락처는 남은" 상태가 된다.
6. **`/partner-inquiry` 화면을 남길 것인가.** 데이터·계약은 공존이고
   (직접 가입은 `partner_inquiries` 행을 만들지 않는다), 입구 둘은 **제품 결정**이다.
   같은 의도를 받는 입구가 둘이면 사용자가 어디로 갈지 모른다.
   운영자의 **대기 큐도 둘**이 된다(문의 심사 + 병원 승인).
7. **승인 결과 "문자"(SMS) 발송 수단이 없다.** 요청서의 완료 화면이
   "사업자등록증을 확인한 뒤 승인 결과를 **알림과 문자로** 알려드려요" 라고 약속한다.
   **알림(`notifications`)은 되고 문자는 되지 않는다.**
   → 화면 문구에서 "문자" 를 빼거나, 발송 수단을 먼저 정해야 한다.
   (§17-25 푸시 알림과 같은 뿌리의 미결이다.)
8. **비밀번호 찾기의 우선순위.** 결정 0001 미결 6 이 이미 올려 둔 항목인데,
   **직접 가입이 그 압력을 한 번 더 올린다** — 이제 계정도 병원도 본인만 만들 수 있고,
   **대신 들어가 줄 사람이 없다.** 운영자가 병원 담당자 계정을 복구할 수단이 0 이다.

**interface-master 가 여기에 하나 더한다:**

9. **`Hospital.phone`·`addressDetail` 을 공개 응답에 내릴 것인가** (§20.6-3).
   계약에는 필드를 두었지만 **공개 시야에서 채울지는 제품 결정**이다.
   권고는 "내린다" 이고 근거는 요청 08 의 알림 문구(`병원에 전화해 주세요`)다.

---

## 21. 🚧 병원 정보 확장 — 시술별 가격 · 사진 · 특징 — **제안 — 요청자 답 반영 대기 → 요청서 19 (2026-10-13 제안)**

| | |
|---|---|
| **상태** | 🚧 **제안이다. 요청자 답 반영 대기 → 요청서 19** (2026-10-13 제안 · **2026-10-21 개정 — 혼자 개발 체제**). 이 절과 `openapi.yaml` 에서 **§21 을 가리키는** 🚧 표시가 붙은 스키마·필드·설명은 **확정 계약이 아니다.** 반영 전까지 **구현하지 않는다** — **반영은 요청서 19 를 처리할 때 한다** |
| **선행 조건** | **§20 의 `POST /uploads`**(→ 요청서 18). 사진이 같은 오퍼레이션·같은 테이블(`uploaded_files`)을 쓴다. 그 조각이 반영되지 않으면 **사진만 기존 URL 입력으로 남고 나머지(가격·특징·한 줄 소개)는 그대로 성립한다** |
| **요구사항 출처** | `docs/features/requests/2026-10-12-07-병원정보-시술별가격-사진.md` → 다시 쓴 **`2026-10-21-19-병원정보-시술별가격-사진.md`**, 데이터 설계 `docs/database/README.md` **§16** 전부 (§16.15 가 이 절에 넘긴 표) |
| **대상 화면** | `docs/features/admin-hospital-edit.md` (병원 관리자 **05 병원 정보 등록**) · `docs/features/hospital-detail.md` (사용자 **U5 병원 상세**) |
| **이 절이 받는 것** | DB §16.14 체크리스트의 **①** (`interface-master 가 계약을 확정한다`) |

> **읽는 사람에게 (2026-10-21 개정 — 혼자 개발 체제)**: §20 과 같다 — 이 절의 어떤 것도
> "이미 정해졌다" 는 뜻이 아니다. **§20(요청 06 → 요청서 18)과 §21(요청 07 → 요청서 19)은
> 따로 반영될 수 있다.** 겹치는 자리는 `POST /uploads` 하나뿐이고, 거기서도 값(`purpose`)이
> 규칙을 가른다. **열린 질문의 답은 요청서 19 에 표로 있고, 반영은 그 요청서를 처리할 때다.**
> (2026-10-13 에는 이 자리가 **"협업자에게 — 반대 의견이 있으면 구현 전에 말해 달라"** 였다.)

### 21.1 한눈에 — 계약이 어떻게 바뀌나

| | 새로 생기는 것 | 바뀌는 것 | **바뀌지 않는 것** |
|---|---|---|---|
| 오퍼레이션 | **0개** | `PATCH /hospitals/{id}`(본문·저장 규칙)<br>`POST /hospitals`(본문)<br>`POST /uploads`(`purpose` 값 1개·인증·응답)<br>`GET /hospitals/{id}`(응답 필드) | `GET /hospitals`(목록)<br>`GET /uploads/{id}/content`<br>검색·지도·전문의·찜 |
| 스키마 | `HospitalProcedurePrice`<br>`HospitalProcedureInput` | `Hospital`(+`procedures`·`tagline`)<br>`HospitalFeatures`(+키 4)<br>`HospitalCreateRequest`·`HospitalUpdateRequest`(+`procedures`·`tagline`, `images` 실사용)<br>`FilePurpose`(+`hospital_photo`)<br>`UploadedFileRef`(+`publicUrl`)<br>`HospitalCompleteness*`(항목 7→9) | `Hospital.images`·`thumbnail`·`procedureIds` 의 **모양**<br>`PriceRange`<br>`ProcedureId`(13종 그대로) |
| 그 밖 | 에러 코드 8개(§11) · 요청 한도 1줄(§16) | — | 페이지네이션·정렬·마스킹·감사 규약 |

**새 오퍼레이션이 0개인 것이 이 제안의 성격이다.** 늘어나는 것은 **이미 있는 저장 경로가 받는 값**
뿐이고, 그래서 **읽는 쪽(환자 화면)의 회귀 위험이 거의 없다** — `images`·`thumbnail`·`procedureIds`
는 모양이 그대로라 병원 카드·검색·지도·찜 투영이 한 글자도 바뀌지 않는다.

### 21.2 A. 시술별 가격 — **요청 본문의 모양이 바뀐다** (`procedureIds` → `procedures`)

db-master 의 권장과 같은 결론이고, 근거를 계약 쪽 언어로 적는다.

```jsonc
// 지금
"procedureIds": ["implant", "inlay"]

// 제안
"procedures": [
  { "procedureId": "implant", "priceMin": 1200000, "priceMax": 1800000 },
  { "procedureId": "inlay",   "priceOnRequest": true },
  { "procedureId": "crown" }                                  // 체크만 (가격 미입력)
]
```

**배열을 둘로 나누지 않는다**(`procedureIds` + `prices`). 나누면 **"체크는 됐는데 가격 배열에 없는
시술"·"가격은 있는데 체크 안 된 시술"** 을 계약이 허용하게 된다 — 저장소가 한 행으로 없앤 상태를
계약이 되살리는 모양이다. 화면에서도 가격 칸은 **체크한 줄에만** 생긴다. 입도가 같으면 배열도 하나다.

**응답의 `procedureIds` 는 남는다.** 병원 카드·상세·검색·전문의가 전부 쓰는 필드이고,
`procedures[].procedureId` 에서 **파생되는 읽기 전용 값**이다(두 출처가 아니다).
**요청에 둘 다 오면 `422`** — 우선순위 규칙을 만드는 것은 "둘 다 보내도 된다" 는 신호가 된다.

**금액 단위는 원(정수)다.** 화면의 `만원` 칸은 표시 단위이고 변환은 클라이언트가 한다. 근거는
`info.description` 의 공통 규약("금액: 정수(원)")과 **한 응답 안의 단위 혼재**다 — `priceRange`(원)와
시술 가격(만원)이 같이 내려오면 폴백 비교에서 `45` 와 `450000` 중 무엇이 큰지를 **읽는 사람이** 틀린다.

**가격이 붙는 단위는 서버 시술 13종뿐이다** (`ProcedureId`). 세부 31개 중 18개는 서버에 마스터가 없고
화면에서도 체크가 막혀 있다(`준비중`) — **저장할 값이 애초에 없다.** 나머지 13개는 서버 id 와 1:1 이라
요청서의 확인 항목("인레이를 체크하고 가격을 넣으면 상세에 인레이와 그 가격이 보인다")이 그대로
성립한다. 18개까지 받으려면 `procedures` 마스터가 커지고 **홈·탐색·커뮤니티의 노출 목록이 함께
바뀐다** — 요청서가 "노출 규칙은 그대로" 라고 못 박은 것과 어긋나므로 범위 밖이다 (열린 질문 5).

**시술 이름을 응답에 싣지 않았다.** db-master 는 "서버가 아는 시술명" 을 함께 내리자고 넘겼지만,
이름의 출처는 이미 `GET /procedures`(1시간 캐시되는 13개 마스터)와 프런트 `taxonomy.ts` 다.
여기에 또 실으면 **같은 라벨이 두 곳에서 갈린다**(칩은 `인레이`, 상세는 `인레이(레진)` 같은 일이
조용히 생긴다). 필요해지면 그때 더하는 비용이 싸다.

### 21.3 B. ⚠ **`PATCH` 의 전체 교체 → 머지** — 이 제안에서 가장 조용한 사고 지점

지금 서버는 `procedureIds` 로 조인 행을 **전체 교체**한다(delete all → insert).
그 테이블에 가격 컬럼이 올라가는데 교체를 그대로 두면 —

> **담당자가 병원 이름만 고쳐 저장해도 시술별 가격이 전부 사라진다. 오류는 한 줄도 뜨지 않는다.**

그래서 계약이 저장 규칙까지 말한다. **`procedures` 는 머지다:**

| 요청의 상태 | 서버 |
|---|---|
| 필드 **생략** | 시술도 가격도 **건드리지 않는다** (부분 수정의 뜻 그대로) |
| 배열에 있는 시술 | **upsert** — 보낸 가격 값으로 덮는다 |
| 배열에 **없는** 기존 시술 | **delete** (체크 해제 = 행 삭제 = 가격도 함께 사라짐 — 화면과 같은 뜻) |
| 빈 배열 `[]` | `422` (`minItems: 1` 유지) |

가격만 지우려면 `{ procedureId, priceMin: null, priceMax: null, priceOnRequest: false }` 를 보낸다 —
그것이 "체크는 했고 아직 안 적음" 이고 **정상 상태**다.

**사진은 반대로 전체 교체다.** 사진 행에는 "그 행에만 붙은 입력값" 이 없고 **순서가 곧 전부**라
교체 + `sort_order` 재부여가 머지보다 단순하다. **두 규칙이 다르다는 사실 자체를 계약에 적는 것**이
이 절의 일이다 — 적지 않으면 구현이 둘 중 하나로 통일하고, 어느 쪽으로 통일해도 한쪽이 깨진다.

**한 요청 = 한 트랜잭션**: 시술 머지 · 진료시간 · 사진 교체 · `thumbnail` 동기화 · 파일 claim 이
함께 커밋되거나 함께 롤백된다. **파일 바이트만 그 밖**이고(객체 저장소 쓰기는 롤백되지 않는다),
그래서 깨지는 방향이 **"주인 없는 파일이 남는 쪽"** 으로만 고정된다 — §20.3 과 같은 구조다.

### 21.4 C. 가격 표시 — **응답에 둘 다 싣고, 고르는 규칙은 한 곳**

요청서가 "기존 전체 가격대는 지우지 말고 **대신 보여주는 값**으로 남겨 두기" 라고 했다.
계약은 `priceRange` 를 그대로 두고 **역할만** 바꾼다.

| 조건 | 병원 상세 `시술·가격` |
|---|---|
| `procedures` 에 가격 상태가 정해진 시술이 1개 이상 | 시술별 목록 |
| 전부 미입력이고 `priceRange` 가 비어 있지 않음 | 전체 가격대 한 줄 |
| 둘 다 없음 | 아무것도 그리지 않는다 |

- **판정 기준은 "시술 행이 있는가" 가 아니라 "가격 상태가 정해진 시술이 있는가" 다.**
  기존 11곳은 시술만 체크돼 있어 전부 미입력 — **마이그레이션 직후 화면이 지금과 똑같다.**
- **섞지 않는다.** 시술별 목록을 그릴 때 가격 없는 줄에 전체 가격대를 내려 적지 않는다.
  적는 순간 **그 시술의 가격이라는 거짓말**이 되고, 비교하려고 만든 기능이 비교를 망친다.
- **서버가 골라서 하나만 내리지 않는 이유**: 같은 응답을 병원 카드(`priceRange` 를 쓴다)와 상세가
  함께 쓴다. 서버가 상세 기준으로 하나를 고르면 **카드의 가격 줄이 사라진다.**
  **값은 둘 다, 규칙은 하나**(`hospitalPriceSection`) — 규칙이 하나면 두 화면이 어긋나지 않는다.

### 21.5 D. 사진 — 업로드는 §20 의 오퍼레이션을 재사용하고, **규칙은 값이 가른다**

| | `business_registration` (06) | `hospital_photo` (**07**) |
|---|---|---|
| 인증 | 없음 (가입 전) | **필수** — 로그인한 담당자다 |
| 타입 | jpeg·png·pdf | **jpeg·png** |
| 응답 URL | **없다** | **공개 URL**(`publicUrl`) |
| 읽기 | `GET /uploads/{id}/content`(운영자·감사) | 공개 URL 하나 |
| 감사 로그 | 열람 1행 | **없음** (환자에게 보이는 공개물) |

**사진에 URL 을 발급해도 되는 이유**: **그 URL 을 아는 사람 전부가 열람자여도 되는 파일**이다.
§20.3 이 URL 을 금지한 것은 열람자를 운영자로 좁혀야 하는 파일이었기 때문이고, 판정은 지금도
`canReadFile(purpose, role)` 한 함수에 남는다 — 그 함수는 고치지 않는다.

**쓰기 입력은 `string[]` 그대로다.** 업로드 응답의 `publicUrl` 을 `images[]` 에 그대로 넣고,
서버는 저장 시점에 **자기가 발급한 값 그대로 역조회**해 그 파일을 claim 한다 —
**URL 을 파싱하지 않는다**(URL 형태가 아직 결정 전이다 — 열린 질문 7). `fileId` 배열을 따로 받지
않은 이유: 응답 `Hospital.images: string[]` 를 바꾸지 않기 위해서다. 쓰기만 id 로 받으면 폼이
**기존 외부 URL 사진과 새로 올린 사진을 다른 배열**로 들어야 하고, 순서(= 대표 사진)가 두 배열에
걸쳐 "몇 번째가 대표인가" 의 답이 둘이 된다. → **서버가 발급 URL 로 파일 행을 되찾을 수단이
필요하다 (열린 질문 11).**

**대표 사진 = 첫 장.** `isPrimary` 플래그를 만들지 않는다 — `sort_order=0` 인 행과 `isPrimary=true`
인 행이 다를 수 있고, 유일성을 강제할 수단도 없다. `thumbnail` 은 **남기되** 같은 트랜잭션이 첫 장의
URL 로 동기화한다. 쓰는 자리가 하나라 두 값이 갈릴 수 없고, known-issue
(`수정 화면에서 대표 이미지를 바꿔도 상세 사진이 그대로`)가 **그 동기화로 사라진다.**
같은 요청에 `thumbnail` 과 `images[0]` 을 **서로 다르게** 보내면 `422` 다 (열린 질문 12).

**claim 은 조건부 UPDATE 다** — 내 병원 것이거나 주인 없는 파일이고, 내가 올렸고, 파기되지 않았을
때만. 아니면 트랜잭션 전체를 되돌리고 `422 UPLOAD_NOT_FOUND`. **조건이 없으면 id 를 바꿔 가며 남의
파일을 자기 병원 사진으로 끌어올 수 있다 — id 가 추측하기 어려운 것은 통제가 아니다.**

### 21.6 E. 병원 특징 — **칩 9개 중 둘은 읽기 전용 파생값**

`HospitalFeatures` 에 키 **4개**가 는다: `sedation`·`accessibility`(쓰기 가능),
`nightCare`·`weekend`(**`readOnly: true`**). 기존 6개와 `required` 는 그대로다.

- **파생 둘을 저장하지 않는 이유**: 같은 사실이 두 곳에 있으면 어긋난다. 저장값이면
  "수요일을 21시까지로 바꿨는데 야간 칩은 꺼져 있는 병원" 이 생기고, **그것이 요청서의 확인
  항목**이다(`수요일 진료를 21:00까지로 바꾸면 야간 진료가 자동으로 켜진다`). 저장값으로 두면
  켜 주는 코드가 관리자 저장·운영자 `PATCH`·시드·이관마다 필요하고, **한 곳만 빠뜨리면 조용히 어긋난다.**
- **요청에 오면 `422 FEATURE_NOT_WRITABLE`** — 조용히 무시하면 "껐는데 다시 켜진다" 가 된다.
  ⚠️ **프런트가 주의할 자리**: `features` 를 응답에서 받아 그대로 돌려보내는 왕복 저장은
  **파생 키를 반드시 빼야 한다.** 계약에서는 `readOnly: true` 가 그것을 기계적으로 말한다
  (OpenAPI 에서 `readOnly` 는 "요청 본문에 보내면 안 된다" 는 뜻이다).
- ⚠️ **`nightCare` 는 파싱에 의존한다.** `businessHours[].hours` 가 자유 문자열이라
  (`10:00 - 19:00`, `휴진`, `09:00-13:00 / 14:00-18:00`) 읽을 수 없는 입력이 남고, 그때는 **`false`**
  다 — **거짓 광고가 되지 않는 쪽**으로 깨뜨린다. `weekend` 는 요일·휴진 플래그만 보므로 견고하다.
  제대로 고치는 길(`hours` 구조화)은 07 보다 큰 변경이다 (열린 질문 3).
- **`cctv` 를 계약에서 내리지 않았다.** 요청서의 칩 9개에 없지만 값도 배지도 지금 있다 —
  폼에서만 빼면 **켜져 있는 병원이 끌 수 없는 값**이 된다 (열린 질문 1).
- **`nightConsult`(야간상담)와 `nightCare`(야간 진료)는 다른 사실이다.** 그런데 탐색의 조건 칩
  `진료시간` 이 실제로 거르는 값은 `nightConsult` 다. 칩의 기준을 옮길지는 열린 질문 2이고,
  이번 범위에서는 **둘 다 두고 배지 문구만 구분**하기를 권한다 — 옮기면 필터가 컬럼 `WHERE` 가
  아니라 `business_hours` 조인·파싱이 되어 **목록 질의가 무거워진다.**

### 21.7 F. 한 줄 소개 — `Hospital.tagline`

- **`introduction`(상세의 긴 소개)과 다른 필드다.** 합치지 않은 이유는 완성도 항목
  `introduction`(30자 이상)이 **긴 소개**를 묻고 있어서다 — 한 줄 소개를 같은 칸에 넣으면
  그 판정이 무엇을 묻는지 알 수 없게 된다.
- **빈 문자열이 정상값**이고 `null` 이 아니다. 카드가 묻는 것은 "그릴 줄이 있는가" 하나뿐이라
  구분할 소비자가 없고, 노출 on/off 플래그도 필요 없다(비우면 안 보인다).
- **40자 초과는 자르지 않고 `422 TAGLINE_TOO_LONG`.** 서버가 말없이 자르면 병원이 쓴 문장이 바뀐다.

### 21.8 G. 완성도 — 항목 **7 → 9**, 그리고 **바가 내려간다**

`HospitalCompletenessItemKey` 가 비워 둔 두 자리(`procedurePrices`·`photos`)가 **입력 수단을 얻었다.**
순서는 `시술 → 시술별 가격`, `대표 이미지 → 병원 사진` — 환자 화면에서 비는 자리가 이웃하도록 둔다.

- **`procedurePrices` 는 "모든 시술이 가격 또는 `상담 후 안내`" 일 때 충족이다.** 하나만 적고
  100% 가 되면 "환자가 비교할 수 있다" 는 **거짓 신호**가 된다. 가혹하지 않은 이유는
  **`상담 후 안내` 가 클릭 한 번**이라서다 — 가격을 공개하지 않기로 한 병원도 100% 에 닿는다.
- **`thumbnail` 과 `photos` 를 둘 다 둔다** — 1~2장 상태에서 갈리는 **다른 질문**이다.
- ⚠️ **마이그레이션 직후 기존 병원의 완성도가 내려간다** (7/7 → 7/9 = 78%). **의도된 것이고,
  릴리스 노트에 적어야 한다** — 적지 않으면 담당자는 "아무것도 안 했는데 점수가 깎였다" 로 읽는다.
  `percent` 의 **"전부 충족이 아니면 99 상한"** 은 고칠 것이 없다. 바로 이 날을 위한 장치였다.
- `target` 어휘에 **`procedures`·`images`·`tagline`** 이 더해지고, 항목 `procedures` 의 `target` 이
  `procedureIds` → `procedures` 로 옮겨간다. **완성도 항목의 `target` 과 `422 details[].field` 가
  같은 어휘여야** 화면이 포커스 이동 코드를 하나만 들고 있을 수 있다.

### 21.9 H. `422` 코드와 `details[].field` 어휘

코드 표는 **§11 에 있다**(`PRICE_*` 넷 · `PROCEDURE_DUPLICATED` · `TOO_MANY_IMAGES` ·
`TAGLINE_TOO_LONG` · `FEATURE_NOT_WRITABLE`, 그리고 재사용하는 `UPLOAD_NOT_FOUND`).
여기서는 두 가지만 적는다.

1. **`field` 는 인덱스 경로다** — `procedures[2].priceMin`, `images[11]`, `tagline`.
   `doctors[2].name` 과 같은 규약(§11)이고, 그래야 폼이 **그 줄의 그 칸**을 짚는다.
   묶음 키는 `procedures`·`images`·`tagline` 이며 완성도 `target` 과 같은 값이다.
2. **`UPLOAD_ALREADY_CLAIMED` 를 만들지 않았다.** db-master 후보에 `409` 로 있었지만,
   담당자가 **자기 병원의 같은 사진을 다시 저장하는 것은 정상 동작**이라 이 코드가 뜨는 경우는
   남의 파일을 가리켰을 때뿐이다 — 그것을 알려 주면 §20.3 이 막은 누출이 그대로 열린다.

### 21.10 계약에 적지 않은 것 (데이터·화면에만 있는 것)

| 적지 않은 것 | 왜 |
|---|---|
| `앱 화면 미리보기` 엔드포인트 / 임시저장(draft) | 폼이 들고 있는 **저장 전 값**으로 그리는 클라이언트 렌더다. 서버에 "저장되지 않은 병원 정보" 라는 두 번째 진실을 만들지 않는다 |
| 저장 후 `저장됐어요` 안내 | `200` 응답의 화면 표현이다 |
| 섹션 이동 탭 · 대분류 요약(`N개 선택 · 앱 노출`) | 클라이언트 계산이다. 서버가 세어 줄 이유가 없다 |
| 비급여 고시가와의 일치 검증 | **대조할 데이터가 서버에 없다.** 책임 경계를 화면 문구로만 말한다 (요청서 그대로) |
| 할인 가격 필드 | `promotions` 가 받는다 — "할인 가격은 이벤트에서 따로 등록" (요청서) |
| 가격 이력 조회 | 보는 화면이 없다. 감사 대상도 아니다(열람·심사가 감사 대상이다 — §4) |
| 목록 응답(`GET /hospitals`)의 `procedures` | 상세가 유일한 소비자다. 비교표를 바꾸면 그때 더한다 (열린 질문 9) |

### 21.11 열린 질문 — 열두 개 (1~10 은 DB §16.16 과 번호가 같다)

> **답: 요청서 19(`2026-10-21-19-병원정보-시술별가격-사진.md`) 의 표.** (2026-10-21 개정 — 혼자 개발 체제.)
> 2026-10-13 에는 협업자 확인을 기다리던 목록이고, 질문 자체는 **기록으로 남겨 둔다.**
> 계약에 반영하는 것은 요청서 19 를 처리할 때다.

1. **CCTV 설치 칩을 어떻게 할 것인가.** 요청서의 칩 9개에 없는데 **값도 배지도 지금 있다.**
   폼에서만 빼면 켜져 있는 병원이 끌 수 없다. **칩 10개로 남기기를 권한다.**
   내리기로 하면 필드는 남기되 배지도 함께 내려야 한다.
2. **`nightConsult`(야간상담)와 파생 `nightCare`(야간 진료)의 관계.** 탐색 `진료시간` 칩이 실제로
   거르는 값은 앞의 것인데, 환자가 기대하는 것은 뒤의 것에 가깝다. 칩의 기준을 옮길지가 질문이고,
   옮기면 필터가 `business_hours` 조인·파싱이 된다. **이번 범위에서는 둘 다 두고 문구만 구분**을 권한다.
3. **`businessHours[].hours` 를 구조화할 것인가.** 자유 문자열이라 `nightCare` 파생이 파싱에
   의존한다. 쪼개면 파생이 정확해지고 진료시간 필터도 가능해지지만 **관리자 폼·계약·기존 11곳
   이관이 따라오는 별도 작업**이다.
4. **가격의 `0`·상한 규칙.** `min > 0`, 상한 **1억원**은 제안값이다. 풀마우스 임플란트 등을 생각하면
   더 올려야 할 수도 있다. (계약에는 `minimum: 1` / `maximum: 100000000` 으로 적어 두었다.)
5. **세부 시술 18개에 가격을 적고 싶다는 요구가 오면** — `procedures` 마스터 확장 + "저장은 되지만
   노출 목록에는 없는 시술" 이라는 축이 함께 필요하다. **07 범위 밖**이다.
6. **업로드 인증** — 병원 사진은 로그인 뒤에 올리므로 `hospital_photo` 는 **인증 필수**로 못 박을 수
   있고, §20 의 비인증 업로드 결정이 어느 쪽으로 가도 영향받지 않는다. **확인만 받으면 된다.**
7. **사진 공개 URL 의 형태** — ⓐ 공개 `GET /files/{fileId}` · ⓑ 저장소 공개 URL · ⓒ 정적 경로.
   **계약은 어느 쪽이든 같다**(`publicUrl` 문자열). 다만 ⓑ 는 파기 후에도 URL 이 살아 있을 수 있어
   **파기 절차가 저장소 객체 삭제까지** 해야 한다.
8. **사진 파기·보존 기간.** 사진을 빼면 표시 행은 사라지고 파일 행은 남는다. 고아 사진의 보존은
   **7일**(실수 복구 여지)을 제안한다 — 서류의 24시간과 **다른 값**이다.
9. **탐색 `가격 비교표` 를 시술별 가격으로 바꿀 것인가.** 시술 칩으로 좁힌 상태라면 그 시술의
   `priceMin` 이 비교표가 원래 말하려던 숫자다. 바꾸면 **목록 응답에 `procedures[]` 가 필요해지고
   응답 크기가 늘어난다.** 요청서에 없어 이번에 하지 않는다.
10. **전체 가격대(`priceRange`)의 폐기 시점과 조건.** 지금 정하지 않는다. `procedurePrices`
    완성도 충족률이 그 판단 근거다.

**interface-master 가 여기에 둘 더한다:**

11. **사진의 쓰기 입력을 공개 URL 문자열로 받는 것이 맞는가** (§21.5). 응답
    `Hospital.images: string[]` 를 지키려고 그렇게 제안했는데, 그러려면 **서버가 자기가 발급한 URL
    로 파일 행을 되찾을 수단**이 있어야 한다 (URL 을 **파싱하지 않고** — 열린 질문 7 이 열려 있으므로).
    `uploaded_files` 에 발급 URL 을 담는 칸이 필요한지, `storage_key` ↔ URL 이 **되돌릴 수 있는 함수**
    인지는 **db-master·백엔드 확인 사항**이다. 되돌릴 수 없다면 대안은 `images` 를
    `{ url } | { fileId }` 객체 배열로 바꾸는 것인데, **그 순간 응답 모양도 함께 바뀐다**(프런트 회귀).
12. **`thumbnail` 과 `images[0]` 이 한 요청에서 어긋날 때.** 제안은 **`422`** 다(판정이 두 곳이 되지
    않게). "`images` 가 이긴다" 로 해도 되지만, 그러면 담당자가 지정한 대표 이미지가 **조용히**
    바뀐다 — 지금 겪고 있는 known-issue 와 증상이 같아진다. 합의가 필요하다.
    (덧붙여 **`POST /uploads` 의 `security` 를 두 줄(`{}` + `bearerAuth`)로 바꿨다** — §20 은
    "조건부로 두지 말라" 고 적었지만, `security: []` 만 두면 계약이 "토큰을 보내면 안 된다" 고
    말하게 된다. 생성기·게이트웨이가 그 줄을 읽으므로 뒤집었고, **값별 규칙은 여전히 설명이 못 박는다.**)
