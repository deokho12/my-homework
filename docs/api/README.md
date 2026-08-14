# 몰라몰라 REST API — 설계 판단

이 문서는 **왜 이렇게 나눴는지**를 적는다. 계약(엔드포인트·스키마·에러)은 [`openapi.yaml`](openapi.yaml) 에 있다.

근거는 전부 `docs/features/` 의 27개 화면 문서와 `frontend/src/` 의 현재 코드다.
화면 문서에 근거가 없는 것은 "제안" 으로 분리해 적었다.

> 작성 시점: 2026-08-12
> **개정: 2026-08-12 — `docs/decisions/0001-roles-and-pii.md` 확정 반영.** 역할 3개(`user`/`hospital_admin`/`operator`),
> 운영자 주도 입점 흐름, 상담 PII 마스킹, 감사 로그. 초안의 미결 사항 1·2·3·12 가 해소됐다.
> DB 스키마(`docs/database/`)는 병렬로 설계됐다. 이 API 는 **저장 구조가 아니라 화면이 필요한 형태**를 기준으로 응답을 정했다.

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

---

## 1. 리소스 목록과 지원 화면

리소스는 저장 테이블이 아니라 **도메인 개념** 단위로 잘랐다. `frontend/src/mocks/db.ts` 의 테이블은
`hospitals` / `doctors` / `consultRequests` / `communityPosts` / `notifications` 5개뿐이고 후기·이벤트·꿀팁·시술은
코드 안 고정 데이터인데, 화면은 그 넷을 독립적으로 읽는다. 그래서 리소스는 13개다.

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
| 마이페이지 | `mypage.md` | `GET /auth/me`<br>`POST /auth/logout`<br>`GET /notifications/unread-count?audience=user`<br>`GET /me/favorites?expand=hospital`<br>`DELETE /me/favorites/{hospitalId}`<br>`GET /me/consult-requests` (신설) | ✅ 🔒 🚧 |
| 병원 상세 | `hospital-detail.md` | `GET /hospitals/{id}`<br>`GET /hospitals/{id}/doctors`<br>`GET /hospitals/{id}/reviews`<br>`GET /promotions?hospitalId=`<br>`PUT`/`DELETE /me/favorites/{id}` | ✅ 🟡 🔒 |
| 전문의 상세 | `doctor-detail.md` | `GET /doctors/{id}`<br>`GET /hospitals/{hospitalId}` (소속 병원 카드) | ✅ 🟡 🔒 |
| 상담 신청 | `consult-request.md` | `GET /hospitals/{id}` (병원명·시술 목록)<br>`POST /consult-requests` | ✅ 🔒 |
| 커뮤니티 글 상세 | `community-post.md` | `GET /community/posts/{id}`<br>`POST /community/posts/{id}/views`<br>`POST /community/posts/{id}/answers` (신설) | ✅ 🟡 🚧 |
| 커뮤니티 글 작성 | `community-new.md` | `GET /procedures`<br>`POST /community/posts` | ✅ |
| 시술 꿀팁 상세 | `tip-detail.md` | `GET /guides/{id}`<br>`GET /hospitals/{id}` (관련 병원 카드)<br>`PUT`/`DELETE /me/favorites/{id}` | ✅ 🟡 🔒 |
| 이벤트 | `events.md` | `GET /promotions`<br>`GET /hospitals/{id}` (카드의 병원명·사진) | 🟡 |
| 알림 | `notifications.md` | `GET /notifications?audience=user`<br>`PATCH /notifications/{id}/read`<br>`POST /notifications/read-all` | ✅ 🟡 |
| 로그인 | `login.md` | `POST /auth/login`<br>`POST /auth/social/{provider}` (🚧) | ✅ 🚧 |
| 회원가입 | `signup.md` | `POST /auth/signup` | ✅ |

### 병원 관리자 화면

**역할에 따라 화면 접근 자체가 갈린다** (`docs/decisions/0001-roles-and-pii.md` 결정 1).
현재 인가가 전혀 없는 것이 확인된 보안 결함이다.

