# 몰라몰라 데이터베이스 설계

| | |
|---|---|
| **현재 구현** | SQLite (Prisma `provider = "sqlite"`) |
| **이전 대상** | PostgreSQL 14+ |
| **스키마 정의** | [`schema.dbml`](schema.dbml) — 테이블·컬럼·인덱스·주석 |
| **ORM 스키마** | [`../../backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) |
| **요구사항 출처** | 1차(27개 테이블): `frontend/src/types/domain.ts`, `docs/features/*.md` (27개), `frontend/src/mocks/fixtures/*.ts`<br>2차(5개 테이블, §11): `docs/decisions/0001-roles-and-pii.md`, `docs/api/README.md` §4·§14, `backend/src/auth/refresh-token.store.ts`<br>3차(**테이블 추가 없음** — 상담 예약 확장, §12): `docs/features/requests/2026-10-12-04-관리자-상담예약-개선.md`, `docs/api/README.md` §4·§9·§14<br>4차(**테이블·컬럼 추가 없음, 인덱스 1개** — 대시보드 집계, §13): `docs/features/requests/2026-10-12-05-관리자-레이아웃-대시보드.md`, `docs/api/README.md` §3·§14<br>5차(**제안 — 요청자 답 반영 대기 → 요청서 18** (2026-10-13 제안 · 2026-10-21 개정), 테이블 1개·컬럼 9개, §14): `docs/features/requests/2026-10-12-06-병원관리자-직접가입.md`, `docs/decisions/0001-roles-and-pii.md` 결정 2<br>6차(**테이블 1개·컬럼 1개 + 시술 13행 → 31행 이관**, §17): `docs/features/requests/2026-10-21-14-시술분류-서버로-준비중-풀기.md`, `frontend/src/features/procedure/taxonomy.ts` |

이 문서는 **왜 이렇게 설계했는지**를 남깁니다. 무엇이 있는지는 `schema.dbml` 을 보세요.

> **2026-10-21 개정 — 혼자 개발 체제.** 협업자가 프로젝트를 떠나, 서버(`backend/`)도 이 저장소에서
> 직접 만듭니다. 그래서 "협업자 확인 대기 / 협업자 인계 / 협업자 영역" 으로 적혀 있던 **표시**를
> 지금 상태에 맞게 고치고, 각 체크리스트가 **어느 요청서에서 처리되는지**를 달았습니다
> (§12 → 요청서 15, §13 → 16, §14 → **18**, §15 → 15, §16 → **19**, 시술 분류 → 14).
> **스키마 설계 내용(컬럼·인덱스·판정 규칙)은 한 줄도 바뀌지 않았습니다** — 표현·표시 정리뿐입니다.
> 근거: `docs/features/requests/2026-10-21-12-혼자-개발-체제로-정리.md`, 목차는
> `docs/features/requests/README.md`.

---

## 1. 엔티티 관계 개요

```
                   ┌──────────────────────┐
                   │ procedure_categories │  시술 분야 9개 (§17)
                   └──────────┬───────────┘
                              │ 1:N
                        ┌─────┴─────────┐
                        │  procedures   │  시술 마스터 31종 (참조 데이터, §17)
                        └───────┬───────┘
        ┌───────────────────────┼───────────────────────────────┐
        │                       │                               │
┌───────┴────────┐      ┌───────┴────────┐              ┌───────┴───────┐
│ hospital_      │      │ doctor_        │              │ guides        │
│ procedures     │      │ procedures     │              │ qa_posts      │
└───────┬────────┘      └───────┬────────┘              │ reviews       │
        │                       │                       │ promotions    │
        │                       │                       │ consult_...   │
┌───────┴───────────────────────┴───────┐              └───────────────┘
│              hospitals                 │ 1 ── N ┐
│  ─ 6 feature_* boolean                 │        │
│  ─ price_min / price_max (원)           │        ├─ hospital_images    (사진 캐러셀)
│  ─ rating / review_count / consult_...  │        ├─ hospital_tags
└──┬──────┬──────┬──────┬──────┬──────┬──┘        ├─ hospital_event_notes
   │      │      │      │      │      │           ├─ business_hours     (요일당 1행)
   │      │      │      │      │      │           └─ hospital_sponsorships (광고 기간·순위)
   │      │      │      │      │      │
   │      │      │      │      │      └── promotions ──── 할인 이벤트 (기간 있음)
   │      │      │      │      └───────── reviews ─── review_photos
   │      │      │      └──────────────── guide_hospitals ─── guides
   │      │      └───────────────────────  favorites ─┐
   │      │                                            │
   │      └── doctors ───┬── doctor_careers            │
   │         (1:N)       ├── doctor_procedures         │
   │                     └── doctor_verifications ─────┤ 검수 이력
   │                                                   │
   └── consult_requests ─┬── consult_status_changes    │
       (user·hospital·   └── consult_memos             │
        doctor? ·                                      │
        procedure?)                                    │
                                                       │
┌──────────────────────────────────────────────────┐   │
│                    users                          │───┘
│  role: user | hospital_admin | operator           │
│  password_hash (+ salt) — 평문 컬럼 없음            │
└──┬──────────────┬─────────────┬──────────────┬────┘
   │              │             │              │
   │              │             │              └── qa_posts / qa_answers (작성자)
   │              │             └───────────────── notification_recipients (읽음 상태)
   │              └─────────────────────────────── consult_requests (신청자)
   └── hospital_admins ── hospitals   "누가 어느 병원의 담당자인가"

┌──────────────────┐        ┌───────────────────────────┐
│  notifications   │ 1 ── N │ notification_recipients   │  (알림 × 사용자)
│  audience/type   │        │  read_at (null=안 읽음)    │
│  hospital_id?    │        └───────────────────────────┘
└──────────────────┘
```

**관계 요약**

| 관계 | 종류 | 근거 화면 |
|---|---|---|
| hospital – procedure | M:N (`hospital_procedures`) | 병원 탐색 시술 칩, 상담 신청 희망 시술 |
| hospital – doctor | 1:N | 병원 상세 '전문의 소개' (전문의는 병원 하나에 소속) |
| user – hospital (담당) | M:N (`hospital_admins`) | `/admin` 인가 |
| user – hospital (찜) | M:N (`favorites`) | 마이페이지 찜 목록 |
| user – consult_request | 1:N | 아직 없는 "내 상담 내역" 화면 |
| doctor – verification | 1:N | `/admin/specialists` 검수 이력 |
| notification – user | M:N (`notification_recipients`) | 사용자/관리자 알림함, 안 읽음 배지 |
| guide – hospital | M:N (`guide_hospitals`) | 꿀팁 상세 '관련 병원 보기' |

여기까지가 1차 설계 **27개 테이블**입니다.

2차로 5개 테이블이 붙어 전체 **32개**가 되었습니다. 화면이 아니라 **결정 문서와 API 계약**에서
요구사항이 나온 테이블들이라 §11 에 따로 정리했습니다.

```
┌──────────────────┐
│      users       │──┬── refresh_tokens    세션(리프레시 토큰) 상태. jti 만 저장
└──────────────────┘  │                     family_id = 회전 계열
                      ├── audit_logs        관리자 행위 감사 (append-only)
                      │     └─ hospital_id? → hospitals   (병원 범위 행위)
                      │        target_type/target_id      (다형 참조, FK 없음)
                      ├── partner_inquiries.reviewed_by_user_id   입점 문의 심사자
                      └── user_agreements ──── legal_documents
                            (사용자 × 문서 버전)   slug × version, 본문·시행일

┌────────────────────┐
│ partner_inquiries  │ received → reviewing → approved | rejected
│  담당자 실명·연락처   │ linked_hospital_id? → hospitals  (승인 후 생성된 병원)
└────────────────────┘
```

---

## 2. 테이블 ↔ 화면 대응

| 테이블 | 지원 화면 |
|---|---|
| `procedures` | 홈(시술로 찾기), 병원 탐색(시술 칩), 커뮤니티 작성(관련 시술), 상담 신청(희망 시술), 병원 등록/수정(취급 시술) |
| `users` | 회원가입, 로그인, 마이페이지 + `/admin` 전체의 인가 |
| `hospital_admins` | `/admin` 전체 (담당 병원 범위), `/admin/notifications` (수신자 결정) |
| `hospitals` | 홈, 병원 탐색(목록·지도·가격비교표), 검색, 병원 상세, 마이페이지 찜 목록, 꿀팁 관련 병원, `/admin`, `/admin/hospital/new`, `/admin/hospital/:id` |
| `hospital_procedures` | 병원 탐색 시술 필터, 병원 상세 '대표 시술', 카드 시술 배지, 상담 신청 시술 선택지 |
| `hospital_images` | 병원 상세 사진 캐러셀 |
| `hospital_tags` | `/admin/hospital/*` 태그 입력 (태그 필터 화면은 아직 없음) |
| `hospital_event_notes` | 병원 상세 '진행중인 이벤트' (가격 없는 자유 문구) |
| `business_hours` | 병원 상세 진료시간 접기/펼치기, `/admin/hospital/*` 요일 7줄 |
| `hospital_sponsorships` | 병원 탐색 '광고' 배지·상단 노출, 병원 상세 '광고' 배지, `/admin/hospital/:id` 광고 현황 |
| `doctors` | 병원 상세 '전문의 소개', 전문의 상세, 병원 탐색 의사 모드 + `전문의`/`경력` 칩 + 'OO전문의 상주' 배지, 검색, `/admin/hospital/*`, `/admin/specialists` |
| `doctor_procedures` | 전문의 상세 '주요 진료 분야', 탐색 의사 모드 시술 필터 |
| `doctor_careers` | 전문의 상세 '경력 및 활동' |
| `doctor_verifications` | `/admin/specialists`, 전문의 배지 판정(병원 상세·전문의 상세·탐색 카드) |
| `consult_requests` | 상담 신청, `/admin/consultations`(화면 이름은 **상담 예약**), `/admin/consultations/:id`, `/admin` 대시보드(숫자 카드 4개 중 3개·오늘 할 일·최근 상담 예약·오늘 내원 예정·이번 달 상담 흐름 — §13), 마이페이지 '내 상담 내역'(확정 일시 포함 — §12.2) |
| `consult_status_changes` | `/admin/consultations/:id` '처리 이력' — 상태 변경 **과 예약 일시 변경**을 함께 담는다 (§12.3) |
| `consult_memos` | `/admin/consultations/:id` '메모' |
| `hospital_inquiries` **(아직 없음 — 요구사항만 있음. 만드는 곳: 요청서 16)** | 병원 상세 `문의` 탭(공개 Q/A), `문의하기`·마이페이지 `내 문의`, 병원 관리자 `문의` 화면. **정의는 `docs/api/README.md` §14 의 `hospital_inquiries` 절에 있다** (2026-10-12 추가). 이 문서의 32개 집계에는 아직 포함되지 않는다 — `schema.dbml`·`schema.prisma` 에 들어오는 시점에 §11 과 같은 형태로 설계 근거를 옮겨 적는다 |
| `uploaded_files` **(아직 없음 — §14 제안. 만드는 곳: 요청서 18)** | 회원가입의 `사업자등록증 업로드`, (운영자) 서류 열람. 요청 07 의 병원 사진 업로드도 같은 테이블을 쓴다. **32개 집계에 포함되지 않는다** — `schema.dbml`·`schema.prisma` 에 들어오는 시점에 집계를 고친다 |
| `favorites` | 병원 상세 하트, 마이페이지 찜 목록, 꿀팁 관련 병원 카드 하트 |
| `reviews`, `review_photos` | 병원 상세 '방문자 후기' |
| `promotions` | 이벤트 목록(`/events`), 홈 '지금 진행중인 이벤트', 병원 카드 🔥 배지·할인가, 병원 상세 가격 영역, 탐색 가격 비교표 '할인가' |
| `guides`, `guide_hospitals` | 홈 '이런 꿀팁 어때요?', 꿀팁 상세(`/tips/:id`) |
| `qa_posts` | 커뮤니티 목록, 질문 상세, 질문 작성 |
| `qa_answers` | 질문 상세 답변 목록·'치과의사 답변' 배지, 목록의 '답변 N', (신설 가능) 답변 작성 |
| `notifications`, `notification_recipients` | `/notifications`, `/admin/notifications`, 마이페이지 알림함 줄, 상단 🔔 배지, `/admin` 🔔 배지 |
| `refresh_tokens` | 화면 없음 — 로그인·로그아웃·자동 재발급의 서버 상태. (신설 가능) '내 기기·세션 목록' |
| `audit_logs` | 화면 없음 — `/admin/consultations/:id` 열람·상태 변경·메모, `/admin/specialists` 검수, 담당자 지정/해제, 병원 생성, 입점 문의 심사가 **쓰는** 테이블. 조회 화면은 아직 없습니다 |
| `partner_inquiries` | 병원 입점 문의(접수), 아직 없는 운영자 심사 화면 |
| `legal_documents` | `/legal/terms`, `/legal/privacy`, `/legal/location`, `/about` |
| `user_agreements` | 회원가입 약관 동의 (절차 자체가 아직 없음), 마이페이지 '동의 내역' (신설 가능) |

**테이블이 필요 없는 화면** (1차 설계 시점의 판단): `/about`, `/partner-inquiry`, `/legal/terms`, `/legal/privacy`, `/legal/location` — 다섯 화면 모두 `준비중입니다` 한 줄뿐이고 저장할 데이터가 없었습니다. 홈의 회사 정보·배너 3장, 검색 화면의 인기 검색어/추천 검색어도 코드 상수이며 관리 화면이 없어 테이블로 만들지 않았습니다 (§9 제안 참고).

> **이 판단은 다섯 화면 중 네 개에서 뒤집혔습니다.** 화면이 비어 있어도 **결정 문서와 API 계약**이 데이터를 요구하면 테이블이 필요하다는 것이 2차 설계의 교훈입니다 — `/partner-inquiry` 는 운영자 주도 입점 흐름(`docs/decisions/0001`)의 시작점이 되었고, 약관 3종은 `POST /auth/signup` 이 이미 받고 있는 `agreedTermsVersions` 의 저장소가 필요했습니다(§11.3). `/about` 은 `legal_documents` 에 `slug='about'` 로 함께 들어갑니다. 홈 배너와 인기 검색어만 여전히 코드 상수입니다.

---

## 3. 이식성 규칙과 근거

Prisma + SQLite 의 실제 한계, 그리고 PostgreSQL 로 옮길 때 깨지는 것들을 피한 규칙입니다.
**결과적으로 더 나은 관계형 설계가 되었습니다** — 배열이 조인 테이블이 되면서 역방향 조회(`procedure → hospitals`)에 인덱스를 걸 수 있게 되었고, JSON 이 실 컬럼이 되면서 필터·정렬을 DB 가 처리할 수 있게 되었습니다.

### 3.1 DB enum 을 쓰지 않는다

Prisma 는 SQLite 에서 `enum` 을 지원하지 않습니다. 상태값은 `String` + 애플리케이션 검증이고, 허용값을 `schema.dbml`/`schema.prisma` 의 컬럼 주석에 적어 두었습니다.

| 원래 타입 | 컬럼 | 허용값 |
|---|---|---|
| `ConsultStatus` | `consult_requests.status`, `consult_status_changes.status` | `new` `contacted` `booked` `cancelled` `visited` (`visited` 는 2026-10-13 추가 — §12.1. `booked` 의 화면 라벨만 `예약완료` → `예약확정` 으로 바뀌었고 **저장값은 그대로**다) |
| (신규) 처리 이벤트 | `consult_status_changes.event` | `status_change` `reschedule` (§12.3) |
| (신규) 취소 사유 | `consult_status_changes.cancel_reason` | `no_answer` `patient_request` `procedure_unavailable` `duplicate` `etc` (§12.4) |
| `VerificationStatus` | `doctors.verification_status`, `doctor_verifications.status` | `pending` `approved` `rejected` |
| `AuthProvider` | `users.provider` | `email` `google` `kakao` |
| (신규) 역할 | `users.role` | `user` `hospital_admin` `operator` |
| `NotificationType` | `notifications.type` | `consult-status` `event` `system` |
| `NotificationAudience` | `notifications.audience` | `user` `admin` |
| `DentalSpecialty` | `doctors.specialty`, `doctors.verified_specialty`, `doctor_verifications.submitted_specialty` | 8종 (`치과보철전문의` … `일반의`) |
| (자유값) 희망 시간 | `consult_requests.preferred_time` | `평일 오전` `평일 오후` `평일 저녁` `주말` (`평일 저녁` 은 2026-10-12 요청서로 늘어난 값이다. **그 이전 접수 건에는 나타나지 않는다** — `openapi.yaml` 의 `ConsultPreferredTime` 과 같은 설명) |

**`ProcedureId` 만 예외로 테이블입니다.** `procedures` 는 이미 이름·이모지·설명을 가진 엔티티이고, 13종 목록이 세 화면(홈 격자·탐색 칩·커뮤니티 선택)에서 공유되기 때문입니다. FK 로 참조하므로 enum 보다 강한 무결성을 얻습니다. `DentalSpecialty` 는 부속 정보가 없어 테이블로 만들지 않았습니다(지시 사항대로 `String`).

> 검증은 Zod 스키마 한 곳에 모아 API 경계에서 수행하는 것을 권장합니다. `CONSULT_STATUSES`, `DENTAL_SPECIALTIES` 처럼 `domain.ts` 에 이미 있는 배열을 재사용하면 프런트와 값이 어긋나지 않습니다.

### 3.2 스칼라 배열 → 조인/자식 테이블

SQLite 는 배열 컬럼이 없습니다. 배열이던 필드는 전부 테이블이 되었습니다.

| 원래 필드 | 새 테이블 | 얻은 것 |
|---|---|---|
| `Hospital.procedureIds: ProcedureId[]` | `hospital_procedures` | `procedure_id` 인덱스로 "이 시술을 하는 병원" 역방향 조회 |
| `Hospital.images: string[]` | `hospital_images` | 순서(`sort_order`) 명시, thumbnail 과 분리 |
| `Hospital.tags: string[]` | `hospital_tags` | `tag_normalized` 인덱스로 태그 검색 가능 |
| `Hospital.events: string[]` | `hospital_event_notes` | 순서 명시 |
| `Hospital.sponsoredCategories: ProcedureId[]` | `hospital_sponsorships` | 카테고리별 기간·순위 분리 (§5.10) |
| `Hospital.businessHours: BusinessHourEntry[]` | `business_hours` | 요일당 유니크, 요일 정수 정렬 |
| `Doctor.procedureIds: ProcedureId[]` | `doctor_procedures` | 의사 모드 시술 필터 |
| `Doctor.career: string[]` | `doctor_careers` | 순서 명시 |
| `Review.photos?: string[]` | `review_photos` | |
| `GuideContent.relatedHospitals?: string[]` | `guide_hospitals` | 병원 → 꿀팁 역방향 조회 |
| `QAPost.answers: QAAnswer[]` | `qa_answers` | **답변 작성 화면이 만들어질 수 있게 됨** (§5.7) |
| `ConsultRequest.statusHistory[]` | `consult_status_changes` | |
| `ConsultRequest.memos[]` | `consult_memos` | |

### 3.3 JSON 컬럼 → 실 컬럼 / 자식 테이블

| 원래 | 지금 |
|---|---|
| `HospitalFeatures` (boolean 6개) | `feature_coordinator`, `feature_painless_anesthesia`, `feature_digital_care`, `feature_parking`, `feature_night_consult`, `feature_cctv` — **실 컬럼 6개** |
| `PriceRange { min, max }` | `price_min Int`, `price_max Int` |
| `businessHours` | `business_hours` 테이블 |
| `statusHistory`, `memos` | `consult_status_changes`, `consult_memos` 테이블 |

`feature_night_consult` 를 실 컬럼으로 뺀 것이 특히 중요합니다. 병원 탐색의 `진료시간` 조건 칩이 이 값으로 필터하는데, JSON 안에 있었다면 서버에서 걸러낼 수 없었습니다.

### 3.4 PK 는 애플리케이션이 만든 문자열

`INTEGER AUTOINCREMENT` 는 두 DB 의 시퀀스 동작이 다르고, 데이터 이전 시 id 충돌이 납니다. 모든 PK 는 `String @id` (기본값 없음)이며 애플리케이션이 `cuid()` 로 만듭니다. 그래서 기존 fixture 의 `h1`, `d1`, `cr1`, `q1`, `a1`, `g1`, `p1`, `r1`, `notif1`, `memo-cr2-1` 을 **그대로 넣을 수 있습니다.**

> `@default(cuid())` 도 쓰지 않았습니다. 시드가 지정 id 를 넣을 때 기본값이 무시되는 것에 의존하지 않고, "id 는 항상 애플리케이션이 정한다" 는 규칙을 하나로 유지하는 편이 명확합니다.

### 3.5 금액은 `Int`, 평점만 `Float`

`Int` (원 단위): `price_min`, `price_max`, `original_price`, `sale_price`.
`Float`: `hospitals.rating`, `doctors.rating` (4.8 같은 **표시값**, 계산에 쓰지 않음), `latitude`/`longitude` (좌표).
`reviews.rating` 은 사용자가 별 1~5 개로 입력하는 값이므로 `Int` 입니다.

할인율(`28%`)은 저장하지 않고 `original_price`/`sale_price` 로 계산합니다.

### 3.6 타임스탬프에 DB 기본값을 쓰지 않는다

`CURRENT_TIMESTAMP` 의 형식·정밀도가 두 DB 에서 다릅니다. `@default(now())` 와 `@updatedAt` 을 모두 쓰지 않고, 애플리케이션이 UTC 로 `created_at` / `updated_at` 을 명시 세팅합니다. 프런트가 이미 `'2026-07-28T09:15:00.000Z'` 형태(UTC ISO-8601)를 쓰고 있어 그대로 이어집니다.

### 3.7 "시각" 과 "달력 날짜" 를 구분한다

| 성격 | 타입 | 예 |
|---|---|---|
| **시각** (언제 일어났나) | `DateTime` (UTC) | `created_at`, `changed_at`, `reviewed_at`, `read_at` |
| **달력 날짜** (어느 날짜까지 유효한가) | `String` `'YYYY-MM-DD'` (KST 달력일) | `hospital_sponsorships.start_date`/`end_date`, `promotions.start_date`/`end_date` |

광고·프로모션 기간을 문자열 날짜로 둔 이유:

1. 현재 코드가 이미 그렇게 비교합니다 — `sponsorship.ts` 의 `today >= start && today <= end` (`toISOString().slice(0,10)`).
2. 문자열 사전순 비교가 SQLite 와 PostgreSQL 에서 **완전히 동일**하고, B-tree 인덱스도 그대로 동작합니다.
3. "8월 20일까지 광고" 는 시각이 아니라 달력일입니다. `DateTime` 으로 저장하면 "종료일 포함/배타" 와 "어느 시간대의 자정인가" 를 매번 결정해야 하고, 시간대 경계에서 하루 밀리는 버그가 생깁니다.

`created_at` 등에는 반대 이유가 적용됩니다 — 정렬·집계에 정밀도가 필요하고(`/admin/consultations` 최신순, `/admin` 이번 달 집계), 이미 UTC 타임스탬프로 들어옵니다.

> 날짜만 있는 fixture 값(`reviews.createdAt: '2026-06-02'`, `qaPosts.createdAt: '2026-07-20'`, `guides.createdAt`)은 `T00:00:00.000Z` 로 승격해 넣습니다. KST(UTC+9)는 양수 오프셋이라 UTC 자정이 같은 날 09:00 KST 가 되므로, 화면에 보이는 날짜가 바뀌지 않습니다.

### 3.8 raw SQL 을 쓰지 않는다

`$queryRaw` / `$executeRaw` 없이 Prisma Client 만 씁니다. 지금 스키마로 표현 못 하는 쿼리는 없습니다. 다만 나중에 필요해질 수 있는 두 곳을 미리 적어 둡니다.

- **집계 갱신** (`hospitals.rating` / `review_count` 재계산): `aggregate` + `update` 두 번으로 충분합니다. 후기가 수만 건이 되면 `UPDATE ... FROM (SELECT avg(...))` 한 방이 낫지만, 그때는 이미 PostgreSQL 로 옮겨간 뒤일 것이므로 PostgreSQL 문법으로 쓰면 됩니다.
- **거리 기반 병원 검색** (지도 반경 필터): 현재는 좌표를 다 받아 앱에서 계산합니다. 병원이 수천 곳이 되면 PostgreSQL + PostGIS(`ST_DWithin`)가 필요한데, SQLite 에는 대응물이 없습니다. **그 시점까지는 앱 계산을 유지**하고, PostGIS 는 이전 이후에 도입합니다. 그래서 `latitude`/`longitude` 를 별도 컬럼으로 둔 채 공간 인덱스는 만들지 않았습니다.

### 3.9 대소문자 구분 검색 — 정규화 컬럼 방식

**문제**: SQLite 의 `LIKE` 는 ASCII 문자에 대해 대소문자를 **구분하지 않습니다**(기본 `NOCASE` 동작). PostgreSQL 의 `LIKE` 는 **구분합니다**. 그래서 SQLite 에서 잘 되던 `LIKE '%white%'` 가 PostgreSQL 에서 `더화이트 WHITE Clinic` 을 못 찾게 됩니다. **한글은 두 DB 모두 대소문자 개념이 없어 영향받지 않습니다.**

병원명·전문의명·태그에 영문이 섞일 수 있으므로(`더화이트 라미네이트클리닉`, 향후 `Smile Dental` 등) **소문자 정규화 컬럼**을 선택했습니다.

| 원본 | 정규화 컬럼 |
|---|---|
| `hospitals.name` | `hospitals.name_normalized` |
| `doctors.name` | `doctors.name_normalized` |
| `hospital_tags.tag` | `hospital_tags.tag_normalized` |
| `users.email` | (별도 컬럼 없이) 저장 자체를 `trim().toLowerCase()` 로 정규화 |

**규칙**: 쓰기 시 애플리케이션이 `lower(trim(원본))` 을 채우고, 검색은 항상 정규화 컬럼 + 소문자로 변환한 검색어를 씁니다.

```ts
const q = term.trim().toLowerCase();
prisma.hospital.findMany({ where: { nameNormalized: { contains: q }, deletedAt: null } });
```

**왜 앱에서 `lower()` 를 부르는 방식이 아닌가**: `where: { name: { contains: q, mode: 'insensitive' } }` 는 Prisma 에서 **PostgreSQL 전용**입니다(SQLite 는 `mode` 미지원). 또 `WHERE lower(name) LIKE ...` 는 함수 표현식이라 일반 인덱스를 타지 못합니다 — PostgreSQL 은 함수 인덱스로 해결할 수 있지만 SQLite/Prisma 로는 선언할 수 없습니다. 정규화 컬럼은 두 DB 에서 **같은 쿼리, 같은 인덱스**로 동작하는 유일한 방법입니다.

부수 효과로 `users.email` 유니크 제약이 정확해집니다. 정규화 없이 저장하면 `Hong@Test.com` 과 `hong@test.com` 이 PostgreSQL 에서 서로 다른 행이 되어 중복 가입이 뚫립니다(SQLite 에서는 안 뚫립니다 — 정확히 이식 시 깨지는 종류의 버그입니다). 현재 로그인/회원가입 화면이 이미 소문자 정규화를 하고 있으므로 그 규칙을 DB 계약으로 승격했습니다.

`hospital_tags` 의 유니크 제약도 `(hospital_id, tag_normalized)` 입니다 — 표시용 원본은 `tag` 에 남기고 중복 판정은 정규화 값으로 합니다.

### 3.10 boolean 저장

SQLite 에 boolean 타입이 없습니다. `0`/`1` 정수로 저장되고, PostgreSQL 에서는 진짜 `boolean` 이 됩니다. **Prisma Client 를 통과하면 양쪽 모두 JS `true`/`false` 로 보입니다.**

깨지는 경우는 raw SQL 뿐입니다.

- `WHERE consult_available = 1` → PostgreSQL 에서 타입 오류 (`= true` 여야 함)
- `WHERE is_closed` → SQLite 에서 정수 truthiness 로 우연히 동작, PostgreSQL 에서도 동작하지만 의미가 다름
- SQLite 파일을 직접 열어 CSV 로 뽑으면 `0`/`1` 이 나오므로, 이전 스크립트에서 boolean 캐스팅이 필요합니다 (§7)

**규칙: boolean 을 raw SQL 로 다루지 않습니다.** Prisma Client 로만 접근하면 이 차이는 드러나지 않습니다.

---

## 4. 정규화하지 않고 남긴 곳

의도적인 비정규화입니다. 각각 근거가 있습니다.

| 남긴 것 | 왜 | 갱신 책임 |
|---|---|---|
| `hospitals.rating` / `review_count` / `consult_count`, `doctors.*` 동일 | 병원 탐색이 이 세 값으로 **정렬**합니다(`인기순`=rating, `후기순`=review_count, `상담많은순`=consult_count). 매 요청마다 후기·상담을 집계하면 정렬에 인덱스를 쓸 수 없습니다. 또 현재 fixture 의 값은 실제 집계와 무관한 **마케팅 표시값**입니다(화면 문서: "상담을 신청해도 이 숫자는 올라가지 않습니다") | 후기/상담 생성 시 또는 배치로 재계산. 규칙이 정해지기 전까지는 시드 값 그대로 유지 |
| `doctors.verification_status` / `rejection_reason` | `doctor_verifications` 최신 행의 캐시입니다. 병원 탐색의 `전문의` 조건 칩이 병원마다 "승인된 전문의가 한 명 이상" 을 판정하는데, 매번 이력 테이블에서 최신 행을 찾으면 상관 서브쿼리가 됩니다 | 검수 처리 트랜잭션에서 이력 행과 함께 갱신 |
| `doctors.verified_specialty` | 이력에서 유도할 수 있지만(마지막 approved 행의 `submitted_specialty`), 배지 판정이 **모든 목록 화면**에서 일어나기 때문에 컬럼으로 둡니다 | 승인 시 세팅 |
| `hospital_tags.tag` (마스터 테이블 없음) | 태그는 쉼표로 구분한 자유 입력이고, 태그를 관리·통합하는 화면이 없습니다. `tags` 마스터를 만들면 오타 태그마다 마스터 행이 늘어나 정규화의 이득 없이 조인만 늘어납니다 | — |
| `qa_answers.is_dentist` | `doctor_id` + 승인 상태로 유도할 수 있지만, 시드 답변(`몰라몰라 자문의`)은 `doctors` 행이 없는데도 `치과의사 답변` 배지가 붙습니다. 그 데이터를 버리지 않으려면 별도 플래그가 필요합니다 | 답변 작성 시 `doctor_id` 로부터 계산해 저장 |
| `qa_answers.author_name` | `author_user_id` 가 null 인 시드 답변(`교정경험자` 등)의 표시 이름 스냅샷. 계정이 연결된 답변은 `users.name` 을 씁니다 | — |
| `consult_requests.name` / `phone` | `users.name` 과 중복처럼 보이지만 **다른 값**입니다. 상담 신청 폼은 이름·연락처를 매번 직접 입력받고(자동 채움 없음), 가족 대신 신청하는 경우도 있습니다. 게다가 개인정보 정정 이력의 관점에서 "신청 당시 남긴 연락처" 는 스냅샷이어야 합니다 | — (불변) |
| `notifications.related_id` (다형 참조, FK 없음) | `consult_request` / `hospital` / `doctor` 중 어느 것이든 가리킬 수 있어 FK 를 걸 수 없습니다. `related_type` 을 함께 둬서 최소한 **무엇인지**는 알 수 있게 했습니다(현재 관리자 알림함이 `related_id` 만 보고 무조건 상담 상세로 보내는 문제의 원인) | 애플리케이션 |
| `business_hours.hours` (문자열) | `open_time`/`close_time` 으로 쪼개는 것이 정석이지만, 관리자 폼이 **자유 텍스트 한 칸**이고 점심시간을 같은 칸에 적도록 안내하고 있습니다. 파싱해서 저장하면 입력을 손실 없이 복원할 수 없습니다. 시간대 검색 필터가 요구사항이 되면 그때 파생 컬럼을 추가합니다 | — |

---

## 5. 모델 결함 10건 — 어떻게 고쳤는가

`docs/features/known-issues.md` 에 사용자 관점 설명이 있는 항목들입니다.

### 5.1 `ConsultRequest` 에 신청자 연결이 없음

**해결**: `consult_requests.user_id` **NOT NULL** + `@@index([userId, createdAt])`.

상담 신청 화면은 이미 로그인을 강제하므로(비로그인 시 로그인 화면으로 리다이렉트) nullable 로 둘 이유가 없습니다. 인덱스가 있으면 마이페이지·로그인 화면이 약속하는 `상담 신청 내역을 확인할 수 있어요` 화면을 만들 수 있습니다:

```ts
prisma.consultRequest.findMany({
  where:   { userId },
  orderBy: { createdAt: 'desc' },
  include: { hospital: true, procedure: true, doctor: true },
});
```

폼에 입력한 `name`/`phone` 은 별도 컬럼으로 유지합니다(§4).

### 5.2 `ConsultRequest` 에 `doctorId` 가 없음

**해결**: `consult_requests.doctor_id` **nullable** + `@@index([doctorId])`.

병원 상세의 `전문의 상담신청`, 전문의 상세의 `상담 신청` 은 이 값을 채웁니다. 병원 단위 상담(`병원 상담신청`, 탐색 카드 버튼)은 `null` 입니다. 관리자 상담 상세에서 "어느 전문의를 지목했는가" 를 보여줄 수 있고, `남기고 싶은 말` 칸에 적어달라는 우회가 사라집니다.

`ON DELETE SET NULL` 로 두어, 전문의가 삭제돼도 상담 기록이 사라지지 않습니다.

### 5.3 알림이 계정별로 나뉘지 않음

**해결**: `notification_recipients` (알림 × 사용자) 테이블. `notifications.is_read` 를 없애고 읽음 상태를 `notification_recipients.read_at` 으로 옮겼습니다.

- 상담 상태 변경 → `audience='user'` 알림 1건 + **신청자 1명**에게만 수신자 행
- 새 상담 접수 → `audience='admin'`, `hospital_id`= 해당 병원 + **그 병원 `hospital_admins` 들에게만** 수신자 행
- 전체 공지(`event`/`system`) → 알림 1건 + 대상 계정 수만큼 수신자 행 (fan-out). 본문은 한 번만 저장되므로 중복되지 않습니다

이것으로 세 가지가 한꺼번에 해결됩니다: ① 남의 상담 알림이 내 알림함에 보이지 않음 ② 읽음 상태가 계정별 ③ 관리자가 상태를 바꿔도 **자기** 알림함에 들어가지 않음(수신자는 신청자뿐).

**왜 `notifications.user_id` 한 컬럼이 아닌가**: 전체 공지를 그 방식으로 하려면 알림 본문을 계정 수만큼 복제해야 하고(제목·메시지 중복), 아니면 `user_id = NULL` = 브로드캐스트라는 예외 규칙과 그 예외만을 위한 별도 읽음 테이블이 필요해집니다. 읽음 처리 경로가 두 개가 되는 것이 이 설계에서 가장 피하고 싶은 것이었습니다.

### 5.4 찜이 계정과 무관함

**해결**: `favorites(user_id, hospital_id)` + `@@unique([userId, hospitalId])`.

찜은 행의 생성/삭제입니다(토글). A 계정으로 찜한 것이 B 계정에 보이는 문제, 로그아웃해도 남는 문제가 구조적으로 사라집니다. `@@index([userId, createdAt])` 로 마이페이지 목록을 최신순으로 뽑습니다.

### 5.5 `User` 에 역할이 없음

**해결**:
- `users.role` — `user` | `hospital_admin` | `operator`
- `hospital_admins(user_id, hospital_id)` — **어느 병원**의 담당자인지

권한 경계 제안:

| 화면 | 접근 |
|---|---|
| `/admin`, `/admin/hospital/:id`, `/admin/consultations*`, `/admin/notifications` | `hospital_admin` — **`hospital_admins` 에 걸린 병원만** |
| `/admin/hospital/new` | `operator` (병원 신규 등록은 입점 심사이므로) |
| `/admin/specialists` | `operator` 전용 — 자격증 검수는 플랫폼 운영자 업무입니다(화면 문서도 "운영자용 화면" 이라고 적고 있습니다) |

`/admin` 이 전 병원 목록을 보여주는 현재 구조는 **역할에 따라 갈라야** 합니다: `hospital_admin` 은 담당 병원 1곳이면 그 병원 대시보드로 바로 들어가고 여러 곳이면 담당 병원만 목록에 보이며, `operator` 는 전 병원을 봅니다. 같은 이유로 `/admin/consultations` 도 `hospital_id IN (담당 병원)` 으로 걸러야 합니다(현재는 모든 병원의 고객 실명·전화번호가 한 목록에 섞여 있습니다). **§9 미결 사항 1** 에 제품 결정이 필요한 부분을 정리했습니다.

### 5.6 커뮤니티 글 작성자가 항상 `익명`

**해결**: `qa_posts.author_user_id` (nullable) + `qa_posts.is_anonymous` (boolean).

작성자 연결과 익명 표시를 **분리**했습니다. 로그인한 사람의 글이어도 `is_anonymous=true` 면 화면에는 계속 `익명` 으로 보입니다(현재 표시 유지). 동시에 `author_user_id` 인덱스로 "내가 쓴 질문" 을 만들 수 있습니다.

`author_user_id` 를 nullable 로 둔 이유는 시드 4건과 기존 익명 글을 수용하기 위해서입니다. **애플리케이션 규칙: 새 글은 반드시 `author_user_id` 를 채운다** (= 글쓰기에 로그인을 요구한다). 로그인 강제 여부는 제품 결정이므로 §9 미결 사항 3에 남겼습니다.

### 5.7 커뮤니티 답변을 쓸 수 있는 화면이 없음

**해결**: `qa_answers` 테이블 (JSON 배열이 아닌 실제 테이블) + 작성자 연결.

- `author_user_id` — 누가 썼는가
- `doctor_id` — 전문의 자격으로 답변한 경우 그 전문의
- `hospital_id` — 병원 자격으로 답변한 경우 그 병원
- `is_dentist` — `치과의사 답변` 배지 (§4)

배열이었기 때문에 "답변을 저장할 방법 자체가 없" 던 상태였습니다. 이제 답변 작성 API/화면을 만들 수 있고, `치과의사 답변` 배지가 `doctor_id` + 승인 상태라는 **실제 근거**를 갖습니다(현재는 샘플 플래그일 뿐입니다).

### 5.8 전문의 인증 이력이 없음

**해결**: `doctor_verifications` 테이블 + `doctors.verified_specialty`.

**검수 우회 차단** — 전문의 배지 판정식:

```
verification_status = 'approved'
AND verified_specialty = specialty        ← 분야를 바꾸면 즉시 거짓
AND specialty <> '일반의'
```

`치과보철전문의` 로 승인받은 사람의 `specialty` 를 `치과교정전문의` 로 바꾸면 `verified_specialty`(=보철)와 달라져 **그 순간 배지가 사라집니다**. 앱 코드가 재검수 로직을 잊어도 데이터가 스스로 방어합니다.

**재검수 트리거** (애플리케이션 불변식):

| 무엇이 바뀌면 | 무엇을 한다 |
|---|---|
| `doctors.specialty` 변경 | `status='pending'` 행 신규 생성, `verification_status='pending'`, `rejection_reason=null` |
| `doctors.certificate_url` 변경 | 위와 동일 (자격증을 바꿨는데 승인이 유지되는 문제도 함께 막힘) |
| 승인 처리 | 행을 `approved` 로, `verified_specialty = submitted_specialty` |
| 반려 처리 | 행을 `rejected` + `rejection_reason` 으로, `verified_specialty` 유지 |

`reviewed_by_user_id` / `reviewed_at` 으로 "누가 언제 처리했는가" 도 남습니다(현재는 남지 않습니다). 그리고 이 테이블의 상태 변화가 **"전문의 승인/반려 결과가 병원에 통보되지 않는다"** 는 별도 문제의 알림 트리거가 됩니다 — `audience='admin'`, `hospital_id`= 소속 병원, `related_type='doctor'`.

### 5.9 비밀번호 평문 저장

**해결**: `users.password_hash` + `users.password_salt` (둘 다 nullable). **평문 컬럼은 스키마에 존재하지 않습니다.**

- `password_hash` — bcrypt(cost ≥ 12) 또는 argon2id 결과 문자열
- `password_salt` — bcrypt/argon2 는 salt 를 해시 문자열에 포함하므로 **null**. 알고리즘을 salt 분리형으로 바꿀 경우를 위한 자리입니다
- `provider != 'email'`(소셜 로그인)이면 둘 다 null

비밀번호 규칙("6자 이상")은 애플리케이션 검증이며 DB 는 관여하지 않습니다. 기존 브라우저에 남은 평문 비밀번호는 **이전하지 않습니다** (§6.4).

### 5.10 할인/프로모션에 기간이 없음

**해결 두 가지**:

1. `promotions.start_date` / `end_date` (`'YYYY-MM-DD'`) — 화면이 `기간 한정 할인 혜택을 확인해보세요` 라고 말하는데 기간 필드가 아예 없던 문제. 이제 D-day·마감일 표시와 "기간이 지난 이벤트 자동 제외" 가 가능합니다.
2. `hospital_sponsorships` 테이블 — fixture 에 하드코딩돼 있던 광고 노출 기간(`sponsoredStartDate`/`sponsoredEndDate`)을 관리 가능한 행으로 옮겼습니다. `isSponsored` 는 컬럼이 아니라 **"오늘이 `[start_date, end_date]` 안인 행의 존재"** 로 파생됩니다. 카테고리 배열이 행으로 풀렸으므로 카테고리별로 다른 기간·다른 순위를 팔 수 있습니다.

`/admin/hospital/:id` 의 `광고 현황 (읽기 전용)` 세 가지 상태가 그대로 나옵니다: 행 없음 → `현재 진행중인 광고가 없어요`, 오늘이 기간 안 → `OO 광고 중 · {end_date}까지` (OO = 세부 시술 이름. 2026-10-21 요청 14 전에는 `OO 카테고리 광고 중`), 기간 지남 → `기간 종료`.

> 평점 3.5 미만이면 배지는 붙지만 상단 노출은 제외하는 규칙(`MIN_SPONSORED_RATING`)은 그대로 애플리케이션에 둡니다. 신뢰 보호 정책이라 자주 바뀔 값이고, DB 제약으로 굳힐 성격이 아닙니다.

---

## 6. 인덱스 선정 근거

각 인덱스가 **어느 화면의 어느 쿼리**를 위한 것인지 적었습니다.

> 지금 데이터는 병원 11곳·전문의 14명 규모입니다. 이 크기에서는 인덱스가 없어도 빠릅니다. 아래 인덱스는 **서버·페이지네이션이 생긴 뒤** 를 위한 것이고, 그때 스키마를 다시 손대지 않기 위해 미리 걸어 둡니다. 반대로 **효과가 의심스러운 인덱스는 일부러 만들지 않았습니다** (§6.7).

### 6.1 목록·정렬 (병원 탐색)

| 인덱스 | 쿼리 |
|---|---|
| `hospitals(rating)` | 정렬 `인기순` — `ORDER BY rating DESC` |
| `hospitals(review_count)` | 정렬 `후기순` |
| `hospitals(consult_count)` | 정렬 `상담많은순` |
| `hospitals(deleted_at)` | 모든 목록 쿼리의 `WHERE deleted_at IS NULL` |
| `doctors(rating)`, `(review_count)`, `(consult_count)` | 의사 모드의 같은 정렬 3종 |
| `doctors(years_of_experience)` | 조건 칩 `경력` — `WHERE years_of_experience >= 10` |
| `doctors(verification_status)` | 조건 칩 `전문의`, `/admin/specialists` 목록 |
| `doctors(hospital_id)` | 병원 상세 '전문의 소개', 'OO전문의 상주' 배지, 병원 모드에서 "승인된 전문의가 있는 병원" 판정 |
| `hospital_procedures(procedure_id)` | 시술 칩 필터 — "이 시술을 하는 병원" 역방향 조회. 배열이었을 때 불가능했던 것 |
| `doctor_procedures(procedure_id)` | 의사 모드 시술 칩 필터 |

정렬용 인덱스에 `DESC` 를 명시하지 않았습니다. B-tree 는 양방향 스캔이 가능하고, SQLite/PostgreSQL 둘 다 역방향 스캔을 지원합니다. 명시하면 Prisma 의 `sort:` 옵션이 필요해지고 provider 별 지원 차이가 생깁니다.

### 6.2 검색 화면

| 인덱스 | 쿼리 |
|---|---|
| `hospitals(name_normalized)` | 병원 이름 부분일치 — `WHERE name_normalized LIKE '%q%'` |
| `doctors(name_normalized)` | 전문의 이름 부분일치 |
| `hospital_tags(tag_normalized)` | 태그 검색(현재 화면은 없지만 §3.9 의 정규화 규칙을 완결하기 위해) |

> 앞쪽 와일드카드(`%q%`)는 B-tree 인덱스를 타지 못합니다. 이 인덱스가 실제로 효과를 내는 것은 접두어 검색(`q%`)과 정확 일치입니다. 부분일치를 대규모로 해야 하면 PostgreSQL 의 `pg_trgm` + GIN 인덱스가 답이고, 그건 이전 이후의 작업입니다(§7.6 체크리스트).

### 6.3 상담 (`/admin`, 상담 관리)

| 인덱스 | 쿼리 |
|---|---|
| `consult_requests(hospital_id, created_at)` | `/admin/consultations` 를 담당 병원으로 좁힌 뒤 최신순 (§5.5 적용 후의 주 쿼리) |
| `consult_requests(user_id, created_at)` | "내 상담 내역" 최신순 (§5.1) |
| `consult_requests(status, created_at)` | 상태 필터를 **병원 범위 없이** 거는 질의 — `operator` 의 전 범위 목록, `/admin` 의 `처리 대기 중인 상담`(=`status='new'` 카운트) |
| `consult_requests(hospital_id, status, created_at)` **(2026-10-13 추가)** | 상태 탭 5개(`전체`/`신규`/`연락중`/`예약확정`/`내원완료`/`취소`)의 **건수 집계 + 탭 선택 목록 최신순**. 담당 병원 범위가 선두이고 상태가 가운데, 정렬 컬럼이 뒤인 순서다. 상담 관리 화면에 들어올 때마다 도는 질의라 `(hospital_id, created_at)` 로 받아 필터링하는 것과 차이가 난다 (§12.6) |
| `consult_requests(created_at)` | `/admin` 의 `이번 달 신규 상담` — `WHERE created_at >= 월초 AND < 다음 월초` |
| `consult_requests(doctor_id)` | "이 전문의를 지목한 상담" (§5.2) |
| `consult_status_changes(consult_request_id, changed_at)` | 상담 상세 '상태 변경 이력' 최신순 |
| `consult_memos(consult_request_id, created_at)` | 상담 상세 '메모' 최신순 |

### 6.4 찜 · 알림

| 인덱스 | 쿼리 |
|---|---|
| `favorites(user_id, hospital_id)` UNIQUE | 병원 상세 하트 상태 조회 + 중복 찜 방지 |
| `favorites(user_id, created_at)` | 마이페이지 찜 목록 |
| `favorites(hospital_id)` | (향후) 병원별 찜 수 |
| `notification_recipients(user_id, read_at)` | **안 읽음 배지** — `WHERE user_id=? AND read_at IS NULL` 을 인덱스만으로 처리. 마이페이지 알림함 줄, 상단 🔔, `/admin` 🔔 이 모두 이 숫자를 씁니다 |
| `notification_recipients(notification_id, user_id)` UNIQUE | 같은 알림을 같은 사람에게 두 번 배달하지 않음 |
| `notifications(audience, created_at)` | 알림함 목록 (사용자용/관리자용을 나눠 최신순) |
| `notifications(hospital_id, created_at)` | 병원별 관리자 알림함 |
| `notifications(related_type, related_id)` | "이 상담과 연결된 알림" 조회, 알림 탭 이동 시 대상 판별 |

### 6.5 광고 · 프로모션

| 인덱스 | 쿼리 |
|---|---|
| `hospital_sponsorships(procedure_id, start_date, end_date)` | 병원 탐색: "이 시술 카테고리에서 지금 광고 중인 병원" — 필터 컬럼(`procedure_id`)이 앞, 범위 컬럼이 뒤인 순서 |
| `hospital_sponsorships(hospital_id, end_date)` | `/admin/hospital/:id` 광고 현황 (그 병원의 최신 캠페인) |
| `promotions(hospital_id, start_date, end_date)` | 병원 카드 🔥 배지·할인가, 병원 상세 가격 영역 |
| `promotions(procedure_id, start_date, end_date)` | (향후) 시술별 이벤트 목록 |

### 6.6 콘텐츠

| 인덱스 | 쿼리 |
|---|---|
| `qa_posts(created_at)` | 커뮤니티 목록 최신순 |
| `qa_posts(procedure_id)` | (향후) 시술별 필터 — 화면 문서에 "필터 칩이 없다" 고 적혀 있지만 배지로 이미 노출되는 축입니다 |
| `qa_posts(author_user_id)` | "내가 쓴 질문" (§5.6) |
| `qa_answers(post_id, created_at)` | 질문 상세 답변 목록, 목록의 `답변 N` 카운트 |
| `qa_answers(doctor_id)`, `(hospital_id)` | "이 전문의/병원이 쓴 답변" (§5.7) |
| `guides(procedure_id)` | 꿀팁 → 시술 연결, 시술별 꿀팁 |
| `guides(created_at)` | 홈 꿀팁 카드 순서 |
| `guide_hospitals(hospital_id)` | 병원 → 그 병원이 걸린 꿀팁 (역방향) |
| `reviews(hospital_id, created_at)` | 병원 상세 후기 목록 최신순 |
| `reviews(procedure_id)` | (향후) 시술별 후기 |
| 각 자식 테이블 `(부모_id, sort_order)` | 캐러셀·경력·태그·이벤트 문구의 순서 보존 조회 |

### 6.7 일부러 만들지 않은 인덱스

- **`hospitals.consult_available`, `is_one_day`, `is_recommended`, `feature_night_consult`** — 조건 칩 5개가 쓰는 boolean 들입니다. 값이 두 가지뿐이라 선택도가 낮고(대략 절반), 인덱스를 타는 대신 풀스캔이 더 빠른 전형적인 경우입니다. 게다가 이 칩들은 **여러 개 동시 선택**이라 단일 컬럼 인덱스가 조합에 맞지 않습니다. 병원 수가 수만 곳이 되고 특정 조합이 지배적이라면 그때 복합 인덱스를 실측으로 정합니다.
- **`hospitals.region`** — 지역 필터 화면이 없습니다. 카드 표시용입니다.
- **공간 인덱스 (`latitude`/`longitude`)** — SQLite 에 대응물이 없습니다. §3.8 참고.
- **`users.provider`** — 조회 축이 아닙니다.

---

## 7. PostgreSQL 이전 절차

### 7.1 무엇이 실제로 바뀌는가

| | SQLite | PostgreSQL |
|---|---|---|
| `String` | `TEXT` | `TEXT` |
| `Int` | `INTEGER` | `INTEGER` |
| `Float` | `REAL` | `DOUBLE PRECISION` |
| `Boolean` | `INTEGER` (0/1) | `BOOLEAN` |
| `DateTime` | 숫자(epoch ms) | `TIMESTAMP(3)` |
| `LIKE` 대소문자 | ASCII 무시 | **구분** |
| 동시 쓰기 | 파일 락 (직렬화) | MVCC |
| FK 강제 | `PRAGMA foreign_keys=ON` 필요 (Prisma 가 켠다) | 항상 |

### 7.2 절차

> **이 절차는 2026-08-12 에 실제로 한 번 끝까지 돌려서 검증했습니다.** 결과는 §7.2.1.

```bash
cd backend

# 1. 기존 SQLite 마이그레이션 폴더를 보존해 둔다 (재사용하지 않는다)
mv prisma/migrations prisma/migrations.sqlite.bak
#   이미 커밋된 상태라면 `git mv` 를 쓴다. 아직 커밋 전(untracked)이면
#   `git mv` 는 "not under version control" 로 실패한다 — 그때는 위처럼 `mv`.

# 2. provider 와 접속 URL 을 바꾼다
#    backend/prisma/schema.prisma:  provider = "postgresql"
#    .env:  DATABASE_URL="postgresql://user:pass@host:5432/mola?schema=public"

# 3. 마이그레이션을 처음부터 재생성한다 (DB 가 없으면 Prisma 가 CREATE DATABASE 까지 한다)
npx prisma migrate dev --name init_postgres --skip-seed
#   --skip-seed 를 권한다: migrate 성공 여부와 시드 실패를 섞어서 보지 않기 위해서다.
#   시드는 다음 단계에서 따로 돌린다.

# 4. 클라이언트 재생성 (migrate dev 가 이미 하지만, 명시적으로 한 번 더)
npx prisma generate

# 5. 데이터: 시드 재실행 (§7.3)
npm run prisma:seed

# 6. 검증: 행 수와 테스트 (§7.5 마지막 항목)
npm run test:run
```

**마이그레이션 파일은 재사용할 수 없습니다.** Prisma 는 provider 별로 다른 DDL 을 생성하고(`INTEGER` vs `BOOLEAN`, PK 선언 위치, 인덱스 문법 등), `migration_lock.toml` 에 provider 가 박혀 있어 provider 를 바꾸면 기존 마이그레이션 히스토리를 적용할 수 없습니다. 그래서 **스키마 파일만 옮기고 마이그레이션은 새로 만듭니다.** 위 규칙(§3)을 지켜 왔다면 `migrate dev` 한 번으로 끝나야 합니다.

**Prisma 6.19+ 주의 — 시드 명령의 위치**: `package.json#prisma` 는 deprecated 이고 Prisma 7 에서 제거됩니다. 시드 명령은 `backend/prisma.config.ts` 의 `migrations.seed` 에 있습니다. 이 설정 파일을 쓰면 **Prisma 가 `.env` 를 자동으로 읽지 않으므로**(`Prisma config detected, skipping environment variable loading`) 설정 파일 첫 줄에서 `import 'dotenv/config'` 를 합니다. 이전 작업 중 `DATABASE_URL` 을 인라인으로 넘길 때는 `dotenv` 가 기존 환경변수를 덮지 않는다는 점(= 인라인 값이 이깁니다)을 이용하면 됩니다.

#### 7.2.1 검증 결과 (2026-08-12)

PostgreSQL **18.4** (npm `embedded-postgres` 로 띄운 로컬 인스턴스, 포트 55432)에서 위 절차를 그대로 실행했습니다. 이 머신에는 Docker·psql·WSL 배포판이 없어 컨테이너로는 띄울 수 없었습니다.

| 확인 항목 | SQLite | PostgreSQL 18.4 |
|---|---|---|
| `prisma validate` | 통과 | 통과 |
| `migrate dev` | 1개 마이그레이션 생성·적용 | 1개 생성·적용 (수동 수정 0) |
| `CREATE TABLE` | 27 | 27 |
| `CREATE INDEX` / `UNIQUE INDEX` | 57 / 9 | 57 / 9 |
| `TEXT` 컬럼 | 138 | 138 |
| `INTEGER` | 19 | 19 |
| 실수형 | `REAL` 4 | `DOUBLE PRECISION` 4 |
| boolean | `BOOLEAN` 14 (SQLite 는 0/1 로 저장) | `BOOLEAN` 14 |
| 타임스탬프 | `DATETIME` 29 | `TIMESTAMP(3)` 29 |
| `CREATE TYPE`(enum) / `SERIAL` / `JSON` / `DEFAULT CURRENT_TIMESTAMP` | 0 | 0 |
| 시드 후 전체 행 수 | 407 | **407** (테이블별 27개 모두 동일) |
| `npm run test:run` | 13개 통과 | **13개 통과** (코드 수정 0) |

즉 §3 의 이식성 규칙은 실제로 지켜졌고, 이전은 provider 한 줄 + 마이그레이션 재생성으로 끝납니다. 애플리케이션 코드는 한 줄도 바꾸지 않았습니다.

> **위 표는 27개 테이블 기준입니다.** §11 의 5개 테이블을 포함한 재검증은 아래 7.2.2 에 있습니다.

#### 7.2.2 재검증 결과 — 32개 테이블 (2026-08-12, 2차)

`refresh_tokens`·`audit_logs`·`partner_inquiries`·`legal_documents`·`user_agreements` 5개 테이블과 `doctor_verifications.reviewed_by_user_id` 의 FK 정책 변경(`SET NULL` → `RESTRICT`)까지 반영한 뒤 **같은 절차를 처음부터 다시 돌렸습니다** (PostgreSQL 18.4, `embedded-postgres`, 포트 55432). 7.2.1 의 예상 증분과 실제 수치가 모두 일치했습니다.

| 확인 항목 | SQLite (32개) | PostgreSQL 18.4 (32개) | 27개 기준 대비 |
|---|---|---|---|
| `migrate dev` | 2개 마이그레이션 (init + 추가분) | **1개 생성·적용** (provider 별 재생성, 수동 수정 0) | — |
| `CREATE TABLE` | 32 | **32** | +5 (예상 +5) |
| `CREATE UNIQUE INDEX` | 12 | **12** | +3 (예상 +3) |
| `CREATE INDEX` | 69 | **69** | +12 (예상 +12) |
| `TEXT` 컬럼 | 175 | **175** | +37 |
| `INTEGER` | 19 | **19** | 0 (새 테이블에 금액·수량 컬럼이 없다) |
| 실수형 | `REAL` 4 | `DOUBLE PRECISION` 4 | 0 |
| boolean | `BOOLEAN` 16 | **`BOOLEAN` 16** | +2 (`pii_masked` nullable, `requires_agreement`) |
| 타임스탬프 | `DATETIME` 40 | **`TIMESTAMP(3)` 40** | +11 |
| `CREATE TYPE`(enum) / `SERIAL` / `JSON` / `DEFAULT CURRENT_TIMESTAMP` | 0 | **0** | 계속 0 |
| `ON DELETE RESTRICT` FK | 14 | 14 | +3 (`audit_logs` 2개, `partner_inquiries.reviewed_by_user_id`) + 1 (`doctor_verifications` 정책 변경) |
| 시드 후 전체 행 수 | 410 | **410** (테이블별 32개 모두 동일) | +3 (`legal_documents` 3행) |
| `npm run test:run` | 126개 통과 | **126개 통과** (코드 수정 0) | +40 |

즉 새 5개 테이블도 §3 의 이식성 규칙을 그대로 지켰습니다. 특히 확인한 것 두 가지:

- **`pii_masked` 의 3값(`true`/`false`/`null`)이 두 DB 에서 같게 동작합니다.** SQLite 는 boolean 을 0/1 로 저장하므로 nullable boolean 이 실제로 세 상태를 구분하는지 확인이 필요했는데, `WHERE pii_masked = false` 와 `IS NULL` 질의가 양쪽에서 같은 결과를 냈습니다 (`test/audit-log.spec.ts`).
- **`used_at`/`revoked_at` 기반 상태 판정과 `deleteMany` 정리 배치**가 양쪽에서 같게 동작합니다. 시각 비교(`expires_at < now()`)를 `DATETIME`(숫자)과 `TIMESTAMP(3)` 어느 쪽에서도 Prisma Client 가 같게 처리했습니다.

SQLite 쪽 마이그레이션이 2개인 것은 추가분을 증분 마이그레이션으로 만들었기 때문이고, PostgreSQL 로 옮길 때는 §7.2 절차대로 **처음부터 1개로 재생성**됩니다(마이그레이션 파일은 provider 간 재사용할 수 없습니다). 이때 SQLite 의 `RedefineTables`(FK 변경을 테이블 재작성으로 처리하는 `PRAGMA foreign_keys=OFF` 블록)는 PostgreSQL 에서 `ALTER TABLE … ADD CONSTRAINT` 로 바뀌므로, **증분 마이그레이션의 raw 카운트(`CREATE TABLE` 6, `CREATE INDEX` 14)에는 재작성 임시 테이블이 섞여 있습니다.** 위 표는 최종 스키마 기준 수치입니다.

문자열 날짜(`start_date`/`end_date`)를 `TEXT` 로 두고 사전순 비교하는 §3.7 의 결정도 양쪽에서 같은 결과를 냈습니다(광고 활성 판정 테스트가 두 DB 에서 동일하게 통과).

남은 미검증 항목 두 개는 **쿼리 코드가 아직 없어서** 확인할 수 없었습니다. API 모듈이 생기면 §7.5 체크리스트로 다시 확인해야 합니다.
- `LIKE` 대소문자 차이 (§3.9): 지금 fixture 의 병원·전문의 이름에 ASCII 대문자가 섞인 데이터가 없어 차이를 드러내는 케이스 자체가 없습니다.
- 동시 쓰기 경쟁 조건 (§7.5): 쓰기 엔드포인트가 아직 없습니다.

### 7.3 데이터 이전

데이터가 시드뿐이라면 **가장 안전한 방법은 시드 재실행**입니다.

```bash
DATABASE_URL="postgresql://..." npx prisma db seed
```

운영 데이터가 쌓인 뒤라면 Prisma Client 로 읽어서 Prisma Client 로 쓰는 스크립트를 씁니다 (CSV 나 `sqlite3 .dump` 를 쓰지 않는 이유: boolean 0/1, DateTime 숫자 표현, 따옴표 처리에서 반드시 사고가 납니다).

```ts
// scripts/migrate-to-postgres.ts — 개념
const src = new PrismaClient({ datasources: { db: { url: SQLITE_URL } } });     // 이전 스키마 클라이언트
const dst = new PrismaClient({ datasources: { db: { url: POSTGRES_URL } } });   // 신규 스키마 클라이언트

// FK 순서대로. 부모 → 자식.
const order = [
  'procedure', 'user', 'hospital', 'hospitalAdmin',
  'hospitalProcedure', 'hospitalImage', 'hospitalTag', 'hospitalEventNote',
  'businessHour', 'hospitalSponsorship',
  'doctor', 'doctorProcedure', 'doctorCareer', 'doctorVerification',
  'consultRequest', 'consultStatusChange', 'consultMemo',
  'favorite', 'review', 'reviewPhoto', 'promotion',
  'guide', 'guideHospital', 'qaPost', 'qaAnswer',
  'notification', 'notificationRecipient',
];
// 각 모델을 배치로 findMany → createMany. Prisma Client 가 boolean/DateTime 을
// 양쪽 표현으로 알아서 변환하므로 캐스팅 코드가 필요 없다.
```

PK 가 애플리케이션 생성 문자열이라 **id 를 그대로 옮길 수 있고, 시퀀스 재설정(`setval`)이 필요 없습니다.** 이것이 §3.4 를 지킨 대가로 얻는 가장 큰 이득입니다.

### 7.4 평문 비밀번호는 이전하지 않는다

현재 브라우저 localStorage 의 계정은 비밀번호가 평문입니다. **이전 대상이 아닙니다.** 그 계정들은 버리고 새로 가입받거나, 이메일만 옮기고 `password_hash = null` + 비밀번호 재설정 안내를 보냅니다. 평문을 해시로 바꿔 넣는 것은 기술적으로 가능하지만, "그 값이 어딘가에 평문으로 존재했다" 는 사실이 바뀌지 않으므로 폐기가 맞습니다.

### 7.5 이전 전에 확인할 것 (체크리스트)

- [ ] **`LIKE` 를 쓰는 모든 쿼리가 `*_normalized` 컬럼을 대상으로 하는가.** 원본 컬럼(`name`, `tag`)에 대한 `contains` 가 하나라도 남아 있으면 PostgreSQL 에서 영문 검색이 조용히 실패합니다. 가장 빠뜨리기 쉬운 항목입니다
- [ ] `mode: 'insensitive'` 를 쓴 곳이 없는가 (SQLite 에서 동작하지 않으므로 지금은 없어야 정상)
- [ ] `$queryRaw` / `$executeRaw` 사용처가 없는가. 있다면 boolean `= 1` / `= true`, 문자열 결합, `strftime` 같은 SQLite 전용 함수를 점검
- [ ] `@default(now())` / `@updatedAt` 이 새로 들어오지 않았는가
- [ ] `enum` / 스칼라 배열 / `Json` 필드가 새로 들어오지 않았는가 (SQLite 에서 애초에 `migrate` 가 실패하므로 자동 감지되지만, provider 를 바꾼 뒤 추가되면 SQLite 로 되돌릴 수 없게 됩니다)
- [ ] 정렬·페이지네이션에 **타이브레이커**가 있는가 — `ORDER BY created_at DESC` 만 쓰면 동일 timestamp 의 순서가 두 DB 에서 다릅니다. `ORDER BY created_at DESC, id DESC` 로 고정하세요. 시드 상담·알림에 같은 시각이 실제로 존재합니다
- [ ] 트랜잭션 경계 점검 — SQLite 는 쓰기를 직렬화하기 때문에 경쟁 조건이 잘 드러나지 않습니다. PostgreSQL 로 가면 드러납니다. 특히 ① 상담 접수 + 관리자 알림 생성 + 수신자 fan-out ② 검수 처리 + `doctors` 캐시 갱신 ③ 찜 토글(유니크 위반 재시도) 을 `prisma.$transaction` 으로 묶었는지 확인
- [ ] `view_count` 증가처럼 read-modify-write 하는 곳이 `increment: 1` 원자 연산인가
- [ ] 시간대 — 서버 프로세스 `TZ=UTC`, DB 세션 UTC, 표시 변환은 프런트에서만. 화면 문서 여러 곳이 "보고 있는 컴퓨터의 시간대 기준" 이라고 적고 있는데 그 동작을 유지해야 합니다
- [ ] 이전 후 검증: 테이블별 행 수 비교, boolean 컬럼의 `true` 개수 비교, `created_at` 최소/최대값 비교

### 7.6 이전 후에 검토할 것 (SQLite 에서는 할 수 없던 것들)

- `pg_trgm` + GIN 인덱스로 부분일치 검색 개선 (§6.2)
- PostGIS + `ST_DWithin` 으로 지도 반경 필터를 DB 로 이동 (§3.8)
- `CHECK` 제약으로 상태값 허용 목록을 DB 에 고정 (Prisma 스키마로는 선언할 수 없어 수동 마이그레이션이 필요합니다). 애플리케이션 검증의 이중 안전망
  - **조건부**: `CHECK (status <> 'booked' OR visit_at IS NOT NULL)` — 켜기 전에 **값 없는 기존 `booked` 행**을 어떻게 할지 먼저 정해야 합니다 (§12.10). 그 전까지는 쓰기 경로의 앱 불변식입니다
- 부분 인덱스 (`WHERE deleted_at IS NULL`) 로 soft delete 인덱스 크기 축소
  - 같은 방식으로 `consult_requests(hospital_id, visit_at) WHERE visit_at IS NOT NULL` — `visit_at` 은
    대부분의 행에서 `null` 이라 `오늘 내원 예정` 인덱스(§13.5)가 쓸모없는 항목을 대부분 담고 있습니다

---

## 8. 시드 데이터 전략

### 8.1 원칙

1. **기존 fixture 의 id 를 그대로 쓴다.** `h1`, `d1`, `cr1`, `q1`, `a1`, `g1`, `p1`, `r1`, `notif1`, `memo-cr2-1`. 화면 문서와 `/hospital/h1` 같은 예시 URL, QA 시나리오가 이 값에 의존합니다.
2. **시드는 idempotent 하게.** 모든 upsert 를 id 기준으로 하면 재실행이 안전하고, PostgreSQL 이전 시 그대로 재사용됩니다.
3. **fixture 를 손으로 옮겨 적지 않는다.** `frontend/src/mocks/fixtures/*.ts` 를 시드 스크립트에서 직접 import 하거나(경로 별칭 주의) 한 번 JSON 으로 덤프해 `backend/prisma/seed/data/*.json` 에 둡니다. 손으로 옮기면 11개 fixture × 수십 행에서 반드시 불일치가 생깁니다.
4. **fixture 에 없는 것(사용자·역할)은 시드가 만든다.** 아래 §8.3.

### 8.2 fixture → 테이블 매핑

| fixture | 대상 |
|---|---|
| ~~`procedures.ts` (13)~~ → **`backend/prisma/seed/data/procedures.ts` (31)** + `procedure-categories.ts` (9) | `procedures` + `procedure_categories` (`sort_order` = 배열 인덱스). **원본이 서버로 왔습니다 — §17.8** |
| `hospitals.ts` (11) | `hospitals` + `hospital_procedures` + `hospital_images` + `hospital_tags` + `hospital_event_notes` + `business_hours` + `hospital_sponsorships` |
| `doctors.ts` (14) | `doctors` + `doctor_procedures` + `doctor_careers` + `doctor_verifications` |
| ~~`consultRequests.ts` (7)~~ → **`backend/prisma/seed/data/consult-requests.ts` (8)** | `consult_requests` + `consult_status_changes` + `consult_memos`. **원본이 서버로 옵니다 — §12.13** (요청서 15) |
| `reviews.ts` (5) | `reviews` + `review_photos` |
| `promotions.ts` (4) | `promotions` (**기간을 새로 부여** — §8.4) |
| `guides.ts` (8) | `guides` + `guide_hospitals` |
| `qaPosts.ts` (4) | `qa_posts` + `qa_answers` |
| ~~`notifications.ts` (7)~~ → **`backend/prisma/seed/data/notifications.ts`** | `notifications` + `notification_recipients`. **원본이 서버로 옵니다 — §12.13** (요청서 15) |
| `trendingSearches.ts` | **이전하지 않음** — 테이블이 없습니다 (§8.6) |
| `placeholder-company-info.ts` | **이전하지 않음** — 코드 상수 |

### 8.3 새로 만드는 시드 데이터

**시술 마스터** — `procedure_categories` **9행** + `procedures` **31행** (§17). `sort_order` 는 `backend/prisma/seed/data/*.ts` 의 배열 순서(홈 격자·탐색 탭·관리자 폼·커뮤니티 선택이 공유하는 순서)이고, 그 순서는 화면의 `features/procedure/taxonomy.ts` 와 **같아야 합니다** — 테스트가 고정합니다 (§17.8). *(요청 14 이전: 프론트 fixture `procedures.ts` 13행)*

**사용자** — fixture 에 없으므로 시드가 만듭니다.

| id | role | 용도 |
|---|---|---|
| `u-operator` | `operator` | 전문의 인증 검수 담당 (`/admin/specialists`) |
| `u-admin-h1` … `u-admin-h11` | `hospital_admin` | 병원 1곳씩 담당. `hospital_admins` 에 (user, hospital) 1행씩 |
| `u-seed-1` … `u-seed-7` | `user` | 상담 신청자 7명 (`김민준` `박서준` `최지훈` `정하윤` `강도윤` `이서연` `한소율`) |

- 이메일: `ops@molarmolar.example`, `admin-h1@molarmolar.example`, `seed-1@molarmolar.example` … (모두 `.example` — 실수로 실제 주소에 메일이 나가지 않게)
- `password_hash`: 개발용 공통 비밀번호의 bcrypt 해시. **`.env` 의 `SEED_PASSWORD` 에서 읽고, 값이 없으면 시드를 중단합니다.** 해시를 시드 코드에 하드코딩하지 마세요
- `provider: 'email'`

**상담 ↔ 사용자 연결** — `consult_requests.user_id` 가 NOT NULL 이므로 필수입니다. `name` 기준으로 `cr1→u-seed-1`(김민준) … `cr7→u-seed-7`(한소율) 로 매핑합니다. `name`/`phone` 컬럼에는 fixture 값을 그대로 넣습니다.

> **요청서 15 에서 바뀝니다 (2026-10-22 설계).** "상담 1건 = 신청자 계정 1개" 가 깨집니다 — 한 사람이 두 병원에 신청하는 샘플이 생기기 때문입니다. 신청자 7명은 명시 목록이 되고 상담 행이 `applicantId` 로 가리킵니다. 계정 id 체계(`u-seed-1`~`7`)와 이름은 그대로입니다 — **§12.13-C·E**.

**전문의 검수 이력** — `doctors.ts` 의 `verificationStatus` 로부터 각 전문의당 `doctor_verifications` 1행을 만듭니다.

| fixture 상태 | 생성 행 | `doctors.verified_specialty` |
|---|---|---|
| `approved` (9명) | `status='approved'`, `reviewed_by_user_id='u-operator'`, `reviewed_at`= 시드 기준 시각 | `specialty` 와 동일 |
| `pending` (3명) | `status='pending'`, `reviewed_*`= null | `null` |
| `rejected` (2명) | `status='rejected'`, `rejection_reason`= fixture 값, `reviewed_by_user_id='u-operator'` | `null` |

`submitted_specialty` = fixture 의 `specialty`, `submitted_certificate_url` = fixture 의 `certificateUrl`.

**알림 수신자** — `notifications.ts` 의 `audience`/`relatedId`/`isRead` 로부터 `notification_recipients` 를 만듭니다.

| 알림 | 수신자 | `read_at` |
|---|---|---|
| `notif1` (user, cr3) | cr3 신청자 = `u-seed-3`(최지훈) | null (안 읽음) |
| `notif7` (user, cr2) | cr2 신청자 = `u-seed-2`(박서준) | 시각 있음 |
| `notif2`, `notif3` (user, 전체 공지) | `u-seed-1`~`u-seed-7` 전원 (fan-out 7행씩) | 시각 있음 (fixture `isRead: true`) |
| `notif4` (admin, cr1 → h1) | `u-admin-h1`, `notifications.hospital_id='h1'` | null |
| `notif5` (admin, cr6 → h5) | `u-admin-h5`, `hospital_id='h5'` | null |
| `notif6` (admin, 운영 공지) | `u-admin-h1`~`u-admin-h11` 전원 | 시각 있음 |

이 매핑을 그대로 넣으면 화면 문서가 적어 둔 초기 상태가 재현됩니다 — 사용자 알림함 안 읽음 1건(단, 이제 **최지훈 계정에서만** 보입니다), 관리자 알림함 안 읽음 2건(각각 h1·h5 담당자에게).

> **요청서 15 에서 이 표가 대체됩니다 (2026-10-22 설계).** `notif1`~`notif7` 은 사라지고, 알림이 **상담 처리 이벤트에서 파생**됩니다(id `ntf-{상담id}-{i}`) — 수신자 규칙(§5.3)은 한 줄도 바뀌지 않습니다. 새 표는 **§12.13-D** 입니다.

**광고 캠페인** — `hospitals.ts` 의 광고 필드를 `hospital_sponsorships` 행으로 풉니다. `sponsoredCategories` 의 각 원소마다 1행이며 `start_date`/`end_date`/`rank` 는 해당 병원 값을 복사합니다 — **단 기간 두 개는 §8.5 의 이동 규칙을 거칩니다**(고정 날짜로 넣으면 그 날이 지난 뒤 광고가 전부 사라집니다). `isSponsored=false` 인 병원은 행을 만들지 않습니다(`h1` 이 그 대조군입니다 — 평점 1위인데 광고를 사지 않아 `h3` 의 광고가 위로 올라가는 것을 보여주는 케이스).

### 8.4 fixture 에 날짜가 없는 것 — 시드가 부여합니다

아래 셋은 **fixture 에 날짜 자체가 없습니다.** 밀 원본이 없으므로 §8.5 의 이동 규칙이 아니라 `SEED_TODAY` 기준 오프셋을 직접 줍니다. (두 방식이 섞인 것이 아니라, 적용할 대상이 다릅니다 — 있는 날짜는 민다, 없는 날짜는 만든다.)

| 대상 | 부여하는 값 |
|---|---|
| `promotions` 4건 | 아래 창 (`SEED_TODAY` 를 감쌉니다) |
| `doctor_verifications` | `created_at` = `SEED_TODAY - 7일`(제출), `reviewed_at` = `SEED_TODAY - 6일`(검수) |
| `legal_documents.effective_at` | `SEED_TODAY - 1일` (미래면 "지금 유효한 버전" 이 0건이 됩니다 — §11.3) |

`promotions.ts` 4건에 `start_date`/`end_date` 가 없습니다. 4건이 항상 진행중으로 보여야 화면 문서(`이벤트 4개가 카드로 나열됩니다`)와 맞으므로, **시드 기준일을 감싸는 창**을 줍니다.

```
p1  start = SEED_TODAY - 30일,  end = SEED_TODAY + 30일   (진행중)
p2  start = SEED_TODAY - 15일,  end = SEED_TODAY + 45일   (진행중)
p3  start = SEED_TODAY - 45일,  end = SEED_TODAY + 15일   (진행중)
p4  start = SEED_TODAY -  7일,  end = SEED_TODAY + 60일   (진행중)
```

기간 만료 UI 를 QA 하려면 `p3` 의 `end_date` 를 과거로 바꿔 보는 것으로 충분합니다. 이것도 문서에 남겨 QA 가 재현할 수 있게 하세요.

### 8.5 fixture 날짜는 **기준일 하나로 통째로 민다** (결정)

fixture 의 날짜는 전부 2026년 5~9월 고정입니다. 그대로 넣으면 시간이 지날수록 샘플이 썩습니다 — `/admin` 의 `이번 달 신규 상담` 이 0 이 되고, **광고 기간 4건이 전부 만료되어 스폰서 배치가 화면에서 사라집니다**(실제로 2026-09-15 에 마지막 광고가 끝나 `test/seed-data.spec.ts` 가 빨개졌습니다). 날짜별로 손보면 규칙이 여러 개가 되므로, **규칙은 하나입니다.**

```
FIXTURE_TODAY = 2026-07-30      목 데이터의 "오늘" (consultRequests.ts 주석)
SEED_TODAY    = env SEED_TODAY (YYYY-MM-DD) 또는 시드 실행 시각의 UTC 날짜
shift         = SEED_TODAY - FIXTURE_TODAY       (일 단위 정수. UTC 라 DST 가 없습니다)

fixture 에 있는 모든 날짜 += shift
  - 시각('2026-07-28T09:15:00.000Z')  → Date 에 그대로 더합니다 (시:분:초 보존)
  - 달력일('2026-07-05')              → 날짜 단위로 더해 다시 'YYYY-MM-DD' 로 둡니다 (§3.7)
```

이 규칙의 성질이 곧 근거입니다.

- **샘플 사이의 간격과 순서가 원본 그대로입니다.** 전부 같은 값을 더하므로 "상담보다 먼저 도착한 상담 알림" 같은 역전이 구조적으로 생기지 않습니다 (예전에는 상담별 오프셋을 알림에 다시 적용하는 두 번째 규칙이 필요했습니다).
- **`SEED_TODAY=2026-07-30` 이면 shift = 0** 이라 fixture 원본이 그대로 들어갑니다. 원본 충실 재현이 특별 경로 없이 됩니다.
- **광고·프로모션 기간이 언제 시드해도 유효합니다** (아래 표).
- 밀기 함수는 DB 를 모르는 순수 함수 하나입니다 (`backend/prisma/seed/dates.ts`). 경계값은 DB 없이 단위 테스트로 고정합니다.

**적용 대상** — fixture 에 날짜가 있는 모든 테이블입니다.

| 테이블 | 밀리는 컬럼 |
|---|---|
| `consult_requests` | `created_at`, `updated_at`(= 마지막 상태 변경) |
| `consult_status_changes` | `changed_at` |
| `consult_memos` | `created_at` |
| `notifications` | `created_at` (상담 연계분·전체 공지 모두 같은 shift) |
| `notification_recipients` | `read_at` (읽은 알림은 도착 시각과 같음) |
| `reviews` | `created_at` |
| `guides` | `created_at` |
| `qa_posts` · `qa_answers` | `created_at`, `updated_at` |
| `hospital_sponsorships` | `start_date`, `end_date` |

`hospitals`·`doctors`·`users` 의 `created_at`/`updated_at` 은 fixture 에 없는 값이라 **시드 실행 시각**을 그대로 씁니다(밀 원본이 없습니다). `promotions`·`doctor_verifications`·`legal_documents` 는 §8.4.

**상담 7건이 놓이는 자리** (fixture 날짜에서 파생됩니다 — 표를 따로 유지하지 않습니다)

> ⚠ **요청서 15 에서 이 표가 대체됩니다 (2026-10-22 설계).** 상담·알림 시드의 원본이
> `backend/prisma/seed/data/` 로 오면서 밀 fixture 날짜가 없어지고, 샘플 8건이 `SEED_TODAY` 기준
> **오프셋을 직접 받습니다**(§8.4 쪽 규칙). 새 자리표는 **§12.13-C** 에 있습니다. 아래 표는
> 요청서 15 가 구현되기 전까지의 상태입니다 — 두 방식이 섞인 것이 아니라 적용 대상이 바뀝니다.

```
cr6  SEED_TODAY -  1일   contacted
cr1  SEED_TODAY -  2일   new
cr2  SEED_TODAY - 10일   contacted
cr3  SEED_TODAY - 15일   booked
cr7  SEED_TODAY - 25일   new
cr4  SEED_TODAY - 35일   cancelled   → 항상 '지난 달' (35 > 한 달 최대 일수)
cr5  SEED_TODAY - 50일   new         → 항상 '지난 달'
```

> 이전 판(§8.5 구안)은 `cr4` 를 −45일로 **지정**했습니다. 단일 규칙에서는 fixture 값(2026-06-25)이 그대로 −35일이 됩니다. 의미("지난 달의 취소 건")는 같고, 규칙이 하나 줄어듭니다.

**주의 — '이번 달' 은 `SEED_TODAY` 의 날짜(일)에 달려 있습니다.** 20일에 시드하면 이번 달 5건이지만, 매월 1일에 시드하면 0건입니다(가장 최근 상담도 전날이므로). 이것은 규칙의 결함이 아니라 "이번 달" 이라는 지표의 성질입니다. 대시보드 숫자를 보려면 `SEED_TODAY` 를 그 달 중순 이후로 고정해서 시드하세요. 테스트(`backend/test/seed-data.spec.ts`)는 그래서 달력 월이 아니라 **"최근 3일 안에 상담이 있다"** 로 단정합니다 — 어느 날 돌려도 참인 것만 고정합니다.

**광고 기간** — fixture 의 창 4개는 모두 `FIXTURE_TODAY` 를 안쪽에 두고 있습니다. 같은 값을 더하므로 **shift 후에도 반드시 `SEED_TODAY` 를 포함합니다.** 이것이 "광고가 언제 시드해도 보인다" 의 증명이고, 단위 테스트가 그 전제(창이 기준일을 포함한다)를 지킵니다.

| 병원 | 시술 | fixture 기간 | 기준일로부터 | shift 후 (`SEED_TODAY` 기준) |
|---|---|---|---|---|
| `h2` | `laminate` | 2026-07-05 ~ 08-20 | −25일 ~ +21일 | `SEED_TODAY-25` ~ `SEED_TODAY+21` |
| `h3` | `implant` | 2026-07-10 ~ 08-15 | −20일 ~ +16일 | `SEED_TODAY-20` ~ `SEED_TODAY+16` |
| `h5` | `implant`, `gum-disease` | 2026-07-01 ~ 08-31 | −29일 ~ +32일 | `SEED_TODAY-29` ~ `SEED_TODAY+32` |
| `h6` | `whitening` | 2026-07-15 ~ 09-15 | −15일 ~ +47일 | `SEED_TODAY-15` ~ `SEED_TODAY+47` |

`h1`·`h4`·`h7`~`h11` 은 `is_sponsored=false` 라 행이 없습니다 — `h1` 이 대조군입니다(평점 1위인데 광고를 사지 않았습니다). `h5` 만 카테고리 2개라 행이 2개입니다.

광고 판정은 서울 날짜(`seoulToday()`, §3.7)로 하고 `SEED_TODAY` 는 UTC 날짜라, 둘이 하루 어긋날 수 있습니다. 가장 가까운 경계도 기준일에서 15일 떨어져 있어 영향이 없습니다.

**만료 UI 를 QA 하려면** `p3` 의 `end_date` 나 `h6` 의 `end_date` 를 과거로 바꾸세요. 되돌리려면 시드를 다시 돌리면 됩니다(idempotent).

### 8.6 이전하지 않는 fixture

- `trendingSearches.ts` (인기 검색어 10/10/6/8 + 추천 검색어 6) — 값이 코드에 하드코딩된 고정 샘플이고, 관리 화면이 없으며, 순위 변동(`▲2`)도 실제 집계가 아닙니다. 테이블로 옮기면 "관리하는 곳이 없는 테이블" 이 됩니다 (§9 제안 1)
- `placeholder-company-info.ts` (회사 정보) — 코드 상수. 사업자 정보가 확정되면 파일만 교체하면 됩니다
- 홈 배너 3장 — 화면 코드에 하드코딩. 링크도 없어 저장할 필드가 없습니다 (§9 제안 2)

### 8.7 테스트 DB — 개발 DB 와 파일을 나눕니다

예전에는 `npm run test:run` 이 `.env` 의 `DATABASE_URL`(= `backend/prisma/dev.db`)을 그대로 썼습니다. 그래서 **개발용 앱에서 한 번 가입해 보는 것만으로 테스트가 빨개지고**, 반대로 테스트가 개발 DB 에 `refresh_tokens`·`audit_logs` 행을 남기고 CLI 테스트가 시드 계정의 역할을 잠시 바꿨습니다(중간에 끊기면 개발 DB 가 이상한 상태로 남습니다). 한쪽을 지키려고 다른 쪽에 조건을 다는 방식(예: "`.example` 도메인 계정만 센다")으로는 끝이 없습니다 — **파일을 나눕니다.**

| 항목 | 내용 |
|---|---|
| 파일 | `backend/prisma/test.db` (`.gitignore` 의 `prisma/test.db*` 가 저널·WAL 까지 뺍니다) |
| 주소 | `TEST_DATABASE_URL` 이 있으면 그 값, 없으면 `file:./test.db` (상대 경로 기준은 `schema.prisma` 가 있는 `prisma/`) |
| 수명 | `npm run test:run` / `npm test` 시작마다 **지우고 다시 만듭니다** — 삭제 → `prisma migrate deploy` → 시드(`SEED_TODAY` = 오늘) |
| 끝난 뒤 | 지우지 않습니다. 실패를 조사할 때 Prisma Studio 로 열어 볼 수 있어야 합니다 |

**보장** — 테스트 프로세스의 `DATABASE_URL` 은 `.env` 가 아니라 위 규칙이 정합니다. `.env` 는 `SEED_PASSWORD`·JWT 키 때문에 여전히 읽지만, **dotenv 는 이미 있는 값을 덮지 않으므로** 테스트가 먼저 넣은 주소가 이깁니다. 그 값이 `dev.db` 를 가리키면 테스트는 시작하지 않고 중단합니다(오타 하나로 개발 DB 를 밟는 경로를 남기지 않습니다). 자식 프로세스를 띄우는 테스트(운영자 CLI)도 부모의 환경을 물려받아 같은 파일을 봅니다.

**왜 `migrate deploy` 인가** — `migrate reset` / `db push --force-reset` 이 아닙니다. 둘은 파괴적 명령이라 Prisma 6 이 AI 에이전트가 실행할 때 사용자 동의 없이는 막고, 막히면 테스트가 "DB 가 없다" 가 아니라 "프롬프트 대기" 로 멈춥니다. 파일을 먼저 지우면 빈 파일에 `deploy` 하는 것으로 충분하고, **CI·운영이 쓰는 경로와 같은 명령**이라 마이그레이션 히스토리가 실제로 적용 가능한지도 함께 검증됩니다.

**결과** — 테스트는 개발 DB 를 읽지도 쓰지도 않습니다. 그래서 "테스트 돌리기 전에 `dev.db` 를 백업한다" 는 절차가 더 이상 필요 없고, 테스트는 매번 **같은 시드 상태**에서 출발합니다(이전 실행이 남긴 행이 없습니다).

---

## 9. 미결 사항 · 제안

### 제품 결정이 필요한 것

**1. 병원 관리자와 병원의 관계 (결함 5의 나머지 절반)** — 가장 중요합니다.

`hospital_admins` 로 "누가 어느 병원 담당인가" 는 표현했지만, **`/admin` 의 구조를 어떻게 바꿀지**는 제품 결정입니다.

| 질문 | 선택지 |
|---|---|
| 병원 담당자를 누가 만드나 | (a) 운영자가 입점 심사 후 계정 생성·연결 (b) 병원이 가입 후 운영자 승인 (c) 병원별 초대 코드 |
| `/admin/hospital/new` 는 누가 쓰나 | (a) 운영자 전용 (심사 절차이므로) — 권장 (b) 자가 등록 후 운영자 승인 |
| 담당 병원이 여러 곳이면 | (a) 병원 목록 → 선택 (지금 화면 재사용) (b) 상단 병원 전환 셀렉터 |
| `hospital_admins` 에 역할 구분이 필요한가 | 지금은 없음. "상담만 보는 데스크 직원" vs "병원 정보 수정 가능한 원장" 을 나눌 필요가 있으면 `hospital_admins.role` 추가 |
| `operator` 도 상담 상세를 볼 수 있나 | 고객 실명·전화번호가 있어 **개인정보 접근 범위** 결정이 필요합니다. 권장: 원칙적으로 차단, 필요 시 접근 로그를 남기는 별도 절차 |

스키마는 (a) 조합을 전제로 두었지만, 어느 쪽으로 가도 `hospital_admins` 는 그대로 씁니다. `hospital_admins.role` 만 나중에 추가될 수 있습니다.

**2. `/admin/specialists` 의 `일반의`** — `일반의` 는 검수할 자격증이 없는데도 검수 목록에 승인/반려 버튼과 함께 나옵니다. 스키마는 `일반의` 도 `doctor_verifications` 행을 가질 수 있게 되어 있습니다. 목록에서 제외할지(권장) 결정이 필요합니다.

**3. 커뮤니티 글쓰기에 로그인을 요구할 것인가** — `qa_posts.author_user_id` 를 nullable 로 두어 두 선택지를 다 열어 두었습니다. 요구한다면 NOT NULL 로 조일 수 있습니다(시드 4건에 작성자 계정을 부여해야 합니다). 화면 문서에도 `(확인 필요)` 로 남아 있는 항목입니다.

**4. 상담 중복 신청 · 마감 병원 접수** — 스키마에 제약을 걸지 않았습니다("중복 신청을 막지 않습니다" 가 현재 문서화된 동작). 막을 거라면 유니크 제약보다 애플리케이션 규칙(같은 병원·같은 사용자·N시간 내 재신청 차단)이 맞습니다 — 유니크로 걸면 정당한 재신청이 영구히 막힙니다.

**5. 집계값 갱신 규칙** — `rating`/`review_count`/`consult_count` 를 실제 집계로 바꿀 것인지, 지금처럼 병원이 입력하는 표시값으로 둘 것인지. 실제 집계로 간다면 후기 작성 기능이 먼저 필요합니다(지금은 읽기 전용).

### 스키마 제안 (근거가 없어 만들지 않음)

화면 문서에 근거가 없어 **테이블을 만들지 않았습니다.** 필요해지면 별도 요청으로 다뤄야 합니다.

1. **`search_trends` / `sponsored_search_suggestions`** — 인기 검색어와 추천 검색어(광고 알약)는 편집·광고 인벤토리 성격이라 언젠가 DB 로 와야 합니다. 지금은 코드 상수이고 관리 화면이 없습니다.
2. **`home_banners`** — 홈 배너 3장. 링크가 없어(`눌러도 아무 일도 일어나지 않습니다`) 저장할 필드가 사실상 없습니다. 링크·기간·노출 순서가 요구사항이 되면 테이블이 필요합니다.
3. ~~**`partner_inquiries`**~~ → **승격됨 (§11.4).** 폼 항목이 `PartnerInquiryCreateRequest` 로 확정되고, 역할 결정이 입점 심사를 병원 생성의 전제로 만들면서 상태 컬럼까지 필요해졌습니다.
4. ~~**`legal_documents`**~~ → **승격됨 (§11.3).** `POST /auth/signup` 이 이미 `agreedTermsVersions` 를 받고 있어서(지금은 버리고 있습니다) `legal_documents` + `user_agreements` 를 함께 만들었습니다.
5. **`reviews.user_id`** — 후기 작성 기능이 없어 계정 연결을 두지 않았습니다. 작성 기능이 생기면 `user_id` 추가 + `author_name` 은 마스킹 표시값으로 유지.
6. **`hospital_event_notes` 의 기간** — 병원 상세 '진행중인 이벤트' 자유 문구에 기간 개념이 문서에 없습니다. `promotions` 처럼 기간이 필요해지면 추가합니다.
7. **`qa_post_views`** — 조회수가 방문마다 올라가는 문제(같은 사람이 다시 봐도 증가)를 제대로 고치려면 `(post_id, user_id 또는 세션, viewed_at)` 이 필요합니다. 지금은 `view_count` 한 컬럼입니다.
8. ~~**`audit_logs`**~~ → **승격됨 (§11.2).** `docs/decisions/0001-roles-and-pii.md` 결정 3 이 "감사 로그는 이 결정에 따라오는 항목" 이라고 명시했고, `docs/api/README.md` §4 가 컬럼·인덱스·기록 대상 9개를 확정했습니다.
9. **병원 연락처** — 전화번호·이메일·홈페이지가 관리자 폼에 없습니다(문서에 "없는 항목" 으로 명시). 상담이 전부 앱 안에서 처리되는 현재 구조와 맞물린 결정이라 임의로 추가하지 않았습니다.
10. **시술별 가격표** — 지금은 병원 전체 가격대 min/max 두 값뿐이라, 가격 비교표의 `최저가` 가 선택한 시술과 무관합니다(문서에 명시된 한계). `hospital_procedure_prices(hospital_id, procedure_id, min, max)` 가 그 한계를 없앱니다.

---

## 10. 발견한 모순 · 애매한 점

`domain.ts` 와 화면 문서를 대조하면서 찾은 것들입니다. 스키마에서는 각각 아래처럼 처리했습니다.

1. **`Hospital.specialty` 와 `Doctor.specialty` 가 이름은 같고 의미가 전혀 다릅니다.** 병원 쪽은 `'임플란트 전문의원'` 같은 자유 홍보 문구(관리자 폼: `전문 분야 (예: 임플란트 전문의원)`, 선택 항목)이고, 의사 쪽은 `DentalSpecialty` 8종 중 하나로 인증 검수의 대상입니다. → 스키마에서 두 컬럼에 서로 다른 의미임을 명시하는 주석을 달았습니다. **`hospitals.specialty` 를 `tagline` 이나 `catchphrase` 로 개명하는 것을 권합니다.**

2. **시술 개수가 문서마다 13 / 15 로 다릅니다.** 실제 `ProcedureId` 는 13종입니다. 병원 탐색의 "시술 칩 15개" 는 13 + `추천` + `기타`(=전체)이고, 두 개는 시술이 아니라 필터 모드입니다. `known-issues.md` 는 `explore.tsx:44-46` 의 주석이 "12개 시술, tmj 로 끝난다" 고 잘못 적혀 있다고 지적하면서 "botox 추가로 실제 15개" 라고 쓰는데, 이 15 는 칩 개수(13+2)이고 시술 개수는 13 입니다. → `procedures` 는 13행이고, `추천`/`기타` 는 데이터가 아니라 UI 상태입니다.

3. **작업 지시서의 `Doctor.certifications` 배열은 `domain.ts` 에 없습니다.** 실제로는 `certificateUrl: string | null` (단수) + `career: string[]` 두 필드입니다. 관리자 폼도 자격증 URL 을 **한 칸**만 받습니다. → `certificate_url` 을 단수로 유지하고, `career` 만 `doctor_careers` 테이블로 풀었습니다. 여러 장 제출이 요구사항이 되면 `doctor_certificates` 를 추가하면 됩니다. 대신 검수 이력이 제출 당시 URL 스냅샷(`submitted_certificate_url`)을 보관하므로, 자격증을 교체해도 "무엇을 근거로 승인했는가" 는 남습니다.

4. **`Hospital.events` 와 `Promotion` 이 둘 다 "이벤트" 라고 불립니다.** 병원 상세의 '진행중인 이벤트' 영역은 `events: string[]`(가격 없는 자유 문구)를 쓰고, 홈·`/events`·카드 🔥 배지·할인가는 `promotions`(가격·배지 있음)를 씁니다. 화면 문서에서도 두 개가 섞여 읽힙니다. → 테이블 이름을 `hospital_event_notes` 와 `promotions` 로 확실히 갈랐습니다.

5. **`탐색` 의 `인기순`·`진료시간`·`기타` 칩은 이름과 동작이 다릅니다** (각각 평점순 / 야간상담 여부 / 전체). `known-issues.md` 에 이미 정리된 항목입니다. → 스키마는 실제 동작을 기준으로 만들었습니다(`rating`, `feature_night_consult`, 필터 없음). 라벨 변경은 프런트 작업입니다.

6. **`consultCount` 가 두 가지 의미로 쓰입니다.** `hospitals.consultCount`/`doctors.consultCount` 는 탐색 `상담많은순` 정렬에 쓰이는 표시 지표인데, `consult_requests` 의 실제 건수와 일치하지 않습니다(문서: "상담을 신청해도 이 숫자는 올라가지 않습니다"). → 비정규화 표시값으로 명시하고(§4), 실제 건수는 `consult_requests` 를 세도록 분리했습니다. §9 결정 5 참고.

7. **알림 화면의 로그인 요구가 애매합니다.** 알림함 입구는 로그인해야 보이는데 `/notifications` 직접 진입은 막지 않습니다(문서에 `(확인 필요)` 로 표기). → 스키마는 알림을 계정에 묶었으므로(`notification_recipients`) 로그인 없이는 **보여줄 행 자체가 없습니다.** 구조적으로 결론이 났습니다.

8. **`/admin/specialists` 는 "운영자용" 인데 `/admin` (병원 관리자 홈)에서 들어갑니다.** 두 역할이 한 경로 아래 섞여 있습니다. → `users.role` 로 분리 가능하게 했고, 경로 재편은 §9 결정 1의 일부입니다.

---

## 11. 2차 추가 테이블 — 세션 · 감사 · 입점 문의 · 약관

| | |
|---|---|
| **추가된 테이블** | `refresh_tokens`, `audit_logs`, `partner_inquiries`, `legal_documents`, `user_agreements` (5개 → 전체 32개) |
| **요구사항 출처** | `docs/decisions/0001-roles-and-pii.md`, `docs/api/README.md` §4·§14, `backend/src/auth/refresh-token.store.ts` |
| **기존 27개 테이블** | **컬럼·인덱스 변화 0.** Prisma 역방향 관계 필드 6개만 추가됐고 DDL 은 바뀌지 않습니다 (§11.7) |

1차 27개 테이블은 **화면 문서**에서 요구사항을 얻었습니다. 이 5개는 다릅니다 — 대응 화면이 아직 없거나 `준비중입니다` 한 줄이고, 요구사항은 **역할·개인정보 결정과 API 계약**에서 나왔습니다. "화면에 근거 없는 테이블은 만들지 않는다" 는 1차 원칙의 예외이며, 그 예외를 정당화하는 것은 다음 세 가지입니다.

- `refresh_tokens` — **이미 구현된 코드가 메모리에서 돌고 있습니다.** 화면이 아니라 동작 결함이 근거입니다.
- `audit_logs` — 결정 3(개인정보 열람 범위)이 "감사 로그는 이 결정에 따라오는 항목" 이라고 명시했습니다. 로그 없이 마스킹만 하면 남는 노출면(담당자 쪽)이 무기록입니다.
- `partner_inquiries`, `legal_documents` + `user_agreements` — **API 가 이미 데이터를 받고 있습니다.** `POST /auth/signup` 은 `agreedTermsVersions` 를 받아 넣을 곳이 없어 버리고 있고, 입점 문의는 병원 생성의 유일한 진입 경로로 확정됐습니다.

### 11.1 `refresh_tokens` — 토큰을 저장하지 않는 세션 상태

#### 왜 DB 로 옮기는가

지금 `InMemoryRefreshTokenStore` 는 세 가지가 깨집니다 (그 파일의 주석이 스스로 적어 둔 한계입니다).

| 깨지는 것 | 결과 |
|---|---|
| 프로세스 재시작 | 모든 리프레시 토큰 무효 = **전원 재로그인** |
| 인스턴스 2개 이상 | 재발급이 다른 인스턴스로 가면 `unknown` → 회전이 랜덤하게 실패 |
| 별도 프로세스 | `npm run operator:grant` 가 **세션을 폐기할 수 없다** → 역할 승격이 재로그인까지 반영되지 않는다 |

세 번째가 특히 중요합니다. 결정 4 는 운영자 승격을 CLI 로만 하도록 정했는데, 승격 직후 그 계정의 **낡은 역할이 박힌 액세스 토큰**을 무효화할 방법이 없으면 "역할 변경 시 그 계정의 리프레시 토큰 전부 폐기" 라는 계약(`docs/api/README.md` §3)을 CLI 가 지킬 수 없습니다.

#### 토큰 문자열도, 그 해시도 저장하지 않습니다

저장하는 것은 `jti` 하나입니다. 서명 검증은 비밀키가 하고, 이 테이블은 **"그 jti 가 아직 살아 있는가"** 만 답합니다.

| 방식 | DB 가 유출되면 |
|---|---|
| 토큰 원문 저장 | 즉시 계정 탈취 |
| 토큰 해시 저장 | 원문은 못 얻지만, 유출본과 대조해 **어떤 토큰이 유효한지 판정**할 수 있습니다 |
| **jti 만 저장** (선택) | 토큰을 만들 수도, 검증할 수도 없습니다. 서명 키가 없으면 `jti` 는 그냥 임의 문자열입니다 |

세션 목록·폐기·재사용 감지에 필요한 것은 **식별자와 상태**뿐이고 토큰 자체는 필요하지 않습니다. 그래서 해시 컬럼조차 두지 않았습니다.

#### 상태를 컬럼 3개로 표현합니다

```
활성   = used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
소비됨 = used_at IS NOT NULL      → 다시 오면 계열 전체 폐기 (REFRESH_TOKEN_REUSED)
폐기됨 = revoked_at IS NOT NULL   → REFRESH_TOKEN_INVALID
만료   = expires_at <= now()      → REFRESH_TOKEN_INVALID
```

**소비·폐기를 `DELETE` 로 처리하지 않는 것이 이 설계의 핵심입니다.** 현재 메모리 구현은 `revoke()` 와 `revokeFamily()` 가 `Map.delete()` 를 씁니다. 그대로 DB 로 옮기면 재사용 공격이 `unknown`(단순 만료·미지 토큰)으로 보여 **계열 폐기가 일어나지 않습니다.** 행이 남아 있어야 `used_at`/`revoked_at` 을 근거로 `reused` 와 `unknown` 을 구분할 수 있습니다.

> 즉 DB 이관은 저장소만 바꾸는 작업이 아닙니다. `revoke`/`revokeAllForUser` 의 구현이 **삭제 → `revoked_at` 세팅**으로 바뀌어야 하고, `consume` 은 `revoked_at IS NOT NULL` 을 새 분기로 다뤄야 합니다. `RefreshConsumeResult` 의 세 갈래(`rotated`/`unknown`/`reused`)는 그대로 쓸 수 있습니다 — 폐기된 토큰은 `unknown` 으로 매핑하면 됩니다(에러 코드가 같습니다).

#### 인덱스 3개

| 인덱스 | 쿼리 |
|---|---|
| `jti` UNIQUE | `consume`/`isActive` 의 단건 조회. 조회 키이므로 유니크가 곧 인덱스입니다 |
| `(user_id, expires_at)` | `revokeAllForUser` (역할 승격·비밀번호 변경), "이 계정의 살아있는 세션" 목록. `expires_at` 이 뒤에 붙어 만료 행을 건너뛴 스캔이 됩니다 |
| `(family_id)` | 재사용 감지 시 계열 전체 폐기 |
| `(expires_at)` | 만료 행 정리 배치 |

`(user_id, expires_at)` 대신 `(user_id)` 만 걸지 않은 이유: 계정 단위 폐기는 **활성 행만** 대상이고, 세션 목록도 만료 행을 걸러 보여줘야 합니다. 정리 배치가 늦게 돌면 만료 행이 활성 행보다 많아질 수 있으므로 두 번째 컬럼이 의미 있습니다.

#### 만료 행 정리 전략

**행이 계속 누적됩니다.** 회전마다 새 행이 생기고, 소비된 행도 만료 전에는 지우지 않기 때문입니다.

규모 (액세스 토큰 15분 / 리프레시 30일, `backend/src/config/env.schema.ts` 기본값):

| 시나리오 | 세션 1개당 30일 누적 행 | 활성 사용자 1만 명 |
|---|---|---|
| 하루 20분 사용 (회전 2회/일) | 약 60행 | 약 60만 행 |
| 앱을 계속 열어 둠 (회전 96회/일) | 약 2,880행 | 약 2,880만 행 |

**정리 규칙**

```ts
// 1차: 만료된 행은 어떤 상태든 지운다. 만료 후에는 재사용 감지 대상도 아니다.
await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

// 2차(선택): 소비된 지 오래된 행. 탈취 토큰은 즉시 쓰이므로 감지 가치가 급감한다.
//   REUSE_DETECTION_WINDOW = 7일 정도. 위 표의 2,880행을 약 670행으로 줄인다.
await prisma.refreshToken.deleteMany({
  where: { usedAt: { lt: subDays(new Date(), 7) } },
});
```

**실행 방법 (권장 순서)**

1. **일 1회 스케줄 배치** — `@nestjs/schedule` 로 04:00 KST. 주 수단입니다. `(expires_at)` 인덱스가 받습니다.
2. **기회적 sweep** — 지금 메모리 구현이 `register()` 마다 전체를 훑는데, DB 에서는 로그인 경로에 `deleteMany` 를 넣는 셈이라 **그대로 옮기면 안 됩니다.** 옮긴다면 프로세스당 N분에 한 번으로 스로틀하고, 실패해도 로그인을 실패시키지 않아야 합니다.
3. **CLI** — `npm run tokens:prune`. 배치가 멈춘 것을 발견했을 때의 수동 수단.

**DB 쪽 스케줄러(`pg_cron`, 이벤트, 트리거)는 쓰지 않습니다.** SQLite 에 대응물이 없어 §3.8(raw SQL 없음)과 이식성 검증이 깨집니다. 삭제는 `deleteMany` 한 줄로 두 DB 에서 동일하게 동작합니다.

> 규모가 위 표의 큰 쪽으로 가면 **계열 단위 압축**(계열당 활성 1행 + `refresh_token_families` 테이블)이 다음 단계입니다. 그러면 행 수가 세션 수와 같아집니다. 지금 만들지 않은 이유는 재사용 감지 로직이 "계열의 마지막 jti 가 아니면 재사용" 이라는 다른 규칙으로 바뀌어야 하고, 그건 저장소 이관과 함께 할 변경이 아니기 때문입니다.

### 11.2 `audit_logs` — 스냅샷과 불변성

`docs/api/README.md` §4 의 컬럼·인덱스·기록 대상을 그대로 따랐습니다. 판단이 필요했던 네 곳만 적습니다.

#### (1) `actor_user_id` 에 FK 를 거는가 — **건다. `ON DELETE RESTRICT`**

요구사항은 "사용자가 삭제되면 감사 기록이 사라지면 안 된다" 입니다. 세 선택지를 비교했습니다.

| 선택 | 사용자 물리 삭제 시 | 문제 |
|---|---|---|
| `ON DELETE CASCADE` | 감사 행이 **함께 사라진다** | 감사의 목적을 정면으로 위반. 후보에서 즉시 제외 |
| `ON DELETE SET NULL` | 감사 행은 남고 **행위자가 지워진다** | "누가 봤는지 모르는 열람 기록" 이 남습니다. `actor_user_id` 를 nullable 로 만들어야 하는 것도 대가입니다 |
| **FK 없음** | 감사 행이 온전히 남는다 | Prisma 로 관계를 선언할 수 없어 조인(`include: { actor: true }`)이 불가능하고, 존재하지 않는 id 가 들어가도 DB 가 막지 못합니다. 감사 로그에서 그건 치명적입니다 — "이 열람자가 누구인지 확인할 수 없다" 가 데이터 오류로 발생합니다 |
| **`ON DELETE RESTRICT`** (선택) | **삭제가 실패한다** | 사용자 물리 삭제가 막힙니다 |

**Restrict 를 고른 근거:**

1. **이 스키마에는 사용자 물리 삭제 경로가 없습니다.** `users.deleted_at` 이 회원 탈퇴이고, 그 이유("상담 신청·커뮤니티 글의 FK 를 깨지 않기 위해 물리 삭제하지 않는다")가 스키마 주석에 이미 적혀 있습니다. 따라서 Restrict 는 **정상 동작을 한 번도 막지 않습니다.**
2. 막는 순간이 온다면 그것은 실수이거나 정책 변경입니다. 그때 **삭제가 실패하는 것**이 **감사가 조용히 사라지는 것**보다 낫습니다. Restrict 는 "감사 기록이 사라지면 안 된다" 를 DB 수준의 불가능으로 바꿉니다.
3. 개인정보 파기 요구(계정 완전 삭제)가 오면 **행을 지우지 말고 익명화**합니다 — `users` 행은 남기고 `email`/`name` 을 치환값으로 바꿉니다. 그러면 감사 행은 계속 같은 행위자를 가리켜 "같은 사람이 한 여러 행위" 라는 정보를 유지하면서 개인정보는 사라집니다. 감사 행을 지우는 것보다 이쪽이 두 요구를 모두 만족합니다.
4. `actor_role` 스냅샷이 있어서, 행위자 계정이 익명화돼도 **어떤 권한으로 한 행위였는지는 남습니다.**

`hospital_id` 도 같은 이유로 Restrict 입니다 (다른 테이블의 `hospital_id` 는 대부분 Cascade 이지만, 감사는 병원이 사라져도 남아야 합니다).

`target_id` 에는 FK 가 없습니다. `consult_request | partner_inquiry | doctor | hospital | user` 다섯을 가리키는 다형 참조라 걸 수 없고(`notifications.related_id` 와 같은 사정), **대상이 지워져도 "무엇을 열람했는가" 는 남아야 하므로** 여기서는 FK 없음이 오히려 맞습니다.

#### (2) 스냅샷 두 개

| 컬럼 | 조인하면 안 되는 이유 |
|---|---|
| `actor_role` | `users.role` 은 승격·해제로 바뀝니다. 조인하면 "operator 로 승격된 사람의 1년 전 담당자 시절 열람" 이 operator 행위로 보입니다 |
| `pii_masked` | 마스킹 정책이 바뀔 수 있습니다(결정 3: "운영자에게 전체를 보이려면 마스킹 투영을 끄면 된다"). 정책이 바뀌면 **과거 행위가 무엇을 봤는지가 소급 변조**됩니다 |

`pii_masked` 는 **API 요구사항의 `not null` 을 nullable 로 바꿨습니다.** 근거: 감사의 핵심 질의는 `WHERE pii_masked = false`("누가 마스킹되지 않은 개인정보를 봤나")인데, NOT NULL 이면 개인정보와 무관한 행위(`hospital.create`, `doctor.verify`)도 `false` 로 들어와 이 질의를 오염시킵니다. 세 값의 의미를 이렇게 고정했습니다.

```
true  = 마스킹된 값을 봤다 (operator)
false = 마스킹하지 않은 개인정보를 봤다 (담당 병원 hospital_admin)  ← 핵심 질의
null  = 그 행위의 응답에 개인정보가 없다 (hospital.create, doctor.verify)
```

nullable 은 not-null 의 상위집합이라 애플리케이션이 항상 `false` 를 넣어도 깨지지 않습니다. **인터페이스 설계와의 정합 확인이 필요한 항목입니다.**

#### (3) `metadata json` → 실 컬럼 2개

이식성 규칙(§3.3)이 JSON 컬럼을 금지합니다. 요구사항의 `metadata`(예시가 "변경 전/후 상태")를 `before_value` / `after_value` **varchar 2개**로 펼쳤습니다. `PriceRange { min, max }` → `price_min`/`price_max` 와 같은 처리입니다.

기록 대상 10개(2026-10-13 에 `consult_request.reschedule` 이 더해져 9 → 10)를 실제로 매핑해 보면 두 컬럼으로 충분합니다.

| action | target_type | hospital_id | pii_masked | before → after |
|---|---|---|---|---|
| `consult_request.view` | `consult_request` | 상담 대상 병원 | `false`(담당자) / `true`(운영자) | — |
| `partner_inquiry.view` | `partner_inquiry` | null | `false` (마스킹하지 않는 자원) | — |
| `consult_request.status_change` | `consult_request` | 상담 대상 병원 | 응답 마스킹 여부 | `'new'` → `'contacted'` |
| `consult_request.reschedule` (2026-10-13) | `consult_request` | 상담 대상 병원 | 응답 마스킹 여부 | `'2026-10-09T05:00:00.000Z'` → `'2026-10-12T02:00:00.000Z'` (확정 일시. **상태가 아니다**) |
| `consult_request.memo_create` | `consult_request` | 상담 대상 병원 | 응답 마스킹 여부 | — (본문은 복사하지 않음) |
| `doctor.verify` | `doctor` | 전문의 소속 병원 | `null` | `'pending'` → `'approved'` |
| `hospital_admin.assign` | `user` (승격 대상) | 대상 병원 | `false` (이메일·이름 노출) | — |
| `hospital_admin.unassign` | `user` | 대상 병원 | `false` | — |
| `hospital.create` | `hospital` | 생성된 병원 | `null` | — |
| `partner_inquiry.review` | `partner_inquiry` | `linked_hospital_id` 또는 null | `false` | `'reviewing'` → `'rejected'` |

**자유 텍스트(반려 사유, 메모 본문)는 감사 로그에 복사하지 않습니다.** 원본 테이블에 있고, 감사 로그가 개인정보 사본을 하나 더 만드는 것은 보존기간 관리 대상을 늘리기만 합니다. 감사 로그는 "누가·언제·무엇에 대해" 를 기록하고 "무엇이라고 썼는가" 는 원본을 봅니다.

> 나중에 `metadata` 성격의 값이 2개를 넘으면 `audit_log_details(audit_log_id, key, value)` 자식 테이블을 추가합니다(§3.2 의 배열→테이블과 같은 방법). 지금 만들지 않은 이유는 기록 대상 10개 중 그것을 요구하는 것이 하나도 없기 때문입니다.

#### (4) 불변성 — 스키마로 할 수 있는 것과 앱이 지킬 것

**결론: 지금은 애플리케이션이 강제합니다.** Prisma 스키마에는 "이 테이블은 append-only" 를 선언하는 문법이 없고, SQLite 트리거는 §3.8(raw SQL 금지)에 걸립니다.

스키마 수준에서 표현한 것:

- **`updated_at` 컬럼을 두지 않았습니다.** 다른 모든 변경 가능한 테이블(`hospitals`, `consult_requests`, `qa_posts` …)에는 있습니다. 없다는 것이 "이 행은 갱신되지 않는다" 는 신호이고, 갱신을 시도해도 그 사실을 기록할 칸이 없습니다.
- **자유 텍스트를 넣지 않았습니다** — 정정할 이유가 있는 컬럼을 아예 만들지 않았습니다(위 (3)).
- `actor_user_id`/`hospital_id` 의 `RESTRICT` — 부모 삭제를 통한 **간접 삭제**를 DB 가 막습니다. 실제로 스키마가 막아 주는 유일한 삭제 경로입니다.

애플리케이션이 지킬 것 (backend-engineer 전달):

1. 감사 로그 접근을 **리포지토리 하나로 좁히고 `create` / `findMany` / `count` 만 노출**합니다. `update`/`delete`/`upsert` 메서드를 만들지 않습니다.
2. 보존기간 만료 삭제는 **전용 배치 하나만** 수행합니다 (`created_at < cutoff`). 이것이 유일하게 허용되는 삭제 경로입니다.
3. **PostgreSQL 이전 후에는 DB 권한으로 굳힙니다.** 여기서 처음으로 진짜 강제가 가능해집니다.

```sql
-- 이전 후 수동 마이그레이션 (§7.6 항목에 추가)
REVOKE UPDATE, DELETE ON audit_logs FROM app_role;   -- 앱은 INSERT/SELECT 만
GRANT  DELETE ON audit_logs TO retention_role;       -- 보존기간 배치 전용 역할
```

`REVOKE DELETE` 를 앱 역할에서 뺄 수 있는 이유는 삭제 주체를 배치로 분리했기 때문입니다. 배치가 앱과 같은 커넥션을 쓰면 이 분리가 무너지므로, 보존 배치는 별도 자격증명으로 접속해야 합니다.

#### 인덱스 5개와 보존 기간

| 인덱스 | 답하는 질문 |
|---|---|
| `(actor_user_id, created_at)` | "이 담당자가 무엇을 열람했나" — 내부 감사, 이상 접근 조사 |
| `(target_type, target_id, created_at)` | **"이 상담을 누가 열람했나"** — 정보주체(고객) 문의에 답하는 질의 |
| `(hospital_id, created_at)` | 병원별 감사. 특정 병원의 담당자 행위 전체 |
| `(action, created_at)` | 행위 종류별 집계 ("이번 달 열람 N건", "권한 부여 N건") |
| `(created_at)` | 보존기간 만료 삭제 배치 |

`request_id` 에는 인덱스를 만들지 않았습니다. 애플리케이션 로그에서 `requestId` 를 들고 감사 행을 찾는 방향은 장애 조사 시의 저빈도 질의이고, 그때는 `created_at` 으로 범위를 좁힐 수 있습니다.

**보존 기간**: 개인정보 열람 기록은 통상 1년 이상 보존합니다. 값은 미결이며(§11.8), 결정 0001 의 미결 5 가 지적한 정합 문제 — **감사 보존기간이 상담 보존기간보다 짧으면 안 됩니다.** 짧으면 "이미 지운 상담을 누가 봤다" 는 기록만 남거나, 반대로 상담은 있는데 열람 기록이 없어집니다.

**쓰기 실패 시 정책**은 제품 결정(`docs/api/README.md` §4)이지만, 스키마는 **두 선택지를 다 열어 두었습니다** — `audit_logs` 를 같은 DB 에 두었으므로 `prisma.$transaction([...])` 으로 열람과 로그 쓰기를 한 트랜잭션에 묶을 수 있습니다. 외부 로그 저장소로 뺐다면 "실패 시 열람도 실패" 를 구현할 방법이 없어집니다.

### 11.3 `legal_documents` + `user_agreements` — 버전과 재동의

#### 왜 두 테이블인가

`POST /auth/signup` 은 이미 `agreedTermsVersions: [{ slug, version }]` 를 받고 있고, **넣을 곳이 없어서 경고만 로그로 남기고 버립니다.** 동의 기록은 사후 재구성이 불가능합니다 — 나중에 테이블을 만들어도 "누가 언제 무엇에 동의했는지" 를 복원할 근거가 없습니다. 그래서 문구를 담을 곳(`legal_documents`)과 동의 사실(`user_agreements`)을 함께 만듭니다.

#### 버전 관리: (문서 종류 × 버전) 이 행이다

```
legal_documents
  (slug, version) UNIQUE      terms/1.0, terms/1.1, privacy/1.0, location/1.0, about/1.0 …
  effective_at                시행일. 미래 날짜를 미리 넣어 둘 수 있다
  requires_agreement          이 버전이 동의 기록 대상인가
```

**행은 불변입니다.** 본문을 고치려면 같은 `slug` 의 새 버전 행을 만듭니다. `user_agreements` 가 `legal_documents.id` 를 가리키기 때문에, 행을 고치면 **과거 동의의 대상이 소급 변경**되어 동의 기록이 증빙 능력을 잃습니다. 이것이 `user_agreements` 가 `(slug, version)` 문자열이 아니라 **`legal_document_id` 를 가리키는 이유**이기도 합니다 — 가리키는 대상이 불변인 행이어야 의미가 있습니다.

"지금 유효한 버전" (`GET /legal-documents/{slug}`):

```ts
prisma.legalDocument.findFirst({
  where:   { slug, effectiveAt: { lte: new Date() } },
  orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
});
```

`version` 문자열로 정렬하지 않습니다 — `'1.10' < '1.9'` 가 되기 때문입니다. 순서는 항상 `effective_at` 이 정하고, `version` 은 **표시·참조용 라벨**입니다. 같은 날 두 번 시행하는 경우의 타이브레이커로 `created_at` 을 붙였습니다(§7.5 의 "정렬에 타이브레이커" 규칙).

#### 재동의 흐름 — 저장하지 않고 계산합니다

`user_agreements` 의 입도가 **(사용자 × 문서 버전)** 인 것이 전부입니다. 약관이 개정되면 새 `legal_documents` 행이 생기고, 그 행에 대한 동의 행은 아무에게도 없으므로 **재동의 대상이 저절로 계산됩니다.**

```ts
// 1. 지금 동의가 필요한 버전들 (slug 당 1개)
const required = await prisma.legalDocument.findMany({
  where: { requiresAgreement: true, effectiveAt: { lte: now } },
  // slug 별 최신 1건만 골라낸다 (앱에서 그룹핑)
});

// 2. 내가 아직 동의하지 않은 것
const agreed = await prisma.userAgreement.findMany({
  where:  { userId, legalDocumentId: { in: required.map((d) => d.id) } },
  select: { legalDocumentId: true },
});
const pending = required.filter((d) => !agreed.some((a) => a.legalDocumentId === d.id));
// pending 이 비어 있지 않으면 → 재동의 화면
```

**사용자마다 '재동의 필요' 플래그를 두지 않습니다.** 플래그 방식은 약관을 개정할 때 전 사용자 행을 UPDATE 해야 하고(수십만 행), 개정을 되돌리면 그 UPDATE 를 되돌릴 방법이 없습니다. 파생값을 저장하지 않으면 개정은 **행 1개 INSERT** 로 끝납니다.

`requires_agreement` 가 이 계산의 기준선을 조정합니다.

| 값 | 언제 |
|---|---|
| `true` | 실질 개정. 새 버전에 대한 동의를 받아야 합니다 |
| `false` | ① `slug='about'` — 동의할 성격의 문서가 아닙니다 ② 오탈자·표현 정정판 — 문구는 최신 버전을 보여주되 **재동의는 받지 않습니다**(이전 버전의 동의가 유효한 동의로 남습니다) |

이 컬럼이 없으면 오탈자 하나를 고칠 때마다 전 사용자에게 재동의 팝업이 뜨거나, 아니면 문구를 못 고칩니다.

#### 왜 `users` 에 컬럼을 붙이지 않았나

`users.agreed_terms_version` 같은 컬럼 방식은 세 가지가 안 됩니다: ① 문서가 3종(+about)이고 각각 버전이 다릅니다 ② 동의 **시각**이 문서별로 다릅니다(가입 시 2종 + 위치 약관은 지도 첫 사용 시) ③ 컬럼을 덮어쓰면 **과거 동의 기록이 사라집니다** — 그것이 정확히 증빙해야 하는 대상입니다. 기존 27개 모델을 건드리지 않는다는 제약과도 맞아떨어졌습니다.

#### 가입 시 처리

`agreedTermsVersions` 의 `{slug, version}` 을 `(slug, version)` 유니크로 `legal_documents.id` 로 바꿔 `user_agreements` 에 넣습니다. 없는 버전이면 `422` 로 거절해야 합니다 — 클라이언트가 캐시된 낡은 버전에 동의하고 보낼 수 있고, 그것을 통과시키면 "동의하지 않은 버전으로 가입" 이 됩니다. `(user_id, legal_document_id)` 유니크가 재요청 멱등성을 줍니다.

가입과 동의는 **같은 트랜잭션**이어야 합니다. 계정만 만들어지고 동의 행이 없으면 그 계정은 동의 없이 가입된 계정이 됩니다.

#### 시드 (§8 보완)

새 테이블 5개 중 **시드가 필요한 것은 `legal_documents` 뿐입니다.** 나머지 4개는 런타임에 쌓이는 데이터입니다(`refresh_tokens`=로그인, `audit_logs`=관리자 행위, `partner_inquiries`=접수, `user_agreements`=가입).

`legal_documents` 는 행이 없으면 `/legal/*` 세 화면과 `/about` 이 여전히 빈 화면이 됩니다. 시드 4행(`terms/1.0`, `privacy/1.0`, `location/1.0`, `about/1.0`)을 넣되:

- `effective_at` 은 **`SEED_TODAY - 1일`** 같은 과거 시각으로 (미래면 "지금 유효한 버전" 조회가 0건이 되어 화면이 다시 비어 보입니다)
- `content` 는 실제 문구가 확정되기 전이므로 **플레이스홀더임이 화면에서 드러나는 문구**를 넣습니다. 그럴듯한 가짜 약관을 넣으면 법무 검토 없이 배포될 위험이 있습니다
- `requires_agreement` 는 `about` 만 `false`
- 시드는 §8.1 원칙대로 id 고정(`legal-terms-1.0` 등) upsert 로 두어 재실행이 안전해야 합니다

가입 동의 절차가 도입되기 전이라면 기존 시드 사용자에 대한 `user_agreements` 행은 만들지 않습니다 — **동의하지 않은 동의 기록을 만드는 것이 이 테이블에서 가장 하지 말아야 할 일입니다.** 그 결과 시드 사용자 전원이 "재동의 대상" 으로 계산되는데, 그것이 사실에 맞는 상태입니다.

### 11.4 `partner_inquiries` — 심사 워크플로 + 개인정보

`docs/api/README.md` §14 의 요구사항을 그대로 따랐고, 컬럼 2개에 대한 판단만 다릅니다.

#### 상태 흐름은 애플리케이션이 강제합니다

```
received → reviewing → approved
                    └→ rejected      (종결 후 되돌리기 불가, rejected 면 review_note 필수)
```

DB `CHECK` 제약을 쓰지 않는 것은 §3.1 과 같은 이유입니다(Prisma 스키마로 선언할 수 없음). 이 규칙은 상태 **전이**라서 CHECK 로도 표현할 수 없습니다 — 전이 검증은 이전 값을 알아야 하므로 트리거가 필요하고, 그건 이식성 규칙에 걸립니다. §7.6 의 "PostgreSQL 이전 후 CHECK 검토" 목록에 `status IN (...)` 만 추가하면 됩니다(전이 규칙은 앱에 남습니다).

#### `updated_at` 을 두지 않은 이유

상태가 바뀌는 테이블인데 `updated_at` 이 없습니다. 필요한 정보 — "언제 `reviewing` 으로 옮겼는가", "누가 옮겼는가" — 는 **`audit_logs`(`action='partner_inquiry.review'`)가 이미 받습니다.** 같은 사실을 두 곳에 두면 어긋나고, 어느 쪽이 진실인지 판단할 근거가 없어집니다. `reviewed_at`/`reviewed_by_user_id` 는 **종결 판정**의 스냅샷으로 응답 스키마가 요구하는 값이라 남겼습니다.

같은 이유로 `consult_status_changes` 같은 별도 이력 테이블도 만들지 않았습니다. 상담은 이력이 **화면에 노출**되지만(상담 상세의 '상태 변경 이력'), 입점 문의 심사 이력을 보여주는 화면 요구는 없습니다.

#### 개인정보 파기 — `pii_purged_at` 하나만 뒀습니다

미결이었던 것은 **보존 기간(며칠)** 이고, "반려 문의의 개인정보를 언젠가 파기한다" 는 사실 자체는 미결이 아닙니다. 그래서 기간은 스키마에 넣지 않고(설정값), 파기가 **일어났다는 사실**만 컬럼으로 뒀습니다.

`contact_name`/`phone` 이 NOT NULL 이라 파기는 삭제가 아니라 치환입니다. 치환만 하면 `'(파기)'` 가 원래 입력값인지 파기 결과인지 구분할 수 없습니다.

```ts
// 파기 대상 — (status, received_at) 인덱스가 받는다
where: { status: 'rejected', receivedAt: { lt: cutoff }, piiPurgedAt: null }
// 파기 실행
data: { contactName: '(파기)', phone: '(파기)', email: null, message: null,
        piiPurgedAt: new Date() }
```

**행 자체는 지우지 않습니다** — `linked_hospital_id` 로 "이 병원이 어느 문의에서 왔는가" 가 이어져 있고, `audit_logs` 가 `target_id` 로 이 문의를 가리키고 있습니다. 행을 지우면 그 감사 기록이 대상 없는 기록이 됩니다.

> `approved` 문의는 파기 대상이 아닙니다 — 입점한 병원과의 계약 근거이므로 병원이 살아 있는 동안 보관합니다. 이것도 확정 정책이 아니라 지금의 기본값입니다(§11.8).

#### 인덱스

| 인덱스 | 쿼리 |
|---|---|
| `(status, received_at)` | 운영자 심사 대기 목록 (`status='received'` 접수순), 반려 문의 파기 배치 |
| `(received_at)` | 전체 목록 최신순 (`status` 필터 없음) |

`reviewed_by_user_id`, `linked_hospital_id` 에는 인덱스를 만들지 않았습니다. "이 운영자가 심사한 문의" 는 조회 축이 아니고(그 질의는 `audit_logs(actor_user_id, created_at)` 가 답합니다), "이 병원의 원 문의" 는 병원 상세에서 한 건씩 찾는 저빈도 역방향 조회입니다. §6.7 과 같은 기준입니다.

### 11.5 새 테이블 인덱스 12개 + 유니크 3개 — 한눈에

| 테이블 | 인덱스 | 근거 |
|---|---|---|
| `refresh_tokens` | `jti` U | `consume` 단건 조회 |
| | `(user_id, expires_at)` | 계정 단위 폐기, 세션 목록 |
| | `(family_id)` | 재사용 감지 시 계열 폐기 |
| | `(expires_at)` | 만료 정리 배치 |
| `audit_logs` | `(actor_user_id, created_at)` | "이 담당자가 무엇을 봤나" |
| | `(target_type, target_id, created_at)` | "이 상담을 누가 봤나" |
| | `(hospital_id, created_at)` | 병원별 감사 |
| | `(action, created_at)` | 행위별 집계 |
| | `(created_at)` | 보존기간 삭제 |
| `partner_inquiries` | `(status, received_at)` | 심사 대기 목록, 파기 배치 |
| | `(received_at)` | 전체 목록 |
| `legal_documents` | `(slug, version)` U | 같은 버전 중복 방지, 가입 시 id 조회 |
| | `(slug, effective_at)` | "지금 유효한 버전" |
| `user_agreements` | `(user_id, legal_document_id)` U | 중복 동의 방지 + **"내 동의 목록" 을 선두 컬럼으로 커버** |
| | `(legal_document_id)` | "이 버전에 동의한 사용자" (재동의 진행률) |

API 요구사항에 있던 `user_agreements(user_id)` 단독 인덱스는 **만들지 않았습니다.** 유니크 인덱스 `(user_id, legal_document_id)` 의 선두 컬럼이 `user_id` 라서 완전히 중복입니다. 쓰기 비용만 늘고 얻는 것이 없습니다.

### 11.6 이식성 규칙 — 새 테이블에서 어떻게 지켰는가

§3 의 규칙 전부를 그대로 적용했습니다. **1차와 같은 기준으로 PostgreSQL 재검증을 통과해야 합니다** (§7.2.1 의 단서 참고).

| 규칙 | 새 테이블에서의 표현 |
|---|---|
| DB enum 금지 | `refresh_tokens` 에 상태 컬럼 없음(타임스탬프 3개로 상태 표현). `audit_logs.action`(9종)·`target_type`(5종)·`actor_role`(3종), `partner_inquiries.status`(4종), `legal_documents.slug`(4종) 전부 `String` + 허용값 주석 + 앱 검증 |
| 스칼라 배열 금지 | `agreedTermsVersions` 배열 → `user_agreements` 행 (요청 배열이 그대로 테이블이 된 사례) |
| JSON 컬럼 금지 | `audit_logs.metadata` → `before_value` / `after_value` 실 컬럼 2개 (§11.2-(3)) |
| TEXT PK + 앱 cuid | 5개 테이블 모두 `String @id`, 기본값 없음. `@default(cuid())` 도 쓰지 않음 |
| 금액은 Int | 해당 금액 컬럼 없음 |
| DB 기본값 타임스탬프 금지 | `created_at`, `received_at`, `agreed_at`, `expires_at` 전부 애플리케이션이 UTC 로 세팅. `@default(now())`·`@updatedAt` 없음 |
| 달력 날짜 vs 시각 | 새 테이블의 날짜 컬럼은 **전부 시각(`DateTime` UTC)** 입니다. `legal_documents.effective_at` 만 판단이 필요했는데(아래) 시각으로 두었습니다 |
| raw SQL 금지 | 만료 정리·파기 배치·보존기간 삭제 모두 `deleteMany`/`updateMany`. DB 트리거·`pg_cron` 을 쓰지 않는 이유가 여기 있습니다 |
| boolean | `pii_masked`(nullable), `requires_agreement`(`@default(true)`). Prisma Client 를 통과하면 두 DB 모두 `true`/`false` (§3.10) |

**`legal_documents.effective_at` 을 `'YYYY-MM-DD'` 문자열로 두지 않은 이유** (광고·프로모션 기간과 다른 선택입니다):

1. **경계가 시작 하나뿐입니다.** `effective_at <= now()` 로 끝나고, §3.7 이 피하려던 "종료일 포함/배타" 애매성이 없습니다.
2. **API 계약이 이미 시각입니다** — `openapi.yaml` 의 `LegalDocument.effectiveAt: format: date-time`. 문자열 날짜로 두면 응답 변환 시 시간대를 매번 붙여야 합니다.
3. 사전 공고·시행 예약을 시각으로 두면 "오늘 18시부터 시행" 같은 요구도 그대로 표현됩니다.

대신 **KST 자정 시행을 애플리케이션이 변환해야 합니다** — `2026-09-01` 시행이면 `2026-08-31T15:00:00.000Z` 를 넣습니다. 이 변환을 빠뜨리면 시행이 9시간 앞당겨집니다. 주석에 명시했고, `docs/api` 쪽 구현 시 검증 대상입니다.

### 11.7 기존 27개 모델 — 무엇이 바뀌었고 무엇을 바꾸지 않았는가

#### 실제로 추가한 것: Prisma 역방향 관계 필드 6개 (DDL 변화 0)

Prisma 는 관계의 **양쪽에 필드**를 요구합니다. 한쪽만 선언하면 `prisma validate` 가 실패합니다. 새 테이블이 `users`·`hospitals` 를 FK 로 참조하므로, 참조되는 쪽에 배열 필드를 넣는 것을 피할 수 없습니다.

```prisma
model User {      // 컬럼 추가 아님 — 관계의 반대편 표현
  refreshTokens     RefreshToken[]
  auditLogs         AuditLog[]
  reviewedInquiries PartnerInquiry[]
  agreements        UserAgreement[]
}
model Hospital {
  auditLogs        AuditLog[]
  partnerInquiries PartnerInquiry[]
}
```

이 필드들은 **가상(virtual)** 입니다. `users`/`hospitals` 테이블의 컬럼·인덱스·제약은 하나도 바뀌지 않고, 마이그레이션 diff 에도 두 테이블에 대한 `ALTER TABLE` 이 나오지 않습니다(FK 는 새 테이블 쪽에 생깁니다). Prisma Client 에 `include: { auditLogs: true }` 옵션이 추가되는 것이 전부입니다.

> FK 를 포기하면 이 편집도 피할 수 있었지만, 그러면 `refresh_tokens.user_id` 가 존재하지 않는 사용자를 가리킬 수 있고 감사 로그의 행위자 무결성이 사라집니다. FK 를 지키는 대가로 가상 필드 6개를 받는 것이 맞다고 판단했습니다.

#### 바꾸지 않았지만 바꾸는 것을 권고하는 것

| 대상 | 지금 | 권고 | 근거 |
|---|---|---|---|
| `doctor_verifications.reviewed_by_user_id` | `ON DELETE SET NULL` | **`RESTRICT`** | 검수 결정의 행위자입니다. 사용자를 물리 삭제하면 "누가 승인했는지 모르는 승인" 이 남습니다. `audit_logs.actor_user_id` 를 Restrict 로 둔 것과 같은 논리이고, 지금 두 테이블의 정책이 서로 다릅니다 |
| `consult_status_changes.changed_by_user_id`, `consult_memos.author_user_id` | `ON DELETE SET NULL` | **`RESTRICT`** 검토 | 위와 같습니다. 다만 이 두 컬럼은 시드·시스템 생성 행이 `null` 인 것이 정상이므로 nullable 은 유지해야 합니다(Restrict 와 nullable 은 양립합니다) |
| `notifications.audience` 값 `admin` | `user` \| `admin` | `user` \| `hospital` | 결정 0001 미결 2. `audit_logs.actor_role` 이 `hospital_admin`/`operator` 를 쓰기 시작하면서 `audience='admin'` 이 어느 역할을 뜻하는지 더 헷갈리게 됐습니다 |
| `users` 물리 삭제 | 경로 없음 | 그대로 유지 + **익명화 절차 문서화** | `audit_logs`·`user_agreements` 가 붙으면서 물리 삭제의 대가가 더 커졌습니다. 파기 요구는 삭제가 아니라 익명화로 처리해야 합니다(§11.2-(1)) |

네 항목 모두 **이 작업에서 수정하지 않았습니다.** 앞의 두 개는 마이그레이션이 필요한 FK 변경이고, 세 번째는 스키마·API·fixture 를 함께 고쳐야 합니다.

### 11.8 남은 미결

새로 생긴 것만 적습니다. 1차 미결은 §9 에 있습니다.

1. **감사 로그 보존 기간** (결정 0001 미결 5) — 1년 이상이 통상값입니다. **상담 데이터 보존기간보다 짧으면 안 됩니다.** 두 값을 함께 정해야 합니다. 정해지면 삭제 배치의 설정값이 되고 스키마는 바뀌지 않습니다.
2. **반려된 입점 문의의 개인정보 보존 기간** — 파기 실행 기록(`pii_purged_at`)은 만들었고 기간만 미결입니다. 함께 정할 것: `approved` 문의를 영구 보관할 것인가(지금 기본값은 "병원이 살아 있는 동안 보관").
3. **감사 로그 쓰기 실패 시 열람 허용 여부** (결정 0001 미결 4, §API 4) — 스키마는 두 선택지를 다 열어 두었습니다(같은 DB 이므로 트랜잭션 가능). 제품 결정입니다.
4. **`pii_masked` 를 nullable 로 둔 것** — API 요구사항은 `not null` 이었습니다. 근거는 §11.2-(2) 에 적었지만 **인터페이스 설계와의 정합 확인이 필요합니다.**
5. **리프레시 토큰 회전 행의 누적** — 정리 전략(§11.1)으로 상한을 두었지만, 활성 사용자가 만 명 규모가 되면 계열 단위 압축을 검토해야 합니다. 그 시점에 `refresh_token_families` 를 추가합니다.
6. **동의 증빙의 범위** — `user_agreements` 에 `ip`/`user_agent` 를 두지 않았습니다(요구사항에 없음). 분쟁 시 "이 동의가 그 사람의 행위였는가" 를 다투게 되면 필요해집니다. 반대로 그 자체가 개인정보라 보존기간 관리 대상이 늡니다.
7. **선택 동의와 동의 철회** — 지금 약관 3종은 모두 필수 동의 성격이라 `is_required` 컬럼도, 철회(`withdrawn_at`)도 만들지 않았습니다. 마케팅 수신 동의처럼 **선택 동의 항목이 생기면** 두 컬럼(또는 `user_agreement_events` 이력 테이블)이 필요합니다.
8. **재동의 유예** — 약관 개정 시 즉시 차단인가, N일 유예인가. 유예를 준다면 `legal_documents` 에 `grace_until` 이 필요합니다. 지금은 즉시(로그인 후 동의 화면) 전제입니다.
9. **`legal_documents` 를 누가 편집하는가** — 관리 화면이 없습니다. 초기에는 시드·마이그레이션으로 넣게 되며, 그러면 약관 개정에 배포가 필요합니다. 운영자 콘솔에 편집 화면이 생기면 `audit_logs` 의 기록 대상에 `legal_document.publish` 를 추가해야 합니다(현재 9개에 없습니다).
10. **`audit_logs` 조회 화면** — 쓰기만 정의됐고 읽는 화면이 없습니다. 인덱스는 4개 질문을 전제로 만들었지만, 실제 화면이 정해지면 정렬·필터 축을 다시 확인해야 합니다.

---

## 12. 3차 — 상담 예약 (상태 5개 · 확정 일시 · 취소 사유 · 처리 이력)

| | |
|---|---|
| **요구사항 출처** | `docs/features/requests/2026-10-12-04-관리자-상담예약-개선.md`, `docs/decisions/0001-roles-and-pii.md` 결정 3, `docs/api/README.md` §4·§9·§14 |
| **새 테이블** | **0개.** 전체 32개 그대로 |
| **바뀌는 것** | `consult_requests` 컬럼 +4 · 인덱스 +1, `consult_status_changes` 컬럼 +4, `ConsultStatus` 값 +1 |
| **받는 곳** | `docs/api/README.md` §14 의 `consult_requests 확장` 절(계약용 요약) → `backend/prisma/schema.prisma`·`schema.dbml` → **요청서 15 (상담·알림을 서버에 저장)** 에서 구현합니다 *(2026-10-21 개정 — 혼자 개발 체제. 2026-10-12 작성 당시에는 "백엔드는 협업자 영역이라 이 문서는 요구사항과 근거만 남깁니다" 였습니다)* |

1·2차와 달리 **화면이 이미 있고 데이터도 쌓여 있는 테이블**을 고칩니다. 그래서 판단 기준이 하나 더
붙습니다 — **과거 행이 새 규칙을 위반한 채 남는 것을 어떻게 다룰 것인가**(§12.10).

### 12.1 상태 5개 — 코드를 바꾸지 않고 하나 더합니다

```
신규(new) → 연락중(contacted) → 예약확정(booked) → 내원완료(visited)
  └────────────┴─────────────────┴──────────────────┴──→ 취소(cancelled)

※ 화살표는 "보통 이 순서로 간다" 는 뜻이고 제약이 아닙니다 — 전이는 전부 허용합니다 (§12.7).
  걸어 들어온 환자는 신규 → 내원완료로 바로 가고, 오기입 정정은 역방향으로도 갑니다.
```

**`booked` 를 `confirmed` 로 개명하지 않고 `visited` 만 더합니다.** 화면 라벨은
`예약완료` → `예약확정` 으로 바뀌지만 **저장값은 그대로**입니다.

| 개명의 대가 | |
|---|---|
| 계약 | `openapi.yaml` 의 enum 값 제거 = **breaking** (`docs/api/README.md` §15 가 `v2` 사유로 분류). 얻는 것은 이름뿐입니다 |
| 데이터 | `consult_requests.status` 와 `consult_status_changes.status` **두 테이블의 과거 행 전부**를 UPDATE. 되돌리려면 역방향 마이그레이션이 또 필요합니다 |
| 시드 | 백엔드 시드가 import 하는 `frontend/src/mocks/fixtures/consultRequests.ts` 의 `cr3` 가 `booked` 입니다. **DB 개명이 프런트 파일 수정을 끌고 들어옵니다** |
| 운영 | 이미 나간 알림 문구(`'예약완료'(으)로 변경되었어요`)는 소급 수정이 불가능합니다 |

`예약완료` 와 `예약확정` 은 **같은 사실을 가리키는 두 라벨**이지 두 상태가 아닙니다. 라벨은 계약 설명과
클라이언트 매핑에만 있으므로 그쪽만 고치면 됩니다. 반대로 `내원완료` 는 **새로운 사실**(실제로 왔는가)이라
값이 필요합니다 — 요청서가 "상담 → 내원 전환을 셀 수 없다" 고 적은 바로 그 구분입니다.

> 코드와 라벨이 어긋난 채 남는 것은 비용입니다(`booked` 를 보고 `예약확정` 을 떠올려야 합니다).
> 그래서 §3.1 의 허용값 표와 `schema.prisma` 주석에 **"`booked` = 예약확정"** 을 적습니다.
> 같은 종류의 어긋남이 이미 하나 있습니다 — 탐색의 `인기순`(=평점순, §10-5).

### 12.2 확정 일시 `visit_at` — 시각 하나, 컬럼 하나

**`consult_requests.visit_at  DateTime? (UTC)`**

| 질문 | 결정 | 근거 |
|---|---|---|
| 달력 날짜(`'YYYY-MM-DD'`)인가 시각인가 | **시각** | §3.7 이 문자열 날짜를 고른 대상은 **기간의 경계**(광고·프로모션)였습니다. 여기는 `10/9(목) **14:00**` 이라는 **한 순간**이고, "종료일 포함/배타" 같은 애매성이 없습니다. `legal_documents.effective_at` 을 시각으로 둔 것과 같은 판단(§11.6) |
| 날짜·시간 두 컬럼으로 쪼갤까 | **하나** | 관리자 폼은 두 칸이지만 저장되는 사실은 하나입니다. 쪼개면 비교·정렬에 매번 결합이 필요하고 두 값이 어긋날 자리가 생깁니다 (`business_hours.hours` 와 반대 방향의 판단 — 거기는 **입력이 자유 텍스트 한 칸**이라 쪼개지 않았습니다) |
| 시간대 | **UTC 저장, 표시는 KST** | §7.5 의 "서버 TZ=UTC, 표시 변환은 프런트" 규칙 그대로. 화면이 `10/9(목) 14:00` 을 그리려면 `Asia/Seoul` 변환이 필요하고, 그것은 `createdAt` 이 이미 하고 있는 일입니다 |
| 정밀도 | **분 단위 (초·밀리초를 0 으로 절삭해 저장)** | 입력 단위가 분입니다. 절삭하지 않으면 같은 약속이 `14:00:00.123` 과 `14:00:00.000` 으로 갈려 **"일시가 바뀌었는가" 비교가 거짓 양성**을 냅니다 — 그 비교가 §12.3 의 no-op 판정입니다 |

**상태가 바뀔 때 `visit_at` 을 어떻게 하는가** — 규칙 하나로 설명됩니다:
**현재 행은 "지금 유효한 사실" 이고, 과거 사실은 이력 행이 보관합니다.**

| 들어가는 상태 | `visit_at` | 왜 |
|---|---|---|
| `booked` | 요청값(없으면 현재값). 둘 다 없으면 **`422`** | 요청서: "날짜가 비면 저장되지 않는다" |
| `visited` | **유지** | "언제 오기로 했던 건인가" 는 내원 기록의 일부입니다. 지우면 마이페이지의 확정 일시가 **내원한 순간 사라집니다** |
| `cancelled` / `contacted` / `new` | **null** | 남겨 두면 취소된 건의 목록 카드와 환자 마이페이지가 계속 `10/9(목) 14:00 예정` 을 보여줍니다 — **환자에게 거짓**이 됩니다. 그 약속이 있었다는 사실은 직전 `booked`/`reschedule` 이력 행에 스냅샷으로 남습니다 |

> **`visited` 에 `visit_at` 이 없는 건이 정상입니다.** 걸어 들어온 환자를 `신규` 에서 바로 `내원완료` 로
> 넘기는 흐름이 요청서에 있습니다. "언제 왔는가" 가 필요하면 그 이력 행의 `changed_at` 이 답합니다 —
> 그래서 `visited_at` 같은 컬럼을 따로 만들지 않았습니다.

**과거 일시 입력을 막지 않습니다.** 지난 약속을 뒤늦게 기록하는 정정이 정상 경로이고
(요청서의 "오기입 정정"), 막을 근거가 화면에 없습니다. 경고를 띄우는 것은 화면의 몫입니다.

### 12.3 이벤트 모델 — 상태 변경과 일시 변경을 **한 테이블**에

예약확정 상태에서 일시만 바꾸는 "일시 변경" 은 상태가 바뀌지 않지만 **이력에 남고 환자에게 알림이
나가야** 합니다. 그래서 `consult_status_changes` 는 이제 **상태 변경이 아니라 처리 이벤트**를 담습니다.

```
consult_status_changes  (컬럼 4개 추가)
  event            varchar, not null, default 'status_change'   -- status_change | reschedule
  visit_at         timestamp, null     -- 이 이벤트 **직후**의 확정 일시 (결과 스냅샷)
  cancel_reason    varchar, null       -- status='cancelled' 인 행에만 (§12.4)
  notification_id  fk → notifications.id, null, SetNull         -- 환자 알림 (§12.8)
```

`reschedule` 행의 `status` 에는 **그 시점의 상태(`booked`)를 그대로** 넣습니다. 행이 스스로를 설명하고,
`ConsultStatusChange.status` 가 `null` 이 될 수 있는 계약 변경(= breaking)도 피합니다.
화면은 `event` 로 문구를 가릅니다 — `예약확정으로 변경` vs **`일시 변경`**.

**왜 별도 테이블(`consult_reschedules`)이 아닌가**: 화면이 요구하는 것은 **한 줄로 섞인 시간순 이력**
("누가 · 언제 · 무엇으로 · 알림 발송")입니다. 두 테이블이면 읽을 때마다 UNION 하고 정렬해야 하며,
"누가·언제·알림" 세 컬럼이 양쪽에 복제됩니다. 한 테이블에 `event` 하나를 더하는 쪽이 싸고,
이벤트 종류가 늘어도 컬럼이 아니라 **값**이 늘어납니다.

**테이블 이름은 바꾸지 않습니다.** `consult_events` 가 내용에 맞지만, 개명은 Prisma 모델·시드·투영을
함께 고치는 변경이고 얻는 것이 이름뿐입니다(§12.1 과 같은 저울). `event` 컬럼이 행의 성격을 이미 말합니다.
**메모 작성 같은 다른 종류까지 이 테이블에 들어오면** 그때가 개명 시점입니다(§12.12-4).

**`event` 에 `@default('status_change')` 를 둔 이유**: 기존 이력 행이 그대로 유효해지고
마이그레이션에 백필이 필요 없습니다. §3.6 이 금지한 것은 **타임스탬프의 DB 기본값**이고,
스칼라 기본값은 `legal_documents.requires_agreement @default(true)` 선례가 있습니다.

**no-op 규칙의 재서술** (`docs/api/README.md` §9 에 계약 문구로 적었습니다):
비교 대상이 `status` 하나에서 **`(status, visitAt, cancelReason)` 세 값**으로 넓어집니다.
세 값이 모두 같으면 이력 행도 알림도 만들지 않습니다. **필수 입력 검사가 no-op 판정보다 먼저**입니다 —
`예약확정` 건에 `visitAt` 없이 `예약확정` 을 보내는 것은 "바뀔 것이 없는 요청" 이 아니라
**값을 빠뜨린 요청**입니다.

### 12.4 취소 사유 — 이력 행에만 두고 현재 값은 파생합니다

사유 코드 5개: `no_answer`(연락이 안 됨) · `patient_request`(환자 요청) ·
`procedure_unavailable`(진료 불가 시술) · `duplicate`(중복 신청) · `etc`(기타).
라벨이 아니라 코드를 값으로 쓴 근거는 `InquiryTopic` 과 같습니다 — **보존할 과거 데이터가 없는 새 값**이고,
라벨을 저장하면 문구를 다듬는 순간 저장값이 깨집니다.

**`consult_requests.cancel_reason` 컬럼을 만들지 않았습니다.**

| | |
|---|---|
| 저장 | `consult_status_changes.cancel_reason` — 취소 이벤트 행의 불변 스냅샷 |
| 현재 값 | **파생**: 현재 상태가 `cancelled` 일 때, 가장 최근 `cancelled` 이벤트 행의 사유 |
| 재오픈(취소 → 연락중) | **비우는 절차가 없습니다.** 현재 상태가 `cancelled` 가 아니면 파생값이 자동으로 `null` 입니다 |

`doctors.verification_status` 는 **다른 테이블의 최신 행**을 캐시한 컬럼이고 그럴 만한 이유가 있었습니다
(배지 판정이 모든 목록 화면에서 일어나 상관 서브쿼리가 됩니다, §4). 여기는 다릅니다 —
**관리자 목록·상세 응답이 이미 `statusHistory` 를 함께 싣고 있어서**(현재 계약의 `ConsultRequest`)
추가 질의 없이 서버 투영에서 계산됩니다. 캐시 컬럼을 두면 "상태는 `contacted` 인데 사유가 남아 있는 행"
이라는 어긋남이 가능해지고, 그 어긋남을 막는 불변식을 앱이 또 지켜야 합니다.

> 뒤집히는 조건: **이력을 싣지 않는 가벼운 목록 투영이 생기는 순간.** 그때는 `doctors.verification_status`
> 와 같은 이유로 캐시 컬럼이 맞고, 갱신 책임은 상태 변경 트랜잭션입니다.

### 12.5 검색 — `phone_digits` 정규화 컬럼

**`consult_requests.phone_digits  varchar, not null`** — `phone` 에서 숫자만 남긴 값(`01012344411`).

`phone` 은 `010-1234-4411` 형태로 정규화 저장됩니다(계약). 뒷자리 4자리 검색은 그 문자열에
`contains` 로도 맞지만, 담당자가 **번호를 통째로 붙여넣으면**(`01012344411`, `010 1234 4411`)
하이픈 때문에 **조용히 0건**이 됩니다. §3.9 가 이름·태그에 적용한 **정규화 컬럼 규칙을 전화번호에도
그대로 적용**합니다 — 쓰기 시 앱이 채우고, 검색은 `q` 에서 숫자만 남겨 이 컬럼에 겁니다.

```ts
const digits = q.replace(/\D/g, '');
// 숫자가 2자 이상이면 번호 검색, 아니면 이름 검색 (둘을 OR 로 묶는다)
where: { OR: [{ name: { contains: q.trim() } },
              ...(digits.length >= 2 ? [{ phoneDigits: { contains: digits } }] : [])] }
```

**인덱스는 만들지 않습니다.** 뒷자리 검색은 앞쪽 와일드카드(`%4411%`)라 B-tree 를 타지 못합니다
(§6.2 의 같은 주석). 담당 병원 범위로 이미 좁혀진 뒤의 스캔이고, 지금 규모에서는 비용이 없습니다.
규모가 커지면 PostgreSQL `pg_trgm`(§7.6)이 받습니다.

**역할별 범위가 다릅니다** (§12.9): `operator` 의 숫자 검색은 **뒤 4자리 접미 일치**로 제한합니다. 4자리를 넘게 넣으면
에러가 아니라 뒤 4자리만 잘라 비교합니다(계약 `GET /consult-requests` 의 `q`).

### 12.6 인덱스 — 1개 추가, 나머지는 그대로

| 인덱스 | 받는 질의 |
|---|---|
| `consult_requests(hospital_id, status, created_at)` **추가** | 상태 탭 **카운트 5벌**(`groupBy(status)`)과 **탭 선택 목록 최신순**. 담당 병원 범위 → 상태 → 정렬 순서입니다. 상담 관리 화면 진입마다 도는 질의라 §6 서문의 "지금 규모에서는 인덱스가 없어도 빠릅니다" 에 기대지 않고 미리 겁니다 |

**추가하지 않은 것과 이유** (§6.7 과 같은 기준):

- **`visit_at` 인덱스** — "오늘 내원 예정" 같은 **일시 기준 목록 화면이 아직 없습니다.** 요청서의 필터
  세 개는 전부 `created_at` 기준입니다. 그 화면이 생기면 `(hospital_id, visit_at)` 을 겁니다
  > **하루 만에 뒤집혔습니다 (2026-10-13).** 대시보드의 `오늘 내원 예정` 이 바로 그 화면이라
  > `(hospital_id, visit_at)` 을 **지금 겁니다** — §13.5. 적어 둔 조건이 그대로 발동했을 뿐
  > 판단이 틀렸던 것은 아닙니다(소비자가 없는 인덱스를 미리 만들지 않았습니다)
- **`phone_digits` 인덱스** — 앞쪽 와일드카드(§12.5)
- **`procedure_id` 필터용 인덱스** — 9개 대분류가 서버 시술 id 여럿으로 풀려 `IN (…)` 이 되는데,
  이미 병원·상태·기간으로 좁혀진 뒤의 조건이라 선택도가 낮습니다. 조건 칩 boolean 들을 인덱스하지 않은
  것과 같은 판단입니다
- **대분류(카테고리) 컬럼·테이블** — **DB 는 13개 시술 id 만 압니다.** 9개 대분류는
  `frontend/src/features/procedure/taxonomy.ts` 의 프런트 매핑 계층이고, 서버는 풀린 id 목록을 받습니다
  (`procedureId` 반복 파라미터). 대분류를 테이블로 올리는 것은 그 분류를 **관리하는 화면**이 생길 때의
  일입니다 — 지금 올리면 두 곳(프런트 상수·DB 행)이 조용히 어긋날 자리만 생깁니다.
  필터 칩에 `시술 미지정`(= `procedure_id IS NULL`)이 들어오면 **파라미터로 표현할 수 없으므로**
  계약에 별도 값이 필요합니다 — 지금 요청서에 없어 만들지 않았습니다
- **`event` 인덱스** — 이력은 항상 한 상담의 전체를 읽습니다. `(consult_request_id, changed_at)` 로 끝납니다

### 12.7 판정 규칙 — 순수 함수 여섯 개 (`consult/transition.ts`)

AGENTS.md 의 "규칙은 DB 도 요청도 모르는 순수 함수" 를 그대로 따릅니다. DB 없이 경계값을 테스트할 수
있어야 하는 것들입니다.

```ts
export type ConsultStatus = 'new' | 'contacted' | 'booked' | 'cancelled' | 'visited';

// 1. 전이는 전부 허용한다. 검증하는 것은 '필요한 입력이 왔는가' 뿐이다.
//    (전이표를 두지 않은 이유: 막을 전이를 찾지 못했다 — 오기입 정정과 당일 내원이 둘 다 정상이다)
export function requiredInputs(next: ConsultStatus): ReadonlyArray<'visitAt' | 'cancelReason'> {
  if (next === 'booked')    return ['visitAt'];
  if (next === 'cancelled') return ['cancelReason'];
  return [];
}

// 2. 결과 일시 (§12.2). booked 는 요청값 ?? 현재값 — 둘 다 없으면 1번 검사가 먼저 막는다
export function nextVisitAt(next, currentVisitAt, requestedVisitAt): Date | null {
  if (next === 'booked')  return truncateToMinute(requestedVisitAt ?? currentVisitAt);
  if (next === 'visited') return currentVisitAt;
  return null;                                   // cancelled | contacted | new
}

// 3. 이 요청이 무엇인가 (§12.3) — no-op 판정과 이벤트 종류를 한 함수가 정한다
export function classifyEvent(cur, req): 'noop' | 'status_change' | 'reschedule' {
  if (req.status !== cur.status) return 'status_change';
  if (cur.status === 'booked' && !sameMinute(req.visitAt, cur.visitAt)) return 'reschedule';
  return 'noop';
}

// 4. '지연' 배지 — 서버는 저장하지도 내려주지도 않는다 (§12.11). 24시간은 경과 시간이라 시간대와 무관하다
export const DELAY_THRESHOLD_MS = 24 * 60 * 60 * 1000;
export const isDelayed = (status, createdAt, now) =>
  status === 'new' && now.getTime() - createdAt.getTime() >= DELAY_THRESHOLD_MS;

// 5. 기간 필터 경계 — Asia/Seoul 달력, 반열린 구간 [from, to)
//    today     : 오늘 00:00 KST        ~ 내일 00:00 KST
//    thisWeek  : 이번 주 월요일 00:00  ~ 다음 주 월요일 00:00   (주의 시작은 월요일)
//    last30    : 오늘 00:00 − 29일     ~ 내일 00:00            (오늘을 포함한 30일)
export function periodRange(period, now, tz = 'Asia/Seoul'): readonly [Date, Date];

// 6. 투영용 파생 (consult/*.projection.ts) — 저장하지 않는 현재 취소 사유 (§12.4)
export const cancelReasonOf = (status, history) =>
  status !== 'cancelled' ? null
    : [...history].reverse().find((e) => e.status === 'cancelled')?.cancelReason ?? null;
```

경계값을 **여기서** 못 박는 이유: `이번 주` 의 시작 요일과 `최근 30일` 의 포함 범위는 문서마다 다르게
읽히는 대표적인 값이고, 화면·서버가 서로 다르게 구현하면 **목록 건수와 탭 카운트가 어긋납니다**
(두 숫자가 같은 질의에서 나오지 않는 순간 사용자가 먼저 알아챕니다).

### 12.8 "환자 알림 발송" — 파생하지 않고 **저장**합니다

이력 행에 `notification_id`(nullable FK → `notifications.id`, `ON DELETE SET NULL`)를 둡니다.
투영에는 **boolean 하나(`notified`)만** 내려갑니다 — 알림 상세로 가는 화면이 없는데 id 를 내리면
그 자리가 "갈 수 있다" 는 약속이 됩니다.

"모든 변경은 알림을 보낸다" 는 규칙으로 파생할 수도 있었습니다. 저장을 고른 이유:

1. **규칙이 바뀌면 과거가 소급해 거짓이 됩니다.** 오기입 정정이 잦아지면 "연속 변경은 알림을 묶는다"
   같은 억제 규칙이 생기기 쉽고, 그 순간 **이미 알림을 받은 과거 이력이 '발송 안 함' 으로 보입니다.**
   `audit_logs.actor_role`·`pii_masked` 를 스냅샷으로 둔 것과 **같은 논리**입니다(§11.2-(2)).
2. **발송은 실패하거나 생략될 수 있습니다** — 수신자 계정 탈퇴, 알림 생성 실패. 규칙은 "보냈어야 한다"
   를 말할 뿐 "보냈다" 를 말하지 못합니다.
3. **조인 키가 달리 없습니다.** `notifications.related_id` 는 상담을 가리킬 뿐이라, 이력 행이 여럿이면
   시각으로 짝짓는 수밖에 없습니다 — 틀리기 쉽고 조용히 틀립니다.
4. 대가는 nullable 컬럼 하나입니다.

`null` 의 뜻은 **발송하지 않음(또는 발송 실패)** 입니다. 시드·과거 이력 행도 `null` 입니다.
알림 행을 지우는 경로가 생기면(보존기간 배치) `null` 이 "삭제됨" 과 섞이므로, **그때 `notified_at` 을
더합니다.** 지금은 알림 삭제 경로가 없어 모호성이 실현되지 않습니다.

> 알림 생성과 이력 행 생성은 **같은 트랜잭션**입니다(§7.5 의 트랜잭션 점검 목록에 상담 상태 변경이
> 이미 들어 있습니다). 둘이 갈리면 "이력은 있는데 알림이 없는" 행이 생기고, 그것이 정확히
> 이 컬럼이 거짓이 되는 경우입니다.

### 12.9 마스킹·스코프 델타

스코프는 그대로입니다 — `hospital_admin` 은 담당 병원, `operator` 는 전체(결정 0001).
**마스킹에 투영 축이 하나 붙습니다**(`docs/api/README.md` §4 에 계약 문구로 적었습니다).

| 투영 | 역할 | 이름 | 연락처 | 감사 로그 |
|---|---|---|---|---|
| 목록 | `hospital_admin` | 전체 | **`010-****-4411`** | 남기지 않음 |
| 목록 | `operator` | `박*영` | `010-****-4411` | 남기지 않음 |
| 상세 | `hospital_admin` | 전체 | **전체** (`전화 걸기` 활성) | **남김** (`pii_masked=false`) |
| 상세 | `operator` | `박*영` | `010-****-4411` | 남김 (`pii_masked=true`) |

굵게 표시한 칸이 이번에 바뀐 곳입니다. **목록은 담당자에게도 번호를 가립니다** — 목록은 건별 열람
기록을 남기지 않기로 한 자원이라(`docs/api/README.md` §4) 전체 번호가 실리면 **무기록 대량 반출**이
성립합니다. 목록에서 값을 빼면 전체 번호를 보는 경로가 **기록이 남는 상세 한 곳**으로 모입니다.

데이터 쪽 귀결 두 가지:

- **`audit_logs` 의 핵심 질의(`WHERE pii_masked = false`)가 비로소 "전체 번호를 본 횟수" 와 같아집니다.**
  목록에 전체 번호가 있던 동안 그 질의는 노출의 일부만 세고 있었습니다
- `operator` 의 **숫자 검색은 뒤 4자리 접미 일치로 제한**합니다(§12.5). 전체 번호 부분일치를 허용하면
  `phone_digits` 가 **"이 번호의 상담이 존재하는가" 오라클**이 되어 마스킹을 우회합니다.
  뒤 4자리는 §4 가 운영자에게 남기기로 한 값이라 그 범위까지는 설계 의도 그대로입니다

### 12.10 과거 행은 새 규칙을 소급해 만족하지 않습니다

"`booked` 면 `visit_at` 이 있다" 는 **쓰기 경로의 불변식**이고, 기존 `booked` 행에는 값이 없습니다.
`cr3` 의 메모 `8/2 14:00 예약 확정` 을 파싱해 채우는 것은 **추측**이고, 그 메모야말로
"적을 칸이 없어 메모에 적었다" 는 요청서의 근거입니다. 화면은 `visit_at IS NULL` 인 `booked` 를
`일시 미입력` 으로 보여주고 담당자가 채우게 합니다.

**DB 제약으로 굳히지 않는 이유**도 같습니다. `CHECK (status <> 'booked' OR visit_at IS NOT NULL)` 은
PostgreSQL 이전 후에 가능하지만(§7.6), 켜는 순간 **과거 행이 제약을 위반**합니다. 이전 시점에
남아 있는 위반 행을 먼저 처리하는 결정이 필요하므로 §7.6 목록에 조건부로 적어 둡니다.

### 12.11 파생값을 컬럼으로 만들지 않은 것 두 개

| 안 만든 것 | 대신 | 근거 |
|---|---|---|
| `delayed`(지연) | **클라이언트 판정** `isDelayed(status, createdAt, now)` | 시간이 지나면 값이 바뀝니다. 컬럼이면 배치가 필요하고 배치가 늦으면 틀린 배지가 보입니다. 서버가 응답에 실어도 **받는 순간부터 늙기 시작하는 값**입니다. 판정에 필요한 두 값이 이미 응답에 있고, 24시간 경과는 시간대와 무관합니다. 탭·카운트가 되는 순간에는 서버가 세지만 그때도 컬럼은 필요 없습니다 — `status='new' AND created_at < now()-24h` 이고 §12.6 의 인덱스가 받습니다 |
| `source`(유입 화면) | **지금 수집하지 않습니다** | 신청 화면이 보내지 않는 값입니다. 컬럼을 만들면 전 건이 `null` 인 컬럼이 남고 화면은 그것을 `알 수 없음` 으로 그려야 합니다. 요청서도 "데이터가 없으면 빼도 됩니다" 로 적었습니다. 필요해지면 `POST /consult-requests` 에 `source` 를 더하는 것이 먼저이고, **과거 건은 영구히 `null`** 이라는 사실을 그때 화면이 받아들여야 합니다 |

### 12.12 밀려 있던 것 · 시드 · 남은 미결

**밀려 있던 것 — 제3자 제공 동의 컬럼.** `ConsultThirdPartyConsent` 는 이미 `openapi.yaml` 의 응답
**필수 필드**인데 받을 컬럼이 없습니다. 이번 마이그레이션에 함께 닫습니다.

```
consult_requests
  third_party_consent_agreed_at      timestamp, null   -- 서버가 접수를 받아들인 시각 (서버 시계)
  third_party_consent_notice_version varchar,   null   -- 동의한 안내문 버전 ('2026-10-12')
```

둘 다 nullable 이고 **함께 채워지거나 함께 null** 입니다(앱 불변식). `null` 은 **거절이 아니라 절차
도입 이전 접수**이며 소급해 채울 방법이 없습니다 — 계약이 적어 둔 그대로입니다.
안내문이 `legal_documents` 로 옮겨가면 이 자리가 `legal_document_id` FK 가 될 수 있지만,
지금 안내문은 프런트 상수라 **버전 문자열만 보존**합니다(`user_agreements` 와 다른 선택인 이유).

**시드·마이그레이션** (§8 보완):

1. `phone_digits` 는 `not null` 입니다. **현재 데이터가 시드뿐이면 컬럼 추가 후 시드 재실행**으로 끝납니다.
   운영 데이터가 생긴 뒤라면 마이그레이션 SQL 에 백필 한 줄을 넣습니다 — §3.8 의 raw SQL 금지는
   **애플리케이션 코드** 규칙이고 마이그레이션 파일에는 적용되지 않습니다
   > **요청서 15 에서 처리.** 개발 DB 는 시드뿐이라 백업 → `prisma migrate dev` → 재시드로 끝납니다.
   > SQLite 의 `ADD COLUMN NOT NULL` 은 기본값이 없으면 기존 행 때문에 실패하므로 **마이그레이션에서만**
   > `DEFAULT ''` 를 주고 재시드로 값을 채웁니다 — 자세한 절차는 §12.13-D
2. `event` 는 기본값이 있어 기존 이력 행이 그대로 유효합니다. `visit_at`·`cancel_reason`·
   `notification_id` 는 전부 nullable 이라 백필이 없습니다
   > **요청서 15 에서 처리.** `third_party_consent_*` 2개와 `notifications.consult_status` 도 같습니다
3. 시드에 `visited` 건이 하나도 없습니다. 샘플을 만들려면 `frontend/src/mocks/fixtures/consultRequests.ts`
   수정이 따라오는데 **그 파일은 프런트 영역**이라 이 변경에 묶지 않습니다
   > **요청서 15 에서 처리 — 전제가 바뀌었습니다.** 프런트 fixture 를 고치는 대신 **원본을 서버로
   > 옮깁니다**(요청 14 가 시술에 한 것과 같은 절차). 그래서 `visited`·`reschedule`·취소 사유·동의
   > 기록이 있는 샘플을 프런트를 건드리지 않고 만들 수 있습니다 — §12.13
4. §8.5 의 상대 날짜 권고가 여기에도 적용됩니다 — 고정 날짜 fixture 로는 `오늘`/`이번 주` 필터와
   `지연` 배지가 **항상 0건**이라 QA 가 재현할 수 없습니다
   > **요청서 15 에서 처리.** 새 샘플은 `SEED_TODAY` 기준 **오프셋을 직접 주는 쪽**(§8.4)을
   > 씁니다 — 밀 원본이 없는 새 데이터이기 때문입니다. 근거는 §12.13-B

**남은 미결:**

1. **`operator` 의 상담 처리 권한** (결정 0001 미결 3) — 상태가 5개가 되면서 "병원이 방치한 건을
   운영자가 취소" 요구가 더 그럴듯해졌지만, 요청서에 없어 바꾸지 않았습니다. 바꾸면 스키마는 그대로이고
   인가 규칙만 바뀝니다
2. **취소 사유의 자유 텍스트** — `etc`(기타)에 설명 칸을 두지 않았습니다. 메모가 그 자리입니다.
   `기타` 비율이 높게 나오면 사유 코드를 늘리는 것이 먼저입니다
3. **상담 보존 기간** — 감사 보존 기간과 함께 정해야 합니다(§11.8-1). `visit_at` 이 더해졌을 뿐
   성격은 같습니다
4. **`consult_status_changes` 의 이름** — 이벤트가 더 늘면(메모 작성 등) `consult_events` 로 개명할
   시점입니다. 지금은 두 종류뿐이라 `event` 컬럼으로 충분합니다
5. **상담 → 내원 전환율 집계** — `visited` 가 생기면서 셀 수 있게 됐지만, 그것을 보여주는 화면이
   아직 없습니다. 집계 화면이 생기면 모집단 정의(접수 기준인가 확정 기준인가)를 먼저 정해야 합니다
   > **다음 날 생겼습니다 (2026-10-13).** 대시보드의 `이번 달 상담 흐름` 이 그 화면이고,
   > 모집단은 **접수 기준 코호트**로 정했습니다 — §13.6

### 12.13 상담·알림 시드 — 원본이 서버로 옵니다 (요청서 15)

> 요청서 15 의 한 줄이 이 절의 전부입니다 — **"브라우저에 남아 있는 예전 샘플 상담·알림은 옮기지
> 않습니다. 대신 서버 시드로 샘플을 몇 건 만들어 주세요. 날짜는 오늘 기준으로 잡아서, 대시보드
> 숫자가 0 이 아니게 해 주세요."**

#### A. 원본을 `backend/prisma/seed/data/` 로 옮깁니다

| 지금 | 요청서 15 이후 |
|---|---|
| `backend/prisma/seed/fixtures.ts` 가 `frontend/src/mocks/fixtures/consultRequests.ts`·`notifications.ts` 를 re-export | **`backend/prisma/seed/data/consult-requests.ts`** · **`backend/prisma/seed/data/notifications.ts`** 가 원본. `fixtures.ts` 의 두 줄이 `./data/*` 로 바뀝니다 |

요청 14 가 시술 분야·세부 시술에 한 절차 그대로입니다(§17.8). 옮기는 이유가 **이번에는 더
직접적**입니다 — 새 샘플이 요구하는 것(`visited`·`reschedule`·취소 사유·`visit_at`·동의 기록·
`consultStatus`)은 **프런트 fixture 의 타입에 없는 필드**입니다. 프런트에 넣으면 화면이 쓰지 않는
필드를 목 데이터에 만드는 것이고, 그것이 §12.12-3 과 §15.8 이 "프런트 영역이라 묶지 않는다" 고
미뤄 둔 이유였습니다. 소유권이 넘어오면 그 제약 자체가 사라집니다.

- **프런트 fixture 는 지우지 않습니다** — MSW 핸들러가 아직 씁니다. 다만 **백엔드는 더 이상 읽지
  않으므로** 두 사본이 달라져도 서버가 깨지지 않습니다. 프런트 쪽 정리(= `localCollection` 의 상담·
  알림 제거)는 같은 요청서의 frontend-engineer 몫입니다
  > **구현 결과(2026-10-22):** 이 저장소에 MSW 는 없었고, 프런트 쪽 정리 뒤에는 두 fixture
  > (`frontend/src/mocks/fixtures/consultRequests.ts`·`notifications.ts`)를 읽는 코드가 하나도
  > 남지 않아 **같은 작업에서 삭제**했습니다. 설계 시점의 위 판단은 그대로 기록으로 남깁니다
- `prisma/tsconfig.seed.json` 의 `@/*` 별칭은 남은 3개(`guides`·`promotions`·`qaPosts`)가 계속 씁니다

#### B. 날짜는 **`SEED_TODAY` 기준 오프셋**입니다 (§8.4 쪽, §8.5 아님)

§8.5(기준일 하나로 통째로 민다)는 **fixture 에 날짜가 있는 것**의 규칙이고, §8.4(오프셋을 직접
준다)는 **밀 원본이 없는 것**의 규칙입니다. 새 샘플은 후자입니다 — 2026-07-30 에 묶인 원본이
애초에 없습니다. `clock.fromToday(n)` 이 프로모션 기간·검수 시각에 쓰는 바로 그 통로입니다.

**두 규칙이 섞이지 않습니다.** 시드가 미는 대상(`guides`·`qa_posts`·`reviews`·광고)과 오프셋을 주는
대상(`promotions`·`doctor_verifications`·`legal_documents`·**상담·알림**)은 서로 다른 테이블이고,
한 테이블 안에서 두 방식이 만나는 자리가 없습니다. §8.5 의 "상담 7건이 놓이는 자리" 표는
**§12.13-C 의 표로 대체**됩니다.

**`오늘` 은 KST 달력일입니다.** `오늘 내원 예정`(§13.5)·`오늘 들어온 상담`(§13.2)의 경계가 전부
`Asia/Seoul` 이기 때문입니다. 시계에 통로를 하나 더합니다:

```ts
// prisma/seed/dates.ts — SEED_TODAY(+n일)의 KST 벽시계 시각 → UTC Date
//   seoulAt(0, '14:00')  = fromToday(0) + (14:00 − 09:00) = 오늘 05:00Z = 오늘 14:00 KST
seoulAt(days: number, hhmm: string): Date
```

> ⚠ **`SEED_TODAY` 의 기본값은 실행 시각의 UTC 날짜**입니다(`dates.ts`). 15:00Z~24:00Z(= KST 자정~
> 오전 9시)에 시드하면 시드의 `오늘` 이 KST 의 `어제` 가 되어 **`오늘 내원 예정` 이 0건**이 됩니다.
> 기본값을 **KST 달력일**로 바꾸는 한 줄이 이 창을 없앱니다(모든 지표의 `오늘` 이 KST 이므로 시드의
> `오늘` 도 KST 인 것이 맞습니다). 바꾸지 않는다면 QA 는 `SEED_TODAY=YYYY-MM-DD` 를 명시해야
> 합니다 — backend-engineer 판단 항목으로 남깁니다

#### C. 샘플 8건 — 무엇을 보증하는지가 선정 기준입니다

신청자 계정·병원·시술 id 는 **이미 있는 시드 값**을 씁니다(`u-seed-1`~`7`, `h1`·`h2`,
31개 시술 taxonomy, `d7`=이하윤/h1). 상담 id `cr1`~`cr8` 도 그대로 유지합니다 — `/admin/consultations/cr1`
같은 예시 URL 과 QA 시나리오가 그 값에 걸려 있습니다(§8.1 원칙 1).

| id | 병원 | 신청자 | 시술 | 상태 | 접수 (KST) | `visit_at` | 취소 사유 | 동의 |
|---|---|---|---|---|---|---|---|---|
| `cr1` | h1 | `u-seed-1` 김민준 | `implant-general` | `new` | **오늘** 09:15 | — | — | 접수 시각 / `2026-10-12` |
| `cr2` | h1 | `u-seed-7` 한소율 | `laminate` | `new` | **D−3** 10:20 | — | — | **둘 다 `null`** (절차 도입 이전 접수) |
| `cr3` | h1 | `u-seed-3` 최지훈 | `implant-general` (지목 `d7`) | `booked` | D−2 11:05 | **오늘 14:00** | — | 접수 시각 / `2026-10-12` |
| `cr4` | h1 | `u-seed-4` 정하윤 | `bruxism-botox` | `visited` | **오늘** 08:00 | **오늘 11:00** (유지) | — | 접수 시각 / `2026-10-12` |
| `cr5` | h1 | `u-seed-5` 강도윤 | **`null`** (시술 미지정) | `cancelled` | **오늘** 07:30 | — (취소가 비운다) | `duplicate` | 접수 시각 / `2026-10-12` |
| `cr6` | h1 | `u-seed-2` 박서준 | `laminate` | `contacted` | D−1 13:40 | — | — | 접수 시각 / `2026-10-12` |
| `cr7` | **h2** | `u-seed-6` 이서연 | `bracket-braces` | `new` | D−1 15:00 | — | — | 접수 시각 / `2026-10-12` |
| `cr8` | **h2** | `u-seed-1` 김민준 | `laminate` | `booked` | D−5 16:30 | **D+3 10:00** | — | 접수 시각 / `2026-10-12` |

`phone` 은 `010-1234-5601`~`5608`(상담 번호순), `phone_digits` 는 숫자만 남긴 값입니다 —
**뒤 4자리가 전부 다르므로** 운영자의 접미 일치 검색(§12.9)을 한 건씩 재현할 수 있습니다.
`name` 은 신청자 계정 이름과 같게 둡니다(§4 는 다를 수 있다고 적었지만, 다른 샘플을 만들면
"계정 이름과 폼 이름이 다른 것" 과 "시드가 틀린 것" 을 QA 가 구분할 수 없습니다).

**이 8건이 h1 담당자(`u-admin-h1`) 화면에 보증하는 숫자** — 괄호 안은 `SEED_TODAY` 가 매월 1일일 때:

| 지표 (§13.2) | 모집단 | 값 |
|---|---|---|
| `todayNew` 오늘 들어온 상담 | `created_at ∈ today`, 상태 무관 | **3** (cr1·cr4·cr5) |
| `statusNew` 신규 전체 | `status='new'` | **2** (cr1·cr2) |
| `pending` 처리 대기 | `status ∈ {new, contacted}` | **3** (cr1·cr2·cr6) |
| `delayed` 24시간 지연 | `status='new'` **그리고** `now − created_at ≥ 24h` | **1** (cr2 — D−3) |
| 오늘 내원 예정 (§13.5) | `status='booked'` **그리고** `visit_at ∈ today` | **1** (cr3 14:00). cr4 는 `visited` 라 빠집니다 |
| 이번 달 깔때기 (§13.6) | `created_at ∈ thisMonth` 코호트 | 신청 6 · 연락 4 · 예약 2 · 내원 1 · 취소 1 (1일: 3·2·1·1·1) |
| 카드 ④ `M 중 N` | 〃 | `M=6, N=2` (1일: `M=3, N=1`) |

**오늘(오프셋 0) 접수 건에 `visited`·`cancelled` 를 하나씩 둔 것이 이 표의 설계 포인트**입니다.
`이번 달` 은 `SEED_TODAY` 의 날짜에 달려 있어서(§8.5 의 경고) 1일에 시드하면 D−1 이하가 전부
지난달로 빠지는데, **오프셋 0 은 어느 날 시드해도 이번 달**입니다. `visited ⊆ {booked,visited} ⊆
연락 ⊆ 코호트`(§13.6 의 포함 관계)이므로 **오늘 접수된 `visited` 한 건이 깔때기의 위 세 단계를
한꺼번에 채웁니다.** 그래서 어느 날 시드해도 다섯 숫자가 모두 0 이 아닙니다.

**범위(스코프) 확인용** — `cr7`·`cr8` 은 h2 입니다. `u-admin-h1` 로 `/admin/consultations` 를 열면
**6건만** 보여야 하고, `GET /consult-requests/cr8` 은 `404 CONSULT_REQUEST_NOT_FOUND` 여야 합니다
(단건은 담당 밖과 없음을 구분하지 않습니다 — 계약 `GET /consult-requests/{id}`. `403 HOSPITAL_NOT_MANAGED`
는 목록의 `?hospitalId=h2` 쪽입니다).
`cr1`(h1)과 `cr8`(h2)의 신청자가 **같은 `u-seed-1`** 이라서, 마이페이지 상담 내역이 병원을 가로질러
2건을 보여주는 것도 같은 계정으로 확인됩니다.

#### D. 처리 이력과 알림 — 한 건이 한 줄씩 만듭니다

이력 행 id 는 기존 규칙 `csc-{consultId}-{i}`(0부터), 알림 행 id 는 **`ntf-{consultId}-{i}`** 입니다.
> §8.1 원칙 1(fixture id 보존)의 **예외를 하나 둡니다** — `notif1`~`notif7` 은 버립니다. 알림 id 를
> 가리키는 URL·화면 문서가 없고(알림은 `relatedId` 로 이동합니다), 이벤트에서 파생되는 결정적 id 라야
> 샘플을 고칠 때 재실행이 중복을 만들지 않습니다. 상담 id 를 유지하는 근거(예시 URL)가 여기엔 없습니다.

| 상담 | 이력 행 (`event` / `status` / 시각 / 행위자 / `visit_at` / `cancel_reason`) | 만드는 알림 |
|---|---|---|
| `cr1` | `status_change`/`new`/접수 시각/**null**/—/— | `ntf-cr1-0` **admin** → `u-admin-h1` |
| `cr2` | `status_change`/`new`/접수 시각/null/—/— | `ntf-cr2-0` **admin** → `u-admin-h1` |
| `cr3` | `new`/접수/null · `contacted`/D−1 10:00/`u-admin-h1` · `booked`/오늘 09:40/`u-admin-h1`/**오늘 14:00** | `ntf-cr3-0` admin · `ntf-cr3-1` user(contacted) · `ntf-cr3-2` user(booked) |
| `cr4` | `new`/접수/null · `booked`/오늘 08:30/`u-admin-h1`/**오늘 11:00** · `visited`/오늘 11:20/`u-admin-h1`/**오늘 11:00**(유지) | `ntf-cr4-0` admin · `ntf-cr4-1` user(booked) · `ntf-cr4-2` user(visited) |
| `cr5` | `new`/접수/null · `cancelled`/오늘 09:00/`u-admin-h1`/—/**`duplicate`** | `ntf-cr5-0` admin · `ntf-cr5-1` user(cancelled) |
| `cr6` | `new`/접수/null · `contacted`/오늘 09:05/`u-admin-h1` | `ntf-cr6-0` admin · `ntf-cr6-1` user(contacted) |
| `cr7` | `new`/접수/null | `ntf-cr7-0` **admin** → `u-admin-h2` |
| `cr8` | `new`/접수/null · `contacted`/D−4 09:00/`u-admin-h2` · `booked`/D−4 09:30/`u-admin-h2`/**D+2 10:00** · **`reschedule`**/`booked`/D−1 14:00/`u-admin-h2`/**D+3 10:00** | `ntf-cr8-0` admin · `ntf-cr8-1` user(contacted) · `ntf-cr8-2` user(booked) · `ntf-cr8-3` user(**일시 변경**) |

규칙 네 가지가 이 표를 전부 설명합니다.

1. **접수 행(`i=0`)은 `changed_by_user_id`·`notification_id` 가 `null`** 입니다. 접수 알림은
   `audience='admin'` 이라 **환자 알림이 아니고**, 이력 행에 알림 id 를 적지 않습니다(§15.2-ⓑ).
   화면도 그 줄만 `앱에서 상담 신청` 으로 그립니다(`consultDisplay.ts` 의 `isIntakeRow`)
2. **그 밖의 모든 이력 행은 `notification_id` 가 채워집니다** → 관리자 상세의 이력 줄에
   `환자 알림 발송` 이 붙습니다. 저장된 사실이지 규칙에서 파생한 값이 아닙니다(§12.8)
3. **수신자** — `audience='user'` 는 그 상담의 신청자 1명, `audience='admin'` 은
   `notifications.hospital_id` = 그 병원 + **그 병원 담당자**(지금은 1명)입니다(§15.6)
4. **`consult_status`** — 접수 알림은 `new`, 상태 변경 알림은 바뀐 뒤 상태, **일시 변경 알림은
   `booked`** 입니다. `related_type='consult_request'`, `related_id` = 상담 id

**문구는 지어내지 않습니다.** 시드는 `frontend/src/features/consult/consultNotificationText.ts` 가
서버로 옮겨 간 **그 순수 함수를 호출해** `title`·`message` 를 만듭니다. 문자열을 시드에 적어 두면
문구를 다듬는 날 **시드와 런타임이 조용히 갈립니다** — 같은 판정을 두 곳에 두지 않는다(AGENTS.md)가
문구에도 그대로 적용됩니다. 결과는 이렇습니다(병원명이 들어간 자리는 실제 이름으로):

| 알림 | `title` | `message` |
|---|---|---|
| 접수 (admin) | `새로운 상담 신청` | `{신청자 이름}님이 상담을 신청했어요` *(계약 `POST /consult-requests`)* |
| `contacted` | `병원이 연락 중이에요` | `강남 스마일 치과가 상담 신청을 확인했어요. 곧 전화가 올 거예요` |
| `booked` | `상담 예약이 확정됐어요` | `강남 스마일 치과 · {M/D(요일) HH:mm} 방문. 변경이 필요하면 병원에 전화해 주세요` |
| `reschedule` | `예약 일시가 바뀌었어요` | *(위와 같은 본문, 새 일시)* |
| `cancelled` | `상담이 취소됐어요` | `강남 스마일 치과 · 같은 신청이 있어 하나로 정리했어요` *(`duplicate` 의 환자용 꼬리말)* |
| `visited` | `상담 상태 변경` | `상담 상태가 '내원완료'(으)로 변경되었어요` *(요청 08 범위 밖이라 기존 문구 유지 — §15.3)* |

> 방문 일시 표기(`10/9(금) 14:00` vs `10월 9일(금) 14:00`)는 **§15.10-⑥ 의 미결**입니다.
> 시드가 함수를 호출하므로 **어느 쪽으로 정해지든 시드 문구가 따라옵니다** — 데이터 설계가 그 결정을
> 기다릴 필요가 없습니다.

**공지 알림 3건**(상담과 무관, `consult_status=null`, `related_*=null`)을 남겨 알림함의 나머지 아이콘
두 종류(`이벤트`·`안내`)와 fan-out 경로를 살려 둡니다.

| id | `audience` | `type` | 생성 | 수신자 | 읽음 |
|---|---|---|---|---|---|
| `ntf-event-1` | `user` | `event` | D−2 11:00 | `u-seed-1`~`7` (7행) | 읽음 |
| `ntf-system-1` | `user` | `system` | D−6 10:00 | `u-seed-1`~`7` (7행) | 읽음 |
| `ntf-system-2` | `admin` | `system` | D−1 09:00 | `u-admin-h1`~`h11` (11행) | 읽음 |

**읽음 상태** — 공지 3건은 읽음(`read_at` = 생성 시각), **상담에서 파생된 알림은 전부 안 읽음**
(`read_at = null`)입니다. 상단 🔔 배지와 알림함의 안 읽음 표시가 첫 로그인부터 보여야 하고,
읽음 처리(`PATCH /notifications/{id}/read`)를 QA 가 눌러 볼 대상이 필요합니다.

**메모 2건** — `memo-cr3-1`(`예약 일시 안내 완료`, `author_user_id='u-admin-h1'`),
`memo-cr5-1`(`같은 번호로 중복 접수 확인`, `u-admin-h1`). 상담 상세의 메모 영역이 빈 화면이 아니게
하는 최소한이고, `author_user_id` 가 채워진 메모가 처음 생깁니다(지금 시드는 전부 `null` 입니다).

#### E. QA 계정 — "환자 A 의 알림이 환자 B 에게 보이지 않는다"

계정 체계는 **그대로**입니다(§8.3) — 비밀번호는 전부 `backend/.env` 의 `SEED_PASSWORD` 이고
해시는 시드가 bcrypt(12)로 만듭니다. 요청서의 확인 항목에 쓸 두 계정을 **못 박습니다**:

| 역할 | 계정 | 이메일 | 이 계정이 보는 것 |
|---|---|---|---|
| 환자 A | `u-seed-1` 김민준 | `seed-1@molarmolar.example` | 상담 2건(`cr1` h1 · `cr8` h2). 알림 **3건**(`cr8` 의 연락중·예약확정·**일시 변경**) + 공지 2건 |
| 환자 B | `u-seed-2` 박서준 | `seed-2@molarmolar.example` | 상담 1건(`cr6` h1). 알림 **1건**(연락중) + 공지 2건 |
| 병원 담당자 | `u-admin-h1` | `admin-h1@molarmolar.example` | h1 상담 6건 · 접수 알림 6건. **h2 의 `cr7`·`cr8` 은 보이지 않습니다** |
| 다른 병원 담당자 | `u-admin-h2` | `admin-h2@molarmolar.example` | h2 상담 2건 |

**A 와 B 의 알림이 서로 다른 건수·다른 문구**라는 것이 이 배치의 목적입니다. 둘 다 "연락중" 하나뿐이면
화면이 섞여 보여도 눈으로 알아챌 수 없습니다. `notification_recipients` 는 (알림 × 사용자)이므로
A 의 알림함 질의에 B 의 행이 섞이려면 **수신자 행이 잘못 만들어져야** 하고, 그것이 정확히 이 QA 가
잡으려는 결함입니다(§5.3).

**시드 계정 구성의 한 가지 변경** — 지금 `seed.ts` 는 신청자 계정을 **상담 건수만큼**
만듭니다(`consultRequests.map(...)`, 상담 1건 = 계정 1개). 한 사람이 두 병원에 신청하는 샘플(`cr1`·`cr8`)이
생기므로 그 1:1 가정이 깨집니다. **신청자 7명을 `data/consult-requests.ts` 에 명시 목록으로 두고**
상담 행이 `applicantId` 로 가리킵니다. `userAccount(i, name)` 함수와 id 체계(`u-seed-1`~`7`)는 그대로입니다.

#### F. 마이그레이션 (backend-engineer 에게)

**요청서 15 는 마이그레이션 한 개**입니다 — §12(상담 예약) · §12.12(동의 2칸) · §13.5(인덱스) ·
§15(알림 칸)을 한 번에 적용합니다. 세 요청서에 걸쳐 설계된 것이지만 **DDL 은 한 덩어리**이고,
나눠도 중간 상태를 쓰는 코드가 없습니다.

```
consult_requests        + phone_digits (not null)  + visit_at
                        + third_party_consent_agreed_at + third_party_consent_notice_version
                        + idx(hospital_id, status, created_at)  + idx(hospital_id, visit_at)
consult_status_changes  + event (not null, default 'status_change')
                        + visit_at + cancel_reason + notification_id (fk, SetNull)
notifications           + consult_status
```

1. **개발 DB 를 먼저 백업합니다** — `cp backend/prisma/dev.db "backend/prisma/dev.backup-$(date +%Y%m%d-%H%M).db"`
   (CLAUDE.md 안전장치 2). 백업 파일은 `prisma/*.db` 로 이미 커밋에서 빠집니다
2. **값이 필요한 컬럼은 `phone_digits` 하나입니다** (`not null` 인데 기존 행에 넣을 값이 없습니다).
   SQLite 에서 이런 변경은 테이블 재생성(새 테이블 → `INSERT ... SELECT` → 교체)으로 나가고,
   그 `INSERT` 가 기존 7행의 `phone_digits` 를 채우지 못해 **실패합니다.**
   **권고: 그대로 두고 reset + 재시드로 넘깁니다** — 개발 DB 의 상담은 전부 시드 산출물이고(1번에서
   백업했습니다), 어차피 4번에서 다시 만듭니다. 스키마와 DB 가 정확히 일치해 **drift 가 남지 않는**
   것이 이 방식의 이점입니다.
   - **`@default("")` 를 스키마에 두지 않습니다.** 쓰기 경로는 항상 값을 채우고, 기본값을 남기면
     "빈 문자열도 정상" 이라는 신호가 스키마에 박힙니다
   - 마이그레이션 SQL 의 새 테이블 정의에만 `DEFAULT ''` 를 손으로 넣는 방법도 되지만, DB 에만 있는
     기본값이 **drift 로 잡힐 수 있어** 권하지 않습니다
   - 운영 데이터가 생긴 뒤라면 3단계(nullable 추가 → 백필 UPDATE → NOT NULL 로 재생성)가 정석입니다.
     §3.8 의 raw SQL 금지는 **애플리케이션 코드** 규칙이고 마이그레이션 파일에는 적용되지 않습니다(§12.12-1)
3. **나머지는 백필이 없습니다** — `event` 는 기본값이 있고, 그 밖은 전부 nullable 입니다.
   `notifications.consult_status` 도 `ADD COLUMN` 한 줄이고 **UPDATE 가 없습니다**(§15.8)
4. **그다음 `prisma:reset` + 재시드입니다.** 개발 DB 의 상담·알림은 전부 시드 산출물이고, 새 시드는
   상담 id 는 유지하되 **내용과 알림 id 를 바꿉니다**. 이전 알림 행(`notif1`~`notif7`)이 남으면
   `consult_status=null` 인 유령 알림이 화면에 섞이므로 reset 이 upsert 보다 깨끗합니다
   (§8.1 의 "fixture 구조가 바뀌면 reset" 이 가리키는 바로 그 경우입니다)
5. **테스트 DB 는 영향이 없습니다** — `npm run test:run` 이 매번 `prisma/test.db` 를 지우고 다시
   만듭니다(§8.7). 다만 `backend/test/seed-data.spec.ts` 는 **고쳐야 합니다**: 상담 7건 →
   **8건**, `notif1`·`notif4` 단정 → 새 알림 id, 그리고 새로 고정할 것들(`cr2` 가 지연 모집단,
   `cr3` 의 `visit_at` 이 오늘 KST, 깔때기 다섯 숫자가 모두 ≥ 1, `cr8` 에 `reschedule` 행 1개)

---

## 13. 4차 — 병원 관리자 대시보드 집계

| | |
|---|---|
| **요구사항 출처** | `docs/features/requests/2026-10-12-05-관리자-레이아웃-대시보드.md`, `docs/api/README.md` §3·§14 |
| **새 테이블** | **0개.** 전체 32개 그대로 (`hospital_inquiries` 는 여전히 요구사항 단계 — §2) |
| **새 컬럼** | **0개.** 화면의 숫자 전부가 기존 컬럼에서 파생됩니다 |
| **바뀌는 것** | **인덱스 +1** (`consult_requests(hospital_id, visit_at)`) · 순수 함수 +2 (`funnelOf`·`completenessOf`) · `periodRange` 에 값 1개(`thisMonth`). **`isDelayed` 는 §12.7 의 것을 그대로 씁니다 — 새로 만들지 않습니다** |
| **받는 곳** | `docs/api/README.md` §14 의 `관리자 대시보드 집계` 절 (계약용 요약) → 계약 → **요청서 16 (문의·찜·대시보드를 서버에서)** 에서 구현합니다 *(2026-10-21 개정 — 혼자 개발 체제. 2026-10-12 작성 당시에는 "백엔드(협업자 영역)" 였습니다)* |

1·2차는 테이블을, 3차는 컬럼을 설계했습니다. **4차가 설계하는 것은 숫자의 모집단입니다.**
화면에 숫자가 13개 붙는데 그중 **6개가 서로 같아야 하고**(카드 보조 줄 = 사이드 배지 = 오늘 할 일 줄),
**5개는 눌렀을 때 열리는 목록의 건수와 같아야 합니다.** 테이블을 하나도 더하지 않으면서
그 등식을 깨지지 않게 적어 두는 것이 이 절의 전부입니다.

> 이미 두 번 경고한 함정입니다 — `docs/api/README.md` §14 의 `hospital_inquiries` 카운트 세 벌,
> `ConsultStatusCounts` vs `ConsultSummary`. **이름이 같고 모집단이 다른 숫자**가
> 이 설계에서 가장 틀리기 쉬운 것이고, 대시보드는 그런 숫자를 한 화면에 13개 모아 놓은 자리입니다.
>
> **그 함정에 이미 한 번 빠져 있습니다.** 지금 `/admin` 의 숫자 카드 둘은 담당 병원을 **전부
> 합산**합니다(`GET /consult-requests/summary` 에 `hospitalId` 가 없습니다). 병원 두 곳을 맡은
> 담당자는 A 병원 화면에서 A+B 를 봅니다 — 요청 04 가 남긴 범위 구멍이고, 이번에 닫습니다(§13.8).

### 13.1 범위 — 대시보드는 **항상 병원 한 곳**이다

| 질문 | 결정 | 근거 |
|---|---|---|
| 누구의 화면인가 | **`hospital_admin` 전용** | 운영자는 기존 병원 목록 + 전문의 검수로 들어갑니다. 운영자에게 `답변 안 한 문의 N건`·`신규 상담 N건 연락하기` 를 보여주는 것은 **답할 수도 연락할 수도 없는 역할에게 할 일을 주는 것**입니다(§3 이 운영자에게 상담 변경·문의 답변을 막은 그 이유). 문의 배지에 이미 같은 규칙이 있습니다 — `scope === 'all'` 이면 화면이 숫자를 생략합니다 |
| 담당 병원이 여러 개면 | **한 곳을 고른다.** 사이드 메뉴 위 병원 선택 드롭다운(1개면 숨김) | 요청서 그대로 |
| `전체 내 병원` 모드를 둘까 | **두지 않는다** | 아래 |

**`전체 합산` 을 만들지 않은 이유.** 카드 4개 중 셋과 목록 셋은 합산이 가능하지만,
**`병원 정보 완성도` 와 `오늘 내원 예정` 은 병원 단위 사실**이라 합산할 대상이 아닙니다
(완성도 70% 와 40% 를 더하면 55% 인가요). 그 둘만 "병원을 고르세요" 로 비워 두면
**한 화면에 모집단이 두 종류** 섞이고, 사이드 배지는 어느 쪽을 따라야 하는지가 또 결정 사항이 됩니다.
합산 모드의 쓸모("오늘 어느 병원이 바쁜가")는 **병원별 한 줄 요약 목록**이지 대시보드가 아니고,
그 화면은 요청서에 없습니다.

그래서 **`hospitalId` 하나가 이 화면 전체의 축**입니다 — 카드·배지·오늘 할 일·각 카드의 링크가
전부 같은 값을 씁니다. 서버 규칙:

```
hospitalId 생략  +  담당 병원 1곳  → 그 병원 (화면에 드롭다운이 없는 경우)
hospitalId 생략  +  담당 병원 2곳 이상 → 422  (서버가 임의로 고르지 않는다)
hospitalId 가 담당 병원 밖 → 403 HOSPITAL_NOT_MANAGED  (병원 존재는 공개 정보 — §3)
```

**서버가 "첫 번째 병원" 을 골라 주지 않는 이유**: 그 순간 화면의 드롭다운 값과 숫자가 갈릴 수 있고,
"내가 고른 적 없는 병원의 할 일" 이 보입니다. 기본 선택은 화면의 몫입니다
(마지막으로 고른 병원 → 없으면 `managedHospitalIds` 의 첫 번째 — 이름순으로 고르려면 병원 목록을 먼저 받아야 해서 첫 화면이 한 번 바뀐다).

### 13.2 숫자 카드 4개 — 모집단과, 눌렀을 때 열리는 화면

전부 **선택 병원 한 곳** 범위입니다. 달력 경계는 전부 **`Asia/Seoul`**, 반열린 구간 `[from, to)`
(§12.7 의 `periodRange`).

| 카드 | 숫자 | 규칙 (정확히) | 누르면 | 그 화면의 같은 숫자 |
|---|---|---|---|---|
| ① 오늘 들어온 상담 | `todayNew` | `created_at ∈ periodRange('today')`. **상태 무관** (취소 포함) | 상담 예약 `period=today` | `meta.totalItems` (= `statusCounts.total`) |
| ① 보조 줄 `신규 전체 N건` | `statusNew` | `status = 'new'`. **기간 무관** | 상담 예약 `status=new` | `meta.totalItems` (= `statusCounts.new`) |
| ② 처리 대기 | `pending` | `status ∈ {new, contacted}`. 기간 무관 | 상담 예약 `status=new&status=contacted` | `meta.totalItems` |
| ② 보조 줄 `24시간 지연 N건` | `delayed` | `status='new'` **그리고** `now − created_at ≥ 24h` | **링크 없음** (§13.3) | — |
| ③ 답변 안 한 문의 | `unansweredInquiries` | `hospital_inquiries.answered_at IS NULL` | 문의 `status=unanswered` | `meta.totalItems`, 요약의 `unanswered` |
| ③ 보조 줄 `가장 오래된 것 {언제}` | `oldestUnansweredAt` | 위 모집단의 `min(created_at)`. 0건이면 `null` | 〃 | — |
| ④ 이번 달 예약확정<br>`이번 달 신청 42건 중 18건 예약` | `newThisMonth`(M) / `bookedThisMonth`(N) | **아래** | 상담 예약 `period=thisMonth` | `meta.totalItems` = **M**<br>(`&status=booked&status=visited` 면 **N**) |

**①이 상태를 가리지 않는 이유.** 누르면 열리는 목록이 `period=today` 하나뿐이라 전 상태가 보입니다.
`status='new'` 로 좁히면 **카드 숫자와 목록 건수가 다릅니다.** 오늘 들어와서 오늘 예약까지 잡힌 건을
"오늘 들어온 상담" 에서 빼는 것도 말이 되지 않습니다.

**②가 `new + contacted` 인 이유와 그 대가.** 요청서가 정한 정의입니다("처리 대기 = 신규 + 연락중").
대가는 **계약에 파라미터가 하나 늘어난다**는 것입니다 — 지금 `GET /consult-requests` 의 `status` 는
단일 값이라 이 카드를 재현할 필터가 없습니다. `status` 를 **반복 허용**으로 넓히면(additive,
`?status=new&status=contacted`) 카드 = `meta.totalItems` 가 성립합니다.
**클라이언트가 `statusCounts.new + statusCounts.contacted` 를 더하게 두지 않습니다** —
그 덧셈이 또 하나의 판정 지점이 되고, 같은 덧셈을 배지에서 한 번 더 하게 됩니다
(§14 가 `total` 을 따로 내려주기로 한 것과 같은 이유).

**④ `이번 달 신청 42건 중 18건 예약` 의 정의** — 분모와 분자가 **같은 코호트**입니다.

```
M = newThisMonth    = created_at ∈ periodRange('thisMonth') 인 건수          (이번 달 신청)
N = bookedThisMonth = 그중 **현재 상태**가 'booked' 또는 'visited' 인 건수     (예약)
```

**비율(%)은 두지 않습니다.** 카드 문구가 `이번 달 신청 42건 중 18건 예약` 이고 퍼센트를 그리는
자리가 없습니다(`DashboardNumbers.tsx`). 퍼센트가 필요해지면 화면이 M·N 으로 계산하거나,
그날 필드를 더합니다.

**`visited` 를 N 에 포함하는 것이 이 정의의 전부**라고 해도 됩니다. 빼면 **내원 처리를 하는 순간
숫자가 줄어들어**, 일을 잘할수록 지표가 내려가는 카드가 됩니다. `booked ∪ visited` 로 묶으면
"예약까지 간 건" 이 월중에 단조 증가합니다.

| 쓰지 않은 후보 | 왜 |
|---|---|
| 이번 달에 `booked` **이벤트**가 난 건 | 분모(이번 달 접수)와 모집단이 달라 **비율이 100%를 넘을 수 있습니다** — 지난달 접수 건이 이번 달에 확정되는 경우 |
| 이력상 `booked` 에 **도달한 적 있는** 건 | 취소된 건까지 세어 숫자가 큽니다. 무엇보다 **상태 탭(현재 상태)으로 재현할 수 없어** 카드와 목록이 영영 갈립니다 |
| 현재 `booked` 만 (visited 제외) | 위 — 월중에 감소합니다 |

**현재 상태로 정의한 대가와 이득.** 예약했다가 취소된 건은 N 에서 빠집니다
(취소 시점에 숫자가 **내려갑니다**). 그것이 틀린 것은 아닙니다 — 카드 문구가 `예약` 이지
`예약했었음` 이 아니고, **지금 잡혀 있는 예약**을 세는 것이 병원이 매일 보는 수입니다.
얻는 것은 큽니다: `현재 상태` 는 **상담 목록의 상태 탭과 같은 축**이라
`period=thisMonth` + `status` 조합으로 **눈으로 대조할 수 있습니다**
(`status=booked` 건수 + `status=visited` 건수 = N).

**링크는 M 쪽입니다** — `period=thisMonth`, 상태 필터 없음 → `meta.totalItems` = M.
N 을 한 번에 여는 링크는 `status` 반복 허용(②와 같은 파라미터)이 들어오면
`period=thisMonth&status=booked&status=visited` 로 **정확히 재현됩니다.** 카드 ② 때문에
필요한 변경이 이 카드의 링크까지 함께 살립니다.

`period` enum 에 `thisMonth` 가 필요합니다 — **additive**이고, `periodRange` 에 한 줄 더하는 일입니다
(`이번 달 1일 00:00 KST ~ 다음 달 1일 00:00 KST`).

> **이름이 같고 모집단이 다른 숫자 경고.** 계약의 `ConsultSummary.newThisMonth` 는
> **담당 병원 전체 합산**이고 `hospitalId` 파라미터가 없습니다. 대시보드의 `newThisMonth` 는
> **선택 병원 한 곳**입니다. `ConsultSummary.pending` 은 `status='new'` 하나인데 대시보드의
> `pending` 은 `new + contacted` 입니다. **두 스키마는 재사용 관계가 아닙니다** — §13.8.

### 13.3 `지연` — 규칙은 **상담 목록과 같은 순수 함수 하나뿐**이다

§12.11 이 적어 둔 뒤집히는 조건("`지연` 이 탭·카운트가 되는 순간")이 발동했습니다.
**카운트가 되었으므로 서버가 셉니다. 컬럼은 여전히 만들지 않고, 규칙도 새로 만들지 않습니다.**

판정은 §12.7 의 함수 **그대로**입니다. 다시 적지 않고 가리킵니다:

```ts
// consult/transition.ts — 이미 있는 것. 대시보드는 여기에 아무것도 더하지 않는다
export const DELAY_THRESHOLD_MS = 24 * 60 * 60 * 1000;
export const isDelayed = (status, createdAt, now) =>
  status === 'new' && now.getTime() - createdAt.getTime() >= DELAY_THRESHOLD_MS;
```

서버 카운트는 이것을 **그대로 이항한 질의**입니다 — 다른 규칙이 아니라 **같은 부등식**입니다:

```
now − created_at ≥ DELAY_THRESHOLD_MS      ⟺      created_at ≤ now − DELAY_THRESHOLD_MS

WHERE hospital_id = ? AND status = 'new' AND created_at <= (now − DELAY_THRESHOLD_MS)
```

**두 곳이 갈리지 않게 지키는 것 네 가지** (계약에도 같은 문장을 적습니다 — `docs/api/README.md` §14):

1. **상수도 함수도 한 곳입니다** — `consult/transition.ts`. 질의는 그 상수로 경계 시각을 만들고
   **`24` 라는 숫자를 어디에도 다시 쓰지 않습니다.** 두 번째 규칙 파일을 만들지 않습니다
2. **경계는 `≥` 이고 포함입니다** — 정확히 24시간 00분 00초 경과한 건은 **지연입니다.**
   `>` 로 구현하면 두 곳이 1틱 차이로 갈립니다. 계약 문구도 "24시간 **이상** 경과" 입니다
3. **24시간은 경과 시간이라 시간대와 무관합니다.** `오늘`·`이번 달` 과 달리 `Asia/Seoul` 이
   개입하지 않습니다 — 기기 시계의 시간대 설정이 틀려도 같은 답이 나옵니다
4. **클라이언트는 대시보드 숫자를 다시 계산하지 않습니다.** 목록 화면의 `지연` 배지만 `isDelayed` 로
   칠합니다. 두 값이 **다른 시점**을 가리킬 수는 있어도(그래서 응답 1분 뒤에는 `지연 3건` 옆에
   배지가 4개일 수 있습니다) **다른 규칙**을 가리키지는 않습니다. 경계값 테스트가
   `isDelayed` 와 질의 경계 시각이 같은 답을 내는 것을 고정합니다

**목록 전체를 받아 `isDelayed` 로 세지 않는 이유**: 모집단이 그 병원의 `new` 전체라 세려면 전 건을
메모리로 올려야 합니다. `오늘 할 일` 에 **개별 건**이 필요한 쪽은 상한(최대 5건)이 있어 목록으로
받고, **그 목록의 각 행은 같은 함수로 다시 판정해도 같은 답**이 나옵니다 (그것이 규칙이 하나라는 뜻입니다).

**보조 줄에 링크를 걸지 않습니다.** `지연` 을 재현하는 목록 파라미터를 만들면 "상태도 기간도 아닌
세 번째 필터 축" 이 탭 UI 옆에 생깁니다. 지연 건은 **오늘 할 일에 개별 줄로 이미 나열**되고
거기서 상세로 바로 갑니다 — 목록을 한 번 더 거칠 이유가 없습니다.

### 13.4 오늘 할 일 네 줄 — 겹치는 것을 겹친다고 적는다

| 줄 | 숫자/행 | 모집단 | 이동 |
|---|---|---|---|
| 1. 지연 상담 (**건별**) | 최대 5행 + `외 N건` | §13.3 의 모집단, `created_at` **오름차순**(오래된 것 먼저) | 상담 상세 |
| 2. `신규 상담 N건 연락하기` | `statusNew` | `status='new'`, 기간 무관 | 상담 예약 `status=new` |
| 3. `답변 안 한 문의 N건` | `unansweredInquiries` | `answered_at IS NULL` | 문의 `status=unanswered` |
| 4. `자격증 반려 — 다시 올리기` | `rejectedDoctors` | 선택 병원 소속 `doctors.verification_status = 'rejected'` | 의료진(= 병원 정보 수정의 의료진 영역) |

**1번은 2번의 부분집합입니다.** 지연 건도 `new` 이므로 `지연 3건` + `신규 상담 8건` 은 11건이 아니라
8건이고 그중 3건이 지연입니다. **화면 문구가 그것을 드러내야 합니다**(`신규 상담 8건 연락하기
— 그중 3건은 24시간이 지났어요` 같은 형태). 두 줄을 더하게 만드는 UI 는 거짓을 보여줍니다.

**4번에 사유가 없는 이유**: 계약(`AdminDashboardTodo.rejectedDoctors`)은 반려된 전문의를 **건별 `{id, name}`** 으로
내려줍니다(2026-10-13 — 이름은 서버가 이미 갖고 있다). 반려 **사유**를 보여주려면 `rejectionReason` 이 필요한데
그 값은 `DoctorAdminView` 에만 있고 **병원 소속 전문의를 관리자 시야로 읽는 GET 이 아직 없습니다**
(`GET /hospitals/{id}/doctors?view=admin` 후보). 사유 표시는 그 GET 이 생기는 날의 일입니다.

**네 줄이 모두 0이면** 화면은 `오늘 처리할 일이 없어요` 한 줄입니다. 서버는 빈 값을 그대로 내려주고
"할 일 없음" 을 판정하지 않습니다 — 네 숫자가 모두 0인지는 화면이 보면 됩니다.

### 13.5 오늘 내원 예정 — `(hospital_id, visit_at)` 인덱스를 지금 겁니다

```
WHERE hospital_id = ? AND status = 'booked' AND visit_at ∈ periodRange('today')
ORDER BY visit_at ASC
```

| 질문 | 결정 | 근거 |
|---|---|---|
| `visited` 도 넣을까 | **아니오, `booked` 만** | `예정` 입니다. 내원 처리를 하면 줄이 사라지는 것이 맞습니다(= 오늘의 처리 목록). `오늘 내원 5명 중 2명 완료` 같은 진행 표시는 화면 기획에 없어 만들지 않습니다 |
| `visit_at` 이 과거인 오늘 건 | **포함** | 오늘 10시 예약을 11시에 보는 것이 정상입니다. 하루 단위 목록이지 미래 필터가 아닙니다 |
| 목록 파라미터(`visitDate=today`)를 계약에 더할까 | **더하지 않습니다** | 아래 |
| 인덱스 | **`consult_requests(hospital_id, visit_at)` 추가** | 아래 |

**목록 파라미터를 만들지 않은 이유.** 이 섹션에는 `전체 보기` 가 없습니다 — 하루치가 전부이고
각 줄은 상담 상세로 갑니다. 소비자가 없는 파라미터를 계약에 올리면 "일시 기준 목록 화면이 있다" 는
약속이 되고, 그 화면이 생길 때 `오늘` 하나로는 모자라서(날짜 이동·주간 보기) 결국 다시 설계합니다.
**날짜별 내원 목록 화면이 생기는 날** `visitPeriod`/`visitDate` 를 `period` 와 같은 모양으로 더합니다
(경계는 서버 KST — 기기 시계로 "오늘" 을 보내면 자정 근처에서 어제가 열립니다).

**인덱스를 지금 거는 이유.** §12.6 이 "그 화면이 생기면" 이라고 적어 둔 화면이 이것입니다.
`(hospital_id, visit_at)` 로 "이 병원의 오늘 일시" 가 **범위로 잡히고 정렬까지 그 인덱스가 받습니다.**
`status='booked'` 는 그 안의 소수 행 필터라 선두에 두지 않습니다 —
`(hospital_id, status, visit_at)` 로 만들면 `(hospital_id, status, created_at)` 과 선두 2컬럼이
겹치는 네 번째 인덱스가 되고, 얻는 것은 이미 좁혀진 집합의 추가 필터뿐입니다.
**`visit_at` 은 대부분의 행에서 `null`** 이라 인덱스가 커지는데, PostgreSQL 로 옮긴 뒤에는
부분 인덱스(`WHERE visit_at IS NOT NULL`)로 줄일 수 있습니다 — §7.6 후보로 적어 둡니다.

### 13.6 이번 달 상담 흐름 — **현재 상태**로 센다

```
상담 신청 ──▶ 연락 완료 ──▶ 예약확정 ──▶ 내원완료        (취소는 단계가 아니라 별도 숫자)
```

**모집단은 카드 ④ 의 M 과 같습니다** — `이번 달(KST)에 접수된 상담` 한 코호트.
네 막대가 같은 집합의 부분집합이라야 깔때기가 깔때기입니다. "이번 달에 일어난 이벤트" 로 세면
분모 없는 네 수가 나란히 서고, 지난달 접수 건이 섞여 **아래 막대가 위 막대보다 길어질 수 있습니다.**

**각 단계는 `현재 상태`(와 거기서 파생되는 현재 취소 사유)로 판정합니다. 이력을 거슬러 세지 않습니다.**

| 단계 | 규칙 (현재 상태 기준) |
|---|---|
| 상담 신청 | 코호트 전체 (= M) |
| 연락 완료 | `status ≠ 'new'` **그리고** `(status='cancelled' 이고 사유가 `no_answer`)가 아님` |
| 예약확정 | `status ∈ {booked, visited}` — **카드 ④ 의 N 과 같은 값** |
| 내원완료 | `status = 'visited'` |
| *(별도)* 취소 | `status = 'cancelled'` — 단계가 아니라 옆에 적는 숫자 |

```ts
// consult/funnel.ts — DB 도 요청도 모르는 순수 함수 (AGENTS.md).
// cancelReason 은 §12.4 의 파생값(cancelReasonOf)이다 — 이 함수는 이미 파생된 값을 받는다.
export interface FunnelInput { status: ConsultStatus; cancelReason: ConsultCancelReason | null }

/** '연락이 안 됨' 으로 닫힌 건은 연락이 닿지 않은 건이다 */
const neverReached = (c: FunnelInput) => c.status === 'cancelled' && c.cancelReason === 'no_answer';

/** 코호트 하나의 깔때기. 단조 감소가 구조적으로 보장된다 (아래 증명) */
export function funnelOf(cohort: ReadonlyArray<FunnelInput>) {
  return {
    requested: cohort.length,
    contacted: cohort.filter((c) => c.status !== 'new' && !neverReached(c)).length,
    booked:    cohort.filter((c) => c.status === 'booked' || c.status === 'visited').length,
    visited:   cohort.filter((c) => c.status === 'visited').length,
    cancelled: cohort.filter((c) => c.status === 'cancelled').length,
  };
}
```

**단조 감소가 깨지지 않는다는 것**이 이 정의를 고른 가장 큰 이유입니다. 증명이 한 줄입니다 —
`visited ⊆ {booked, visited} ⊆ {status ≠ new 이고 no_answer 취소가 아님} ⊆ 코호트`.
`booked`·`visited` 는 `new` 가 아니고 취소도 아니므로 상위 막대에 **반드시** 포함됩니다.
깔때기가 중간에서 부풀어 오르는 그림은 구조적으로 나올 수 없습니다.

판단 네 가지와 그 근거:

| 질문 | 결정 | 근거 |
|---|---|---|
| 왜 이력이 아니라 현재 상태인가 | **현재 상태** | 깔때기 옆에 있는 상담 목록의 **상태 탭과 같은 축**입니다. 담당자가 `예약확정 18` 막대를 보고 탭을 눌러 18건을 셀 수 있어야 합니다. 이력 기준("도달한 적 있는가")은 그 대조가 **영원히 불가능**합니다 — 재현할 필터가 없습니다. 숫자가 맞는지 눈으로 확인할 수 없는 지표는 틀려도 아무도 모릅니다 |
| `연락이 안 됨` 취소를 `연락 완료` 에서 빼는 이유 | **뺀다** | 빼지 않으면 그 막대가 "연락을 **시도**한 건" 이 되어 쓸모가 없어집니다. `연락이 안 됨` 은 **연락이 닿지 않았다는 병원 자신의 기록**이고, 이 깔때기가 답해야 할 질문("신청자 중 몇 명과 실제로 말이 닿았나")에 그 건은 아니오입니다. 나머지 네 사유(`환자 요청`·`진료 불가 시술`·`중복 신청`·`기타`)는 **연락이 닿은 뒤에 나오는 사유**라 그대로 셉니다 |
| 자유 전이(신규 → 내원완료 직행) | 자동으로 맞는다 | 현재 상태가 `visited` 면 세 막대에 모두 들어갑니다. 중간 상태를 거쳤는지 묻지 않으므로 걸어 들어온 환자가 "연락 안 한 건" 으로 빠지지 않습니다 |
| 역방향 전이(오기입 정정) | **지금 값이 곧 답이다** | `내원완료` 를 잘못 눌렀다 `예약확정` 으로 되돌리면 막대가 **내려갑니다.** 그것이 맞습니다 — 정정의 목적이 숫자를 고치는 것입니다. 이력 기준이면 잘못 누른 사실이 영구히 집계에 남습니다 |

> **`연락 완료` 라는 라벨의 한계를 적어 둡니다.** `contacted`(연락중)는 "연락을 시도하는 중" 인데
> 이 막대는 그것을 `연락 완료` 로 셉니다. 정확히는 **"신규를 벗어났고, 연락 불발로 닫히지 않은 건"**
> 입니다. 라벨을 `연락 단계 이상` 으로 바꾸면 정확해지지만 요청서의 문구가 `연락 완료` 이고,
> 담당자에게는 "손을 댄 건" 이 읽히는 뜻입니다. **라벨과 규칙이 1:1이 아닌 자리**라서
> 여기 적어 둡니다 (`인기순`=평점순, `booked`=예약확정과 같은 종류의 어긋남 — §12.1).

**과거 취소 건의 사유는 `null` 입니다** (§12.4 가 이력 행에만 사유를 두기 전의 건, 그리고
사유 없이 들어간 시드). `null ≠ 'no_answer'` 이므로 **`연락 완료` 에 포함됩니다.**
소급해 추측하지 않습니다 — §12.10 과 같은 판단입니다.

**집계 SQL 로 내려쓰지 않습니다.** 코호트(그 병원의 이번 달 접수 건)의 `status` 와,
**취소 건에 한해** 사유 파생에 필요한 이력을 읽어 위 함수에 넘깁니다. 규칙이 순수 함수 한 곳에
있어야 하고(AGENTS.md), 지금 규모에서 비용이 없습니다. 코호트 질의는 기존
`(hospital_id, created_at)` 이, 취소 건 이력은 기존 `(consult_request_id, changed_at)` 이 받습니다.

> **뒤집히는 조건**: 한 병원의 **월 상담이 수천 건**이 되는 순간. 그때는 `groupBy(status)` 로
> 네 수 중 셋을 DB 가 세고(`연락 완료` 만 취소 사유 때문에 따로 셉니다), 그래도 모자라면
> §12.4 가 적어 둔 조건("이력을 싣지 않는 가벼운 목록 투영이 생기는 순간")대로
> `consult_requests.cancel_reason` 캐시 컬럼이 맞습니다. **지금 만들면 소비자 없는 비정규화입니다.**

### 13.7 병원 정보 완성도 — **오늘 채울 수 있는 항목만** 7개, 같은 가중치

**선정 기준 하나: 담당자가 지금 이 화면에서 입력할 수 있는가.**
채울 수단이 없는 항목을 완성도에 넣으면 `남은 항목` 을 눌러도 갈 곳이 없고,
**영원히 100%가 되지 않는 바**가 됩니다 — 그 바는 아무도 보지 않게 됩니다.

| # | `key` | 라벨 | 충족 조건 | 못 채웠을 때 가는 곳 (`target`) |
|---|---|---|---|---|
| 1 | `basicInfo` | 기본 정보 | `name`·`region`·`address` 가 trim 후 비어 있지 않고, `latitude`·`longitude` 가 **둘 다 0이 아니며**, `specialty`(전문 분야)가 trim 후 비어 있지 않음 | `name` |
| 2 | `businessHours` | 진료시간 | 7요일 행이 모두 있고, `is_closed = false` 인 요일의 `hours` 가 **trim 후 공백이 아님** | `businessHours` |
| 3 | `procedures` | 진료 시술 | `hospital_procedures` 행 **≥ 1** | `procedureIds` |
| 4 | `thumbnail` | 대표 이미지 | `thumbnail` 이 비어 있지 않고 **서버 기본 이미지가 아님** | `thumbnail` |
| 5 | `introduction` | 병원 소개 | `trim(introduction).length ≥ 30` | `introduction` |
| 6 | `directions` | 찾아오시는 길 | `trim(directions).length ≥ 10` | `directions` |
| 7 | `doctors` | 의료진 | 그 병원 소속 `doctors` 행 **≥ 1** (검수 상태 무관) | `doctors` |
| — | *(자리)* `procedurePrices` | 시술별 가격 | **요청 07** → **§16.9 에서 채웠습니다 (제안)** | `procedureIds` → `procedures` (§16.9) |
| — | *(자리)* `photos` | 병원 사진 3장 이상 | **요청 07** (파일 업로드가 생긴 뒤) → **§16.9 (제안)** | `images` |

`target` 값은 **프런트에 이미 있는 폼 필드 키**입니다 —
`frontend/src/features/hospital/lib/hospitalFieldErrors.ts` 의 `HOSPITAL_FIELD_KEYS`
(서버 `422` 의 `details[].field` 가 쓰는 바로 그 어휘). 완성도 항목이 **서버 검증 오류와 같은 키로
같은 입력 칸을 가리키므로**, 화면은 포커스 이동 코드를 하나만 들고 있으면 됩니다.
그 배열에 없는 것이 둘입니다: `doctors`(병원 필드가 아니라 폼의 의료진 영역 — 요청 07 이 화면을 분리하면 그 라우트가
됩니다)와, 07 자리의 `images`(지금 수정 화면이 사진 목록을 보내지 않아 키가 없다 — 07 에서 입력 수단과 함께 추가).

**항목에서 뺀 것과 그 이유:**

| 뺀 것 | 왜 |
|---|---|
| 병원 사진 3장 이상 | **오늘 채울 수단이 없습니다.** 등록 화면은 `대표 이미지 URL` 을 `[thumbnail]` 로 넣어 우회하고, **수정 화면은 `images` 를 아예 보내지 않습니다**(`docs/features/known-issues.md`). 담당자가 `남은 항목: 병원 사진 3장` 을 눌러 갈 입력 칸이 없습니다. 파일 업로드가 오는 **07 의 자리**로 미룹니다 |
| 시술별 가격 | 07 이 스키마를 정합니다 |
| 가격대 (`priceRange`) | 등록 **필수 항목**이라(`HospitalCreateRequest.required`) 계약을 지나온 병원은 전부 참입니다. 항상 참인 항목은 완성도를 **공짜로 한 칸 올릴 뿐**입니다. 07 에서 시술별 가격이 들어오면 그쪽이 진짜 항목이 됩니다 |
| 병원 특징 체크박스 (`features`) | **0개가 정상 상태**입니다. 해당 사항이 없는 병원에게 "안 채웠다" 고 말하면 거짓말을 체크하게 만듭니다 |
| 태그 (`tags`) | 태그 필터 화면이 없어(§2) 비어 있어도 환자 화면에 빈자리가 생기지 않습니다 |

> **항목 1·3 도 등록 필수라 "거의 항상 참" 입니다.** 그래도 남긴 이유가 셋 있습니다:
> ① 요청서가 적은 항목이고, ② `specialty` 는 **필수가 아니어서** 항목 1을 실제로 거짓으로 만들 수
> 있으며(기본값이 빈 문자열입니다), ③ 항목 3은 **0개인 병원이 실제로 존재할 수 있습니다** — 아래.

**순수 함수와 백분율:**

```ts
// hospital/completeness.ts — 순수 함수. 이미 읽어 둔 값을 받고 DB 를 모른다
export const COMPLETENESS_ITEMS = [
  'basicInfo', 'businessHours', 'procedures', 'thumbnail', 'introduction', 'directions', 'doctors',
] as const;                              // ← 이 배열의 순서가 곧 '남은 항목' 의 순서다

export function completenessOf(input): {
  percent: number;
  items: ReadonlyArray<{ key; label; done: boolean; target }>;   // 항상 전체 항목. 순서 고정
  noProcedures: boolean;                                          // ← % 와 별개 경고 (아래)
}
```

1. **동일 가중치.** `percent = round(충족 수 / 전체 항목 수 × 100)`. 가중치를 두는 순간
   "왜 사진이 소개보다 2배인가" 를 설명할 근거가 필요한데 화면에 없습니다.
   **단, 전부 충족이 아니면 99 를 넘기지 않습니다** — 항목이 07 에서 늘어나면 반올림이 `100%` 를
   만들어 `남은 항목: 시술 가격` 과 `100%` 가 나란히 보이는 날이 옵니다.
2. **"비어 있지 않음" 이 아니라 최소 길이** (`introduction` 30자 · `directions` 10자).
   둘 다 서버 기본값이 빈 문자열이고 한 글자만 넣어도 채워집니다. 글자 수는 임의값이지만
   **상수 두 개가 함수 한 곳에 있으면 바꾸는 비용이 한 줄**입니다.
3. **`남은 항목` 의 순서 = 응답 배열 순서 = 위 표 순서**이고 **그 순서가 계약입니다.**
   환자 화면에서 비는 자리가 큰 것부터입니다(기본 정보·진료시간·시술은 병원 카드와 상세 상단,
   의료진은 그다음). 화면이 다시 정렬하면 판정 지점이 둘이 됩니다.
4. **`items` 는 충족한 것까지 전부 내려줍니다.** `남은 항목` 은 `items.filter(!done)` 이고,
   07 이후 섹션별 체크 표시(`✓ 진료시간`)가 같은 배열을 씁니다.

**`시술 0개` 경고는 백분율과 별개입니다.**

```
noProcedures = (hospital_procedures 행 === 0)
```

완성도 바가 `86%` 인데 환자가 시술로는 못 찾는 상태가 가능합니다 — 7분의 1은
**"거의 다 됐다" 로 보이지만 사실은 노출이 막힌 상태**입니다. 그래서 같은 함수가
**별도 boolean** 을 내고 화면은 바 아래 경고 줄을 따로 그립니다.

> **경고 문구는 `앱에 노출되지 않아요` 보다 좁혀야 합니다 — 사실이 아닙니다.**
> 시술 0개 병원이 **빠지는 곳**과 **그대로 보이는 곳**을 확인했습니다:
>
> | 빠집니다 (시술로 찾는 모든 경로) | 그대로 보입니다 |
> |---|---|
> | 홈 `시술로 찾기` 격자 → 대분류 전개 | 병원 이름 **검색** (`GET /search`, `q`) |
> | 병원 탐색의 시술 칩 13개·세부 시술 (`?procedureId=`) | 꿀팁 상세 `관련 병원` |
> | 탐색 `가격 비교표` 의 시술 열 | 마이페이지 **찜 목록** |
> | 클라이언트 전개(`filterPageByLegacyIds`)를 타는 대분류 선택 | **병원 상세 직접 링크** (`/hospital/h1`) |
> | | 탐색 `추천` 칩 (`recommended=true`, `isRecommended` 면) |
>
> 즉 **"시술로 찾는 길이 전부 막힌다"** 가 정확한 사실입니다
> (탐색의 기본 선택이 시술 기반이라 **환자가 병원을 발견하는 주 경로**가 통째로 닫힙니다).
> 문구 제안: **`시술을 등록하지 않으면 환자가 시술로 검색할 때 병원이 나오지 않아요`**.
> 화면 문구는 디자이너·프런트가 정하되 **"앱에 아예 안 보인다" 로 적지 않습니다** —
> 찜·검색·직접 링크로 들어온 환자에게는 그대로 보이고, 그 상태에서 상담도 받습니다.
>
> **덧붙여: 계약상 시술 0개 병원은 만들어질 수 없습니다.** `procedureIds` 에 `minItems: 1` 이
> 걸려 있어 `POST`/`PATCH` 를 통과하지 못합니다. 그래서 이 경고가 뜨는 경우는
> **계약 이전에 들어온 데이터(시드·이관)** 뿐이고, 프런트 코드도 그 상태를 이미 방어하고 있습니다
> (`HospitalDetailView` 와 `HospitalMapView` 에 `procedureIds: []` 주석이 있습니다).
> 경고를 두는 이유가 그것입니다 — **막혀 있어야 할 상태가 실제로 존재합니다.**

**서버가 계산합니다.** 입력값이 거의 다 `Hospital` 응답 안에 있어 클라이언트도 계산할 수 있지만
**하지 않습니다**:

- 같은 판정이 **대시보드 바**와 (07 이후) **병원 정보 화면의 섹션별 체크** 두 곳에서 필요합니다
- 항목이 07 에서 **둘 늘어납니다** — 앱 배포 없이 바뀌어야 하는 종류입니다
- `doctors ≥ 1` 은 **다른 테이블**이라 병원 응답만으로는 판정할 수 없습니다. 클라이언트가 계산하려면
  병원 화면마다 전문의 목록을 한 번 더 받아야 합니다
- `images`·`thumbnail` 은 수정 화면이 보내지 않거나 서버가 기본값을 채워 넣는 자리라
  **클라이언트가 들고 있는 값과 저장된 값이 갈립니다**. 완성도는 **저장된 것** 기준이어야 합니다

### 13.8 배지와 카드가 같은 숫자인 이유 — **출처가 하나다**

| 사이드 메뉴 | 숫자 | 같은 값인 곳 |
|---|---|---|
| `상담 예약` 배지 | `statusNew` | 카드 ① 보조 줄, 오늘 할 일 2번 |
| `문의` 배지 | `unansweredInquiries` | 카드 ③, 오늘 할 일 3번 |

세 자리에 같은 숫자가 필요한데, **그 숫자를 세 번 계산하지 않습니다.** 대시보드 응답 하나에서
오고 화면은 그것을 스토어에 둡니다. 다른 관리자 화면(상담 예약·문의·병원 정보)에서도 배지가
보여야 하므로, 그 화면들은 **같은 응답을 캐시로 쓰고** 변경(상태 변경·답변 등록) 뒤에만 다시 받습니다.

**이것이 요청 04 가 남긴 구멍을 메웁니다.** 요청 04 까지 `/admin` 의 숫자 카드 둘은
`GET /consult-requests/summary` 에서 왔는데 그 오퍼레이션에는 **`hospitalId` 파라미터가 없어**
담당 병원 전부를 합산합니다. 병원을 두 곳 맡은 담당자는 **A 병원 화면을 보면서 A+B 의 숫자**를
봅니다. 사이드 배지와 카드가 "선택한 병원" 을 말하기로 한 이상 그 합산은 **거짓**이 됩니다.

**기존 두 요약을 배지에 쓰지 않는 이유** — 모집단이 다릅니다:

| 기존 | 값 | 대시보드 | 어긋나는 지점 |
|---|---|---|---|
| `ConsultSummary.pending` | `status='new'`, 담당 병원 **전체 합산** | `pending` = `new + contacted`, **선택 병원** | 이름이 같고 뜻이 둘 다 다릅니다 |
| `ConsultSummary.newThisMonth` | 담당 병원 전체 합산 (`hospitalId` 파라미터 **없음**) | 선택 병원 | 병원이 2곳이면 값이 다릅니다 |
| `HospitalInquirySummary.unanswered` | `hospitalId` 로 좁힐 수 **있음** | 같은 규칙 | **유일하게 재사용 가능**합니다 |

문의 쪽은 재사용할 수 있지만 상담 쪽은 할 수 없습니다. **한쪽만 재사용하면** 대시보드가
두 출처에서 숫자를 받아 "어느 것이 기준인가" 가 다시 결정 사항이 됩니다. 전부 한 응답에서 받습니다
(계약 권고는 `docs/api/README.md` §14).

**`GET /consult-requests/summary` 를 어떻게 할 것인가 — 셋 중 하나를 골라야 합니다:**

| 선택지 | 판단 |
|---|---|
| ① 파라미터 `hospitalId` 를 더해 그대로 쓴다 | **모자랍니다.** 범위는 고쳐지지만 `pending` 의 **뜻**(= `new` 하나)이 대시보드의 `처리 대기`(= `new + contacted`)와 다릅니다. 같은 이름의 두 숫자가 남습니다 |
| ② 필드를 더해 대시보드 전용으로 키운다 | 일곱 숫자·세 목록·깔때기·완성도가 들어가면 **이름만 `ConsultSummary` 인 다른 스키마**가 됩니다. 상담 도메인에 병원 완성도가 들어오는 것도 이상합니다 |
| ✅ ③ **대시보드는 새 집계 하나로 받고, 이 오퍼레이션은 계약에 남기되 소비 화면이 생길 때까지 구현하지 않는다** | 아래 |

③을 고른 이유, 그리고 **2026-10-13 에 바로잡은 사실**:

- 처음에는 "운영자 홈이 전 범위 상담 숫자를 볼 유일한 자리라서 남긴다" 고 적었습니다.
  **그것은 사실이 아니게 됐습니다** — 실제 운영자 홈(`OperatorHome.tsx`)은 같은 레이아웃에
  **병원 목록과 검수 대기만** 보여주고 상담 숫자를 그리지 않습니다(사용자 결정).
- 그래서 지금 **이 오퍼레이션을 읽는 화면은 하나도 없습니다.** `x-screens` 는 빈 목록이고
  (`admin-home.md` 를 뺐습니다), **서버 구현도 소비 화면이 생기는 날까지 필요 없습니다.**
- **그래도 계약에서 지우지는 않습니다** — 삭제는 더 큰 결정이고, ①·② 를 버린 근거와
  모집단 구분(`ConsultSummary` 는 **담당 병원 전체 합산**, `pending = new` 하나)은
  운영자 홈이 상담 숫자를 요구하게 되는 날 다시 필요한 기록입니다. 계약 설명에 그 경계를
  적어 두는 것이 `statusCounts` 와 `ConsultSummary` 의 모집단 차이를 이미 적어 둔 것과
  같은 처방입니다.

> `hospitalId` 파라미터를 **지금 더하지 않습니다.** 더해도 쓰는 화면이 없고
> (대시보드는 ③으로 갑니다), 소비자 없는 파라미터는 "이 숫자를 병원별로 봐도 된다" 는
> 잘못된 신호가 됩니다. **운영자 홈이 병원별 숫자를 요구하는 날** 더합니다.

### 13.9 질의 계획 — 인덱스 1개 추가, 나머지는 전부 기존 것

| 숫자/목록 | 질의 | 인덱스 |
|---|---|---|
| ① `todayNew`, ④ `newThisMonth`, 흐름 코호트, 최근 5건 | `hospital_id` + `created_at` 범위/정렬 | `(hospital_id, created_at)` **기존** |
| ① 보조 `statusNew`, ② `pending`, ② 보조 `delayed` | `hospital_id` + `status` (+ `created_at` 경계) | `(hospital_id, status, created_at)` **기존 (§12.6)** |
| 오늘 내원 예정 | `hospital_id` + `visit_at` 범위 + 정렬 | `(hospital_id, visit_at)` **← 추가** |
| ④ `bookedThisMonth`, 흐름 네 막대 | 코호트의 `status` (+ **취소 건만** 사유 파생용 이력) | `(hospital_id, created_at)` · `(consult_request_id, changed_at)` **기존** |
| ③ 미답변 수 · 가장 오래된 것 | `hospital_id` + `answered_at IS NULL` (+ `min(created_at)`) | `(hospital_id, answered_at)` **기존(설계안)** |
| 오늘 할 일 4 `rejectedDoctors` | `hospital_id` + `verification_status='rejected'` | `(hospital_id)` **기존** |
| 완성도 | 병원 1행 + 자식 테이블 count 3 | 각 `(부모_id, …)` **기존** |

`가장 오래된 미답변` 은 미답변 행을 다 받아 `min(created_at)` 을 잡습니다 — 미답변은 본래 적은
집합입니다. 커지면 `(hospital_id, answered_at, created_at)` 이지만, 그 테이블은 **아직 만들어지지도
않았습니다**(§2). 지금 인덱스를 늘려 두는 것은 추측입니다.

### 13.10 만들지 않은 것 · 미룬 것

| 안 만든 것 | 대신 | 근거 |
|---|---|---|
| `consult_requests.max_stage`(도달 단계) | **현재 상태** + 순수 함수 (§13.6) | 깔때기를 현재 상태로 정의하면서 아예 필요 없어졌습니다. 이력 기준이었다면 캐시 컬럼 논의가 따라왔을 텐데, 정의를 바꿔 **질문 자체를 없앴습니다** |
| `consult_requests.cancel_reason` | 이력에서 파생 (§12.4) | 깔때기의 `연락 완료` 가 사유를 보지만, 모집단이 한 달치 취소 건이라 이력 조회로 충분합니다. §12.4 가 적어 둔 뒤집히는 조건("이력을 싣지 않는 가벼운 목록 투영")은 아직입니다 |
| `hospitals.completeness_percent` | 응답 시점 계산 (§13.7) | 입력 7개가 전부 같은 병원의 자식 행이라 **쓰기마다 갱신해야 하는 컬럼**이 됩니다. 07 에서 항목이 바뀌면 전 병원 백필이 따라옵니다 |
| `delayed` 컬럼 | 질의 조건 (§13.3) | §12.11 그대로 — 시간이 지나면 값이 바뀝니다 |
| 대시보드 스냅샷 테이블 (일별 집계) | 매 요청 계산 | 과거 추이를 보는 화면이 없습니다. `지난달 대비` 가 요구사항이 되는 날 `consult_daily_stats` 같은 테이블이 맞고, 그때 보존 기간도 함께 정합니다 |
| 병원 선택 상태 저장 (`hospital_admins.is_default` 등) | 클라이언트 (§13.1) | 서버가 기억할 이유가 없습니다. 기기마다 달라도 되는 값입니다 |
| 운영자용 집계 | — | 운영자는 이 화면을 쓰지 않습니다 (§13.1) |

**미룬 것 (근거와 함께):**

1. **완성도 항목 두 개** — `procedurePrices`(시술별 가격)와 `photos`(사진 3장 이상). 둘 다
   **요청 07** 이 입력 수단(가격 칸·파일 업로드)을 만든 뒤입니다. 자리와 `target` 만 적어 둡니다 (§13.7)
   → **§16 에서 설계했습니다 (제안 단계)** — 항목은 7 → 9 가 됩니다 (§16.9)
2. **일시 기준 목록 파라미터·화면** — §13.5. 인덱스는 먼저 깔립니다
3. **반려 전문의 건별 줄과 사유 표시** — 관리자 시야의 병원 소속 전문의 GET 이 없습니다 (§13.4)
4. **알림 종 · 환자 검색 (상단 바)** — 기존 `GET /notifications/unread-count` 와 상담 목록의 `q` 를
   그대로 씁니다. 대시보드 집계에 넣지 않습니다
5. **승인 상태(`승인 완료 · 앱 노출 중` / `승인 대기`)와 직책** — 요청 06 입니다. `hospitals` 에
   승인 상태 컬럼이 없고 `hospital_admins` 에 직책 컬럼이 없습니다. **그 요청서가 올 때 함께 설계합니다**
   → **§14 에서 설계했습니다 (제안 단계)**
6. **`이번 주`·`지난달 대비` 같은 비교 숫자** — 요청서에 없습니다. `periodRange` 는 이미 받을 수
   있지만 소비자가 없습니다

---

## 14. 병원 관리자 직접 가입 (구 요청 06) — **제안 — 요청자 답 반영 대기 → 요청서 18**

| | |
|---|---|
| **상태** | **제안입니다. 요청자 답 반영 대기 → `docs/features/requests/2026-10-21-18-병원관리자-직접가입.md` (구 요청 06).** 이 절의 어떤 것도 `schema.prisma`·`schema.dbml`·`openapi.yaml` 에 아직 반영하지 않았습니다. 열린 질문(§14.17)의 답은 **요청서 18 의 표**에 있고, **반영은 요청서 18 을 처리할 때** 합니다 — 이 절의 제안 내용은 그때까지 그대로 둡니다 *(2026-10-13 제안 · 2026-10-21 개정 — 혼자 개발 체제. 원래 표시는 "제안 — 협업자 확인 대기 (2026-10-13)" 였습니다)* |
| **요구사항 출처** | `docs/features/requests/2026-10-12-06-병원관리자-직접가입.md` (**2026-10-21 에 `2026-10-21-18-병원관리자-직접가입.md` 로 대체됨 — 지금 기준은 18 번입니다**), 사용자 확정 사항(2026-10-13, 아래), `docs/decisions/0001-roles-and-pii.md` **결정 2(변경 대상)** |
| **새 테이블** | **1개** — `uploaded_files` (사업자등록증. 요청 07 의 병원 사진도 같은 테이블을 쓴다) |
| **새 컬럼** | `hospitals` **8개**, `hospital_admins` **1개**. 기존 컬럼 **3개의 기본값 변경** |
| **바뀌는 것** | 순수 함수 +5 (`hospital/visibility.ts`·`hospital/approval.ts`·`auth/agreements.ts`·`upload/access.ts`) · 인덱스 +4 · `legal_documents.slug` 에 값 1개 · `audit_logs.action` 에 값 3개 · `audit_logs.target_type` 에 값 1개 |
| **받는 곳** | 이 절 → `docs/decisions/0001` 결정 2 개정 → **interface-master**(계약) → **backend-engineer** (같은 저장소의 `backend/`). 전 과정을 **요청서 18** 에서 진행합니다 *(2026-10-21 개정 — 혼자 개발 체제. 원래는 "백엔드(협업자 영역)")* |

**사용자가 확정한 것 (2026-10-13)** — 이 절 전체의 전제입니다.

1. 방식은 **직접 가입 + 승인 대기**다 (초대 코드가 아니다). **결정 2 를 바꾸는 일이다**
2. 개발 단계에서는 **자동 승인**. 운영자 검수 화면은 별도 작업(이번 범위 밖) — **단 데이터는 그것을 받칠 수 있어야 한다**
3. 승인 전: **관리자 화면은 쓴다. 환자 앱에는 병원이 노출되지 않는다**
4. 사업자등록증 파일의 저장·열람 권한은 **운영자만**

1·2차는 테이블을, 3차는 컬럼을, 4차는 숫자의 모집단을 설계했습니다.
**5차가 설계하는 것은 "아직 공개되지 않은 행" 이라는 상태**입니다. 지금까지 `hospitals` 에 행이 있다는
것은 곧 환자가 볼 수 있다는 뜻이었습니다(`deleted_at IS NULL` 하나가 전부). 그 등식이 깨집니다 —
**행은 있는데 보이면 안 되는 병원**이 생기고, 그 판정이 빠진 질의 한 곳이 곧 "승인 안 난 병원이 앱에
떴다" 는 사고입니다. 그래서 이 절에서 가장 긴 것이 §14.4(노출 판정이 걸리는 자리 전부)입니다.

### 14.1 승인 상태를 어디에 두나 — `hospitals` 컬럼 5개, **이력 테이블은 만들지 않는다**

선택지는 셋이었습니다.

| 안 | 판단 |
|---|---|
| `hospitals` 에 상태 컬럼 | **채택** |
| `hospital_approvals` 이력 테이블 + `hospitals` 에 캐시 컬럼 (`doctor_verifications` 패턴) | 기각 |
| 별도 1:1 테이블 (`hospital_approval_states`) | 기각 |

**`doctor_verifications` 패턴을 따르지 않은 이유.** 그 테이블이 존재하는 이유는 **재검수 강제**입니다 —
전문의가 `specialty` 나 자격증을 바꾸면 `pending` 행이 새로 생겨 승인이 자동으로 풀립니다(§5.8).
병원 승인에는 그런 트리거가 없습니다. 병원 정보를 고쳤다고 해서 승인이 풀리지 않습니다
(**사업자등록증이 바뀌면 풀려야 하는가** 는 미결로 남깁니다 — §14.17-3).
트리거가 없으면 이력 테이블이 답하는 질문은 "누가 언제 승인했는가" 하나뿐이고,
**그 질문은 `audit_logs` 가 이미 받는 질문**입니다. `partner_inquiries` 에 심사 이력 테이블을 만들지
않은 것과 같은 판단입니다(§11.4 — "같은 사실을 두 곳에 두면 어긋나고, 어느 쪽이 진실인지 판단할
근거가 없어집니다"). 심사 이력을 **보여주는 화면**이 요구되는 날 이력 테이블을 만들면 되고,
그때는 `audit_logs` 의 `hospital.approve` 행이 이미 그 데이터입니다.

```prisma
model Hospital {
  // ── §14 제안: 승인 (5개) ─────────────────────────────────────────
  /// HospitalApprovalStatus: pending | approved | rejected
  /// 공개 노출 판정은 이 값 단독이 아니라 isPubliclyListed() 다 (§14.4)
  approvalStatus String @default("pending") @map("approval_status")

  /// 이 승인이 어디서 왔는가: operator | auto | migrated.  pending 이면 null
  ///   operator = 사람이 검수했다 (approval_decided_by_user_id 가 함께 채워진다)
  ///   auto     = 개발 단계 자동 승인 플래그 (§14.11). **행위자가 없다**
  ///   migrated = 이 마이그레이션 이전부터 있던 병원 (§14.3)
  approvalSource String? @map("approval_source")

  /// 결정 시각. 자동 승인도 "언제 결정됐는가" 는 사실이므로 채운다
  approvalDecidedAt DateTime? @map("approval_decided_at")

  /// 결정한 운영자. **nullable 이지만 Restrict** — auto·migrated 는 null 이 정상이고,
  /// 값이 들어간 뒤에는 그 사용자를 물리 삭제할 수 없다
  /// (doctor_verifications.reviewed_by_user_id·audit_logs.actor_user_id 와 같은 정책 — §11.7)
  approvalDecidedByUserId String? @map("approval_decided_by_user_id")

  /// 반려 사유. status='rejected' 면 필수다 (앱 검증).
  /// partner_inquiries.review_note 와 같은 성격이고, **오늘은 쓰는 경로가 없다** (§14.17-1)
  approvalNote String? @map("approval_note")
}
```

**값은 셋입니다.** `suspended`(노출 중단)를 만들지 않았습니다 — 요구한 화면이 없고, 운영상 내리는
수단은 `deleted_at`(soft delete)이 이미 있습니다. 값을 늘리는 것은 나중에도 **문자열 하나**이고,
노출 판정을 `=== 'approved'` 로 적어 두면 값이 늘어도 판정은 저절로 안전한 쪽입니다
(`!== 'rejected'` 로 적으면 그렇지 않습니다 — **이 절의 판정식을 부정형으로 쓰지 마세요**).

### 14.2 가입 폼이 요구하는 컬럼 3개 — `phone`·`phone_digits`·`address_detail`

승인과 무관하지만 같은 마이그레이션에 들어갑니다. **`hospitals` 에 전화번호 컬럼이 아예 없습니다**
(fixture 에도 없습니다 — 지금 병원 상세에 전화번호가 보이지 않는 이유입니다).

```prisma
model Hospital {
  /// 치과 대표번호. 표시용 원본 ('02-1234-5678'). 형식 검사는 앱 (consult_requests.phone 과 같은 완화 패턴)
  phone String? @map("phone")
  /// 숫자만 남긴 값 ('0212345678'). 중복 가입 후보 조회용 (§14.9).
  /// consult_requests.phone_digits 와 같은 정규화 규칙이다 (§12.5)
  phoneDigits String? @map("phone_digits")
  /// 상세 주소 ('3층 301호'). address 는 주소 검색이 돌려준 도로명/지번 그대로 둔다
  addressDetail String? @map("address_detail")
}
```

**셋 다 nullable 입니다.** 기존 병원 11곳에 넣을 값이 없고, 운영자가 만드는 병원(`POST /hospitals`)도
오늘은 전화번호를 받지 않습니다. 없는 값을 `''` 로 채우면 "입력 안 함" 과 "빈 문자열로 입력함" 이
구분되지 않습니다.

**`address` 를 쪼개지 않고 `address_detail` 을 더한 이유**: 주소 검색 UI 가 돌려주는 것은 한 덩어리이고,
다시 검색하면 그 값이 통째로 교체됩니다. 상세 주소를 같은 칸에 이어 붙이면 재검색 때 사라집니다.
표시용 합치기는 순수 함수 하나입니다 — `formatAddress(address, addressDetail)`.

**`region` 은 받지 않고 파생합니다.** 가입 폼에 지역 칸이 없는데 `hospitals.region` 은 NOT NULL 입니다.
주소 검색이 **서버 경유**(`docs/api/README.md` §10)이므로 카카오 응답의 `region_2depth_name`(`강남구`)을
그대로 쓸 수 있습니다. 응답에 없으면 주소 문자열에서 뽑습니다(`regionOf`). **이 값이 비면 탐색의
지역 표시가 깨지므로, 주소 검색 응답에 지역이 포함되는지가 interface-master 확인 항목입니다.**

### 14.3 기본값과 마이그레이션 — **기본값은 닫고, 백필은 연다**

```sql
-- 1) 컬럼 추가. 기본값은 '닫힌 쪽'
ALTER TABLE hospitals ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending';
-- 2) 같은 마이그레이션에서 기존 행만 '열린 쪽'으로 백필
UPDATE hospitals SET approval_status = 'approved', approval_source = 'migrated';
```

두 줄이 **반대 방향인 것이 의도**입니다.

- **기본값이 `pending`** — 새 행을 만드는 코드가 이 필드를 빠뜨리면 **병원이 안 보입니다.** 반대로
  기본값이 `approved` 면 빠뜨렸을 때 **검수 안 받은 병원이 환자에게 보입니다.** 실수의 대가가 한쪽은
  "문의 한 건", 다른 쪽은 "검증 없이 노출된 의료기관" 입니다. 실패는 닫히는 쪽으로 해야 합니다.
- **백필은 `approved`** — 기존 병원 11곳을 `pending` 으로 두면 마이그레이션 직후 **앱 전체가 빈 화면**이
  됩니다(홈·탐색·검색·지도·꿀팁 관련 병원이 전부 0건). 이 11곳은 운영자가 넣은 데이터이므로
  검수 대상이 아닙니다. `approval_source='migrated'` 가 "사람이 승인한 것이 아니라 이관된 행" 임을
  남깁니다 — `approval_decided_at`·`approval_decided_by_user_id` 는 **null 로 둡니다**
  (없는 결정을 지어내지 않습니다. `doctor_verifications` 시드 행이 null 인 것과 같습니다).

**운영자가 만드는 병원(`POST /hospitals`)은 `approved` 를 명시해서 씁니다** — 기본값에 기대지 않습니다.
운영자가 만든 병원은 이미 검수를 거친 것이고(결정 2 의 흐름), 그 경로를 `pending` 으로 두면
운영자가 자기가 만든 병원을 자기가 다시 승인해야 합니다. `approval_source='operator'`,
`approval_decided_by_user_id` = 그 운영자입니다.

**상태 전이**

```
            (가입: 자동 승인 OFF)          (운영자 승인)
  (없음) ───────────────────────→ pending ─────────────→ approved
     │                                │                     ↑
     │  (가입: 자동 승인 ON §14.11)     │ (운영자 반려,        │ (운영자 승인)
     │  (운영자 POST /hospitals)       │  approval_note 필수) │
     └────────────────────────────────┼──────────→ rejected ┘
                                      ↑                 │
                                      └─────────────────┘
                                       (재제출 — 화면 없음, §14.17-1)
```

| 전이 | 오늘 쓰는 경로 | 기록 |
|---|---|---|
| → `pending` (신규) | 가입 (자동 승인 OFF) | `hospitals.created_at` |
| → `approved` (신규) | 가입 (자동 승인 ON), `POST /hospitals` | `approval_source` |
| `pending` → `approved`/`rejected` | **없음** (검수 화면이 범위 밖) | `audit_logs` `hospital.approve`/`hospital.reject` |
| `rejected` → `pending` | **없음** (재제출 화면이 없음) | 〃 |
| `approved` → 무엇이든 | **전이 없음** | 승인 취소는 `deleted_at` 이다 (§14.1) |

전이 검증은 **앱의 순수 함수**입니다(§14.13). DB `CHECK` 를 쓰지 않는 이유는 §3.1·§11.4 와 같습니다 —
전이는 이전 값을 알아야 해서 CHECK 로 표현할 수 없습니다.

### 14.4 "앱에 노출되지 않음" 의 정확한 범위 — 판정 **하나**와 그것이 걸리는 자리 **전부**

요청서의 문장은 "승인 전에는 관리자 화면은 쓰되 앱에 병원이 노출되지 않음" 한 줄입니다.
그 한 줄이 실제로 걸리는 질의가 아래 전부입니다. **이 표가 이 절의 핵심 산출물입니다.**

```ts
// hospital/visibility.ts — 판정은 여기 하나뿐이다
export const isPubliclyListed = (h: { approvalStatus: string; deletedAt: Date | null }) =>
  h.deletedAt === null && h.approvalStatus === 'approved';

// 같은 판정의 질의 표현. 두 표현이 갈리지 않는지 테스트가 고정한다 (아래 경고)
export const PUBLICLY_LISTED_WHERE = { deletedAt: null, approvalStatus: 'approved' } as const;
```

> **`deleted_at` 을 판정에 함께 넣은 것이 중요합니다.** 사이드 메뉴 배지(`승인 완료 · 앱 노출 중`)가
> `approval_status === 'approved'` 만 보면, **soft delete 된 병원이 "앱 노출 중" 이라고 말합니다.**
> 배지와 질의가 **같은 함수**를 써야 하는 이유이고, AGENTS.md 의 "같은 판정을 두 곳에 두지 않는다" 가
> 가리키는 바로 그 상황입니다(병원 카드 배지와 전문의 목록 배지가 갈렸던 사고와 같은 모양).

| 자리 | 지금 조건 | 바뀐 뒤 | 미승인 병원은 |
|---|---|---|---|
| 병원 목록·탐색·카테고리(시술 칩)·정렬 | `hospital.filters.ts:23` `{ deletedAt: null }` | `PUBLICLY_LISTED_WHERE` | 안 나옴 |
| 지도(bounds 질의) | 같은 함수가 만든다 | 〃 (자동) | 안 나옴 |
| 검색(`q`, 검색 resolve, 추천 병원) | 같은 함수 + `hospital.service.ts:113` | 〃 | 안 나옴 |
| 홈 추천(`is_recommended`)·꿀팁 관련 병원(`guide_hospitals`) | 조인만 | 조인 대상에 〃 | 안 나옴 |
| 광고 노출(`hospital_sponsorships`) | 기간 판정 | 병원 조인에 〃 | 안 나옴 (**미승인 병원의 광고 행은 존재할 수 없지만, 질의는 막는다**) |
| **전문의 목록·검색·의사 모드** | `doctor.filters.ts:38` `hospital: { deletedAt: null }` | `hospital: PUBLICLY_LISTED_WHERE` | **소속 전문의가 통째로 안 나옴** |
| 전문의 상세 직접 링크 | `doctor.repository.ts:96` | 공개 시야면 `404 DOCTOR_NOT_FOUND` | 못 봄 |
| **병원 상세 직접 링크** | `hospital.repository.ts:32` | 공개 시야면 **`404 HOSPITAL_NOT_FOUND`** | 못 봄 (아래) |
| 찜 목록(`/me/favorites`) | 조인 | 조인에 〃. **행은 지우지 않는다** | 목록에서 빠짐 |
| 찜 토글 | — | 상세와 같은 판정 → `404` | 못 함 |
| 상담 신청(`POST /consult-requests`) | 병원 존재 확인 | 상세와 같은 판정 → `404` | 못 함 |
| 병원 문의(`hospital_inquiries` — 아직 테이블 없음) | — | 공개 Q/A 목록·문의 작성 모두 같은 판정 | 못 함 |
| 후기 목록·이벤트(`promotions`) | 병원 범위 | 병원 조인에 〃 | 안 나옴 |

**병원 상세를 `404` 로 하는 이유 — `docs/api/README.md` §3 의 "병원 존재는 공개 정보" 와 모순이 아닙니다.**
그 규칙이 말하는 것은 **이미 공개된 병원**의 존재입니다. 승인 전 병원은 아직 공개 자원이 아니고,
`403` 을 주면 "이 id 에 심사 중인 병원이 있다" 가 새어 id 대입으로 입점 준비 중인 병원 목록을 셀 수
있습니다. `deleted_at` 이 설정된 병원을 `404` 로 다루는 것과 같은 취급입니다.

**판정을 적용하지 않는 자리 (관리 시야)** — 여기에 적용하면 요청서의 "관리자 화면은 쓴다" 가 깨집니다.

- `/admin` 대시보드 집계 전부(§13), `GET /admin/hospitals`, 병원 정보 조회·수정, 전문의 등록·수정,
  진료시간·태그·시술 저장, 완성도 계산
- 운영자의 전 병원 목록·전문의 검수 큐 (**미승인 병원의 전문의도 검수 큐에 뜹니다** — 검수는 운영자
  시야이고, 전문의 배지는 어차피 공개 화면에서만 의미가 있습니다)
- 알림함 (승인 결과 알림이 바로 이 병원 앞으로 갑니다)

그래서 `GET /hospitals/{id}` 는 **시야가 둘인 유일한 오퍼레이션**이 됩니다:

```ts
// 공개 시야에서 숨고, 관리 시야에서 보인다
const visible = isPubliclyListed(h)
  || viewer?.role === 'operator'
  || viewer?.managedHospitalIds.includes(h.id);   // canViewHospitalPrivately()
```

### 14.5 가입 한 번에 생기는 행 — **트랜잭션 하나, 파일 메타행만 밖**

토글을 켠 가입 1회가 만드는 행:

| # | 테이블 | 값 |
|---|---|---|
| 1 | `users` | `role='hospital_admin'`, `provider='email'`, 이메일 정규화·비밀번호 해시 |
| 2 | `hospitals` | `approval_status` = §14.11 의 판정값, 이름·대표번호·주소·좌표·상세주소·`region`(파생)·`name_normalized` |
| 3 | `hospital_admins` | `(user_id, hospital_id)` + `position`(직책) |
| 4 | `uploaded_files` | 사업자등록증 **메타행의 주인 확정**(`hospital_id`·`uploaded_by_user_id` UPDATE) |
| 5 | `user_agreements` | 4행 (`terms`·`privacy`·`location`·`partner-terms`) |

**1·2·3·4·5 는 한 트랜잭션입니다** (`prisma.$transaction`). 중간 실패 시 어중간한 상태의 예:

- 1만 성공 → `hospital_admin` 인데 담당 병원이 0곳. 관리자 화면에 들어와 빈 목록만 보는 상태입니다
  (`docs/api/README.md` §3 이 담당자 해제 때 `role` 을 되돌리는 바로 그 이유)
- 1·2 성공, 3 실패 → **주인 없는 병원 행**. 아무도 고칠 수 없고 운영자가 수동으로 담당자를 붙여야 합니다
- 1·2·3 성공, 5 실패 → **동의 없이 가입된 계정** (§11.3 의 "가입과 동의는 같은 트랜잭션")

**파일 바이트는 트랜잭션에 참여할 수 없습니다.** 객체 저장소 쓰기는 롤백되지 않으므로, 업로드는
가입 요청 **전에** 끝나고(§14.7), 트랜잭션 안에서는 **메타행을 claim** 할 뿐입니다. 방향이 한쪽으로만
깨집니다 — 가입이 실패하면 **주인 없는 파일**이 남고(배치가 지웁니다), 반대로 "가입은 됐는데 파일이
없다" 는 일어나지 않습니다. claim 은 조건부 UPDATE 입니다:

```ts
// 트랜잭션 안. 이미 주인이 있는 파일(남의 업로드 id 추측)이면 0건 → 전체 롤백
const claimed = await tx.uploadedFile.updateMany({
  where: { id: dto.businessRegistrationFileId, purpose: 'business_registration',
           hospitalId: null, uploadedByUserId: null, purgedAt: null },
  data:  { hospitalId, uploadedByUserId: userId },
});
if (claimed.count !== 1) throw new UnprocessableEntity('UPLOAD_NOT_FOUND');
```

**재시도 멱등성은 `users.email` 유니크가 줍니다.** 같은 폼을 두 번 제출하면 두 번째는 `409`
(`EMAIL_TAKEN`)에서 멈추고 병원 행이 두 개 생기지 않습니다 — 별도 중복 방지 규칙이 필요 없는 이유입니다
(§14.9).

> SQLite 의 쓰기 트랜잭션은 직렬화됩니다. 가입 트랜잭션 안에서 **외부 호출(주소 검색·파일 저장소)을
> 하지 마세요** — 트랜잭션이 네트워크 지연만큼 DB 를 잠급니다. 좌표는 요청 본문으로 이미 와 있고,
> 파일은 이미 저장돼 있습니다.

### 14.6 직책 — `hospital_admins.position`

```prisma
model HospitalAdmin {
  /// AdminPosition: director | manager | coordinator | etc   (대표원장 | 실장 | 코디네이터 | 기타)
  /// null = 운영자가 지정한 담당자 (POST /hospitals/{id}/admins 에는 직책 입력이 없다)
  position String? @map("position")
}
```

**`users` 가 아니라 `hospital_admins` 인 이유**: 직책은 사람의 속성이 아니라 **그 병원에서의 역할**입니다.
`hospital_admins` 는 M:N 이므로(결정 1) 한 사람이 A 병원 대표원장이면서 B 병원 코디네이터일 수 있고,
`users` 에 두면 두 번째 담당 병원이 생기는 순간 둘 중 하나가 거짓이 됩니다. 담당자 해제 시 직책이
함께 사라지는 것도 맞는 동작입니다(행이 사라집니다).

**값은 코드로 저장합니다** (`director`/`manager`/…). `doctors.specialty` 가 한글을 저장하는 것과 다른
선택인데, 그쪽은 **법으로 정해진 자격 명칭**이라 라벨이 곧 값입니다. 직책은 표시 문구가 바뀔 수 있고
(`대표원장`→`원장`), 그때 과거 행의 값을 UPDATE 하게 되면 "그때 뭐라고 적었는가" 가 사라집니다.
`consult_status_changes.cancel_reason`(`no_answer`·`etc` …)과 같은 처리입니다.
**라벨 매핑은 한 곳**(프런트 상수 또는 투영)이고, `기타`→`etc` 역시 그 선례를 따릅니다.

사이드 메뉴 하단은 이 값과 §14.4 의 판정을 함께 씁니다: `{직책 라벨} · {승인 완료 · 앱 노출 중 | 승인 대기}`.
`position` 이 null 이면 직책 줄을 생략합니다(지어내지 않습니다).

### 14.7 사업자등록증 — `uploaded_files` 하나로 요청 07 까지 받는다

서버에 파일 업로드가 아직 없습니다. **요청 07(병원 사진 업로드)이 같은 기반을 쓸 예정**이므로
공용으로 설계하되, **07 의 필드는 만들지 않습니다.**

```prisma
/// ★ 업로드된 파일의 메타데이터. **바이트는 여기 없다** — 저장소는 storage_key 뒤에 숨는다.
/// 공용 테이블이다: 지금 purpose 는 1종이고, 요청 07 이 'hospital_photo' 를 더한다.
model UploadedFile {
  id String @id

  /// FilePurpose: business_registration
  /// (요청 07 에서 hospital_photo 추가 예정 — **지금 만들지 않는다**)
  /// 접근 통제·보관 기간이 전부 이 값에서 파생된다 (canReadFile / retentionOf)
  purpose String

  /// 저장소 키. 로컬 디스크면 상대 경로, 객체 저장소면 object key.
  /// **저장소 종류 컬럼을 두지 않았다** — 한 배포에 백엔드는 하나이고 설정값이다.
  /// UNIQUE: 두 행이 같은 키를 가리키면 한쪽을 파기할 때 다른 쪽이 깨진 행이 된다
  storageKey String @unique @map("storage_key")

  /// 사용자가 올린 원본 파일명. 관리자 화면이 '사업자등록증.pdf 제출 완료' 로 보여준다
  originalName String @map("original_name")
  /// image/jpeg | image/png | application/pdf (앱 검증. 확장자가 아니라 실제 타입으로 판정)
  contentType String @map("content_type")
  byteSize    Int    @map("byte_size")

  /// 어느 병원의 파일인가. **가입 전 업로드라 처음에는 null** 이고 가입 트랜잭션이 채운다 (§14.5)
  hospitalId String? @map("hospital_id")
  /// 올린 사람. 위와 같은 이유로 nullable. Restrict — 업로더가 사라지면 "누가 제출했는가" 가 사라진다
  uploadedByUserId String? @map("uploaded_by_user_id")

  createdAt DateTime @map("created_at")

  /// 원본 바이트를 파기한 시각. 파기는 행 삭제가 아니다 (아래).
  /// partner_inquiries.pii_purged_at 과 같은 성격이고, **보존 기간은 컬럼으로 굳히지 않는다**
  purgedAt DateTime? @map("purged_at")

  hospital   Hospital? @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  uploadedBy User?     @relation(fields: [uploadedByUserId], references: [id], onDelete: Restrict)

  @@index([hospitalId, purpose])
  @@index([purpose, createdAt])
  @@map("uploaded_files")
}
```

**접근 통제는 컬럼이 아니라 `purpose` 에서 파생합니다.**

```ts
// upload/access.ts — 순수 함수
export const canReadFile = (purpose: string, viewerRole?: string) =>
  purpose === 'business_registration' ? viewerRole === 'operator' : true;
```

- **운영자만입니다. 올린 본인(담당 병원 `hospital_admin`)도 다시 내려받을 수 없습니다** — 요청서의
  "저장·열람 권한을 운영자로 제한" 그대로입니다. 관리자 화면은 파일명과 `제출 완료` 만 보여주고
  링크를 걸지 않습니다
- **공개 URL 을 발급하지 않습니다.** `hospital_images.url` 처럼 URL 문자열을 어딘가에 저장하는 순간
  그 URL 을 아는 사람 전부가 열람자가 됩니다. 접근은 오퍼레이션(`operator` 전용)을 통해서만 하고
  응답은 `Cache-Control: no-store` 입니다
- **열람은 감사 대상입니다** — `audit_logs.action='hospital_document.view'`,
  `target_type='uploaded_file'`, `pii_masked=false`(마스킹하지 않은 개인정보를 봤다).
  `partner_inquiry.view` 와 같은 취급입니다

**보관·파기** (기간은 설정값. §11.4 와 같이 컬럼으로 굳히지 않습니다):

| 대상 | 조회 조건 | 기본 제안 |
|---|---|---|
| 고아 파일 (가입 미완료) | `hospital_id IS NULL AND created_at < cutoff AND purged_at IS NULL` | **24시간** |
| 반려된 병원의 서류 | 병원 `approval_status='rejected'` + 결정 후 N일 | **30일** (반려 입점 문의와 함께 정한다 — §11.8-2) |
| 승인·대기 중인 병원의 서류 | — | **병원이 살아 있는 동안 보관** (입점 계약 근거. `approved` 입점 문의와 같은 기본값) |
| soft delete 된 병원의 서류 | `hospitals.deleted_at` + N일 | 미결 |

파기 = **저장소 객체 삭제 + `purged_at` 세팅**. 행은 남깁니다 — `audit_logs` 가 `target_id` 로 이
파일을 가리키고 있어서, 행을 지우면 "대상 없는 열람 기록" 이 됩니다(§11.4 와 같은 논리).

**`hospital_images` 를 고치지 않았습니다.** 그 테이블은 공개 URL 문자열이고 접근 통제가 없습니다.
요청 07 에서 사진이 파일 업로드가 되면 `hospital_images` 가 `uploaded_files` 를 참조하게 될 수 있지만,
**그 컬럼은 07 이 만듭니다.** 지금 만들면 소비자가 없는 FK 가 됩니다.

> **→ §16.5 가 그 컬럼을 정했습니다** — `hospital_images.uploaded_file_id`(nullable·UNIQUE) 와
> `purpose` 값 `hospital_photo` 하나입니다. **순서(`sort_order`)·대표는 `uploaded_files` 가 아니라
> `hospital_images` 가 들고 있습니다** — §14.15 가 "07 이 만든다" 고 적어 둔 두 필드를 07 은
> 파일 테이블에 만들지 않습니다(이유는 §16.5). `canReadFile` 도 **그대로입니다** — 이미
> `business_registration` 이 아니면 공개라서, 병원 사진은 함수를 고치지 않고 들어옵니다.

### 14.8 `[필수] 병원 파트너 이용약관` — 문서를 늘리고, **필수성은 가입 경로가 정한다**

```
legal_documents.slug: terms | privacy | location | about | partner-terms   ← 값 1개 추가
시드 1행: partner-terms / 1.0 / requires_agreement = true
```

**`legal_documents` 에 "누구에게 필수인가" 컬럼을 만들지 않았습니다.** `is_required_for='hospital_admin'`
같은 컬럼은 문서에 대상자를 박아 넣는 것인데, 필수성은 **문서의 성질이 아니라 가입 경로의 성질**입니다
(같은 약관이 나중에 일반 사용자에게도 필수가 될 수 있고, 그때 문서 행을 UPDATE 하면 §11.3 이 지키려던
불변성이 깨집니다). 대신 순수 함수 하나입니다:

```ts
// auth/agreements.ts
export type SignupKind = 'user' | 'hospital_admin';
export const requiredAgreementSlugs = (kind: SignupKind) =>
  kind === 'hospital_admin'
    ? ['terms', 'privacy', 'location', 'partner-terms'] as const
    : ['terms', 'privacy', 'location'] as const;
```

가입 요청의 `agreedTermsVersions` 를 이 목록과 대조해 **부족하면 `422`**, 없는 버전이면 `422`(§11.3).
토글을 끈 일반 가입에 `partner-terms` 가 섞여 오면 그것도 `422` 입니다 — 동의할 이유가 없는 약관에
동의한 기록을 만들지 않습니다.

> **놓치기 쉬운 것: 재동의 계산도 같은 함수로 좁혀야 합니다.** §11.3 의 재동의 판정은
> "`requires_agreement=true` 인 최신 시행 버전 중 내가 동의하지 않은 것" 인데, 그대로 두면
> **전 일반 사용자에게 `병원 파트너 이용약관` 재동의 팝업이 뜹니다.** 대상 slug 집합을 먼저
> `requiredAgreementSlugs(사용자의 역할)` 로 좁힌 뒤 미동의를 찾아야 합니다. 이 한 줄이
> 새 slug 를 추가하면서 생기는 유일한 회귀 위험입니다.

담당자로 **승격**되는 경로(`POST /hospitals/{id}/admins`)는 어떻게 하나 — 그 사람은 파트너 약관에 동의한
적이 없습니다. 위 재동의 계산이 그대로 답합니다: 담당 병원이 생긴 순간 `partner-terms` 가 대상 집합에
들어오고 동의 행이 없으므로 **다음 로그인에서 동의 대상으로 계산됩니다.** 별도 처리가 필요 없습니다.

### 14.9 같은 병원이 두 번 가입하는 경우 — **막지 않는다. 다만 찾을 수 있게 둔다**

**하드 차단을 만들지 않습니다.**

- **같은 주소에 치과가 둘 있습니다** (한 건물 2·3층). 주소 문자열 일치로 막으면 정상 가입이 막힙니다
- **같은 대표번호를 분원이 공유합니다.** 이전 개원으로 번호가 승계되기도 합니다
- **폼 중복 제출은 이미 막혀 있습니다** — 가입이 한 트랜잭션이고 `users.email` 이 유니크라
  두 번째 제출은 `409` 입니다(§14.5). "실수로 두 번" 의 압도적 다수가 이 경우입니다
- 남는 것은 **실제로 같은 병원을 두 사람이 등록한 경우**인데, 그것은 차단이 아니라 **검수의 일**입니다.
  차단하면 두 번째 사람은 아무 안내도 받지 못한 채 가입에 실패합니다

**대신 운영자가 찾을 수 있게만 둡니다** — `phone_digits` 컬럼과 그 인덱스(§14.2·§14.14).
검수 화면이 생길 때 "같은 대표번호의 병원이 이미 있습니다" 를 **경고로** 띄울 수 있습니다.

```ts
// 차단이 아니라 검수 보조. 결과가 있어도 가입은 진행된다
where: { phoneDigits, deletedAt: null, NOT: { id: hospitalId } }
```

`hospitals.address` 에는 인덱스를 만들지 않았습니다 — 중복 판정이 부분일치여야 의미가 있는데
앞쪽 와일드카드는 B-tree 를 타지 못하고(§6.2), 근접 판정은 좌표로 하는 편이 정확합니다.
그 질의를 쓰는 화면이 아직 없으므로 지금 인덱스를 거는 것은 추측입니다(§13.9 와 같은 기준).

### 14.10 `partner_inquiries` 와의 관계 — **공존. 대체하지 않는다**

| | 입점 문의 (`partner_inquiries`) | 직접 가입 (§14) |
|---|---|---|
| 누가 | 비로그인. 계정이 없다 | 가입하는 본인 |
| 무엇이 남나 | 연락처와 문의 내용 **한 행** | 계정·병원·담당자·서류·동의 **다섯 종류** |
| 의도 | "얘기부터 들어보고 싶다" | "지금 등록하겠다" |
| 운영자가 하는 일 | 심사 후 **연락** | **서류 검수** 후 승인/반려 |

**결정 2 에서 바뀌는 것은 "입점 문의가 병원 생성의 _유일한_ 경로" 라는 부분**이지, 문의 폼을 없애는
것이 아닙니다. 문의는 가입 의사가 없는 사람도 쓰는 입구이고, 테이블·심사 흐름이 이미 설계돼 있습니다(§11.4).

**최소 규칙 둘:**

1. **직접 가입은 `partner_inquiries` 행을 만들지 않습니다.** 문의가 아닙니다. 두 큐에 같은 건이
   두 번 뜨면 운영자가 같은 병원을 두 번 심사합니다
2. 같은 병원이 문의도 하고 직접 가입도 한 경우, 운영자가 **기존 컬럼** `partner_inquiries.linked_hospital_id`
   로 연결합니다. 그 컬럼이 이미 "이 병원이 어느 문의에서 왔는가" 를 위해 nullable 로 설계돼 있습니다 —
   **스키마 변경 0** 입니다

> 운영자의 **대기 큐가 두 개**가 됩니다(문의 심사 + 병원 승인 검수). 그 둘을 한 화면에서 볼지
> 나눌지는 운영자 콘솔 설계의 몫이고(결정 0001 미결 1), 데이터는 양쪽을 다 받습니다.
> `/partner-inquiry` 화면을 남길지 접을지도 제품 결정입니다 — 두 입구가 같은 의도를 받으면
> 사용자가 어디로 가야 할지 모릅니다 (§14.17-5).

### 14.11 개발 단계 자동 승인 — 설정 플래그 + `approval_source='auto'`

```
HOSPITAL_AUTO_APPROVE   (dev 기본 true / prod 기본 false)
```

```ts
// hospital/approval.ts — 순수 함수. DB 도 env 도 모른다. 플래그를 인자로 받는다
export function approvalOnSignup(autoApprove: boolean, now: Date) {
  return autoApprove
    ? { approvalStatus: 'approved', approvalSource: 'auto',  approvalDecidedAt: now,  approvalDecidedByUserId: null }
    : { approvalStatus: 'pending',  approvalSource: null,    approvalDecidedAt: null, approvalDecidedByUserId: null };
}
```

**`approval_source` 컬럼이 있어야 하는 이유가 여기입니다.** `approval_decided_by_user_id = null` 만으로는
세 가지가 구분되지 않습니다 — ① 자동 승인 ② 이관된 기존 병원 ③ 아직 결정 없음. 운영 전환 시
**반드시 해야 하는 질의가 "플래그가 켜진 채로 자동 승인된 병원 찾기"** 이고, 그 질의가
`approval_source='auto'` 입니다. (플래그를 켠 채 배포하는 것이 이 설계에서 가장 흔한 사고입니다.)

**자동 승인은 `audit_logs` 에 남기지 않습니다.** `audit_logs.actor_user_id` 는 NOT NULL + Restrict 이고,
자동 승인에는 **행위자가 없습니다.** 가짜 시스템 계정을 만들어 넣으면 "행위자" 라는 컬럼의 의미가
무너지고, `actor_role` 스냅샷도 거짓이 됩니다. 사실을 그대로 적는 자리는 `approval_source` 입니다.
사람이 한 승인·반려만 `hospital.approve`/`hospital.reject` 로 남습니다.

**가입 응답과 알림**: 자동 승인이어도 완료 화면 문구는 요청서대로 둡니다(승인 결과 안내).
승인 결과 알림은 기존 `notifications`(`audience='admin'`, `hospital_id`, `type='system'`) 로 충분하고
**새 테이블이 필요 없습니다.** 문자(SMS)는 발송 인프라가 없습니다 — §14.17-6.

### 14.12 이메일 형식 검사 — **이미 있습니다 (확인만)**

요청서의 "지금은 이메일 형식 검사가 없습니다"(24행) 는 **낡은 기술(記述)입니다.**

| 자리 | 지금 | 근거 |
|---|---|---|
| 클라이언트 가입 | ✅ 검사 | `frontend/src/features/auth/schemas/authSchemas.ts` 의 `email` 스키마(`.email()`)를 가입·로그인이 **공유** |
| 클라이언트 로그인 | ✅ 검사 | 〃 |
| 서버 가입 | ✅ 검사 | `backend/src/auth/auth.schemas.ts:21` `.email('이메일 형식이 올바르지 않아요')` |
| 서버 로그인 | ❌ **일부러 안 함** | 같은 파일 46–48행의 주석: 형식으로 거절하면 "짧은/이상한 입력 = 없는 계정" 정보가 새고, 규칙 이전에 만든 계정이 로그인하지 못한다 |

**데이터 설계에 변경 없습니다.** `users.email` 은 이미 `trim().toLowerCase()` 정규화 + UNIQUE 이고(§3.9),
그 규칙이 가입·로그인 양쪽에서 같습니다. 서버 로그인의 미검사는 **의도된 것이므로 고치지 않습니다** —
요청서의 "로그인에도 형식 검사" 는 클라이언트에서 이미 충족됩니다.

### 14.13 판정 규칙 — 순수 함수 다섯 묶음

AGENTS.md 의 "규칙은 DB 도 요청도 모르는 순수 함수" 를 따릅니다. **DB 없이 경계값을 테스트할 수
있어야 하는 것들**이고, 각 함수가 이 절의 질문 하나에 대응합니다.

| 파일 | 함수 | 답하는 질문 |
|---|---|---|
| `hospital/visibility.ts` | `isPubliclyListed(h)` · `PUBLICLY_LISTED_WHERE` · `canViewHospitalPrivately(h, viewer)` | 누구에게 보이나 (§14.4) |
| `hospital/approval.ts` | `canTransition(from, to)` · `requiresNote(to)` · `approvalOnSignup(autoApprove, now)` | 어떤 전이가 되나 (§14.3·§14.11) |
| `auth/agreements.ts` | `requiredAgreementSlugs(kind)` | 어떤 약관이 필수인가 (§14.8) |
| `upload/access.ts` | `canReadFile(purpose, role)` · `retentionOf(purpose, state)` | 누가 파일을 보나, 언제 지우나 (§14.7) |
| `hospital/address.ts` | `formatAddress(a, d)` · `regionOf(kakaoResult)` | 주소·지역 표시 (§14.2) |

> **`isPubliclyListed` 와 `PUBLICLY_LISTED_WHERE` 는 같은 판정의 두 표현입니다.** 한쪽만 고치면
> **목록에서는 사라졌는데 상세는 열리는**(또는 그 반대) 상태가 되고, 그 어긋남은 조용합니다.
> 두 표현을 **같은 파일에** 두고, "판정이 거짓인 행을 where 가 반환하지 않는다" 를 고정하는 테스트를
> 함께 두세요. 함수를 공유할 수 없는 이유(하나는 JS 값, 하나는 Prisma 조건)를 주석에 남깁니다 —
> AGENTS.md 가 요구하는 "공유가 안 되면 그 이유를 주석에" 가 이 경우입니다.

### 14.14 인덱스 — 4개 추가

| 테이블 | 인덱스 | 쿼리 |
|---|---|---|
| `hospitals` | `(approval_status)` | 운영자 검수 대기 목록(`approval_status='pending'`). **공개 목록용이 아닙니다** — 거기서는 선택도가 낮아(거의 전부 `approved`) 풀스캔이 낫습니다(§6.7 의 boolean 과 같은 사정) |
| `hospitals` | `(phone_digits)` | 중복 가입 후보 조회 (§14.9) |
| `uploaded_files` | `(hospital_id, purpose)` | "이 병원의 사업자등록증" 단건 조회, 07 의 "이 병원의 사진" |
| `uploaded_files` | `(purpose, created_at)` | 고아 파일 정리 배치, 보존기간 파기 배치 |
| `uploaded_files` | `storage_key` **UNIQUE** | 같은 키를 두 행이 가리키지 않게 |

**만들지 않은 인덱스**: `hospital_admins(position)`(조회 축이 아닙니다 — 표시용),
`hospitals(approval_source)`(운영 전환 때 한 번 도는 질의라 풀스캔으로 충분합니다),
`uploaded_files(uploaded_by_user_id)`("이 사람이 올린 파일" 화면이 없습니다 — §11.4 와 같은 기준).

### 14.15 만들지 않는 것

| 안 만든 것 | 대신 | 근거 |
|---|---|---|
| `hospital_approvals` 이력 테이블 | `audit_logs` + `hospitals` 컬럼 5개 | 재검수 트리거가 없어 이력의 유일한 소비자가 "누가 승인했나" 뿐 (§14.1) |
| `hospitals.is_visible` / `is_published` boolean | `approval_status` 파생 | 두 값이 갈리면 어느 쪽이 진실인지 알 수 없습니다. 노출은 **승인의 결과**이지 독립 축이 아닙니다 |
| `approval_status` 값 `suspended` | `deleted_at` | 요구한 화면이 없습니다. 값 추가는 나중에도 문자열 하나입니다 |
| `legal_documents.is_required_for` | `requiredAgreementSlugs()` | 필수성은 문서가 아니라 가입 경로의 성질 (§14.8) |
| `hospital_admins.invite_code` (결정 2 의 대안) | — | 직접 가입을 택했으므로 불필요 (결정 문서의 "변경 제안" 절 참고) |
| `uploaded_files.checksum` · `storage_backend` · `width`/`height` | — | 중복 검출·멀티 저장소·썸네일 요구가 없습니다. 이미지 치수는 **요청 07** 이 필요해지면 그때 |
| `uploaded_files` 의 07 전용 필드 (`sort_order`, `is_primary`) | — | **07 이 만듭니다.** 사진 순서·대표 지정은 사진 화면의 요구사항입니다 |
| 사업자등록번호 컬럼 | — | 폼이 **파일**만 받습니다. 번호를 따로 받거나 OCR 로 뽑는 요구가 없습니다. 생기면 `hospitals.business_number` + 유니크 여부를 그때 정합니다(국세청 조회 없이 유니크를 거는 것은 위험합니다) |
| 가입 행위의 `audit_logs` 행 | `hospitals.created_at` 등 | 감사 대상은 **관리자 행위**입니다. 본인이 자기 병원을 만드는 것은 사용자 행위이고, 그 사실은 행 자체에 남습니다 |
| SMS 발송 테이블 | — | 발송 인프라가 없습니다 (§14.17-6) |

### 14.16 백엔드 작업 체크리스트 (요청서 18 에서 처리)

*(2026-10-21 개정 — 혼자 개발 체제. 원래 제목은 "백엔드 인계 체크리스트" 이고, "협업자 확인 후 ①②는 이
문서의 작성자가, ③부터는 협업자 영역" 이라고 적혀 있었습니다. 목록 자체는 그대로 둡니다 — 이제 이것은
**요청서 18 을 처리하는 사람이 보는 목록**입니다.)*

**요청서 18 (`docs/features/requests/2026-10-21-18-병원관리자-직접가입.md`) 을 처리할 때** 아래 순서로
진행합니다. 기다릴 외부 확인은 없습니다. ①②는 db-master·interface-master 가, ③부터는 같은 저장소의
**backend-engineer** 가 맡습니다.

- [ ] ① **결정 0001 의 결정 2 를 개정**한다 (지금은 "변경 제안" 소절까지만 있습니다)
- [ ] ② **interface-master 가 계약을 확정**한다 — `openapi.yaml`, `docs/api/README.md` §3 권한 표·§4 감사 로그 (아래 인계 목록)
- [ ] ③ `schema.prisma` + `docs/database/schema.dbml` 반영
  - [ ] `hospitals` **+8 컬럼**: `approval_status`(NOT NULL, `@default("pending")`), `approval_source`, `approval_decided_at`, `approval_decided_by_user_id`(Restrict), `approval_note`, `phone`, `phone_digits`, `address_detail`
  - [ ] `hospital_admins` **+1 컬럼**: `position`(nullable)
  - [ ] `uploaded_files` **신규 테이블** (+ `User.uploadedFiles`·`Hospital.uploadedFiles` 역방향 필드 — **DDL 변화 0**, §11.7 과 같은 사정)
  - [ ] **기존 컬럼 3개의 기본값 변경** — 아래가 빠지면 **가입 트랜잭션이 NOT NULL 위반으로 실패합니다**
- [ ] ④ **마이그레이션** — `ADD COLUMN ... DEFAULT 'pending'` 직후 **같은 마이그레이션에서**
      `UPDATE hospitals SET approval_status='approved', approval_source='migrated'` (§14.3)
- [ ] ⑤ 노출 판정 적용 — `hospital.filters.ts:23`, `hospital.service.ts:113`, `hospital.repository.ts:32`,
      `hospital.projection.ts:141`, `doctor.filters.ts:38`, `doctor.repository.ts:96`·`103`·`112`·`132`.
      **`{ deletedAt: null }` 을 손으로 쓴 자리를 전부 찾아** 공개/관리 시야 중 어느 쪽인지 판정한다(§14.4)
- [ ] ⑥ 순수 함수 5묶음 + 그 단위 테스트 (§14.13). **`isPubliclyListed` ↔ `PUBLICLY_LISTED_WHERE` 일치 테스트 포함**
- [ ] ⑦ 가입 트랜잭션 (§14.5) + 파일 claim 의 조건부 UPDATE
- [ ] ⑧ 업로드 오퍼레이션 + 저장소 어댑터 + 고아 정리 배치
- [ ] ⑨ 시드 — `legal_documents` 에 `partner-terms/1.0` 1행 추가(§11.3 의 플레이스홀더 원칙 그대로).
      **기존 fixture·시드 병원 11곳의 데이터는 바꾸지 않는다** (마이그레이션 백필이 처리합니다)
- [ ] ⑩ `docs/features/signup.md`·`login.md`·`admin-*.md` 갱신, `known-issues.md` 의
      "메뉴 아래에 담당자 직책과 승인 상태가 없습니다" 줄 해소

**기존 컬럼 3개의 기본값 변경 (④ 의 일부)** — 가입 폼이 주지 않는 NOT NULL 컬럼들입니다.

| 컬럼 | 지금 | 제안 | 근거 |
|---|---|---|---|
| `hospitals.thumbnail` | `String` (기본값 없음, 생성 계약은 `url()` 필수) | **`@default("")`** | `introduction`·`directions` 가 이미 `@default("")` 입니다. §13.7 완성도 항목 4(`비어 있지 않고 기본 이미지가 아님`)가 **빈 문자열을 자연스럽게 '미충족'** 으로 처리합니다. 실제 대표 이미지는 요청 07 의 파일 업로드가 채웁니다 |
| `hospitals.price_min` / `price_max` | `Int` (기본값 없음, 생성 계약 필수) | **`@default(0)`** | `latitude`/`longitude` 가 이미 "둘 다 0이면 미입력" 센티널로 쓰이고 있습니다(§13.7 항목 1). 둘 다 0 이면 화면에 가격대를 **표시하지 않습니다** — `hasPriceRange(min,max)` 한 줄입니다. 07 이 시술별 가격을 가져오면 이 값은 대체값으로 남습니다(요청 07 "기존 가격대는 지우지 말 것") |
| (참고) `hospital_procedures` 0건 | 생성 계약은 `min(1)` | **허용** | §13.7 이 이미 "항목 3은 0개인 병원이 실제로 존재할 수 있습니다" 를 전제합니다. 가입 폼에 시술 선택이 없고, 완성도 바와 `noProcedures` 경고가 그 상태를 가리킵니다 |

> `POST /hospitals`(운영자)의 **계약은 그대로 둡니다** — 운영자는 지금도 세 값을 다 받습니다.
> 기본값은 **가입 경로를 위한 것**이고, 계약을 느슨하게 만드는 변경이 아닙니다.

### 14.17 남은 미결 · 요청자에게 물을 것

> **답: 요청서 18(`2026-10-21-18-병원관리자-직접가입.md`)의 표 — 반영은 그 요청서에서.**
> 아래 질문은 지우지 않고 그대로 둡니다. 이 자리는 **2026-10-13 시점의 열린 질문 기록**이고,
> 답은 요청서 18 에 표로 적혀 있습니다 *(2026-10-21 개정 — 혼자 개발 체제. 원래 제목은
> "남은 미결 · 협업자에게 물을 것" 이었습니다)*.

1. **`rejected` 와 `approval_note` 를 지금 만들 것인가.** 오늘 그 값을 쓰는 코드가 없습니다(검수 화면이
   범위 밖). **지금 만들기를 권합니다** — 값 하나와 nullable 컬럼 하나라 비용이 없고, 노출 판정을
   `=== 'approved'` 로 적어 두면 값이 늘어도 안전합니다. 반대 의견이면 `pending|approved` 둘로 시작해도
   §14.4 는 그대로 성립합니다. **재제출(`rejected → pending`) 화면이 없는 것**은 어느 쪽이든 남는 구멍입니다
2. **업로드를 어떤 모양으로 받을 것인가 (API 결정).** 가입 전이라 **토큰이 없습니다.**
   ⓐ 가입 요청 자체를 multipart 로 (JSON 계약이 깨집니다) ⓑ **비인증 사전 업로드 + 가입 요청이 id 참조**
   (이 절의 전제. 저장소 오남용 표면이 생기므로 크기·타입 제한 + rate limit + 고아 정리가 필수)
   ⓒ 계정부터 만들고 두 번째 요청에서 병원 등록 (요청서의 "가입 한 번" 이 깨집니다).
   **ⓑ 를 제안하지만 보안 표면을 늘리는 결정이라 요청자 확인이 필요합니다** *(2026-10-21 개정 —
   혼자 개발 체제. 원래는 "협업자 확인이 필요합니다")*
3. **사업자등록증을 교체하면 승인이 풀려야 하는가.** `doctor_verifications` 는 자격증이 바뀌면 재검수를
   강제합니다(§5.8). 병원도 같아야 한다면 `uploaded_files` 신규 행 + `approval_status='pending'` 되돌림이
   필요하고, 그 순간 **앱에서 병원이 사라집니다.** 교체 화면이 아직 없으므로 미결로 둡니다
4. **파일 보존 기간 숫자** — 고아 24시간·반려 30일은 제안입니다. 반려 입점 문의의 보존 기간(§11.8-2)과
   **함께** 정해야 합니다. 서로 다르면 "같은 병원의 서류는 지웠는데 문의의 연락처는 남은" 상태가 됩니다
5. **`/partner-inquiry` 화면을 남길 것인가** (§14.10). 데이터는 공존이지만 입구 두 개는 제품 결정입니다
6. **승인 결과 문자(SMS)** — 요청서의 완료 화면이 "알림과 문자로 알려드려요" 라고 약속합니다.
   **발송 인프라가 없습니다**(결정 0001 에서 "이메일 발송 인프라가 없다" 와 같은 사정). 알림은 기존
   `notifications` 로 되고, 문자는 되지 않습니다. **화면 문구에서 "문자" 를 빼거나, 발송 수단을 먼저
   정해야 합니다**
7. **주소 검색 응답에 지역(`region_2depth_name`)이 포함되는가** — `hospitals.region` 이 NOT NULL 인데
   가입 폼에 지역 칸이 없습니다(§14.2). interface-master 확인 항목입니다
8. **담당자가 비밀번호를 잊으면** — 결정 0001 미결 6 이 "운영자가 계정을 만들지 않으므로 비밀번호 찾기의
   우선순위가 올라갔다" 고 적었는데, **직접 가입은 그 압력을 한 번 더 올립니다.** 이제 계정도 병원도
   본인만 만들 수 있고, 대신 들어가 줄 사람이 없습니다

---

## 15. 알림 — 상담 상태 칸 (요청 08)

> 요청서: `docs/features/requests/2026-10-12-08-알림-예약확정-문의답변.md`
> 요청자 결정일 2026-10-13. **데이터 변경은 nullable 컬럼 하나가 전부입니다** —
> 나머지(문구, 이동 경로, 아이콘 그림)는 계약과 화면의 몫입니다.

요청 08 이 알림함에 요구하는 것은 네 가지입니다: ① 예약확정 알림에 **방문 일시가 문장으로** 들어갈 것
② 문의 답변 알림 ③ 상담 알림을 누르면 **마이페이지 상담 내역**으로 ④ 왼쪽에 **종류 아이콘 다섯**
(예약 / 문의 / 상담 / 이벤트 / 안내).

이 중 **④ 만 데이터를 요구합니다.**

| 요구 | 지금 데이터로 되는가 | 결론 |
|---|---|---|
| ① 방문 일시가 문장에 | 됩니다 — `message` 가 자유 문자열입니다(§15.3) | 변경 없음 |
| ② 문의 답변 알림 | 됩니다 — `type='inquiry-answer'` 가 **이미 있습니다**(2026-10-12 계약 추가) | 변경 없음 |
| ③ 상담 내역으로 이동 | 됩니다 — `related_type='consult_request'` + `related_id` = 상담 id 그대로 | 변경 없음 |
| ④ 예약 아이콘을 상담 아이콘과 가르기 | **안 됩니다** — `type` 이 `consult-status` 하나라 예약확정과 연락중·취소가 같은 값입니다 | **컬럼 1개 추가** |

### 15.1 추가하는 것 — `notifications.consult_status` 하나

```
notifications
  consult_status varchar, null   -- ConsultStatus. type='consult-status' 행의 "변경 후 상태".
                                 -- 일시 변경(reschedule)이면 'booked'. 다른 type 은 전부 null
```

- **허용값**: `new` | `contacted` | `booked` | `visited` | `cancelled` — `consult_requests.status` 와
  **같은 도메인**입니다(§12.1). 새 값 집합을 만들지 않습니다
- **기본값 없음, NOT NULL 아님.** 쓰기 경로의 불변식만 둡니다:
  `type='consult-status'` 로 **새로 만드는** 행은 값을 반드시 적는다. `type` 이 그 밖이면 `null` 이다
- **DB CHECK 를 걸지 않습니다** — 기존 행이 `null` 이라 켜는 순간 위반입니다(§12.10 과 같은 사정).
  PostgreSQL 이전 후 과거 행을 정리하기로 하면 §7.6 에 조건부로 올립니다
- **인덱스를 만들지 않습니다** — 소비자가 `WHERE` 가 아닙니다(§15.5)

### 15.2 왜 컬럼인가 — 새 `type` 값·범용 `subtype`·역조인을 모두 버린 이유

소비자는 **아이콘 판정 하나**입니다. 순수 함수 한 줄로 적으면 이렇습니다.

```
notificationIcon({ type, consultStatus }) -> 'booking' | 'inquiry' | 'consult' | 'event' | 'notice'

  type='consult-status' && consultStatus='booked'  -> 'booking'   (예약)
  type='consult-status'  (그 밖 · null 포함)        -> 'consult'   (상담)
  type='inquiry-answer'                            -> 'inquiry'   (문의)
  type='event'                                     -> 'event'     (이벤트)
  type='system'                                    -> 'notice'    (안내)
```

**이 함수는 클라이언트에 둡니다** (`frontend/src/features/notification/notificationIcon.ts`).
서버는 아이콘을 모릅니다 — 내려보내는 것은 `type`·`consultStatus` 라는 **사실**이고, 그 사실을 그림으로
바꾸는 것은 표시 규칙입니다(`isDelayed` 를 서버 컬럼으로 만들지 않은 것과 같은 이유, §12.11).
판정 지점이 화면 한 곳뿐이라 "같은 판정을 두 곳에 두지 않는다" 가 자동으로 지켜집니다.

버린 대안 넷:

| 대안 | 왜 버렸나 |
|---|---|
| **새 `type` 값 `consult-booked`** | `type` 은 **이동 경로의 축**입니다 — 화면이 `type` 으로 분기해 상담 내역·내 문의·이벤트로 보냅니다. 값을 쪼개면 그 분기가 전부 `consult-status \|\| consult-booked` 두 줄이 되고, 하나를 빠뜨린 자리가 **조용히 이동하지 않는 알림**이 됩니다. 아이콘 하나를 가르려고 라우팅 축을 쪼개는 교환입니다 |
| **범용 `subtype varchar`** | 허용값이 `type` 에 따라 달라져서 **검증을 문장으로 쓸 수 없습니다**(`type='event'` 일 때 `subtype='booked'` 은 무엇인가). `consult_status` 는 도메인이 이미 정의돼 있고 `consult_requests.status` 와 같은 값 집합이라, 틀린 값이 들어오면 그 자체로 틀렸다고 말할 수 있습니다 |
| **`consult_status_changes.notification_id` 역조인으로 파생** | ⓐ 알림함 목록이 상담 이력 조인을 N건마다 하게 되고, 그 조인 키에 인덱스가 없습니다 — 인덱스를 새로 만들면 비용이 nullable 컬럼 하나와 비슷한데 질의만 복잡해집니다 ⓑ **접수 알림(`audience='admin'`)에는 짝이 되는 이력 행의 `notification_id` 가 없습니다** — 접수 행은 알림 id 를 적지 않습니다 ⓒ 알림은 상담보다 오래 남을 수 있습니다(보존 기간 미정, §12.12-3) |
| **`event`(`status_change`/`reschedule`) 를 알림에 복사** | 아이콘이 묻는 것은 "무슨 이벤트였나" 가 아니라 "**지금 예약이 잡힌 건가**" 입니다. `변경 후 상태` 한 칸이면 일시 변경도 `booked` 로 자연히 떨어져 특례가 없습니다 — 다음 절 표의 둘째 줄이 그 이득입니다 |

### 15.3 이벤트별로 무엇이 들어가는가

`consult_status` 는 **그 알림을 낳은 이벤트 직후의 상담 상태**입니다. 이력 행의 `status` 와 같은 값이고
(§12.3 — "`reschedule` 행의 상태는 그 시점의 상태(`booked`)다, 행이 스스로를 설명한다"), 알림 행이
그것을 한 벌 더 들고 있을 뿐입니다.

| 이벤트 | `type` | `consult_status` | 아이콘 | 문구 |
|---|---|---|---|---|
| 상담 접수 (환자) | `consult-status` (`audience='admin'`) | `new` | 상담 | 지금 문구 유지 (`새로운 상담 신청`) |
| → `contacted` | `consult-status` | `contacted` | 상담 | **요청 08 이 새로 정함** — `병원이 연락 중이에요` |
| → `booked` | `consult-status` | `booked` | **예약** | **요청 08** — `상담 예약이 확정됐어요` / `○○치과의원 · 10/9(목) 14:00 방문 …` |
| 예약 일시 변경 (`reschedule`) | `consult-status` | **`booked`** | **예약** | 지금 문구 유지 (`예약 일시가 '…'(으)로 변경되었어요`) |
| → `cancelled` | `consult-status` | `cancelled` | 상담 | **요청 08** — `상담이 취소됐어요` + 환자용 사유 문장(§15.4) |
| → `visited` | `consult-status` | `visited` | 상담 | **요청서에 없음 → 지금 문구 유지** (`상담 상태가 '내원완료'(으)로 변경되었어요`) |
| 되돌림 (`booked`→`contacted` 등) | `consult-status` | 되돌아간 상태 | 상담 | **요청서에 없음 → 지금 문구 유지** |
| 문의 답변 | `inquiry-answer` | `null` | 문의 | 이미 구현됨 (`{병원명} · {답변 60자}`) |
| 이벤트 · 공지 | `event` / `system` | `null` | 이벤트 / 안내 | 변경 없음 |

> **`visited` 와 되돌림의 문구를 바꾸지 않는 이유**: 요청서가 그 두 경우의 문장을 적지 않았습니다.
> 지어내면 요청자가 검수하지 않은 문장이 환자에게 나갑니다. 아이콘은 `booked` 가 아니므로 '상담' 이고,
> 그것은 규칙의 결과이지 예외가 아닙니다.

### 15.4 문구는 **저장 시점에 확정**합니다 (지금 방식 유지)

`title`·`message` 는 알림을 만드는 트랜잭션 안에서 완성된 문자열로 적습니다. 렌더 시점에 조립하지
않습니다. **병원 이름이 바뀌어도 과거 알림의 문장은 그대로인 것이 맞습니다.**

- 알림은 **그때 보낸 통지의 사본**입니다. 사후에 문장이 달라지면 "환자가 받은 알림" 과 "알림함에 보이는
  알림" 이 다른 문서가 됩니다 — `audit_logs` 의 `actor_role`·`pii_masked` 를 스냅샷으로 둔 것과
  같은 논리입니다(§11.2-(2))
- §4 가 `hospital_name`·`asker_display_name` **스냅샷 컬럼을 두지 않기로** 한 것과 모순이 아닙니다.
  그 둘은 **현재 상태를 보여주는 투영**이라 바뀐 이름이 보이는 것이 맞고, 알림은 과거 사실의 사본입니다
- 조립식으로 가면 알림 목록 질의가 상담·병원·문의를 조인해야 하고, **대상이 지워지면 문장이 사라집니다**
- 대가: 문구를 다듬어도 과거 알림은 옛 문장으로 남습니다. 받아들입니다 — 이미 보낸 통지입니다

**방문 일시도 같은 이유로 `message` 문자열 안에만 있습니다.** `notifications.visit_at` 을 만들지
않습니다 — 포맷은 서버가 정하기로 했으므로 날짜 값을 다시 쓸 소비자가 없고, 예약이 또 바뀌었을 때
**과거 알림은 그때의 약속을 말해야** 맞습니다. 현재 일시는 `related_id` 가 가리키는 상담 내역에 있습니다.

### 15.5 취소 사유는 **코드이지 데이터가 아닙니다**

관리자용 라벨(`중복 신청`·`연락이 안 됨`)을 환자에게 그대로 보내지 않습니다. 매핑은 순수 함수 하나입니다.

```
patientCancelSentence(reason: ConsultCancelReason) -> string | null
  etc -> null (사유 문장 없이 제목만)
```

- **`notifications.cancel_reason` 을 만들지 않습니다.** 소비자가 없습니다 — 아이콘은 `cancelled` 하나로
  갈리고, 사유는 이미 `message` 문장 안에 녹아 있습니다. 사유별 집계가 필요해지면
  `consult_status_changes.cancel_reason` 이 **이미 그 질문에 답합니다**(§12.4)
- 문장 자체는 계약(`openapi.yaml` 의 예시)과 화면 문구의 영역입니다. 이 문서가 고정하는 것은
  **"코드 → 환자 문장" 변환이 알림 행에 들어가기 전에 끝난다"** 하나입니다
- `etc` 에 자유 텍스트 칸이 없다는 §12.12 미결 2 가 여기서 다시 보입니다 — `기타` 취소 알림은 구조적으로
  이유를 말할 수 없습니다. `기타` 비율이 높게 나오면 **사유 코드를 늘리는 것이 먼저**입니다

### 15.6 수신자 규칙은 그대로입니다

`audience` 와 `notification_recipients` 는 **한 줄도 바뀌지 않습니다**(§5.3).

- 상태 변경 → `audience='user'` + 신청자 1명에게만 수신자 행. 관리자 자기 알림함에 들어가지 않습니다
- 상담 접수 → `audience='admin'`, `hospital_id` = 그 병원 + 그 병원 담당자들
- 문의 답변 → `audience='user'` + 문의자 1명
- `consult_status` 는 **수신자 결정에 쓰이지 않습니다** — `audience` 와 직교하는 표시용 칸입니다

> 프런트 로컬 구현은 아직 알림함을 계정별로 가르지 않습니다(`notificationApi.ts`·`consultApi.ts` 의
> 기존 결함 주석). 서버가 수신자 행을 만들면 사라지는 격차이고, 이번 변경이 넓히지 않습니다.

### 15.7 인덱스 — 추가하지 않습니다

아이콘 판정은 **이미 뽑아 온 행 한 줄**에 대한 계산입니다. `WHERE consult_status = ?` 를 거는 질의가
없습니다. §6.4 의 네 인덱스가 그대로 알림함 목록과 안 읽음 배지를 받습니다.

"예약 알림만 모아보기" 탭이 생기면 그때 `(audience, consult_status, created_at)` 를 검토합니다 —
지금 그 화면이 없고, 없는 화면을 위한 인덱스는 쓰기 비용만 늘립니다(§6.7 과 같은 판단).

### 15.8 기존 행 — 백필하지 않습니다

마이그레이션은 `ADD COLUMN consult_status varchar NULL` 한 줄이고 **UPDATE 가 없습니다.**

- 기존 `consult-status` 알림의 문구는 `상담 상태가 'X'(으)로 변경되었어요` 인데, 그 `X` 를 **문자열에서
  파싱해 채우는 것은 추측**입니다(§12.10 과 같은 논리)
- `related_id` 로 상담을 조인해 **현재 상태**를 넣는 백필도 가능하지만, 알림이 말하는 것은
  **그때의 변경 후 상태**입니다. 그 뒤에 상태가 또 바뀐 건에는 **틀린 값을 심게 됩니다.** 거절합니다
- 영향은 **아이콘 하나뿐**입니다: 과거 예약확정 알림이 '예약' 대신 '상담' 아이콘으로 보입니다.
  판정 함수의 `null` 분기가 곧 변경 전 동작이라 **화면이 깨지지 않습니다**
- 시드 fixture(`notif1`..`notif7`)도 `null` 로 둡니다. 값을 넣으려면
  `frontend/src/mocks/fixtures/notifications.ts` 수정이 따라오는데 **그 파일은 프런트 영역**이라
  이 변경에 묶지 않습니다(§12.12-3 과 같은 처리)
  > **요청서 15 에서 전제가 바뀌었습니다 (2026-10-22).** 알림 시드의 **원본이 서버로 옵니다**
  > (`backend/prisma/seed/data/notifications.ts`). 프런트를 건드리지 않고 값을 적을 수 있으므로,
  > 새 샘플은 `consult_status` 를 **처음부터 채운 채** 만들어집니다 — §12.13-D.
  > **백필하지 않는다는 이 절의 결론은 그대로입니다**: 백필의 대상이던 `notif1`~`notif7` 은
  > 채워지는 것이 아니라 reset 으로 **사라집니다**(§12.13-F-4)

### 15.9 만들지 않는 것

| 안 만든 것 | 대신 | 근거 |
|---|---|---|
| `type='consult-booked'` | `consult_status` | `type` 은 이동 경로 축입니다 (§15.2) |
| 범용 `subtype` | `consult_status` | 허용값이 `type` 에 종속돼 검증을 쓸 수 없습니다 (§15.2) |
| `notifications.visit_at` | `message` 문자열 | 문구를 서버가 만들기로 한 이상 날짜 값의 소비자가 없습니다 (§15.4) |
| `notifications.cancel_reason` | `message` + `consult_status_changes.cancel_reason` | 아이콘은 `cancelled` 로 충분하고, 집계는 이력이 이미 답합니다 (§15.5) |
| `notifications.icon` | `notificationIcon()` | 그림 이름을 저장하면 아이콘 세트를 바꿀 때 과거 행이 전부 틀립니다 |
| `consult_status` 인덱스 | — | 필터 화면이 없습니다 (§15.7) |
| `type='inquiry-answer'` 관련 컬럼 | — | 이미 `type` + `related_id` 로 끝납니다. 요청 08 의 문의 쪽은 **데이터 변경 0** 입니다 |

### 15.10 백엔드·계약 작업 체크리스트 (요청서 15 에서 처리)

*(2026-10-21 개정 — 혼자 개발 체제. 원래 제목은 "백엔드·계약 인계 체크리스트" 입니다. 목록은 그대로
두고 처리할 자리만 적습니다.)*

**요청서 15 (`docs/features/requests/2026-10-21-15-상담-알림-서버로.md`) 에서** 아래를 처리합니다 —
알림은 상담과 같은 트랜잭션 안에서 생기므로(⑤) 상담을 서버로 옮기는 작업과 한 묶음입니다.
②부터는 같은 저장소의 **backend-engineer** 가 맡습니다.

- [ ] ① **interface-master 가 계약을 확정**한다 — 아래 "인계 목록". `openapi.yaml`·`docs/api/README.md`
      는 이 문서의 작성자가 건드리지 않았습니다
      → **요청서 15 의 2단계** (db-master 다음이 interface-master 입니다)
- [x] ② `schema.prisma` `Notification` **+1 컬럼**: `consultStatus String? @map("consult_status")`
      → **2026-10-22 반영** (요청서 15, db-master). `type`·`related_type` 주석의 낡은 허용값도 함께 고쳤습니다
- [x] ③ `docs/database/schema.dbml` 의 `Table notifications` 반영.
      **`type` 의 허용값 주석이 낡았습니다** — `inquiry-answer` 가 빠져 있습니다(2026-10-12 계약 추가).
      같은 커밋에서 함께 고칩니다
      → **2026-10-22 반영.** `related_type` 에 `hospital_inquiry` 도 함께 더했습니다(계약의
      `relatedResource` 와 값 집합을 맞춥니다)
- [ ] ④ 마이그레이션 — `ADD COLUMN` 한 줄, **백필 없음** (§15.8)
      → **요청서 15 의 backend-engineer.** §12 의 DDL 과 **한 마이그레이션**으로 묶습니다 — 절차는 §12.13-F
- [ ] ⑤ 알림 생성 지점 **네 곳**이 값을 적는다. 전부 **기존 트랜잭션 안**이고 새 트랜잭션이 없습니다
      — 상담 접수(`new`), 상태 변경(`input.status`), 일시 변경(`booked`), 문의 답변(`null`)
- [ ] ⑥ 문구 생성 순수 함수 2개 + 단위 테스트 — `patientCancelSentence(reason)`(§15.5)와
      예약 일시 포맷 **하나**. ⚠ **지금 두 표기가 있습니다**: 기존 알림 문구는
      `10월 9일(금) 14:00`(`formatVisitAtLong`, 계약에 이미 박혀 있음)이고 요청서 08 의 예시는
      `10/9(목) 14:00` 입니다. **둘 중 하나로 정해 함수 하나만 남깁니다** — 같은 알림함에서
      예약확정 알림과 일시 변경 알림이 서로 다른 날짜 표기를 쓰면 안 됩니다 (§15.11-4)
- [ ] ⑦ 프런트 — `notificationIcon()` 순수 함수 + 경계값 테스트(`null`·`booked`·그 밖),
      `AppNotification.consultStatus` 추가, mock 두 곳(`consultApi.ts`·`inquiryApi.ts`)이 값을 적도록
- [ ] ⑧ 프런트 — 상담 알림의 이동 대상을 **마이페이지 상담 내역**으로 (요청자 결정 2).
      `notifications.tsx` 의 `hospitalIdForConsult` 조회와 `useMyConsultRequests` 선조회가 **사라집니다**
      — 알림이 들고 있는 상담 id 로 바로 갑니다. **데이터 변경 없음**
- [ ] ⑨ `docs/features/notifications.md` 갱신 (아이콘 다섯 · 종류별 문구 표)

**interface-master 에 넘기는 것** (계약 변경):

| 자리 | 변경 |
|---|---|
| `AppNotification` 스키마 | **`consultStatus` 추가** — `ConsultStatus` enum 재사용, **nullable, 키는 항상 있음**. `type='consult-status'` 가 아니면 `null`, 과거 행도 `null` |
| `NotificationType` enum | **변경 없음** — `consult-status \| inquiry-answer \| event \| system` 그대로 |
| `GET /notifications` | 파라미터·정렬 변경 없음. 응답 항목에 위 필드 하나 |
| 예시 문구 자리 | 예약확정 · 연락중 · 취소(사유 4종 + `기타`) 문장을 **계약 예시로 못 박는다.** 지금 서버가 쓰는 `상담 상태가 '…'(으)로 변경되었어요` 는 `visited`·되돌림에서만 남는다 (§15.3) |
| 알림 생성 엔드포인트 | **여전히 없습니다.** 알림은 상태 변경·답변 등록의 부수효과로만 생깁니다 |

### 15.11 남은 미결

1. **관리자 알림함에도 아이콘을 쓰는가.** 요청 08 은 사용자 화면(U10)만 말합니다. `consult_status` 는
   `audience='admin'` 행에도 적히므로(접수 알림 = `new`) 데이터는 이미 준비됐지만, 관리자 알림함의
   아이콘 규칙은 요청이 없어 정하지 않았습니다
2. **알림함 100건 상한** (`notifications.tsx` 의 `LIST_PAGE_SIZE` 주석). 상담마다 알림이 늘기만 해서
   언젠가 101번째부터 화면에서 조용히 사라집니다 — 이번 변경이 알림 **종류**를 늘리므로 그 시점이
   당겨집니다. 페이지 이동 UI 또는 보존 기간(§12.12-3 과 함께 정할 것)이 숙제입니다
3. **찜한 병원의 새 이벤트 알림** — 요청서의 다섯째 줄입니다. 이벤트 기능 자체가 없어 범위 밖이고,
   생기면 `type='event'` + `related_type='promotion'` 으로 **스키마 변경 없이** 들어갑니다
4. **예약 일시 표기를 어느 쪽으로 통일하는가** (⑥). `10월 9일(금) 14:00` 은 계약에 이미 예시로 들어가
   있고, `10/9(목) 14:00` 은 요청서가 쓴 표기입니다. **데이터에는 영향이 없습니다**(문자열 하나) —
   interface-master·designer 결정 항목입니다

---

## 16. 병원 정보 확장 — 시술별 가격 · 사진 · 특징 (구 요청 07) — **제안 — 요청자 답 반영 대기 → 요청서 19**

| | |
|---|---|
| **상태** | **제안입니다. 요청자 답 반영 대기 → `docs/features/requests/2026-10-21-19-병원정보-시술별가격-사진.md` (구 요청 07).** 이 절의 어떤 것도 `schema.prisma`·`schema.dbml`·`openapi.yaml` 에 아직 반영하지 않았습니다. 열린 질문(§16.16)의 답은 **요청서 19 의 표**에 있고, **반영은 요청서 19 를 처리할 때** 합니다 — 이 절의 제안 내용은 그때까지 그대로 둡니다 *(2026-10-13 제안 · 2026-10-21 개정 — 혼자 개발 체제. 원래 표시는 "제안 — 협업자 확인 대기 (2026-10-13)" 였습니다)* |
| **요구사항 출처** | `docs/features/requests/2026-10-12-07-병원정보-시술별가격-사진.md` (**2026-10-21 에 `2026-10-21-19-병원정보-시술별가격-사진.md` 로 대체됨 — 지금 기준은 19 번입니다**), 화면: `docs/features/admin-hospital-edit.md`·`hospital-detail.md` |
| **새 테이블** | **0개.** `uploaded_files`(§14.7)를 재사용하고, 나머지는 기존 테이블의 컬럼입니다 |
| **새 컬럼** | `hospital_procedures` **3개**, `hospitals` **3개**, `hospital_images` **1개** (합계 7) |
| **바뀌는 것** | 순수 함수 +4 묶음(`hospital/procedurePrice.ts`·`priceDisplay.ts`·`photos.ts`·`hoursFeatures.ts`) · `uploaded_files.purpose` 에 값 1개 · 완성도 항목 7 → **9** (§13.7) · 인덱스 **추가 0** |
| **선행** | **§14 의 `uploaded_files` 가 전제입니다 — 즉 요청서 18 이 먼저입니다.** 그 테이블이 없으면 이 절의 사진은 기존 URL 입력 그대로 남습니다 |
| **받는 곳** | 이 절 → **interface-master**(계약) → **backend-engineer** (같은 저장소의 `backend/`). 전 과정을 **요청서 19** 에서 진행합니다 *(2026-10-21 개정 — 혼자 개발 체제. 원래는 "백엔드(협업자 영역)")* |

요청서가 지키라고 한 네 가지가 이 절의 제약입니다. 전부 설계에 그대로 반영했습니다.

| 요청서의 제약 | 이 절에서 |
|---|---|
| 세부 시술 → 카테고리 노출 규칙(`features/procedure/taxonomy.ts`)은 그대로 | `procedures` 마스터 13종을 **건드리지 않습니다**. 가격은 그 13종 위에 붙습니다 (§16.2) |
| 원데이는 시술이 아니라 병원 특징 | `hospitals.is_one_day` 그대로. `procedures` 에 '원데이' 행을 만들지 않습니다 (§16.6) |
| db-master → interface-master 순서 | 이 절이 먼저이고, `openapi.yaml`·`docs/api/README.md` 는 **건드리지 않았습니다** (§16.15 가 인계 목록) |
| 기존 전체 가격대는 지우지 말고 **대신 보여주는 값**으로 | `price_min`/`price_max` 유지 + 폴백 순수 함수 하나 (§16.4). 마이그레이션 백필이 없어 **기존 병원 11곳의 화면은 그대로입니다** |

### 16.1 시술별 가격 — 새 테이블이 아니라 `hospital_procedures` 의 컬럼 3개

선택지는 둘이었습니다.

| 안 | 판단 |
|---|---|
| 새 테이블 `hospital_procedure_prices(hospital_id, procedure_id, …)` | 기각 |
| ✅ **기존 조인 테이블 `hospital_procedures` 에 컬럼 3개** | 채택 |

**입도(grain)가 완전히 같기 때문입니다.** 새 테이블을 만들어도 키는 `(hospital_id, procedure_id)`
이고, 그것은 `hospital_procedures` 의 **유니크 키 그대로**입니다. 같은 입도의 테이블을 둘로 나누면
**둘이 어긋난 상태가 표현 가능해집니다** — "체크하지 않은 시술에 가격만 있는 행", 반대로 "체크는
했는데 가격 행이 없는 시술". 앞의 것은 화면이 만들 수 없는 상태이고(가격 칸은 체크한 줄에만
생깁니다), 그런 상태를 **저장소가 표현할 수 있게 두면 언젠가 들어옵니다.** 한 행이면 그 상태가
애초에 없습니다 — 체크 해제 = 행 삭제 = 가격도 함께 사라집니다.

```prisma
model HospitalProcedure {
  // 기존: id, hospital_id, procedure_id, @@unique([hospital_id, procedure_id])

  // ── §16 제안: 시술별 가격 (3개) ────────────────────────────────────────
  /// 비급여 가격 범위 (**원**. §3.5 — 금액은 Int(원)).
  /// **둘 다 null 이 "아직 적지 않음"** 이다. 한쪽만 null 인 행은 만들지 않는다 (앱 검증)
  priceMin Int? @map("price_min")
  priceMax Int? @map("price_max")

  /// '상담 후 안내' 체크. true 면 price_min/price_max 는 **반드시 둘 다 null** (앱 검증).
  /// null(미입력)과 구분해서 저장하는 이유는 §16.1 의 상태 표 참고 — 완성도 항목이 그 둘을 다르게 센다
  priceOnRequest Boolean @default(false) @map("price_on_request")
}
```

**상태는 셋이고, 셋 다 다른 사실입니다.**

| # | `price_on_request` | `price_min`/`max` | 뜻 | 병원 상세에서 | 완성도 |
|---|---|---|---|---|---|
| ① | `false` | 값 | 가격 범위를 적었다 | `30만원 ~ 50만원` | 충족 |
| ② | `true` | `null` | **상담 후 안내를 골랐다** | `상담 후 안내` | 충족 |
| ③ | `false` | `null` | 체크만 하고 아직 안 적었다 | 가격 줄 없음 (시술 이름만) | 미충족 |

**②와 ③을 한 상태로 합치지 않는 이유**(= `price_on_request` 컬럼을 없애고 "null 이면 상담 후
안내" 로 읽지 않는 이유)는 **완성도 항목**입니다(§16.9). 합치면 시술을 체크하는 것만으로
`시술별 가격` 항목이 충족되고, 그 항목은 **아무도 채운 적 없는데 항상 100%인 칸**이 됩니다
(§13.7 이 "항상 참인 항목은 완성도를 공짜로 한 칸 올릴 뿐" 이라고 뺀 바로 그 종류입니다).
환자 화면에서 ②와 ③이 거의 같아 보이는 것은 사실이지만, **담당자에게는 다른 사실**입니다 —
②는 결정이고 ③은 미입력입니다.

> ③을 환자에게 `상담 후 안내` 로 보여줄 것인지는 **화면 결정**입니다(디자이너·프런트). 데이터는
> 둘을 구분해 두므로 어느 쪽으로 정해도 스키마가 바뀌지 않습니다. 기본 제안은 **가격 줄을 아예
> 그리지 않는 것**입니다 — 적지도 않은 병원이 "상담하면 알려준다" 고 약속한 것처럼 읽힙니다.

### 16.2 가격이 붙는 단위 — **서버 시술 13종**이고, 세부 18개는 지금 저장할 수 없습니다

> **2026-10-21 추가 — 이 절의 전제가 §17 로 해소됩니다.** 요청서 14 가 `procedures` 를 **31행**으로
> 만들고 분야를 테이블로 올립니다(§17). 그래서 요청서 19 를 구현할 때 가격이 붙는 단위는
> **세부 시술 31개**이고, 아래의 "18개는 저장할 수 없다"·"노출 범위가 바뀐다" 는 **요청 14 이전의
> 기록**입니다. 설계 판단(= 가격은 `hospital_procedures` 의 컬럼 3개)은 그대로 유효합니다.

| 후보 단위 | 개수 | 판단 |
|---|---|---|
| ✅ **서버 시술 id** (`procedures.id`) | 13 | **채택.** FK 가 걸리고, 이미 `hospital_procedures` 가 그 단위다 |
| 세부 시술 id (`taxonomy.ts` 의 `SubProcedureId`) | 31 | 기각 — **서버에 마스터가 없다** |

세부 시술 31개 중 **13개만 `legacyProcedureId` 가 있고 18개는 `null`** 입니다(`taxonomy.ts`).
그리고 그 13개는 서버 id 와 **1:1** 입니다(`LEGACY_TO_SUB` 가 `Record<ProcedureId, SubProcedureId>`
라 컴파일러가 그것을 고정합니다). 그래서 **"세부 시술별 가격" 과 "서버 시술별 가격" 은 지금
같은 것**입니다 — 인레이를 체크하고 가격을 넣으면 `procedure_id='inlay'` 행에 그 값이 들어가고,
병원 상세는 `subFromLegacy('inlay').name` = `인레이` 로 그립니다. 요청서의 확인 항목
("인레이를 체크하고 가격을 넣으면 상세에 인레이와 그 가격이 보인다")이 그대로 성립합니다.

**준비중 18개는 체크 자체가 막혀 있습니다**(`SubProcedureCheckbox` 의 `disabled`). 체크할 수
없으므로 **가격 칸도 생기지 않고, 저장할 값도 없습니다** — 데이터 변경 0입니다. 화면은 지금처럼
`준비중` 배지로 "이 서비스가 그 시술을 아직 다루지 않는다" 는 사실만 말합니다.

**세부 18개에 가격을 받으려면 무엇이 필요한가** (지금 하지 않는 일):

- `procedures` 마스터에 행 18개를 더하는 일입니다. 그런데 그 테이블은 **홈 `시술로 찾기` 격자 ·
  탐색 칩 · 커뮤니티 글 작성의 시술 선택**이 `sort_order` 로 공유하는 **고정 노출 목록**입니다
  (스키마 주석). 행을 더하면 그 세 화면이 즉시 바뀝니다 — **가격 기능이 노출 범위를 바꾸는 것**은
  요청서가 "노출 규칙은 그대로" 라고 못 박은 것과 정면으로 어긋납니다.
- 노출과 저장을 분리하려면 `procedures` 에 `is_listed` 같은 축이 하나 더 필요하고, 그 순간
  taxonomy 의 매핑 계층이 **서버로 이사**합니다. 그것은 07 보다 큰 작업이고 별도 요청입니다 (§16.16-5)
  — **그 별도 요청이 요청서 14 (시술 분류를 서버로 + 스케일링·예방 열기)** 입니다 *(2026-10-21 추가)*.
- 문자열 `sub_procedure_id` 를 FK 없이 받는 중간안도 기각입니다. 허용값이 프런트 파일에만
  있어 **서버가 검증할 수 없고**, 오타가 그대로 저장돼 영원히 안 보이는 가격이 됩니다.

### 16.3 금액 단위와 검증 — **저장은 원**, 판정은 순수 함수 하나

**저장 단위는 원(`Int`)입니다.** 요청서의 입력 칸은 `최소 ~ 최대 만원` 이지만, 그 변환(×10,000)은
**화면의 일**입니다. 근거:

- §3.5 가 "금액은 `Int`(원)" 이고 `promotions.original_price`·`hospitals.price_min` 이 전부 원입니다.
  **한 응답 안에서 시술 가격만 만원이면** 폴백(§16.4)이 단위가 다른 두 값을 비교하게 됩니다 —
  `45` 와 `450000` 중 어느 쪽이 큰지는 코드가 아니라 **읽는 사람**이 틀립니다.
- 만원 단위로 저장하면 9만 5천원을 적을 수 없습니다. 입력 UI 는 바뀔 수 있고 저장값은 그 뒤에
  남습니다.
- **계약(API)도 원을 권합니다** — interface-master 확인 항목입니다 (§16.15).

```ts
// hospital/procedurePrice.ts — 순수 함수. DB 도 요청도 모른다
export interface ProcedurePriceInput {
  priceMin: number | null;
  priceMax: number | null;
  priceOnRequest: boolean;
}

/** 어긋난 조합을 전부 코드로 돌려준다. 빈 배열이면 통과. */
export function validateProcedurePrice(input: ProcedurePriceInput): PriceErrorCode[];

export type PriceErrorCode =
  | 'PRICE_NOT_ALLOWED_ON_REQUEST' // onRequest=true 인데 금액이 왔다
  | 'PRICE_INCOMPLETE'             // min/max 중 한쪽만 왔다
  | 'PRICE_RANGE_INVERTED'         // min > max
  | 'PRICE_OUT_OF_RANGE';          // 0 이하이거나 상한 초과
```

| 규칙 | 값 | 근거 |
|---|---|---|
| `onRequest=true` → 금액 금지 | — | 두 사실이 동시에 참일 수 없습니다. 하나를 우선시하는 서버 규칙을 만드는 대신 **422 로 거절**합니다 — 화면에서 동시에 켤 수 없으므로 이 요청이 오면 클라이언트 버그입니다 |
| 한쪽만 입력 금지 | — | `30만원 ~ (빈칸)` 은 화면에 그릴 수 없습니다. "최소만 적고 최대는 열어 두기" 가 요구되면 그때 상태를 하나 더 정의합니다 |
| `min ≤ max` | — | 요청서가 명시한 유일한 가격 규칙입니다. **`min === max` 는 허용**합니다(정찰제). `formatPriceRange` 가 이미 그 경우 한 값만 그립니다 |
| `min > 0` | 0 금지 | `0원 ~ 50만원` 은 "무료" 로 읽힙니다. 미입력은 `null` 이 표현하므로 0을 센티널로 쓸 이유도 없습니다 |
| 상한 | **제안 1억원** | 오타 방어용 상수 하나입니다. 숫자는 임의값이지만 **함수 한 곳**에 있습니다 (§13.7 의 30자·10자와 같은 처방) |
| 만원 배수 강제 | **하지 않음** | 입력 UI 가 만원 칸인 것은 화면 사정입니다. 서버가 배수를 강제하면 천원 단위 입력이 생기는 날 계약부터 막힙니다 |

> **DB CHECK 제약을 두지 않습니다** — §3.1 과 같은 이유(이식성·애플리케이션 검증 일원화)입니다.
> `min ≤ max` 를 DB 가 막아도 **에러 메시지를 필드에 붙일 수 없어** 화면이 쓸 수 없습니다.

### 16.4 기존 전체 가격대와의 관계 — **지우지 않고, 폴백 함수 하나**

`hospitals.price_min`/`price_max` 는 **그대로 둡니다**(요청서 지시). 다만 **역할이 바뀝니다** —
"이 병원의 가격" 이 아니라 **"시술별 가격이 하나도 없을 때 대신 보여주는 값"** 입니다.

```ts
// hospital/priceDisplay.ts — 순수 함수 하나. 병원 상세 `시술·가격` 섹션의 유일한 판정
export function hospitalPriceSection(
  rows: ReadonlyArray<ProcedurePriceRow>,          // 그 병원의 hospital_procedures (가격 포함)
  fallback: { min: number; max: number }           // hospitals.price_min / price_max
):
  | { kind: 'perProcedure' }                       // 가격 상태가 정해진 행이 1개 이상 → 시술별 목록
  | { kind: 'hospitalRange'; min: number; max: number } // 0개 + 전체 가격대가 있다 → 한 줄
  | { kind: 'none' };                              // 0개 + 전체 가격대도 비었다 → 아무것도 안 그린다

/** §14.16 이 이름만 적어 둔 그 함수다. (0, 0) 은 "미입력" 센티널이다 */
export const hasPriceRange = (min: number, max: number) => min > 0 && max > 0;
```

**판정 기준은 "행이 있는가" 가 아니라 "가격 상태가 정해진 행이 있는가"** 입니다 —
§16.1 의 ①·② 가 하나라도 있으면 `perProcedure`, 전부 ③ 이면 폴백입니다. 시술만 체크된
기존 병원 11곳이 전부 ③ 이므로 **마이그레이션 직후 화면은 지금과 완전히 같습니다.**

**섞지 않습니다.** `perProcedure` 일 때 가격이 없는(③) 시술 줄에 **전체 가격대를 내려 적지
않습니다.** 전체 가격대는 "이 병원 전체" 의 값이고, 시술 줄에 적는 순간 **그 시술의 가격이라는
거짓말**이 됩니다. 비교하려고 만든 기능이 비교를 망치는 자리입니다.

**폴백이 걸리는 곳은 병원 상세 `시술·가격` 섹션 하나입니다.** 다른 두 소비자는 지금 그대로입니다:

| 소비자 | 지금 | 07 에서 |
|---|---|---|
| 병원 카드(`HospitalCard`)의 가격 줄 | `priceRange` | **그대로.** 카드는 한 줄이고 시술 13개를 담을 자리가 없습니다 |
| 탐색 `가격 비교표`(`PriceCompareTable`) | `priceRange.min` (또는 프로모션가) | **그대로 두되 미결입니다** — 시술 칩으로 좁힌 상태라면 그 시술의 `price_min` 이 훨씬 정확합니다. 요청서에 없어 이번에 하지 않습니다 (§16.16-9) |

**언제 전체 가격대를 지우는가**: "모든(또는 거의 모든) 병원이 시술별 가격을 채운 날" 입니다.
그 날을 **측정할 수단이 §16.9 의 완성도 항목**입니다 — `procedurePrices` 충족률이 지표입니다.
지금 지우면 11곳의 가격 표시가 통째로 사라집니다.

### 16.5 사진 — `hospital_images` 유지 + 파일 참조 1개, **대표는 첫 장**

**`hospital_images` 를 `uploaded_files` 로 이관하지 않습니다. 공존입니다.**

| | `uploaded_files` (§14.7) | `hospital_images` |
|---|---|---|
| 답하는 질문 | "이 바이트는 무엇이고 누가 언제 올렸고 언제 파기하는가" | "이 병원의 사진 **목록**은 무엇이고 순서는 어떤가" |
| 수명 | 파기해도 행은 남는다(`purged_at`) | 담당자가 빼면 행이 사라진다 |
| 외부 URL 사진 | 표현할 수 없다 | 기존 11곳이 그것이다 |

```prisma
model HospitalImage {
  // 기존: id, hospital_id, url, sort_order, @@index([hospital_id, sort_order])

  /// ── §16 제안 ──
  /// 파일 업로드로 들어온 사진이면 그 파일. 외부 URL 로 들어온 기존 행은 null.
  /// UNIQUE: 한 파일을 두 표시 행이 가리키면 한쪽을 빼거나 파기할 때 다른 쪽이 깨진 사진이 된다
  /// (uploaded_files.storage_key 를 UNIQUE 로 둔 것과 같은 논리 — §14.7).
  /// Restrict: 파일 행은 삭제하지 않는 테이블이다. 그 정책을 FK 로 굳힌다
  uploadedFileId String?       @unique @map("uploaded_file_id")
  uploadedFile   UploadedFile? @relation(fields: [uploadedFileId], references: [id], onDelete: Restrict)
}
```

`uploaded_files.purpose` 에 값 하나(`hospital_photo`)를 더합니다. **그것이 전부입니다** —
`canReadFile` 은 이미 `business_registration` 이 아니면 공개를 돌려주므로(§14.7)
**순수 함수를 고치지 않습니다.** 사진은 환자에게 보이는 공개물이라 `audit_logs` 대상도 아니고
`Cache-Control: no-store` 도 아닙니다.

**`url` 은 계속 `hospital_images` 가 들고 있습니다.** 파일 기반 사진이면 서버가 발급한 공개 경로가
들어갑니다. 덕분에 **`Hospital.images: string[]` 계약과 환자 화면이 하나도 바뀌지 않습니다** —
요청서의 "사진을 파일로 올리면 병원 상세 사진 넘김에 보인다" 가 프런트 변경 없이 성립합니다.
(사업자등록증과 달리 URL 을 발급해도 되는 이유: **그 URL 을 아는 사람 전부가 열람자여도 되는
파일**입니다. §14.7 이 URL 을 금지한 것은 열람자를 운영자로 좁혀야 하는 파일이었기 때문입니다.)

**대표 사진 = `sort_order` 가 가장 작은 행. `is_primary` 를 만들지 않습니다.**

| 안 | 판단 |
|---|---|
| ✅ **대표 = 목록의 첫 장** | 채택 — 판정이 한 곳이고, "대표 지정" 과 "순서 바꾸기" 가 **같은 한 연산**이 됩니다 |
| `hospital_images.is_primary` boolean | 기각 — `sort_order=0` 인 행과 `is_primary=true` 인 행이 **다를 수 있습니다.** "같은 판정을 두 곳에 두지 않는다"(AGENTS.md) 에 바로 걸립니다. 유일성(정확히 한 장)을 DB 로 강제할 수도 없습니다 |

`hospitals.thumbnail` 은 **남깁니다** — 병원 카드·검색·찜 목록 투영이 전부 쓰는 계약 필드입니다.
대신 **사진 목록 저장 트랜잭션이 첫 장의 `url` 로 함께 갱신**합니다. 쓰는 자리가 **하나**라
두 값이 갈릴 수 없습니다(§4 의 비정규화 집계값과 같은 취급).

```ts
// hospital/photos.ts — 순수 함수
export const MAX_HOSPITAL_PHOTOS = 11;              // 대표 1 + 내부 10 (요청서)

/** 저장 전 검증: 장수 상한 · url 중복 · 빈 url. 빈 배열은 허용(사진 없는 병원) */
export function validatePhotoSet(urls: readonly string[]): PhotoErrorCode[];

/** 0..n-1 을 다시 매긴다. 중간에 빠진 번호·중복 번호를 남기지 않는다 */
export function normalizePhotoOrder<T>(photos: readonly T[]): Array<T & { sortOrder: number }>;

/** 대표 = 첫 장. 목록이 비면 기존 thumbnail 을 그대로 둔다(지우지 않는다) */
export function primaryPhotoUrl(urls: readonly string[], fallback: string): string;
```

> **`sort_order` 를 0부터 연속으로 다시 매기는 이유**: 지금 컬럼은 `@default(0)` 이고 기존 행들이
> 전부 0 일 수 있습니다. 순서가 "같은 값 여러 개" 면 캐러셀 순서가 **DB 반환 순서**가 되고,
> 그것은 보장되지 않습니다 — 대표 사진이 날마다 바뀌는 버그가 여기서 나옵니다.

**3장 이상은 "권장" 이고 저장을 막지 않습니다.** 막으면 사진 2장짜리 병원이 **다른 필드도 저장할 수
없게** 됩니다. 권장은 완성도 항목으로 말합니다 (§16.9).

### 16.6 병원 특징 칩 9개 — **컬럼은 2개만 늘고, 둘은 파생입니다**

| # | 요청서의 칩 | 저장 | 비고 |
|---|---|---|---|
| 1 | 원데이 보철 | `hospitals.is_one_day` | **기존.** 요청서대로 시술이 아니라 특징입니다 |
| 2 | 디지털 진료(구강스캐너) | `feature_digital_care` | 기존 |
| 3 | 야간 진료 | **없음 — 진료시간에서 파생** | 아래 |
| 4 | 주말 진료 | **없음 — 진료시간에서 파생** | 아래 |
| 5 | 주차 가능 | `feature_parking` | 기존 |
| 6 | 수면 진료 | **`feature_sedation` 신규** | |
| 7 | 무통 마취 | `feature_painless_anesthesia` | 기존 |
| 8 | 전담 코디네이터 | `feature_coordinator` | 기존 |
| 9 | 장애인 편의시설 | **`feature_accessibility` 신규** | |
| (10) | CCTV 설치 | `feature_cctv` | **기존인데 요청서의 9개에 없습니다** — §16.16-1 |
| (11) | 야간상담 | `feature_night_consult` | **기존. 탐색 칩 `진료시간` 이 실제로 거르는 값입니다** — §16.16-2 |

```prisma
model Hospital {
  /// ── §16 제안: 특징 2개 ──
  /// 수면 진료(진정 요법) 가능
  featureSedation      Boolean @default(false) @map("feature_sedation")
  /// 장애인 편의시설 (경사로·휠체어 동선·장애인 화장실 등. 세부 항목은 받지 않는다)
  featureAccessibility Boolean @default(false) @map("feature_accessibility")
}
```

**enum 배열 테이블(`hospital_features`)을 만들지 않습니다.** §3.2 가 금지한 것은 **스칼라 배열**이지
boolean 묶음이 아닙니다. 지금 6개가 이미 컬럼이고 계약의 `HospitalFeatures` 가 **키 고정 객체**입니다.
테이블로 바꾸면 ① 기존 6컬럼 이관 ② 계약의 객체 → 배열 변경 ③ 모든 투영·필터 변경이 따라오는데,
얻는 것은 "값 추가가 행 추가" 뿐입니다. 그런데 **특징은 데이터로 늘지 않습니다** — 라벨·아이콘·
필터 파라미터가 전부 코드에 있어서, 행을 넣어도 화면에 **라벨 없는 칩**이 생길 뿐입니다.
필터(`nightConsult=true`)도 컬럼 하나의 `WHERE` 로 끝납니다.

**야간 진료·주말 진료는 저장하지 않습니다 — `business_hours` 에서 파생합니다.**

```ts
// hospital/hoursFeatures.ts — 순수 함수. business_hours 7행만 받는다
export const NIGHT_FROM_HOUR = 18;   // 요청서: "18시 이후 진료가 있으면"

export function derivedHourFeatures(
  hours: ReadonlyArray<{ dayOfWeek: number; hours: string; isClosed: boolean }>
): { nightCare: boolean; weekend: boolean };

/** '10:00 - 19:00' → { closeMinutes: 1140 }. 파싱할 수 없으면 null */
export function parseClosingTime(value: string): number | null;
```

| 왜 파생인가 | |
|---|---|
| **같은 사실이 두 곳에 있으면 어긋납니다** | 저장값이면 "수요일을 21시까지로 바꿨는데 야간 칩은 꺼진 병원" 이 생깁니다. 요청서의 확인 항목이 정확히 그 시나리오입니다 |
| **켜 주는 코드가 저장 경로마다 필요합니다** | 관리자 저장·운영자 `PATCH`·시드·이관 중 **한 곳만 빠뜨리면 조용히 어긋납니다** |
| 선례가 있습니다 | `consult_requests.delayed`(§12.11)·`hospitals.completeness_percent`(§13.10) 를 컬럼으로 만들지 않은 것과 같은 판단입니다 — **시간이 지나거나 다른 값이 바뀌면 틀려지는 값은 컬럼이 아닙니다** |

| 파생 규칙 | 견고함 |
|---|---|
| **주말**: `day_of_week ∈ {6,7}` 인 행 중 `is_closed=false` 이고 `hours` 가 공백이 아닌 행이 1개 이상 | **견고합니다** — 문자열을 파싱하지 않습니다 |
| **야간**: `is_closed=false` 인 행 중 `parseClosingTime(hours) ≥ 18:00` 인 행이 1개 이상 | ⚠ **`hours` 가 자유 문자열입니다** (`'10:00 - 19:00'`, `'휴진'`, `'09:00-13:00 / 14:00-18:00'`). 파싱 실패 시 **false** — 칩이 조용히 꺼집니다 |

> **야간 파생의 한계를 숨기지 않습니다.** `business_hours.hours` 는 "관리자 폼이 자유 입력이고
> 점심시간을 같은 칸에 적는다" 는 이유로 문자열입니다(스키마 주석). 파싱기는 **마지막 `HH:MM`**
> 을 종료 시각으로 보는 것이 최선이고, 그래도 못 읽는 입력이 남습니다. 제대로 고치는 길은
> `business_hours` 를 `open_minutes`/`close_minutes`(+ 점심 2개)로 구조화하는 것인데 **07 보다 큰
> 변경**이라 미결입니다(§16.16-3). 그 전까지는 **파싱 실패 = 꺼짐**(거짓 광고가 되지 않는 쪽)입니다.

### 16.7 한 줄 소개 — `hospitals.tagline`

```prisma
model Hospital {
  /// ── §16 제안 ──
  /// 리스트 카드에 노출되는 한 줄 소개. **40자 상한은 앱·계약 검증**이다 (DB 길이 제약 없음 — §3.1).
  /// introduction(긴 소개)과 다른 필드다: 카드 한 줄 vs 상세 문단
  tagline String @default("") @map("tagline")
}
```

- **`@default("")` 입니다** — `introduction`·`directions` 와 같은 패턴입니다. 카드가 묻는 것은
  "그릴 줄이 있는가" 하나뿐이라 `null`/`''` 를 구분할 소비자가 없고, 투영에 `?? ''` 분기가 생기지
  않습니다. (§14.2 의 `phone` 을 nullable 로 둔 것과 기준이 다른 이유: 그쪽은 "입력 안 함" 과
  "빈 값으로 입력함" 을 **중복 가입 후보 조회**가 구분해야 했습니다.)
- **40자를 넘으면 자르지 않고 `422`** 입니다. 서버가 말없이 자르면 병원이 쓴 문장이 바뀝니다.
- `introduction` 과 합치지 않습니다 — 완성도 항목 5(`introduction ≥ 30자`)가 **긴 소개**를 묻고
  있는데, 한 줄 소개를 같은 칸에 넣으면 그 판정이 무엇을 묻는지 알 수 없게 됩니다.

### 16.8 `앱 화면 미리보기` · 저장 후 안내 — **데이터 변경 0**

| 요청서 항목 | 데이터 |
|---|---|
| 상단 섹션 이동 탭 (기본 정보/진료 시간/사진/병원 특징/진료 시술·가격) | **없음.** 기존 `Anchor`/`fieldAnchorId` 어휘 그대로입니다 |
| `앱 화면 미리보기` | **없음.** 폼이 들고 있는 **저장 전 값**으로 그리는 클라이언트 렌더입니다. 임시저장(draft) 테이블을 만들지 않습니다 — 서버에 "저장되지 않은 병원 정보" 라는 두 번째 진실이 생기고, 어느 쪽이 환자에게 보이는지가 다시 결정 사항이 됩니다 |
| 저장 후 `저장됐어요` 안내 | **없음.** `200` 응답의 화면 표현입니다 |
| 가격 입력 아래 안내 문구(비급여 고시가·할인은 이벤트로) | **없음.** 정적 문구입니다. **서버는 고시가와의 일치를 검증할 수 없습니다**(대조할 데이터가 없습니다) — 책임 경계를 문구로만 말합니다 |

### 16.9 완성도 (§13.7) — 자리로 비워 둔 두 항목을 채웁니다. 7 → **9개**

§13.7 이 `*(자리)* procedurePrices`·`*(자리)* photos` 로 적어 둔 두 줄이 **입력 수단을 얻었으므로**
항목이 됩니다. 선정 기준("담당자가 지금 이 화면에서 입력할 수 있는가")을 둘 다 만족합니다.

| # | `key` | 라벨 | 충족 조건 | `target` |
|---|---|---|---|---|
| 1 | `basicInfo` | 기본 정보 | (기존) | `name` |
| 2 | `businessHours` | 진료시간 | (기존) | `businessHours` |
| 3 | `procedures` | 진료 시술 | `hospital_procedures` 행 ≥ 1 | **`procedures`** ← 키 변경(아래) |
| **4** | **`procedurePrices`** | **시술별 가격** | 행 ≥ 1 **이고, 모든 행이 §16.1 의 ① 또는 ②** | **`procedures`** |
| 5 | `thumbnail` | 대표 이미지 | (기존) | `thumbnail` |
| **6** | **`photos`** | **병원 사진 3장 이상** | `hospital_images` 행 **≥ 3** | **`images`** |
| 7 | `introduction` | 병원 소개 | (기존) | `introduction` |
| 8 | `directions` | 찾아오시는 길 | (기존) | `directions` |
| 9 | `doctors` | 의료진 | (기존) | `doctors` |

**`procedurePrices` 를 "하나라도 적었으면 충족" 으로 하지 않은 이유**: 시술 13개 중 1개만 적고
100% 가 되면, 그 항목은 환자가 비교할 수 있다는 **거짓 신호**가 됩니다. 반대로 "전부" 가 가혹하지
않은 이유는 **`상담 후 안내` 가 클릭 한 번**이기 때문입니다 — 가격을 공개하지 않기로 한 병원도
100% 에 도달할 수 있습니다. 이것이 ②를 ③과 구분해 저장한 값이 하는 일입니다(§16.1).

**`thumbnail`(항목 5)과 `photos`(항목 6)를 둘 다 남깁니다.** 사진 3장이면 대표도 참이라 포함
관계처럼 보이지만, **1~2장 상태에서 둘이 갈립니다**(대표는 있고 3장은 아님). 서로 다른 질문입니다.

**바뀌는 것 둘:**

1. `COMPLETENESS_ITEMS` 배열이 9개가 되고 **순서는 위 표 그대로**입니다(가격은 시술 바로 뒤,
   사진은 대표 이미지 바로 뒤 — 환자 화면에서 비는 자리가 이웃합니다). `completenessPercent` 의
   **"전부 충족이 아니면 99 상한"** 은 **고칠 것이 없습니다** — §13.7 이 바로 이 날을 위해 넣어
   둔 장치입니다.
2. `HOSPITAL_FIELD_KEYS`(= 서버 `422` 의 `details[].field` 어휘)에 **`procedures`·`images`·`tagline`
   3개를 더합니다.** `procedureIds` 는 **응답 전용**으로 남습니다(§16.12) — 요청 필드가
   `procedures` 가 되면 서버 오류 경로도 `procedures[2].priceMin` 이고, 폼 앵커 이름이 그것과
   같아야 `mapHospitalFieldErrors` 의 접두 매칭이 그 칸을 찾습니다. 항목 3의 `target` 도 함께
   `procedures` 로 옮깁니다(같은 섹션이라 포커스 지점은 그대로입니다).

### 16.10 마이그레이션 — 컬럼 7개, **백필 0**

```sql
-- 1) 시술별 가격 (전부 nullable / false 기본값)
ALTER TABLE hospital_procedures ADD COLUMN price_min INTEGER;
ALTER TABLE hospital_procedures ADD COLUMN price_max INTEGER;
ALTER TABLE hospital_procedures ADD COLUMN price_on_request BOOLEAN NOT NULL DEFAULT 0;

-- 2) 사진 ↔ 파일
ALTER TABLE hospital_images ADD COLUMN uploaded_file_id TEXT
  REFERENCES uploaded_files(id);                       -- UNIQUE 인덱스는 Prisma @unique 가 만든다

-- 3) 특징 2개 + 한 줄 소개
ALTER TABLE hospitals ADD COLUMN feature_sedation BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN feature_accessibility BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN tagline TEXT NOT NULL DEFAULT '';

-- 백필 없음. UPDATE 문이 한 줄도 없다.
```

**§14.3 과 달리 백필이 없습니다.** 그쪽은 "기본값이 닫힌 쪽(`pending`)이라 기존 병원이 전부
앱에서 사라지는" 문제가 있어 같은 마이그레이션에서 열어 줘야 했습니다. 여기서는 **기본값이
곧 사실**입니다 — 기존 병원 11곳은 실제로 시술별 가격을 적은 적이 없고(③), 수면 진료·장애인
편의시설을 신고한 적이 없으며, 한 줄 소개를 쓴 적이 없습니다. **없는 사실을 지어내지 않습니다.**

**화면 회귀 0 을 보장하는 연결 고리**: 모든 행이 ③ → `hospitalPriceSection` 이 `hospitalRange`
→ 병원 상세가 지금과 **똑같이** 전체 가격대를 그립니다 (§16.4).

**완성도 바는 내려갑니다** — 항목이 7 → 9 가 되고 새 두 항목은 전부 미충족이라, 7/7 이던
병원이 7/9(78%)가 됩니다. **의도된 것입니다**: 요청 07 이 "채울 수 있게 된 칸" 을 두 개 늘렸고,
완성도는 그 칸이 비었다는 사실을 말해야 합니다. (§13.7 이 "항목이 07 에서 늘어난다" 를 전제로
설계된 이유입니다.) **이 사실을 릴리스 노트에 적습니다** — 적지 않으면 담당자는 "내가 아무것도
안 했는데 점수가 깎였다" 로 읽습니다.

### 16.11 인덱스 — **추가 0**

| 질의 | 인덱스 |
|---|---|
| 이 병원의 시술·가격 (상세·관리자 폼) | `hospital_procedures @@unique([hospital_id, procedure_id])` **기존** — 선두 컬럼 조회입니다 |
| 이 병원의 사진 (순서대로) | `hospital_images @@index([hospital_id, sort_order])` **기존** |
| 이 병원의 사진 파일 / 고아 파일 정리 | `uploaded_files (hospital_id, purpose)` · `(purpose, created_at)` **§14.14 가 이미 "07 의 이 병원의 사진" 용도로 깔아 둔 것** |
| 파일 ↔ 표시 행 역조회 | `hospital_images.uploaded_file_id` **UNIQUE**(제약이 곧 인덱스) |

**만들지 않는 인덱스**: `hospital_procedures(price_min)` — "인레이 싼 순" 같은 **가격 정렬·필터
화면이 없습니다.** 탐색 `가격 비교표` 는 이미 받은 목록을 클라이언트가 정렬합니다(§6.7 기준).
`hospitals(feature_sedation)` 등 boolean — §6.7 이 적어 둔 그대로 선택도가 낮습니다.

### 16.12 원자성 — 저장 한 번 = 트랜잭션 하나, 그리고 **교체가 아니라 머지**

> ⚠ **이 절에서 가장 조용한 사고 지점입니다.** 지금 `PATCH /hospitals/{id}` 는 `procedureIds`
> **배열**을 받고 조인 행을 **전체 교체**합니다(delete all → insert). 가격 컬럼을 그 테이블에
> 올려 두고 교체 방식을 그대로 두면, **병원 이름만 고쳐 저장해도 시술별 가격이 전부 사라집니다.**

**그래서 요청 본문의 모양이 바뀌어야 합니다** (계약 결정 — interface-master):

```jsonc
// 지금
"procedureIds": ["implant", "inlay"]

// 제안
"procedures": [
  { "procedureId": "implant", "priceMin": 1200000, "priceMax": 1800000 },
  { "procedureId": "inlay",   "priceOnRequest": true },
  { "procedureId": "crown" }                                   // 체크만 (③)
]
```

| 안 | 판단 |
|---|---|
| ✅ **배열 하나(`procedures`)로 합친다** | 채택 — 서버는 이 목록으로 **upsert + 목록에 없는 행 delete**. 가격은 보낸 값으로 덮습니다 |
| `procedureIds` 와 `prices` 두 배열 | 기각 — **"체크는 됐는데 가격 배열에 없는 시술"·"가격은 있는데 체크 안 된 시술" 을 계약이 허용**하게 됩니다. §16.1 이 테이블에서 없앤 상태를 계약이 되살립니다 |

- **응답의 `procedureIds` 는 그대로 남깁니다** — 병원 카드·상세·전문의·검색이 전부 쓰는 필드이고,
  `procedures` 에서 **파생되는 읽기 전용 값**입니다(두 출처가 아닙니다).
- `procedures` 와 `procedureIds` 가 **요청에 둘 다 오면 `422`** 입니다. 우선순위 규칙을 만드는 것은
  "둘 다 보내도 된다" 는 신호가 됩니다.
- `minItems: 1` 은 그대로입니다(§13.7 의 전제 유지).

**트랜잭션 경계 (요청 1건 = 트랜잭션 1개):**

| 저장 | 한 트랜잭션 안 | 밖 |
|---|---|---|
| 병원 정보 저장 | `hospitals` UPDATE + `hospital_procedures` 머지 + `business_hours` 교체 + `hospital_images` 교체(+`sort_order` 재부여) + `hospitals.thumbnail` 동기화 + `uploaded_files` **claim** | **파일 업로드 자체**(`POST /uploads`) — 저장을 누르기 전에 일어납니다 (§14.5 와 같은 구조) |

**파일 claim 은 조건부 UPDATE 입니다** (§14.5 의 사업자등록증과 같은 처방):

```sql
UPDATE uploaded_files
   SET hospital_id = :hospitalId
 WHERE id = :fileId
   AND purpose = 'hospital_photo'
   AND (hospital_id IS NULL OR hospital_id = :hospitalId)   -- 남의 병원 파일을 가져올 수 없다
   AND uploaded_by_user_id = :currentUserId                 -- 남이 올린 파일을 가져올 수 없다
   AND purged_at IS NULL;
-- 영향 행이 0이면 트랜잭션 전체를 롤백하고 422 UPLOAD_NOT_FOUND / 409 UPLOAD_ALREADY_CLAIMED
```

**조건이 없으면 id 를 바꿔 가며 남의 파일을 자기 병원 사진으로 끌어올 수 있습니다** —
id 가 추측하기 어려운 것은 통제가 아닙니다.

**사진 목록은 전체 교체입니다** — 시술과 달리 사진에는 "이 행에만 붙은 입력값" 이 없어서
(순서가 곧 전부라) 교체가 머지보다 단순하고, 순서 재부여도 한 번에 끝납니다.

### 16.13 만들지 않는 것

| 안 만든 것 | 대신 | 근거 |
|---|---|---|
| `hospital_procedure_prices` 테이블 | `hospital_procedures` 컬럼 3개 | 입도가 같습니다. 나누면 어긋난 상태가 표현 가능해집니다 (§16.1) |
| 세부 시술 31종 마스터 테이블 / `procedures` 행 18개 추가 | — | 노출 목록이 바뀝니다. 요청서가 "노출 규칙은 그대로" 라고 못 박았습니다 (§16.2) |
| 가격 **이력** 테이블 | — | 가격 변동을 보는 화면이 없습니다. "언제 올렸나" 가 요구되면 그때 만들고, 그 전까지는 `audit_logs` 도 이 행위를 기록하지 않습니다(관리자 행위 중 **열람·심사**가 감사 대상입니다 — §11.2) |
| `hospital_procedures.price_unit` / `currency` | 원(Int) 고정 | 통화가 하나입니다. 단위 컬럼은 "섞여 들어올 수 있다" 는 신호가 됩니다 (§16.3) |
| `hospitals.price_min/max` **삭제** | 폴백으로 유지 | 요청서 지시 + 11곳의 표시가 사라집니다 (§16.4) |
| `hospital_images.is_primary` | `sort_order` 최솟값 | 판정이 두 곳이 됩니다 (§16.5) |
| `uploaded_files.sort_order` / `is_primary` (§14.15 가 "07 이 만든다" 고 적은 둘) | `hospital_images` | 순서·대표는 **파일의 성질이 아니라 목록의 성질**입니다. 파일 테이블에 넣으면 사업자등록증 행에도 그 컬럼이 생깁니다 |
| `uploaded_files.width`/`height`·썸네일 메타 | — | §14.15 와 같습니다. 리사이즈·크롭 요구가 없습니다 |
| `feature_night_care` / `feature_weekend` 컬럼 | `derivedHourFeatures()` | 같은 사실이 두 곳에 있으면 어긋납니다 (§16.6) |
| 병원 정보 **임시저장(draft)** 테이블 | 클라이언트 상태 | 미리보기는 저장 전 값입니다 (§16.8) |
| 할인 가격 필드 | `promotions` | 요청서 그대로 — "할인 가격은 이벤트에서 따로 등록" |
| `tagline` 의 노출 on/off 컬럼 | 빈 문자열 | 안 보이게 하려면 비우면 됩니다 |

### 16.14 백엔드 작업 체크리스트 (요청서 19 에서 처리)

*(2026-10-21 개정 — 혼자 개발 체제. 원래 제목은 "백엔드 인계 체크리스트" 이고, "협업자 확인 후 ①은 이
문서의 작성자가, ②부터는 협업자 영역" 이라고 적혀 있었습니다. 목록 자체는 그대로 둡니다 — 이제 이것은
**요청서 19 를 처리하는 사람이 보는 목록**입니다.)*

**요청서 19 (`docs/features/requests/2026-10-21-19-병원정보-시술별가격-사진.md`) 를 처리할 때** 아래
순서로 진행합니다. 기다릴 외부 확인은 없습니다. ①은 interface-master 가, ②부터는 같은 저장소의
**backend-engineer** 가 맡습니다.
**§14(요청서 18)의 `uploaded_files` 가 먼저 들어가야 ⑤·⑥ 이 가능합니다.**

- [ ] ① **interface-master 가 계약을 확정**한다 — §16.15 의 인계 목록. `openapi.yaml`·
      `docs/api/README.md` 는 이 문서의 작성자가 건드리지 않았습니다
- [ ] ② `schema.prisma` + `docs/database/schema.dbml` 반영 (컬럼 7 + `UploadedFile.hospitalImage` 역방향 필드 — **DDL 변화 0**)
  - [ ] `hospital_procedures` **+3**: `price_min`·`price_max`(둘 다 nullable), `price_on_request`(`@default(false)`)
  - [ ] `hospital_images` **+1**: `uploaded_file_id`(nullable, **UNIQUE**, `onDelete: Restrict`)
  - [ ] `hospitals` **+3**: `feature_sedation`·`feature_accessibility`(`@default(false)`), `tagline`(`@default("")`)
  - [ ] `uploaded_files.purpose` 주석에 값 추가 — `business_registration | hospital_photo`
- [ ] ③ **마이그레이션** — `ADD COLUMN` 7줄, **`UPDATE` 없음** (§16.10)
- [ ] ④ 순수 함수 4묶음 + 단위 테스트 (§16.3·16.4·16.5·16.6).
      **경계값을 테스트로 고정**: `min === max`, `min > max`, 한쪽만 입력, `onRequest` + 금액,
      17:59/18:00, 토요일만 진료, `휴진`·파싱 불가 문자열, 사진 11장/12장, 사진 0장일 때 `thumbnail`
- [ ] ⑤ 쓰기 경로 — `procedures` 배열 **머지**(upsert + 차집합 delete). ⚠ **지금의 전체 교체를
      그대로 두면 이름만 고쳐도 가격이 날아갑니다** (§16.12)
- [ ] ⑥ 사진 저장 — 목록 교체 + `sort_order` 0..n-1 재부여 + `thumbnail` 동기화 + 파일 **조건부
      claim**(§16.12 SQL). 사진이 빠진 `uploaded_files` 행은 **지우지 않고** 고아 정리 배치가 맡는다
      (`purpose='hospital_photo' AND 참조하는 hospital_images 행 없음 AND created_at < cutoff`)
- [ ] ⑦ 읽기 경로 — 병원 상세 투영에 `procedures[].price*` 와 파생 특징 2개. **`Hospital.images`·
      `thumbnail`·`procedureIds` 의 모양은 바뀌지 않습니다**(기존 화면 회귀 0)
- [ ] ⑧ 완성도 — 서버 `hospital/completeness.ts` 항목 9개 (§16.9). 프런트
      `features/hospital/lib/completeness.ts` 와 **같은 표·같은 순서**로 맞춘다
- [ ] ⑨ 프런트 — `HOSPITAL_FIELD_KEYS` +3(`procedures`·`images`·`tagline`), 항목 3의 `target` 을
      `procedures` 로, `HospitalForm` 의 `Anchor field="procedureIds"` → `"procedures"`
- [ ] ⑩ 시드 — **기존 fixture 11곳의 값은 바꾸지 않는다**(seed 가 import 하는 파일입니다).
      시술별 가격·사진 파일의 시드 데이터를 **만들지 않습니다** — 기본값 그대로가 "아직 안 적음"
      이고, 그 상태의 화면(폴백)이 실제로 가장 많이 보일 상태입니다
- [ ] ⑪ `docs/features/admin-hospital-edit.md`·`hospital-detail.md` 갱신,
      `known-issues.md` 의 **"수정 화면에서 대표 이미지를 바꿔도 상세 사진이 그대로"** 줄 해소
      (§16.5 의 `thumbnail` 동기화가 그 원인을 없앱니다)

### 16.15 interface-master 에 넘기는 것

| 자리 | 변경 |
|---|---|
| `HospitalWriteInput` (`POST /hospitals`, `PATCH /hospitals/{id}`) | **`procedureIds` → `procedures: HospitalProcedureInput[]`** (§16.12). `minItems: 1` 유지. 둘 다 오면 `422` |
| **신규 스키마** `HospitalProcedureInput` | `procedureId`(필수, `ProcedureId` enum) · `priceMin`·`priceMax`(nullable **정수, 원**) · `priceOnRequest`(기본 `false`) |
| `Hospital` 응답 | `procedures[]` **추가** (위 필드 + 서버가 아는 시술명). **`procedureIds` 는 유지**(파생, 읽기 전용) |
| `Hospital` 응답 | `tagline` **추가**(문자열, 항상 있음, 빈 문자열 가능) |
| `HospitalFeatures` 스키마 | **키 2개 추가** — `sedation`·`accessibility`. **`nightCare`·`weekend` 는 "읽기 전용 파생"** 임을 설명에 못 박는다(요청에 오면 `422` — 진료시간이 정합니다) |
| `HospitalWriteInput.images` | **쓰기 가능으로** — 지금 수정 화면이 보내지 않는 필드입니다. `maxItems: 11`, **첫 항목이 대표**라는 사실을 설명에 적는다 |
| `POST /uploads` | **`purpose` 에 값 추가** — `hospital_photo`. 이 purpose 는 **인증 필수**(가입 전 업로드가 아닙니다)이고 응답에 **공개 URL 을 포함**한다(사업자등록증과 다른 점 — §16.5). 크기·타입 제한은 이미지 전용으로 좁힌다 |
| 공개 사진 열람 | `GET /uploads/{id}/content` 는 **운영자 전용**입니다. 사진은 그 경로가 아니라 `hospital_images.url` 로 노출됩니다 — **URL 발급 주체·형태가 결정 항목**입니다 (§16.16-7) |
| `422 details[].code` 후보 | `PRICE_RANGE_INVERTED` · `PRICE_INCOMPLETE` · `PRICE_NOT_ALLOWED_ON_REQUEST` · `PRICE_OUT_OF_RANGE` · `PROCEDURE_DUPLICATED` · `TOO_MANY_IMAGES` · `TAGLINE_TOO_LONG` · `FEATURE_NOT_WRITABLE`(파생 특징을 보냈다) · `UPLOAD_NOT_FOUND`(**기존 재사용**) · `UPLOAD_ALREADY_CLAIMED` |
| `details[].field` 어휘 | `procedures[i].priceMin` 처럼 **인덱스 경로**로 내려줘야 폼이 그 줄을 짚을 수 있습니다. 묶음 키는 `procedures`·`images`·`tagline` |
| 완성도 응답 (§13.7 / `docs/api/README.md` §14) | 항목 **7 → 9**, `key` 두 개(`procedurePrices`·`photos`)와 순서 (§16.9) |
| 금액 단위 | **원(정수).** 화면의 `만원` 은 표시 단위입니다 — 계약에 단위를 명시해 주세요 (§16.3) |

### 16.16 남은 미결 · 요청자에게 물을 것

> **답: 요청서 19(`2026-10-21-19-병원정보-시술별가격-사진.md`)의 표 — 반영은 그 요청서에서.**
> 아래 질문은 지우지 않고 그대로 둡니다. 이 자리는 **2026-10-13 시점의 열린 질문 기록**이고,
> 답은 요청서 19 에 표로 적혀 있습니다 *(2026-10-21 개정 — 혼자 개발 체제. 원래 제목은
> "남은 미결 · 협업자에게 물을 것" 이었습니다)*.

1. **CCTV 설치 칩을 어떻게 할 것인가.** 요청서의 칩 9개에 없는데 **컬럼도 배지도 지금 있습니다.**
   폼에서만 빼면 **고칠 수 없는 값**이 됩니다(켜져 있는 병원이 끌 수 없습니다). **칩 10개로
   남기기를 권합니다.** 내리기로 하면 컬럼은 남기되 배지도 함께 내려야 합니다
2. **`야간상담`(`feature_night_consult`)과 파생 `야간 진료` 의 관계.** 둘은 **다른 사실**입니다
   (늦게까지 상담 전화를 받는 것 ≠ 늦게까지 진료하는 것). 그런데 **탐색의 조건 칩 `진료시간` 이
   실제로 거르는 값은 `nightConsult`** 입니다(계약에 그렇게 적혀 있습니다). 환자가 `진료시간` 칩을
   누르고 기대하는 것은 **야간 진료** 쪽에 가깝습니다. 칩의 기준을 파생 값으로 옮길 것인가가
   열린 질문입니다 — 옮기면 **필터가 컬럼이 아니라 `business_hours` 조인/파싱**이 되어 질의가
   무거워집니다(그때는 §16.6 의 "진료시간 구조화" 가 선행 조건입니다). 이번 범위에서는
   **둘 다 그대로 두고 배지 문구만 구분**하기를 권합니다
3. **`business_hours.hours` 를 구조화할 것인가.** 자유 문자열이라 `야간 진료` 파생이 파싱에
   의존합니다(§16.6). `open_minutes`/`close_minutes`(+점심)로 쪼개면 파생이 정확해지고 진료시간
   필터도 가능해지지만, **관리자 폼·계약·기존 11곳 이관이 따라오는 별도 작업**입니다
4. **가격의 0·상한 규칙** — `min > 0`, 상한 1억원은 **제안값**입니다. 비급여 최고가(풀마우스
   임플란트 등)를 생각하면 상한을 더 올려야 할 수도 있습니다
5. **세부 시술 18개에 가격을 적고 싶다는 요구가 오면** — §16.2. `procedures` 마스터 확장 +
   "저장은 되지만 노출 목록에는 없는 시술" 이라는 축이 함께 필요합니다. **07(=요청서 19) 범위
   밖**이고, 시술 분류를 서버로 옮기는 일은 **요청서 14** 가 맡습니다 *(2026-10-21 추가)*
6. **업로드 인증** — §14.17-2 의 결정이 사업자등록증(가입 전, 토큰 없음)에 걸려 있는데,
   **병원 사진은 로그인 뒤에 올립니다.** 그래서 `hospital_photo` 는 **인증 필수**로 못 박을 수
   있고, 06 의 결정이 어느 쪽으로 가도 영향받지 않습니다 — 확인만 받으면 됩니다
7. **사진 공개 URL 의 형태** — ⓐ 공개 `GET /files/{fileId}` 를 새로 열거나 ⓑ 저장소 공개 URL 을
   그대로 쓰거나(객체 저장소 전제) ⓒ 정적 경로. **데이터 설계는 어느 쪽이든 같습니다**
   (`hospital_images.url` 에 문자열이 들어갑니다). 다만 ⓑ 는 파기(`purged_at`) 후에도 URL 이
   살아 있을 수 있어 **파기 절차가 저장소 객체 삭제까지 해야 합니다**(§14.7 이 이미 그렇게 적었습니다)
8. **사진 파기·보존** — 병원이 사진을 빼면 `hospital_images` 행은 사라지고 `uploaded_files` 행은
   남습니다. 고아 사진 파일의 보존 기간(제안: §14.7 의 고아 24시간과 **다르게**, 실수 복구를 위해
   **7일** 뒤 파기)을 정해야 합니다
9. **탐색 `가격 비교표` 를 시술별 가격으로 바꿀 것인가.** 지금은 `priceRange.min`(병원 전체)을
   씁니다. 시술 칩으로 좁힌 상태라면 **그 시술의 `price_min`** 이 비교표가 원래 말하려던 숫자입니다.
   요청서에 없어 이번에 하지 않습니다 — 하기로 하면 목록 응답에 `procedures[].price*` 가 필요하고
   (지금은 상세에만 있어도 됩니다) **응답 크기가 늘어납니다**
10. **전체 가격대(`hospitals.price_min/max`)의 폐기 시점과 조건** — §16.4. 지금 정하지 않습니다.
    `procedurePrices` 완성도 충족률이 그 판단 근거입니다

---

## 17. 시술 분류를 서버로 — 분야 9 · 세부 31 · `준비중` 파생 (요청 14)

| | |
|---|---|
| **상태** | **설계 확정. 구현 대기** — 이 절 → interface-master(계약) → backend-engineer(서버) → designer/frontend-engineer → code-reviewer → qa-master 순으로 **요청서 14** 에서 진행합니다 *(2026-10-21)* |
| **요구사항 출처** | `docs/features/requests/2026-10-21-14-시술분류-서버로-준비중-풀기.md`, `docs/features/known-issues.md`(개발자용 메모 "요청서 14 에서 할 일" 1~6), 화면: `home.md`·`category.md`·`explore.md`·`search.md`·`admin-hospital-edit.md` |
| **새 테이블** | **1개** — `procedure_categories` (9행) |
| **새 컬럼** | **1개** — `procedures.category_id` (NOT NULL, FK) |
| **데이터 변경** | `procedures` 13행 → **31행**. 그중 **6행은 id 가 바뀝니다**(기존 자식 행 전부 재지정) |
| **인덱스** | **추가 0** (§17.10) |
| **선행** | 요청서 12(혼자 개발 체제). §8.7 의 테스트 DB 분리가 이미 끝나 있어야 합니다 — 이 마이그레이션은 **데이터를 옮기므로** 빈 DB 와 데이터가 있는 DB 양쪽에서 돌아야 하고, 그 둘을 매번 확인하는 자리가 테스트 DB 입니다 |
| **후속** | **요청서 17**(공공데이터 병원)과 **19**(시술별 가격)가 이 절의 31개 id 위에 붙습니다. 그래서 id 를 지금 정리합니다 (§17.3) |

요청서가 "건드리지 말아달라" 고 한 네 가지가 이 절의 제약입니다.

| 요청서의 제약 | 이 절에서 |
|---|---|
| 분야 9개·세부 31개의 **이름과 순서**는 `taxonomy.ts` 그대로 | `procedure_categories.name`·`procedures.name`·`sort_order` 가 그 파일의 값·배열 순서를 **그대로** 받습니다 (§17.4). 두 사본이 갈리지 않게 테스트가 묶습니다 (§17.8) |
| 원데이는 시술이 아니라 병원 특징 | `hospitals.is_one_day` 그대로. `procedures` 에 '원데이' 행을 만들지 않습니다 |
| 예전 주소(`/explore?category=<옛 시술 id>`)는 계속 열려야 한다 | **별칭 표**(옛 id → 새 id) 하나로 받습니다. **서버가 아니라 화면이 풉니다** (§17.5) |
| 기존 병원 11곳의 시술 등록이 사라지면 안 된다 | 마이그레이션이 자식 행을 **지우지 않고 재지정**합니다. 이관 후 행 수가 같다는 것을 단정으로 고정합니다 (§17.6) |

### 17.1 무엇을 서버가 갖게 되는가 — 결정 3개

| # | 결정 | 근거 |
|---|---|---|
| 1 | **서버 시술 id = 화면의 세부 시술 id 31개.** 매핑 계층을 없앱니다 | 지금은 서버 13 ↔ 화면 31 사이에 `taxonomy.ts` 의 `legacyProcedureId` 가 있습니다. 같은 하나를 가리키는 이름이 둘이라 화면·서버·계약 어디를 봐도 상대를 한 번 번역해야 합니다 (`known-issues.md` 🔵 "화면에 보이는 시술 이름이 서버에 저장된 이름과 다릅니다") |
| 2 | **분야는 테이블이다** (`procedure_categories` 9행 + `procedures.category_id`) | 분야를 화면이 계산해서 분야 세 곳의 광고 우선 노출이 꺼지고 100곳 제한이 생겼습니다 (`known-issues.md` 🟠). 분야가 컬럼이면 `GET /hospitals?categoryId=` 한 번으로 끝납니다 (§17.9) |
| 3 | **`준비중` 은 컬럼이 아니라 파생이다** | 요청서가 규칙을 "앱에 노출되는 병원 중 그 시술을 하는 곳이 1곳 이상" 으로 정했습니다. 그 규칙의 입력은 전부 DB 에 이미 있습니다. 컬럼으로 두면 **병원이 체크할 때마다 갱신해야 하는 두 번째 사실**이 생기고, 갱신을 한 번 빠뜨리면 "병원은 있는데 준비중" 이 됩니다 (§17.7) |

> 인계 목록(`known-issues.md`)의 1번은 "세부 시술 18행 추가 + **준비중 플래그**" 였습니다. 요청서 14 가
> 세는 규칙을 명시했으므로 **플래그는 만들지 않습니다** — 요청서가 인계 메모를 대체합니다.

### 17.2 `procedure_categories` — 9행, 컬럼 4개

```prisma
/// 시술 분야 9개. 화면의 `features/procedure/taxonomy.ts` 가 갖고 있던 표가 서버로 왔다.
model ProcedureCategory {
  /// implant | prevention | orthodontics | cavity | aesthetic | gum | tmj | botox | extraction
  id          String @id
  name        String
  /// 홈 격자 카드의 한 줄 설명 ('상실된 치아를 인공 치근으로 대체해요')
  description String
  /// 홈 격자·탐색 탭·관리자 폼 섹션이 공유하는 고정 노출 순서
  sortOrder   Int    @map("sort_order")

  procedures Procedure[]

  @@map("procedure_categories")
}
```

**두지 않은 컬럼 둘.**

- **아이콘** — 분야 아이콘은 요청 13 에서 **그림(React 컴포넌트, `CATEGORY_ICONS`)** 이 됐습니다. 문자열 컬럼을 둬도 화면이 그것으로 그릴 수 없습니다. 이모지는 `procedures.emoji` 에만 남습니다(커뮤니티 글 작성의 시술 선택이 그것을 씁니다)
- **동의어(keywords)** — 요청서가 "동의어는 지금처럼 화면 `taxonomy.ts` 에 두어도 된다" 고 했습니다. 검색 추천은 아직 화면이 조합하고(`known-issues.md` 개발자용 메모), 서버가 `GET /search/suggest` 를 갖게 되는 날 **그 요청서에서** 옮기면 됩니다. 소비자 없는 테이블을 먼저 만들지 않습니다 (AGENTS.md)

### 17.3 `procedures` — 31행, id 를 세부 시술 id 로 통일합니다

```prisma
model Procedure {
  id               String @id
  name             String
  emoji            String
  shortDescription String @map("short_description")
  description      String
  sortOrder        Int    @map("sort_order")

  /// ★ 추가. 분야 9개 중 하나. 분야 없는 시술은 없다
  categoryId String @map("category_id")
  category   ProcedureCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  // (기존 관계 8개 그대로)
  @@index([sortOrder])
  @@map("procedures")
}
```

`sort_order` 는 **31개 전체의 통짜 순서(0~30)** 입니다 — 분야 순서 × 분야 안 순서를 한 번에 담습니다. 분야별 두 번째 순서 컬럼을 두지 않는 이유: `taxonomy.ts` 의 `SUB_PROCEDURES` 배열이 이미 그 순서로 선언돼 있고, 분야 안 순서는 `WHERE category_id=? ORDER BY sort_order` 로 그대로 나옵니다. 컬럼이 둘이면 **둘이 어긋난 상태**(분야 안 순서는 맞는데 전체 순서가 뒤집힌)가 표현 가능해집니다.

**id 6개가 바뀝니다.**

| 옛 서버 id | 새 id | 새 이름 | 왜 바꾸는가 |
|---|---|---|---|
| `implant` | `implant-general` | 일반 임플란트 | **분야 id 와 충돌합니다.** `implant` 는 이제 분야(임플란트)의 id 입니다 |
| `orthodontics` | `bracket-braces` | 일반(브라켓)교정 | 분야 id 충돌 (교정) |
| `cavity` | `resin` | 레진 | 분야 id 충돌 (충치치료). 옛 `cavity` 는 분야 전체가 아니라 **레진 하나**를 가리켰습니다 |
| `tmj` | `tmj-treatment` | 턱관절장애 치료 | 분야 id 충돌 (턱관절·스플린트) |
| `botox` | `bruxism-botox` | 이갈이 보톡스 | 분야 id 충돌 (보톡스). 사각턱 보톡스는 별도 행이 됩니다 |
| `gum-disease` | `gum-treatment` | 잇몸치료 | 충돌은 없지만 **화면 이름과 id 를 맞춥니다** — 나머지 30개가 전부 세부 시술 id 인데 하나만 옛 이름이면 다음 사람이 그것을 규칙으로 읽습니다 |

나머지 7개는 id 그대로입니다 (`inlay` `crown` `laminate` `whitening` `splint` `snoring-device` `wisdom-tooth`). 이름은 `wisdom-tooth` 만 `사랑니` → `사랑니 발치` 로 바뀝니다.

**왜 "지금" 바꾸는가.** id 변경은 자식 행 재지정을 동반하는 유일하게 번거로운 작업입니다. 그런데
**요청 17(공공데이터 비급여 가격)과 19(시술별 가격)가 이 id 에 값을 붙입니다.** 가격 행이 붙은
뒤에 바꾸면 옮길 테이블이 늘고, 바꾸지 않으면 `implant` 가 **어떤 맥락에서는 분야, 어떤 맥락에서는
세부 시술**인 상태가 영구히 남습니다 — `?categoryId=implant` 와 `?procedureId=implant` 가 서로 다른
것을 가리키는 API 는 반드시 누군가 틀립니다.

**막는 것이 있었는가 — 없습니다.** `procedures` 를 가리키는 FK 8개는 전부 `ON UPDATE CASCADE`
(`migrations/20260812121726_init/migration.sql`)지만, 마이그레이션은 **그 캐스케이드에 기대지 않습니다**
(§17.6) — PK 를 UPDATE 하지 않고 "새 행 삽입 → 자식 재지정 → 옛 행 삭제" 로 갑니다. `foreign_keys`
pragma 가 켜져 있든 꺼져 있든 결과가 같아야 하기 때문입니다.

### 17.4 31행의 값 — 이름·순서는 `taxonomy.ts`, 문구는 새로 씁니다

`sort_order` 는 아래 표의 행 번호(0부터)입니다. `name`·`category_id`·순서는 `taxonomy.ts` 에서 **그대로** 옮긴 값이고, `emoji`·`short_description`·`description` 은 기존 13개의 문체(fixture `procedures.ts`)에 맞춰 새로 적었습니다. 기존 13개 중 **의미가 좁아진 4개**(`resin`·`gum-treatment`·`bracket-braces`·`bruxism-botox`)는 문구도 고쳤습니다 — 옛 문구가 분야 전체를 설명하고 있어서 세부 시술 이름 아래 그대로 두면 틀린 말이 됩니다.

| # | id | 이름 | 분야 | emoji | 한 줄 소개 | 설명 |
|---|---|---|---|---|---|---|
| 0 | `implant-general` | 일반 임플란트 | implant | 🦷 | 자연치아처럼 튼튼하게 | 상실된 치아 자리에 인공 치근을 심고 보철물을 올리는 시술입니다. 재료와 식립 개수에 따라 비용과 기간이 달라져요. |
| 1 | `bone-graft` | 뼈이식 | implant | 🧱 | 임플란트 심을 자리를 만들어요 | 잇몸뼈(치조골)가 부족할 때 뼈를 채워 임플란트를 심을 수 있는 상태로 만드는 시술입니다. |
| 2 | `sinus-lift` | 상악동거상술 | implant | ⛰️ | 위턱 어금니 임플란트를 위해 | 위턱 어금니 쪽 뼈가 얇을 때 상악동 점막을 들어 올려 뼈를 보강한 뒤 임플란트를 심는 시술입니다. |
| 3 | `implant-denture` | 임플란트 틀니 | implant | 🔩 | 틀니를 임플란트로 고정 | 임플란트 몇 개를 심어 틀니를 단단히 고정하는 방식입니다. 잇몸으로만 지지하는 틀니보다 잘 흔들리지 않아요. |
| 4 | `scaling` | 스케일링 | prevention | 🪥 | 치석을 제거해 잇몸 건강을 지켜요 | 칫솔질로 닿지 않는 치석과 치태를 기구로 제거하는 기본 예방 처치입니다. |
| 5 | `fluoride` | 불소도포 | prevention | 🧴 | 충치에 강한 치아로 | 치아 표면에 불소를 발라 산에 대한 저항성을 높이고 초기 충치를 예방하는 처치입니다. |
| 6 | `sealant` | 실란트 | prevention | 🧷 | 어금니 홈을 미리 메워요 | 어금니 씹는 면의 깊은 홈을 메워 음식물이 끼지 않게 하는 충치 예방 처치입니다. |
| 7 | `halitosis` | 구취관리 | prevention | 🌬️ | 입냄새의 원인을 찾아서 | 입냄새의 구강 내 원인(치주질환·설태·건조)을 찾아 치료하고 관리법을 안내하는 진료입니다. |
| 8 | `clear-aligner` | 투명교정 | orthodontics | 💎 | 눈에 잘 띄지 않는 교정 | 투명한 장치를 단계별로 바꿔 끼며 치아를 움직이는 교정 방식입니다. 탈착이 가능해요. |
| 9 | `lingual-braces` | 설측교정 | orthodontics | 🫥 | 장치를 치아 안쪽에 | 교정 장치를 치아 안쪽 면에 붙여 겉으로 보이지 않게 하는 교정 방식입니다. |
| 10 | `bracket-braces` | 일반(브라켓)교정 | orthodontics | 😁 | 가장 널리 쓰는 교정 방식 | 치아 바깥면에 브라켓을 붙이고 와이어로 치아를 움직이는 교정입니다. 메탈·세라믹 브라켓을 고를 수 있어요. |
| 11 | `partial-ortho` | 부분교정 | orthodontics | ⏱️ | 필요한 곳만 짧게 | 앞니 등 일부 구간만 움직이는 교정입니다. 전체 교정보다 기간과 비용이 작아요. |
| 12 | `resin` | 레진 | cavity | 🩹 | 충치 부위를 치아색으로 | 충치를 제거한 자리를 치아 색 레진으로 채우는 보존 치료입니다. 하루에 끝나는 경우가 많아요. |
| 13 | `inlay` | 인레이 | cavity | 🧩 | 충치 부위만 정밀하게 | 충치로 손상된 부위를 본떠 만든 보철물을 끼워 넣는 시술로, 삭제 범위를 최소화할 수 있어요. |
| 14 | `onlay` | 온레이 | cavity | 🔷 | 씹는 면까지 덮어서 | 인레이보다 손상 범위가 클 때 치아의 씹는 면(교두)까지 덮어 복원하는 보철입니다. |
| 15 | `crown` | 크라운 | cavity | 👑 | 손상된 치아를 감싸기 | 신경치료 후이거나 손상이 큰 치아를 전체적으로 감싸 씌워 기능과 모양을 회복하는 보철 시술입니다. |
| 16 | `root-canal` | 신경치료 | cavity | 🪡 | 치아를 살려서 쓰기 위해 | 충치가 신경까지 닿았을 때 염증이 생긴 치수를 제거하고 내부를 소독·충전하는 치료입니다. |
| 17 | `laminate` | 라미네이트 | aesthetic | ✨ | 치아 앞면을 얇게 코팅 | 치아 앞면을 얇게 삭제한 뒤 세라믹 조각을 부착해 색과 모양을 개선하는 심미 시술입니다. |
| 18 | `whitening` | 치아미백 | aesthetic | 🌟 | 치아 색을 밝게 | 약제를 이용해 치아 표면의 착색을 개선하고 색조를 밝게 만드는 심미 시술입니다. |
| 19 | `gum-contouring` | 잇몸성형 | aesthetic | 💗 | 웃을 때 잇몸이 많이 보인다면 | 잇몸 라인을 다듬어 치아와 잇몸의 비율을 맞추는 심미 시술입니다. |
| 20 | `gum-treatment` | 잇몸치료 | gum | 🌿 | 잇몸 염증을 가라앉혀요 | 잇몸 속 치석과 염증 조직을 제거해 치주질환의 진행을 막는 치료입니다. |
| 21 | `periodontal-surgery` | 치주수술 | gum | 🩺 | 깊은 치주질환에는 수술로 | 비수술 치료로 닿지 않는 깊은 치주 조직을 잇몸을 열어 직접 치료하는 수술입니다. |
| 22 | `gum-graft` | 잇몸이식 | gum | 🌱 | 내려앉은 잇몸을 덮어요 | 잇몸이 퇴축해 치아 뿌리가 드러난 부위에 연조직을 이식해 덮는 시술입니다. |
| 23 | `tmj-treatment` | 턱관절장애 치료 | tmj | 🦴 | 통증·소리·개구장애 개선 | 턱관절의 통증, 소리, 입 벌림 제한 등을 진단하고 치료하는 턱관절 질환 관리 진료입니다. |
| 24 | `splint` | 스플린트 | tmj | 🛡️ | 턱관절에 가는 힘을 분산 | 교합을 안정시켜 턱관절과 근육의 부담을 줄이는 구강 내 장치 치료입니다. |
| 25 | `bruxism-device` | 이갈이장치 | tmj | 🌙 | 자는 동안 치아를 보호 | 수면 중 이갈이로부터 치아 마모와 턱 근육 긴장을 막아 주는 장치입니다. |
| 26 | `snoring-device` | 코골이장치 | tmj | 😴 | 수면 중 코골이 완화 | 하악을 전방으로 유도해 기도를 확보, 코골이와 수면무호흡을 완화하는 구강 내 장치입니다. |
| 27 | `bruxism-botox` | 이갈이 보톡스 | botox | 💉 | 이갈이로 뭉친 근육을 풀어요 | 저작근에 보톡스를 주입해 이갈이·이악물기로 인한 근육 긴장과 턱 통증을 완화하는 시술입니다. |
| 28 | `masseter-botox` | 사각턱(교근) 보톡스 | botox | 💆 | 턱선을 갸름하게 | 발달한 교근에 보톡스를 주입해 턱선을 부드럽게 만드는 시술입니다. |
| 29 | `wisdom-tooth` | 사랑니 발치 | extraction | 😬 | 통증 전에 미리 발치 | 매복되었거나 통증·염증을 유발하는 사랑니를 안전하게 발치하는 시술입니다. |
| 30 | `general-extraction` | 일반 발치 | extraction | ✂️ | 보존이 어려운 치아는 빼요 | 살릴 수 없는 치아를 빼내고 이후 보철·임플란트 계획을 함께 세우는 진료입니다. |

분야 9행 (`sort_order` = 0~8, 이름·설명은 `taxonomy.ts` 의 `CATEGORIES` 그대로):

| # | id | 이름 | 설명 |
|---|---|---|---|
| 0 | `implant` | 임플란트 | 상실된 치아를 인공 치근으로 대체해요 |
| 1 | `prevention` | 스케일링·예방 | 치석 제거부터 충치 예방까지 |
| 2 | `orthodontics` | 교정 | 치열과 교합을 가지런히 |
| 3 | `cavity` | 충치치료 | 초기 충치부터 신경치료·보철까지 |
| 4 | `aesthetic` | 심미 | 치아 색과 모양을 아름답게 |
| 5 | `gum` | 잇몸치료 | 잇몸 염증과 치주 질환 관리 |
| 6 | `tmj` | 턱관절·스플린트 | 턱 통증·이갈이·코골이 장치 |
| 7 | `botox` | 보톡스 | 이갈이 완화와 사각턱 개선 |
| 8 | `extraction` | 사랑니·발치 | 사랑니와 보존이 어려운 치아 발치 |

### 17.5 별칭 표 — 옛 id 는 **화면이** 풉니다, 서버는 모릅니다

바깥에 남아 있는 옛 id 는 두 군데입니다.

| 어디 | 무엇 |
|---|---|
| 북마크한 주소 | `/explore?category=crown`, `/explore?category=gum-disease` 등 |
| 브라우저 저장소 | `lib/localCollection.ts` 의 상담·커뮤니티 행 (상담·커뮤니티 서버는 요청서 15·16) |

```ts
/** 옛 서버 시술 id → 새 id. 2026-10-21 이전에 발급된 주소·브라우저 행만 이 표를 거친다. */
export const LEGACY_PROCEDURE_ID_ALIASES: Record<string, SubProcedureId> = {
  implant: 'implant-general',
  orthodontics: 'bracket-braces',
  cavity: 'resin',
  'gum-disease': 'gum-treatment',
  tmj: 'tmj-treatment',
  botox: 'bruxism-botox',
  // 아래 7개는 id 가 그대로다. 항등 항목을 **남겨 두는 이유**: 이 표가 "서버가 2026-10-21
  // 이전에 알던 13종" 의 완전한 목록이라는 사실 자체가 문서다. 항목이 6개뿐이면 다음 사람이
  // 나머지 7개는 어떻게 됐는지 다시 조사한다.
  inlay: 'inlay', crown: 'crown', laminate: 'laminate', whitening: 'whitening',
  splint: 'splint', 'snoring-device': 'snoring-device', 'wisdom-tooth': 'wisdom-tooth',
};
```

**자리는 `frontend/src/features/procedure/taxonomy.ts` 하나입니다** (지금 `LEGACY_TO_SUB` 가 있는 자리). 두 화면이 각자 변환을 적으면 한쪽만 고쳐져 조용히 갈라집니다 — 이미 `categoryPathForLegacy` 의 주석이 같은 말을 하고 있습니다.

**서버는 옛 id 를 받지 않습니다.** 알 수 없는 시술 id 는 지금처럼 `422 VALIDATION_FAILED(unknown_procedure)` 입니다 (`hospital.service.ts` 의 `assertProceduresExist`). 근거:

- 서버가 별칭을 받으면 **같은 시술을 가리키는 입력이 둘**이 되고, 둘 중 어느 것으로 저장됐는지가 행마다 달라집니다. 저장은 한 가지 값으로만 들어와야 합니다
- 별칭이 필요한 것은 **이미 발급된 주소와 이미 저장된 브라우저 행** 뿐이고, 둘 다 화면이 읽는 값입니다. 서버에 둘 이유가 없습니다 (AGENTS.md — 계약이 요구하지 않는 규칙을 서버에 만들지 않는다)

**충돌 걱정 하나는 실제로 없습니다.** 옛 id 5개(`implant`·`orthodontics`·`cavity`·`tmj`·`botox`)는 이제 **분야 id** 와 글자가 같습니다. 그런데 `/explore?category=` 는 원래 분야를 받는 자리이고, 다섯 개 모두 **그 시술이 속한 분야와 같은 글자**입니다(`cavity` → 레진 → 충치치료 분야 = `cavity`). 그래서 옛 주소든 새 주소든 **열리는 화면이 같습니다.** `?sub=` 에 옛 id 가 오는 경우만 위 표를 거칩니다.

### 17.6 마이그레이션 — 한 파일, 8단계

**원칙 두 개.** ① `procedures` 의 PK 를 `UPDATE` 하지 않습니다 — `ON UPDATE CASCADE` 가 걸려 있지만 그 동작은 `PRAGMA foreign_keys` 상태에 달려 있고, 마이그레이션 엔진이 어떤 상태로 돌리는지에 결과가 달라지는 스크립트는 "맞는지 읽어서 알 수 없는" 스크립트입니다. **삽입 → 재지정 → 삭제**는 pragma 가 켜져 있든 꺼져 있든 같은 결과를 냅니다. ② **마이그레이션은 기존 행을 새 체계로 옮기는 데 필요한 것만 넣습니다.** 새 18행과 모든 문구의 최종값은 **시드**가 넣습니다 (업서트라 몇 번 돌려도 같습니다). 그래서 빈 DB 에서는 3~6단계가 0행에 영향을 주고 끝납니다.

```sql
-- 1) 분야 테이블
CREATE TABLE "procedure_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL
);

-- 2) 분야 9행. FK 대상이라 3단계 백필보다 먼저 있어야 한다 (문구 최종값은 시드가 덮어쓴다)
INSERT INTO "procedure_categories" ("id","name","description","sort_order") VALUES
  ('implant','임플란트','상실된 치아를 인공 치근으로 대체해요',0),
  ('prevention','스케일링·예방','치석 제거부터 충치 예방까지',1),
  … (9행, §17.4 의 표) ;

-- 3) 컬럼을 먼저 nullable 로 붙인다 (8단계의 테이블 재작성이 NOT NULL 로 굳힌다)
ALTER TABLE "procedures" ADD COLUMN "category_id" TEXT;

-- 4) 기존 13행의 분야 백필 — 옛 id 기준
--    (스케일링·예방에 해당하는 옛 행은 없다 — 그래서 UPDATE 도 없다)
UPDATE "procedures" SET "category_id"='implant'      WHERE "id"='implant';
UPDATE "procedures" SET "category_id"='orthodontics' WHERE "id"='orthodontics';
UPDATE "procedures" SET "category_id"='cavity'       WHERE "id" IN ('cavity','inlay','crown');
UPDATE "procedures" SET "category_id"='aesthetic'    WHERE "id" IN ('laminate','whitening');
UPDATE "procedures" SET "category_id"='gum'          WHERE "id"='gum-disease';
UPDATE "procedures" SET "category_id"='tmj'          WHERE "id" IN ('tmj','splint','snoring-device');
UPDATE "procedures" SET "category_id"='botox'        WHERE "id"='botox';
UPDATE "procedures" SET "category_id"='extraction'   WHERE "id"='wisdom-tooth';

-- 5) 이름이 바뀌는 6개: 새 행을 **기존 행에서 복제**한다.
--    INSERT ... SELECT 라서 빈 DB 에서는 0행이 들어간다 (= 새 DB 에 카탈로그를 심지 않는다)
INSERT INTO "procedures" ("id","name","emoji","short_description","description","sort_order","category_id")
  SELECT 'implant-general',"name","emoji","short_description","description","sort_order","category_id"
    FROM "procedures" WHERE "id"='implant';
  … (bracket-braces←orthodontics, resin←cavity, gum-treatment←gum-disease,
     tmj-treatment←tmj, bruxism-botox←botox)

-- 6) 자식 재지정 — 8개 테이블. **삭제(7단계)보다 반드시 먼저.**
--    consult_requests 는 ON DELETE SET NULL 이라, 순서가 뒤집히면 '희망 시술' 이 조용히 비워진다
--    ⓐ 결정적 id 를 쓰는 3개 테이블은 id 도 함께 고친다 (시드가 id 를 다시 만들기 때문 — §8.1 원칙 2)
UPDATE "hospital_procedures"
   SET "procedure_id"='implant-general', "id"='hp-'||"hospital_id"||'-implant-general'
 WHERE "procedure_id"='implant' AND "id"='hp-'||"hospital_id"||'-implant';
--    ⓑ 런타임에 만들어진 행(관리자 폼 저장 — id 가 cuid)은 procedure_id 만 고친다
UPDATE "hospital_procedures" SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
--    같은 ⓐ/ⓑ 쌍을 doctor_procedures('dp-'||doctor_id), hospital_sponsorships('sp-'||hospital_id) 에도
--    ⓒ id 규칙이 없는 5개는 한 줄씩
UPDATE "consult_requests" SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "reviews"          SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "promotions"       SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "guides"           SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "qa_posts"         SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
--    → 위 8개 테이블 × 옛 id 6개

-- 7) 옛 6행 삭제. 자식이 하나도 안 남아 있어야 하므로 RESTRICT 가 안전망이 된다
DELETE FROM "procedures" WHERE "id" IN ('implant','orthodontics','cavity','gum-disease','tmj','botox');

-- 8) category_id 를 NOT NULL + FK 로 굳힌다 (SQLite 는 테이블 재작성이다 — Prisma 가 만드는
--    'PRAGMA defer_foreign_keys=ON; … new_procedures … DROP … RENAME …' 블록을 그대로 둔다)
```

| 단계 | 개발 DB(데이터 있음) | 빈 DB(테스트·CI) |
|---|---|---|
| 1·2 | 테이블 + 분야 9행 | 같음 |
| 3·4 | 13행 백필 | 0행 |
| 5 | 6행 복제 | 0행 |
| 6 | `hospital_procedures` 등 재지정 | 0행 |
| 7 | 6행 삭제 | 0행 |
| 8 | 재작성 (모든 행 `category_id` 있음) | 빈 테이블 재작성 |

**만드는 방법** — `npx prisma migrate dev --create-only`(개발 DB 백업 후, CLAUDE.md 안전장치 2)로 1·3·8단계의 뼈대를 받은 뒤, 2·4~7단계를 그 사이에 손으로 끼웁니다. `migrate reset`·`db push --force-reset` 은 쓰지 않습니다(§8.7 — Prisma 6 이 AI 에이전트에게 막고, 막히면 프롬프트에서 멈춥니다). 테스트 DB 는 매 실행마다 `migrate deploy` + 시드로 다시 만들어지므로(§8.7) **빈 DB 경로는 테스트를 한 번 돌리면 자동으로 검증됩니다.**

**보존 단정(테스트로 고정).** 마이그레이션 전후로 `hospital_procedures` 26행(11곳), `doctor_procedures`, `hospital_sponsorships` 5행, `reviews`·`guides`·`promotions`·`qa_posts`·`consult_requests` 의 **행 수가 같고**, `consult_requests.procedure_id IS NULL` 인 행이 늘지 않아야 합니다. 요청서의 "기존 병원 11곳의 시술 등록이 사라지면 안 됩니다" 가 이 단정입니다.

### 17.7 `준비중` — 저장하지 않고 셉니다

**규칙(요청서 그대로).** 세부 시술은 **앱에 노출되는 병원 중 그 시술을 하는 곳이 1곳 이상이면 열려 있고**, 0곳이면 `준비중` 입니다. 분야는 **속한 세부 시술이 전부 준비중일 때만** 준비중입니다.

**"앱에 노출되는 병원" 의 출처는 하나여야 합니다.** 지금 그 판정은 `buildHospitalWhere` 의 첫 줄
`{ deletedAt: null }` 뿐입니다(`backend/src/hospital/hospital.filters.ts`). 승인 상태 컬럼은 §14 의
제안(요청서 18)이고 아직 없습니다. 그래서:

```ts
/** 공개 목록에 나오는 병원의 조건. `GET /hospitals`·가용성 집계·요청 17 의 공공데이터가 공유한다. */
export function publicHospitalWhere(): Prisma.HospitalWhereInput {
  return { deletedAt: null };
}
```

`buildHospitalWhere` 가 이 함수로 시작하도록 고칩니다. **같은 판정을 두 곳에 두지 않기 위해서입니다**
(AGENTS.md) — 요청서 18 이 `approval_status='approved'` 를 더하는 날, 목록에서는 사라졌는데
`준비중` 은 안 붙는 병원이 생기지 않아야 합니다.

**집계 질의 — 한 번입니다.**

```ts
// "공개 병원이 1곳 이상 등록한 시술 id"
const rows = await prisma.hospitalProcedure.groupBy({
  by: ['procedureId'],
  where: { hospital: publicHospitalWhere() },
  _count: { _all: true },
});
```

```sql
-- 같은 뜻의 SQL (읽기용)
SELECT hp.procedure_id, COUNT(*) AS hospital_count
  FROM hospital_procedures hp
  JOIN hospitals h ON h.id = hp.hospital_id
 WHERE h.deleted_at IS NULL
 GROUP BY hp.procedure_id;
```

**판정은 순수 함수입니다** — DB 도 요청도 모르고, 위 집계 결과만 받습니다.

```ts
export interface ProcedureAvailability {
  /** 이 시술을 등록한 공개 병원 수 */
  hospitalCount: number;
  /** 1곳 이상인가 */
  isAvailable: boolean;
}

/** 시술 31개의 가용성. `openIds` 는 위 groupBy 가 돌려준 (id → 병원 수). */
export function computeProcedureAvailability(
  procedures: { id: string; categoryId: string }[],
  hospitalCountById: ReadonlyMap<string, number>,
): { procedures: Map<string, ProcedureAvailability>; categories: Map<string, ProcedureAvailability> };
```

분야의 `hospitalCount` 는 **세부 시술 수의 합이 아니라** "그 분야의 시술을 하나라도 하는 병원 수" 가
맞습니다 — 합으로 세면 임플란트와 뼈이식을 둘 다 하는 병원이 2로 세어집니다. 분야 수치가 화면에
필요해지면 `groupBy` 를 `(category_id, hospital_id)` distinct 로 바꾸면 됩니다. **지금 화면이 요구하는
것은 "0인가 아닌가" 뿐이므로**(홈 격자의 `준비중` 배지, 관리자 폼의 비활성) 분야 쪽은
`isAvailable = 속한 시술 중 하나라도 isAvailable` 만 계산합니다. 숫자는 시술 단위로만 둡니다.

**요청 17 이 들어오면 자동으로 늘어납니다.** 공공데이터 병원도 `hospitals` + `hospital_procedures` 행이라
같은 질의에 잡힙니다 — 이 절에서 17 을 위해 미리 만드는 것은 없습니다.

**시드 직후 상태** (지금 11곳의 등록을 그대로 옮기므로 작업 전과 같습니다):

| 분야 | 열린 세부 시술 | 준비중 |
|---|---|---|
| 임플란트 | `implant-general`(h1·h3·h5·h8) | 뼈이식·상악동거상술·임플란트 틀니 |
| **스케일링·예방** | **없음** | **4개 전부 — 분야가 준비중** |
| 교정 | `bracket-braces`(h2·h11) | 투명·설측·부분 |
| 충치치료 | `resin`(h3·h10) `inlay`(h7·h10) `crown`(h7·h10) | 온레이·신경치료 |
| 심미 | `laminate`(h1·h2·h6) `whitening`(h6) | 잇몸성형 |
| 잇몸치료 | `gum-treatment`(h3·h5) | 치주수술·잇몸이식 |
| 턱관절·스플린트 | `tmj-treatment`(h9) `splint`(h4·h9) `snoring-device`(h4) | 이갈이장치 |
| 보톡스 | `bruxism-botox`(h1·h9) | 사각턱 보톡스 |
| 사랑니·발치 | `wisdom-tooth`(h8·h11) | 일반 발치 |

**시드가 스케일링을 넣지 않는 이유.** 요청서의 확인 항목이 "관리자 병원 정보에서 `스케일링` 을
체크하고 저장하면 … `준비중` 이 아니게 된다" 이고, 다른 항목이 "기존 병원들의 시술 표시가 작업 전과
같다" 입니다. 시드가 미리 넣으면 **첫 항목은 확인할 수 없게 되고 둘째 항목은 깨집니다.** 샘플에
스케일링 병원이 있어야 한다는 결정이 나오면 그때 시드 데이터에 추가하면 됩니다 (§17.13-1).

### 17.8 시드 — 시술 원본이 서버로 옵니다

| | 지금 | 요청 14 이후 |
|---|---|---|
| 시술 원본 | `frontend/src/mocks/fixtures/procedures.ts` (13) → `backend/prisma/seed/fixtures.ts:31` 이 import | **`backend/prisma/seed/data/procedures.ts` (31)** + **`.../procedure-categories.ts` (9)** |
| 프론트 fixture | 같은 파일이 MSW·테스트 스텁 겸용 | **남깁니다.** 단 id·이름·순서는 `taxonomy.ts` 에서 **파생**합니다 (아래) |
| 옛 id 를 들고 있는 다른 fixture | `consultRequests`·`guides`·`promotions`·`qaPosts` (프론트), `hospitals`·`doctors`·`reviews` (백엔드 `seed/data/`) | **값을 새 id 로 고칩니다.** 시드에서 별칭으로 변환하지 않습니다 |

**왜 "fixture 를 고치고, 시드에서 변환하지 않는가".** 변환을 시드에 두면 **프론트 fixture 에는 영원히
옛 id 가 남습니다.** 그 fixture 는 MSW 응답 스텁이기도 해서, 화면 테스트는 서버가 더 이상 내려주지
않는 id 를 보며 통과하게 됩니다. 별칭은 **바깥에 이미 나간 값**(주소·브라우저 저장소)에만 쓰는
장치이고, 우리가 소유한 파일은 그냥 고치는 것이 맞습니다. 바꿀 자리는 적습니다 — 프론트 4개 파일
10줄, 백엔드 `seed/data/` 3개 파일 22줄.

**새 파일 2개는 import 가 없어야 합니다.** `procedure-categories.ts`·`procedures.ts` 는 타입 선언과
배열 리터럴만 둡니다(`@/…` 별칭도, `@prisma/client` 타입도 쓰지 않습니다). 이유는 §17.8 의 동기화
테스트가 **프론트에서 이 파일을 상대 경로로 import** 하기 때문입니다 — 별칭이 하나라도 있으면
프론트 쪽 해석기가 그것을 풀 수 없습니다. (반대 방향, 즉 백엔드 테스트가 프론트 파일을 읽는 방식은
택하지 않습니다. `backend/prisma/tsconfig.seed.json` 의 주석이 "서버 코드가 프론트엔드 소스를 import
할 수 있게 되면 안 된다, 시드만 예외" 라고 못 박아 두었고, 테스트는 `backend/tsconfig.json` 범위입니다.)

**두 사본을 묶는 테스트.**

| 테스트 | 무엇을 고정하나 |
|---|---|
| `frontend/src/features/procedure/taxonomy.sync.test.ts` (신규) | `backend/prisma/seed/data/procedures.ts` 와 `taxonomy.ts` 의 **id 배열이 순서까지 같고**, 이름이 같고, `categoryId` 가 같다. 분야도 같은 방식으로 |
| `frontend/src/features/procedure/taxonomy.test.ts` (기존, 갱신) | 프론트 fixture 의 id 집합 = `SUB_PROCEDURE_IDS`. 옛 `LEGACY_TO_SUB` 단정은 **별칭 표 단정**으로 바뀝니다 (별칭의 값이 전부 실재하는 세부 시술 id 인가) |
| `backend/test/seed-data.spec.ts` (기존, 갱신) | 시드 후 `procedures` 31행 · `procedure_categories` 9행 · 모든 시술에 분야가 있다 · 31개 id 집합이 시드 데이터 파일과 같다 |

> 사본이 둘인 이유를 `taxonomy.ts` 머리말에 남깁니다 (AGENTS.md — "공유가 안 되면 그 이유를 주석에").
> **화면은 네트워크를 기다리지 않고 분야 격자를 그립니다.** 홈·탐색 탭·관리자 폼이 첫 프레임에
> 9개 분야를 그려야 하므로 이름·순서는 번들에 들어 있어야 하고, 그래서 서버 응답만으로는 대체할 수
> 없습니다. 대신 **갈라지면 테스트가 먼저 깨집니다.**

**프론트 fixture 의 모양** — 이름·순서를 세 번째로 베끼지 않습니다.

```ts
// frontend/src/mocks/fixtures/procedures.ts
// 이름·순서·분야는 taxonomy 에서 파생한다. emoji 와 문구만 이 파일이 들고 있다
// (목 데이터용 값이다 — 서버의 최종 문구는 backend/prisma/seed/data/procedures.ts 에 있다).
export const procedures: Procedure[] = SUB_PROCEDURES.map((sub) => ({
  id: sub.id, name: sub.name, ...MOCK_COPY[sub.id],
}));
```

`useProcedureMap.test.tsx` 의 `procedures[0]?.id === 'implant'` 결합 가드는 **`'implant-general'`** 이
됩니다(`screens/community/new.tsx` 의 하드코딩된 로딩 기본값과 같은 값이어야 한다는 성질은 그대로입니다).

**시드 절차의 변경은 두 줄입니다.** ① 시술보다 **분야를 먼저** upsert ② 시술 upsert 에 `categoryId`
추가(`sortOrder` 는 지금처럼 배열 인덱스). 자식 테이블의 결정적 id(`hp-…`·`dp-…`·`sp-…`)는 새 id 를
그대로 받으므로 규칙 자체는 바뀌지 않습니다 — 마이그레이션 6단계가 기존 행의 id 를 같은 규칙으로
맞춰 두기 때문에 **재시드가 중복 행을 만들지 않습니다.**

### 17.9 분야로 거르기 + 광고 우선 노출 — 질의 하나, 순수 함수 한 군데

**필터.** `categoryId` 가 오면 조인으로 거릅니다. 시술 id 목록을 미리 뽑아 `in` 으로 넣지 않습니다 — FK 가 이미 그 관계를 들고 있습니다.

```ts
// hospital.filters.ts / doctor.filters.ts — 둘이 같은 모양이다
if (query.categoryId !== undefined) {
  where.procedures = { some: { procedure: { categoryId: query.categoryId } } };
}
if (query.procedureId !== undefined) {
  where.procedures = { some: { procedureId: query.procedureId } };
}
```

`procedureId` 와 `categoryId` 가 함께 오면 **세부 시술이 이깁니다**(더 좁은 조건). 계약이 그렇게 적어야 하고, 서버는 둘 중 하나만 적용합니다.

**광고 자격.** 지금 `computeSponsorship` 은 `procedureId?: string` 하나를 받아
`sponsoredCategories.includes(procedureId)` 로 봅니다. 분야 필터에서는 "그 분야의 **어느** 시술이든
광고 중이면 자격 있음" 이어야 하므로, 인자를 **집합**으로 넓힙니다.

```ts
export interface ComputeSponsorshipOptions {
  today: string;
  /**
   * 이 요청이 좁힌 시술 id 집합. 세부 시술 칩이면 1개, 분야 탭이면 그 분야의 시술 전부.
   * 넘기지 않으면(추천 탭·필터 없음) 카테고리 일치 검사를 하지 않는다.
   */
  procedureIds?: string[];
}
// categoryOk = options.procedureIds === undefined
//           || input.sponsoredCategories.some((id) => options.procedureIds!.includes(id));
```

- **세부 시술 하나일 때의 동작이 지금과 완전히 같습니다**(원소 1개짜리 집합) — 회귀 없이 넓어집니다
- 규칙이 **한 함수 안에 하나**로 남습니다. "분야용 자격 판정" 을 따로 만들면 세부 시술 쪽과 갈립니다
- 분야의 시술 id 집합은 `ProcedureRepository.findIdsByCategory(categoryId)` 로 **요청당 한 번** 읽습니다(31행 테이블이라 비용이 없습니다). 광고 행에 `category_id` 를 복제해 두지 않는 이유는 그것이 **같은 사실의 두 번째 사본**이기 때문입니다 — 시술이 분야를 옮기면 광고 행이 옛 분야에 남습니다

`hospital.service.ts` 의 `sponsoredFirst` 조건에 `categoryId` 를 더합니다:
`query.procedureId !== undefined || query.categoryId !== undefined || query.recommended === true`.
**이것으로 `known-issues.md` 🟠 "시술 분야 세 곳은 광고 병원이 위로 안 올라가고 100곳까지만 보입니다"
가 사라집니다** — 100곳 제한은 화면이 여러 시술을 각각 받아 합치느라 둔 임시 상한이었고, 서버가 분야를
알면 목록은 처음부터 서버 페이지네이션(`paginate`)을 탑니다. **데이터 쪽에 추가로 필요한 것은 없습니다.**

### 17.10 인덱스 — 추가 0

| 후보 | 판단 |
|---|---|
| `procedures(category_id)` | **만들지 않습니다.** 31행 테이블입니다. 분야 조인은 전체 스캔이 인덱스 조회보다 싸고, `hospital_procedures(procedure_id)` 인덱스(이미 있음)가 실제 선택도를 다 담당합니다 |
| `procedures(category_id, sort_order)` | 같은 이유로 기각. "분야의 세부 시술을 화면 순서로" 는 31행 정렬입니다 |
| `procedure_categories(sort_order)` | 9행. 기각 |

§6.7("일부러 만들지 않은 인덱스")과 같은 판단입니다. **PostgreSQL 이전 후에도 그대로**입니다 — 다시 볼 조건은 "시술 카탈로그가 수백 행이 되는 경우"(예: 공공데이터 비급여 코드를 시술 행으로 직접 들이는 설계)이고, 요청 17 은 그런 설계가 아닙니다.

### 17.11 전공 ↔ 시술 표 — 한 벌로 맞춥니다

지금 표가 둘입니다: 프론트 `CATEGORY_SPECIALTIES`(분야 → 강조할 전공들, 배지)와 백엔드
`PROCEDURE_SPECIALTY_MAP`(시술 → 전공 1개, 전문의 등록 시 자동 배정). 둘이 `implant`·`whitening`·
`cavity` 에서 갈려 있습니다 (`known-issues.md` 개발자용 메모).

**원본은 백엔드의 시술 → 전공 **복수** 표 하나입니다.** 분야 표는 그 **합집합**으로 정의합니다.

```ts
// backend/src/doctor/specialty-procedures.ts — import 0 (프론트 테스트가 상대 경로로 읽는다)
export const PROCEDURE_SPECIALTIES: Record<string, readonly string[]> = { … 31행 … };
```

| 분야 | 시술 | 전공 |
|---|---|---|
| 임플란트 | `implant-general` | 치과보철전문의 · 구강악안면외과전문의 |
| | `bone-graft`·`sinus-lift` | 구강악안면외과전문의 |
| | `implant-denture` | 치과보철전문의 |
| 스케일링·예방 | `scaling`·`halitosis` | 치주과전문의 · 통합치의학과전문의 |
| | `fluoride`·`sealant` | 소아치과전문의 · 통합치의학과전문의 |
| 교정 | `clear-aligner`·`lingual-braces`·`bracket-braces`·`partial-ortho` | 치과교정전문의 |
| 충치치료 | `resin`·`root-canal` | 통합치의학과전문의 |
| | `inlay`·`onlay` | 치과보철전문의 · 통합치의학과전문의 |
| | `crown` | 치과보철전문의 |
| 심미 | `laminate` | 치과보철전문의 |
| | `whitening` | 통합치의학과전문의 · 치과보철전문의 |
| | `gum-contouring` | 치주과전문의 |
| 잇몸치료 | `gum-treatment`·`periodontal-surgery`·`gum-graft` | 치주과전문의 |
| 턱관절·스플린트 | `tmj-treatment`·`splint`·`bruxism-device`·`snoring-device` | 구강악안면외과전문의 |
| 보톡스 | `bruxism-botox`·`masseter-botox` | 구강악안면외과전문의 |
| 사랑니·발치 | `wisdom-tooth`·`general-extraction` | 구강악안면외과전문의 |

- **임플란트 분야는 치과보철 + 구강악안면외과 둘 다 강조합니다** — 요청자 결정입니다. 식립(외과)과 보철(상부 구조)이 한 분야 안에 들어 있어 한쪽만 고르면 다른 쪽 전문의가 상주하는 병원의 배지가 꺼집니다 (`specialty.ts` 가 복수 값을 둔 것과 같은 이유)
- 쓸 수 있는 값은 **기존 7개 전공 + 일반의** 뿐입니다 (`DentalSpecialty`). 새 전공을 만들지 않습니다
- **구강악안면방사선과전문의는 31개 중 어디에도 없습니다.** 영상 진단은 세부 시술 목록에 없는 활동이라 자동 배정이 0개인 것이 맞습니다 — `known-issues.md` 🟡 "두 전문 분야는 전문의 등록 시 시술이 자동으로 채워지지 않습니다" 중 **소아치과는 해소**되고(불소도포·실란트), 방사선과는 **의도적으로 남습니다**

합집합으로 유도되는 분야 표(= 프론트 `CATEGORY_SPECIALTIES` 의 새 값):

| 분야 | 전공 | 지금과 다른가 |
|---|---|---|
| implant | 치과보철 · 구강악안면외과 | **바뀜** (지금 구강악안면외과만) |
| prevention | 치주과 · 통합치의학과 · 소아치과 | **바뀜** (소아치과 추가) |
| orthodontics | 치과교정 | 같음 |
| cavity | 통합치의학과 · 치과보철 | 같음 |
| aesthetic | 치과보철 · 통합치의학과 · 치주과 | **바뀜** (치주과 추가 — 잇몸성형) |
| gum | 치주과 | 같음 |
| tmj / botox / extraction | 구강악안면외과 | 같음 |

**두 파일로 남기되, 한쪽이 다른 쪽의 합집합임을 테스트가 고정합니다** (`taxonomy.sync.test.ts` 에 같이
둡니다). 프론트가 런타임에 합집합을 계산하게 하려면 시술 → 전공 표가 응답에 실려야 하는데, 배지는
카드가 그려지는 **첫 프레임**에 필요하고(네트워크를 기다리면 배지가 깜빡입니다) 계약에 소비자 없는
필드를 하나 더 만드는 일이기도 합니다. 그래서 **사본 + 검사**를 택합니다. 이유를 두 파일 머리말에
적습니다.

**자동 배정의 부작용 하나는 이 절에서 고치지 않습니다.** `getProceduresForSpecialty` 는 전공만 보고
시술을 고르고 **병원이 실제로 취급하는 시술과 교집합을 내지 않습니다**(`일반의` 만 예외). 시술이
13 → 31 로 늘면 구강악안면외과 전문의 한 명에게 11개가 붙고, 그중 상당수는 그 병원이 하지 않는
시술입니다. **고치는 방법은 한 줄**(모든 전공에 대해 `hospitalProcedureIds` 와 교집합)이지만 등록
동작이 바뀌는 변경이라 요청서 14 의 범위 밖입니다 — §17.13-2 의 결정 항목으로 올리고,
`backend/README.md` 의 "미룬 것들" 과 `known-issues.md` 에 기록합니다.

> **→ 결정됨(2026-10-21): 교집합을 요청 14 에 넣었습니다.** 계약 `docs/api/README.md` §22.8 의
> 리드 결정이고 `getProceduresForSpecialty` 가 이미 그렇게 동작합니다(`일반의` 는 교집합이
> 전체라 전과 같습니다). 그래서 §17.13-2 와 §17.15-7 의 "미룬다" 는 더 이상 유효하지 않습니다.

### 17.12 만들지 않는 것

| 만들지 않는 것 | 이유 |
|---|---|
| `procedures.is_coming_soon` | §17.7 — 세어서 파생합니다. 컬럼이면 병원이 체크할 때마다 갱신해야 하는 두 번째 사실이 됩니다 |
| `procedures.is_listed` (노출/저장 분리 축) | §16.2 가 "언젠가 필요할 수도" 라고 적어 둔 축입니다. **요청 14 는 31개를 전부 노출합니다** — 노출하지 않을 시술이 없으므로 축이 필요 없습니다 |
| 동의어(keywords) 테이블 | 요청서가 화면에 두라고 했습니다. 서버 검색 추천을 만드는 요청서에서 다시 봅니다 |
| 분야 아이콘 컬럼 | 아이콘은 React 컴포넌트입니다 (§17.2) |
| 서버의 옛 id 별칭 | §17.5 — 저장 값은 한 가지여야 합니다 |
| `hospital_procedures` 의 분야 복제 | 광고 자격은 조인으로 풉니다 (§17.9) |
| 공공데이터용 사전 설계 | 요청 17 이 합니다. 이 절은 **그것을 막지 않는 것**까지만 합니다(공공데이터 병원도 같은 두 테이블에 들어오면 §17.7 의 집계에 자동으로 잡힙니다) |

### 17.13 남은 미결 · 요청자에게 물을 것

1. **샘플 병원 11곳에 `스케일링` 을 넣을까요?** — 권고: **넣지 않습니다** (§17.7 의 이유). 넣기로 하면 어느 병원에 넣을지도 함께 정해야 합니다(예: `h3`·`h5`·`h10`)
2. **전문의 자동 배정을 병원 시술과 교집합할까요?** — 권고: **합니다**(그러지 않으면 병원이 하지 않는 시술이 전문의 프로필에 붙습니다). 다만 요청서 14 의 범위 밖이라 **별도 확인**을 받고 넣습니다 (§17.11)
3. **커뮤니티 질문하기의 시술 목록이 13 → 31 로 늘어납니다.** 데이터는 그대로이고 화면 결정입니다 — 분야로 묶어 보여줄지(`충치치료 › 레진`) 31개를 평평하게 둘지는 designer·frontend-engineer 가 정합니다 (`known-issues.md` 🔵 "커뮤니티 질문하기의 시술 이름만 옛 목록을 씁니다" 가 이때 사라집니다)
4. **`bruxism-device`(이갈이장치)와 `splint`(스플린트)는 임상적으로 겹칩니다.** `taxonomy.ts` 가 둘을 따로 뒀고 이름·순서를 바꾸지 말라고 했으므로 그대로 둡니다. 병원이 둘 다 체크할 수 있고, 그것이 틀린 상태는 아닙니다
5. **문구(한 줄 소개·설명) 31개는 이 절이 초안으로 쓴 값입니다.** 의료 표현이라 요청자 검토를 받는 편이 좋습니다 — 고치더라도 **시드 데이터 파일 한 곳**만 바뀌고 스키마는 그대로입니다

### 17.14 interface-master 에 넘기는 것

| 자리 | 변경 |
|---|---|
| `ProcedureId` enum | **13 → 31**. 값은 §17.4 의 id (옛 6개는 **제거** — 서버가 받지 않습니다) |
| `Procedure` 스키마 | **`categoryId` 추가**(필수). 나머지 필드 그대로 |
| **신규** `GET /procedure-categories` 또는 `ProcedureCategory` 스키마 | `id`·`name`·`description`·`sortOrder`. 화면이 분야 목록을 서버에서도 받을 수 있어야 합니다(관리자 폼의 31개 섹션) |
| `GET /procedures` · `GET /procedure-categories` 응답 | **가용성**(`준비중` 판정)을 어디에 실을지 결정이 필요합니다. 권고: `Procedure.isAvailable`(+`hospitalCount`)과 `ProcedureCategory.isAvailable`. 화면 세 곳(홈 격자·탐색 탭·관리자 폼)이 같은 값을 써야 하므로 **한 응답에서 함께 내려주는 편**이 갈라지지 않습니다. 단 가용성은 변하는 값이라 **현재 `Cache-Control: public, max-age=3600` 을 재검토**해야 합니다(권고: `max-age=60` 또는 가용성만 별도 경로) |
| `GET /hospitals` · `GET /doctors` | **`categoryId` 파라미터 추가** (§17.9). `procedureId` 와 동시에 오면 `procedureId` 우선. `categoryId` 일 때도 광고 우선 노출을 켭니다 |
| 목록 응답 | 변화 없음. 분야 필터는 **페이지네이션을 그대로 탑니다**(100곳 제한은 화면 쪽 임시 조치였습니다) |
| `422 details[].code` | 기존 `unknown_procedure` 재사용. 분야용으로 `unknown_category` 가 필요합니다(존재하지 않는 `categoryId`) |

> **이 표는 넘긴 시점의 제안입니다. 확정 계약은 `docs/api/README.md` §22 이고, 세 줄이 다르게
> 결정됐습니다** — ⓐ `GET /procedure-categories` 는 **만들지 않습니다**(호출할 화면이 없습니다 — §22.4),
> ⓑ `procedureId` + `categoryId` 는 "우선" 이 아니라 **AND** 입니다(§22.6), ⓒ 모르는 분야는
> `unknown_category` 가 아니라 **0건**이라 그 에러 코드를 만들지 않았습니다(§22.6).
> 캐시는 `max-age=60` 이 아니라 **`no-cache` + ETag** 로 갔습니다(§22.5).

### 17.15 backend-engineer 에게 넘기는 것 (체크리스트)

1. `schema.prisma` — `ProcedureCategory` 모델 + `Procedure.categoryId`/`category`
2. 마이그레이션 1개 (§17.6). **개발 DB 백업 먼저** (CLAUDE.md 안전장치 2)
3. 시드 — `seed/data/procedure-categories.ts`(9)·`seed/data/procedures.ts`(31) 신설, `seed/fixtures.ts` 에서 프론트 `procedures` import 제거, 분야 → 시술 순서로 upsert, `seed/data/hospitals|doctors|reviews.ts` 의 옛 id 22곳 치환
4. 순수 함수 — `procedure/availability.ts`(§17.7), `hospital/sponsorship.ts` 의 `procedureIds` 집합화(§17.9), `hospital/public-visibility.ts` 의 `publicHospitalWhere`(§17.7), `doctor/specialty-procedures.ts` 의 31행 표(§17.11)
5. 필터 — `hospital.filters.ts`·`doctor.filters.ts` 의 `categoryId`, `hospital.service.ts` 의 `sponsoredFirst`
6. 테스트(먼저 쓰기) — 가용성 경계(0곳/1곳/삭제된 병원만 있는 시술), 분야 필터 + 광고 정렬, 이관 보존 단정(§17.6), 시드 31/9행, 전공 표 합집합
7. `backend/README.md` 의 "미룬 것들" 에 §17.11 의 자동 배정 교집합을 기록