| 화면 | 문서 | 접근 역할 | 엔드포인트 | 상태 |
|---|---|---|---|---|
| 관리자 홈 | `admin-home.md` | `hospital_admin`(담당만)<br>`operator`(전체) | `GET /consult-requests/summary`<br>`GET /admin/hospitals` (`scope` 로 범위 구분)<br>`GET /notifications/unread-count?audience=admin` | ✅ 🟡 |
| | | | 병원 삭제 — **엔드포인트 없음** (🚧). §19 참고 | 🚧 |
| 병원 등록 | `admin-hospital-new.md` | **`operator` 전용** | `POST /hospitals` (전문의·담당자 동시 지정)<br>`GET /geo/address-search`<br>`GET /procedures` | ✅ 🟡 |
| 병원 정보 수정 | `admin-hospital-edit.md` | `hospital_admin`(담당만)<br>`operator`(전체) | `GET /hospitals/{id}`<br>`PATCH /hospitals/{id}`<br>`GET /hospitals/{id}/doctors`<br>`PUT /hospitals/{id}/doctors`<br>`GET /geo/address-search` | ✅ 🟡 |
| | | | 광고 신청·기간 변경 — **엔드포인트 없음.** 화면이 읽기 전용이고 "담당팀에 문의" 라고 안내한다 (🚧) | 🚧 |
| 전문의 인증 검수 | `admin-specialists.md` | **`operator` 전용** | `GET /doctors/verification-queue`<br>`PUT /doctors/{id}/verification` | ✅ 🟡 |
| 상담 관리 | `admin-consultations.md` | `hospital_admin`(담당만, 전체 PII)<br>`operator`(전체, 마스킹) | `GET /consult-requests`<br>`PATCH /consult-requests/{id}/status` (**`hospital_admin` 만**) | ✅ 🟡 |
| 상담 상세 | `admin-consultation-detail.md` | 위와 같음 | `GET /consult-requests/{id}` (**열람 로그 남음**)<br>`PATCH /consult-requests/{id}/status` (`hospital_admin` 만)<br>`POST /consult-requests/{id}/memos` (`hospital_admin` 만) | ✅ |
| 관리자 알림 | `admin-notifications.md` | `hospital_admin`, `operator` | `GET /notifications?audience=admin`<br>`PATCH /notifications/{id}/read`<br>`POST /notifications/read-all` | ✅ 🟡 |

`operator` 의 관리자 알림함은 **정상적으로 비어 있다** — 새 상담 알림과 검수 결과 알림 둘 다 담당자에게만 간다.

### 운영자 전용 화면 (아직 없음 🚧)

역할 결정으로 **화면이 없는 엔드포인트 4개**가 생겼다. 운영자 콘솔이 필요하다.

| 필요한 화면 | 엔드포인트 | 무엇을 하나 |
|---|---|---|
| 입점 문의 목록·상세 | `GET /partner-inquiries`<br>`GET /partner-inquiries/{id}`<br>`PATCH /partner-inquiries/{id}` | 문의 심사, 결과·사유 기록 |
| 병원 담당자 관리 | `GET /hospitals/{id}/admins`<br>`POST /hospitals/{id}/admins`<br>`DELETE /hospitals/{id}/admins/{userId}` | 담당자 지정·해제 |

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
| (비로그인) | 병원·전문의·후기·이벤트·꿀팁·커뮤니티·시술·검색·약관 조회, 입점 문의 접수. 전문의 `rating` 은 `null` 로 가려짐 |
| `user` | 위 + 상담 신청, 내 상담 내역, 찜, 사용자 알림함, 커뮤니티 작성·답변 |
| `hospital_admin` | 위 + **담당 병원**의 정보·전문의 수정, 담당 병원 상담의 조회·상태 변경·메모(**전체 PII**), 관리자 알림함, 주소 검색 |
| `operator` | 위 + **병원 생성**, **담당자 지정·해제**, **전문의 인증 검수**, **입점 문의 심사**, 전 병원 정보 수정, 전 상담 **조회**(**PII 마스킹**) |

`hospital_admin` 이 **할 수 없는** 것 — 전문의 인증 검수, 병원 생성, 담당자 지정, `isRecommended`(에디터 추천) 설정.
`operator` 가 **할 수 없는** 것 — 상담 상태 변경, 상담 메모 작성, 고객 연락처 전체 열람.

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
| **내 상담** (`/me/consult-requests/{id}`) | **`404`** | 남의 상담 존재 여부를 흘리지 않는다 |
| **알림** (`/notifications/{id}/read`) | **`404`** | 남의 알림 id 존재 여부를 흘리지 않는다 |

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

`GET /consult-requests` 와 `GET /admin/hospitals` 는 **같은 경로에서 역할별로 범위가 달라지는** 두 곳이다.
그래서 응답에 `scope: managed | all` 을 넣었다. 화면이 "내 병원" 과 "전체" 를 구분해야 하고,
목록이 0건일 때 "담당 병원이 아직 지정되지 않았어요" 와 "등록된 병원이 없어요" 를 구분해야 한다
(지금은 둘 다 그냥 빈 화면이다 — 확인된 결함).

### 병원 관리자 계정을 만드는 방법 — 기존 계정 승격

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
| `POST /consult-requests/{id}/memos` | 작성 | `authorName` 으로 화면에도 노출 |
| `PUT /doctors/{id}/verification` | 결정 | 누가·언제·어떤 사유로 판정했는지. 현재는 반려 사유만 남고 승인 시 그것도 지워진다 |
| `POST /hospitals/{id}/admins` | 권한 부여 | 계정 승격이다. 권한 변경은 무조건 기록 대상 |
| `DELETE /hospitals/{id}/admins/{userId}` | 권한 회수 | 위와 같음 |
| `POST /hospitals` | 생성 | 운영자만 할 수 있는 행위 |
| `PATCH /partner-inquiries/{id}` | 심사 | 승인·반려 판정 |

응답 헤더 `X-Audit-Logged: true` 로 기록됐음을 알린다 (클라이언트 동작에 영향은 없고 감사 파이프라인 점검용).

#### 목록 조회는 기록하지 않는다

`GET /consult-requests` 에도 실명·전화번호가 실리지만 **건별 열람 로그를 남기지 않는다.**
상담 관리 화면이 목록을 반복 조회해서 로그가 의미 없이 불어난다.
**목록은 접근 통계로, 상세는 건별 열람 기록으로** 다루는 실무적 타협이다.

목록에서의 대량 반출에 대한 1차 방어선은 `pageSize` 상한(100)과 요청 한도다.
**엑셀 내려받기(`GET /consult-requests/export`)가 생기면 그때는 필수로 기록한다** — 그건 명백한 대량 반출이다.

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
                                              -- 'partner_inquiry.view', 'doctor.verify',
                                              -- 'hospital_admin.assign', 'hospital_admin.unassign',
                                              -- 'hospital.create', 'partner_inquiry.review'
  target_type       varchar, not null          -- 'consult_request' | 'partner_inquiry' | 'doctor'
                                              -- | 'hospital' | 'user'
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
| **새 상담 알림** | `POST /consult-requests` | `audience=admin`, `type=consult-status`, 제목 `새로운 상담 신청`, 내용 `{name}님이 상담을 신청했어요`, `relatedResource=consultRequest`, `relatedId={상담 id}`. **수신자는 그 병원의 관리자** |
| **상담 상태 변경 알림** | `PATCH /consult-requests/{id}/status` | `audience=user`, 제목 `상담 상태 변경`, 내용 `상담 상태가 '{라벨}'(으)로 변경되었어요`. **수신자는 그 상담의 `userId`** |
| 상태 이력 한 줄 | `PATCH /consult-requests/{id}/status` | `statusHistory` 에 `{ status, changedAt, changedByName }` 추가 |
| **전문의 검수 결과 알림** | `PUT /doctors/{id}/verification` | `audience=admin`, `type=system`, `relatedResource=doctor`. **수신자는 그 전문의 소속 병원의 관리자.** 지금은 아무 알림도 생기지 않아 병원이 결과를 알 방법이 없다 |
| 검수 감사 로그 | `PUT /doctors/{id}/verification` | 누가·언제·어떤 결정을 했는지. 지금은 반려 사유만 남고 승인하면 그것도 지워진다 |
| 재검수 복귀 | `PUT /hospitals/{id}/doctors`, `PATCH /doctors/{id}` | `specialty` 또는 `certificateUrl` 이 바뀌면 `verificationStatus` → `pending`. 지금은 승인이 유지되어 검수 없이 다른 과 배지가 노출된다 |
| 조회수 증가 | `POST /community/posts/{id}/views` | **`GET` 이 아니다.** GET 이 상태를 바꾸면 캐시·프리페치·재시도가 조회수를 부풀린다 |

### 중복 알림 방지

같은 상태로 다시 `PATCH .../status` 를 보내면 **아무 부수효과 없이 `200` + 현재 리소스**를 반환한다 (no-op).
`X-Status-Changed: false` 헤더로 알려준다.

지금은 `예약완료` 인 상담에 `예약완료` 를 다시 누르면 이력이 중복으로 쌓이고 고객 알림도 또 간다.
목록의 빠른 상태 버튼을 오탭하면 쉽게 발생하는데, **오탭이 고객에게 중복 알림으로 나가는 것**을 서버가 막는다.

4xx 로 만들지 않은 이유: 요청 후의 상태가 요청자가 원한 상태와 같다. 실패로 다룰 이유가 없고,
클라이언트가 "이미 그 상태였습니다" 라는 에러를 사용자에게 보여줄 필요도 없다.

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
전문의 검수 알림이 생기면 잘못된 곳으로 이동한다. `relatedResource`(`consultRequest`|`hospital`|`doctor`|`promotion`|`null`)를
함께 내려주어 이동 대상을 종류로 판단하게 한다.

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
        "message": "010으로 시작하는 휴대폰 번호를 입력해주세요" }
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
| `INVALID_PHONE_FORMAT` | 422 (detail) | 010으로 시작하는 휴대폰 번호를 입력해주세요 |

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
| consult | `fetchConsultSummary()` | `GET /consult-requests/summary` | 관리자 홈 숫자 카드 |
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
| `이번 달 신규 상담` 이 항상 0 | `GET /consult-requests/summary` 가 `Asia/Seoul` 기준으로 계산. 샘플 데이터 날짜 문제는 별개 |
| 의사를 검색하면 병원 화면으로 간다 | `GET /search/resolve` 가 `kind=doctor` + `doctorId` 를 준다 (이동 대상은 제품 결정 → §17) |
| 추천 검색어 알약 5개가 죽어 있다 | `GET /search/suggestions` 가 `term` 과 `target` 을 분리 (§7) |
| 카카오 REST 키가 브라우저에 노출 | `GET /geo/address-search` (§10) |
| 마이페이지의 관리자 링크가 누구에게나 보인다 | `GET /auth/me` 의 `role` 로 링크 자체를 숨긴다 (§3) |

### API 가 고칠 수 없는 것

| 결함 | 왜 |
|---|---|
| 검색으로 들어가면 홈으로 못 돌아간다 | 클라이언트 라우팅 문제. `q` 파라미터 자동 실행이 뒤로 가기와 싸운다 |
| 지도가 보이지 않는다 | `VITE_KAKAO_MAP_JS_KEY` 환경 설정 |
| 대표 이미지를 바꿔도 상세 캐러셀이 안 바뀐다 | 폼이 `images` 배열을 편집하지 않는다. `PATCH /hospitals/{id}` 에 `images` 가 있으니 **폼이 보내면 고쳐진다** — 화면 작업 |
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
| `GET /geo/address-search` | `private, max-age=600` | 개인화되지 않지만 인증이 필요하다. 서버 내부 캐시가 본체 |
| `/me/*`, `/consult-requests*`, `/notifications*`, `/admin/*`, `/doctors/verification-queue`, `/partner-inquiries*`, `/hospitals/{id}/admins*` | **`no-store`** + `Vary: Authorization` | 개인정보(실명·전화번호·자격증)와 계정별·역할별 데이터. 중간 캐시에 남으면 안 된다 |

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
| `POST /community/posts`, `.../answers` | 계정당 **20회/시간** | 스팸 |
| `POST /community/posts/{id}/views` | IP 당 **60회/분** | 조회수 조작 |
| `POST /partner-inquiries` | IP 당 **3회/분** | 인증이 없는 공개 폼 |
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
    지금은 `평일 오전` / `평일 오후` / `주말` 한국어 문자열이 그대로 저장된다.
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
| `POST /uploads` (이미지 업로드) | 폼이 URL 직접 입력 방식이다(🚧: "사진 파일 올리기 — 없습니다"). 스토리지·리사이징·자격증 이미지 접근 제어가 함께 필요하다. **자격증 이미지가 공개 URL 인 것은 잠재적 개인정보 문제**라 업로드를 만들 때 서명 URL 로 다루는 것이 좋다 |
| `GET /hospitals/{id}/procedure-prices` | 시술별 가격표가 없다. 폼에 전체 가격대 최소/최대 두 숫자만 있다. 가격 비교표의 `최저가` 가 "선택한 시술의 가격이 아니다" 는 현재 한계의 원인이다 |
| `GET /consult-requests/export` (엑셀) | 내려받기 기능이 없다(🚧). 개인정보 대량 반출이라 감사 로그가 함께 필요하다 |
| `kind=filter` (`SearchTarget` 확장) | `원데이 가능 병원 모음` 같은 필터 조합 검색어를 표현하려면 필요하다 (§17-23) |
| `GET /audit-logs` | 감사 로그 **조회** API. 기록은 스펙에 반영했지만 조회 화면이 없다. 조회 자체가 개인정보 열람 이력 열람이라 접근 통제가 또 필요하다 — 내부 도구로 다루는 것이 맞을 수 있다 |
