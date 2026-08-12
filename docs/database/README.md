# 몰라몰라 데이터베이스 설계

| | |
|---|---|
| **현재 구현** | SQLite (Prisma `provider = "sqlite"`) |
| **이전 대상** | PostgreSQL 14+ |
| **스키마 정의** | [`schema.dbml`](schema.dbml) — 테이블·컬럼·인덱스·주석 |
| **ORM 스키마** | [`../../backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) |
| **요구사항 출처** | `frontend/src/types/domain.ts`, `docs/features/*.md` (27개), `frontend/src/mocks/fixtures/*.ts` |

이 문서는 **왜 이렇게 설계했는지**를 남깁니다. 무엇이 있는지는 `schema.dbml` 을 보세요.

---

## 1. 엔티티 관계 개요

```
                        ┌───────────────┐
                        │  procedures   │  시술 마스터 13종 (참조 데이터)
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

전체 **27개 테이블**입니다.

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
| `consult_requests` | 상담 신청, `/admin/consultations`, `/admin/consultations/:id`, `/admin` 숫자 카드 2개, (신설 가능) 내 상담 내역 |
| `consult_status_changes` | `/admin/consultations/:id` '상태 변경 이력' |
| `consult_memos` | `/admin/consultations/:id` '메모' |
| `favorites` | 병원 상세 하트, 마이페이지 찜 목록, 꿀팁 관련 병원 카드 하트 |
| `reviews`, `review_photos` | 병원 상세 '방문자 후기' |
| `promotions` | 이벤트 목록(`/events`), 홈 '지금 진행중인 이벤트', 병원 카드 🔥 배지·할인가, 병원 상세 가격 영역, 탐색 가격 비교표 '할인가' |
| `guides`, `guide_hospitals` | 홈 '이런 꿀팁 어때요?', 꿀팁 상세(`/tips/:id`) |
| `qa_posts` | 커뮤니티 목록, 질문 상세, 질문 작성 |
| `qa_answers` | 질문 상세 답변 목록·'치과의사 답변' 배지, 목록의 '답변 N', (신설 가능) 답변 작성 |
| `notifications`, `notification_recipients` | `/notifications`, `/admin/notifications`, 마이페이지 알림함 줄, 상단 🔔 배지, `/admin` 🔔 배지 |

**테이블이 필요 없는 화면**: `/about`, `/partner-inquiry`, `/legal/terms`, `/legal/privacy`, `/legal/location` — 다섯 화면 모두 `준비중입니다` 한 줄뿐이고 저장할 데이터가 없습니다. 홈의 회사 정보·배너 3장, 검색 화면의 인기 검색어/추천 검색어도 코드 상수이며 관리 화면이 없어 테이블로 만들지 않았습니다 (§8 제안 참고).

---

## 3. 이식성 규칙과 근거

Prisma + SQLite 의 실제 한계, 그리고 PostgreSQL 로 옮길 때 깨지는 것들을 피한 규칙입니다.
**결과적으로 더 나은 관계형 설계가 되었습니다** — 배열이 조인 테이블이 되면서 역방향 조회(`procedure → hospitals`)에 인덱스를 걸 수 있게 되었고, JSON 이 실 컬럼이 되면서 필터·정렬을 DB 가 처리할 수 있게 되었습니다.

### 3.1 DB enum 을 쓰지 않는다

Prisma 는 SQLite 에서 `enum` 을 지원하지 않습니다. 상태값은 `String` + 애플리케이션 검증이고, 허용값을 `schema.dbml`/`schema.prisma` 의 컬럼 주석에 적어 두었습니다.

| 원래 타입 | 컬럼 | 허용값 |
|---|---|---|
| `ConsultStatus` | `consult_requests.status`, `consult_status_changes.status` | `new` `contacted` `booked` `cancelled` |
| `VerificationStatus` | `doctors.verification_status`, `doctor_verifications.status` | `pending` `approved` `rejected` |
| `AuthProvider` | `users.provider` | `email` `google` `kakao` |
| (신규) 역할 | `users.role` | `user` `hospital_admin` `operator` |
| `NotificationType` | `notifications.type` | `consult-status` `event` `system` |
| `NotificationAudience` | `notifications.audience` | `user` `admin` |
| `DentalSpecialty` | `doctors.specialty`, `doctors.verified_specialty`, `doctor_verifications.submitted_specialty` | 8종 (`치과보철전문의` … `일반의`) |
| (자유값) 희망 시간 | `consult_requests.preferred_time` | `평일 오전` `평일 오후` `주말` |

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

`/admin/hospital/:id` 의 `광고 현황 (읽기 전용)` 세 가지 상태가 그대로 나옵니다: 행 없음 → `현재 진행중인 광고가 없어요`, 오늘이 기간 안 → `OO 카테고리 광고 중 · {end_date}까지`, 기간 지남 → `기간 종료`.

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
| `consult_requests(status, created_at)` | 상태 필터 칩 `신규`/`연락중`/`예약완료`/`취소`, `/admin` 의 `처리 대기 중인 상담`(=`status='new'` 카운트) |
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
- 부분 인덱스 (`WHERE deleted_at IS NULL`) 로 soft delete 인덱스 크기 축소

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
| `procedures.ts` (13) | `procedures` (`sort_order` = 배열 인덱스) |
| `hospitals.ts` (11) | `hospitals` + `hospital_procedures` + `hospital_images` + `hospital_tags` + `hospital_event_notes` + `business_hours` + `hospital_sponsorships` |
| `doctors.ts` (14) | `doctors` + `doctor_procedures` + `doctor_careers` + `doctor_verifications` |
| `consultRequests.ts` (7) | `consult_requests` + `consult_status_changes` + `consult_memos` |
| `reviews.ts` (5) | `reviews` + `review_photos` |
| `promotions.ts` (4) | `promotions` (**기간을 새로 부여** — §8.4) |
| `guides.ts` (8) | `guides` + `guide_hospitals` |
| `qaPosts.ts` (4) | `qa_posts` + `qa_answers` |
| `notifications.ts` (7) | `notifications` + `notification_recipients` |
| `trendingSearches.ts` | **이전하지 않음** — 테이블이 없습니다 (§8.6) |
| `placeholder-company-info.ts` | **이전하지 않음** — 코드 상수 |

### 8.3 새로 만드는 시드 데이터

**시술 마스터** — `procedures` 13행. `sort_order` 는 `procedures.ts` 배열 순서(홈 격자·탐색 칩·커뮤니티 선택이 공유하는 순서).

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

**광고 캠페인** — `hospitals.ts` 의 광고 필드를 `hospital_sponsorships` 행으로 풉니다. `sponsoredCategories` 의 각 원소마다 1행이며 `start_date`/`end_date`/`rank` 는 해당 병원 값을 복사합니다. `isSponsored=false` 인 병원은 행을 만들지 않습니다(`h1` 이 그 대조군입니다 — 평점 1위인데 광고를 사지 않아 `h3` 의 광고가 위로 올라가는 것을 보여주는 케이스).

### 8.4 프로모션 기간 (fixture 에 없는 값)

`promotions.ts` 4건에 `start_date`/`end_date` 가 없습니다. 시드가 부여합니다. 4건이 항상 진행중으로 보여야 화면 문서(`이벤트 4개가 카드로 나열됩니다`)와 맞으므로, **시드 기준일을 감싸는 창**을 줍니다.

```
p1  start = SEED_TODAY - 30일,  end = SEED_TODAY + 30일   (진행중)
p2  start = SEED_TODAY - 15일,  end = SEED_TODAY + 45일   (진행중)
p3  start = SEED_TODAY - 45일,  end = SEED_TODAY + 15일   (진행중)
p4  start = SEED_TODAY -  7일,  end = SEED_TODAY + 60일   (진행중)
```

기간 만료 UI 를 QA 하려면 `p3` 의 `end_date` 를 과거로 바꿔 보는 것으로 충분합니다. 이것도 문서에 남겨 QA 가 재현할 수 있게 하세요.

### 8.5 날짜를 상대값으로 둘 것 (권장)

fixture 의 상담 날짜는 2026년 6~7월 고정이고, 그래서 `/admin` 의 `이번 달 신규 상담` 이 항상 `0` 으로 나옵니다(알려진 문제). 시드에서 **`SEED_TODAY` 기준 상대 오프셋**으로 바꾸는 것을 권장합니다.

```
SEED_TODAY = 시드 실행 시각 (또는 env SEED_TODAY)

cr1  SEED_TODAY -  2일   status new         → '이번 달'
cr2  SEED_TODAY - 10일   status contacted   → '이번 달'
cr3  SEED_TODAY - 15일   status booked      → '이번 달'
cr6  SEED_TODAY -  1일   status contacted   → '이번 달'
cr7  SEED_TODAY - 25일   status new         → '이번 달'
cr4  SEED_TODAY - 45일   status cancelled   → '지난 달'
cr5  SEED_TODAY - 50일   status new         → '지난 달'
```

`status_history` 의 각 행도 같은 오프셋으로 미룹니다(원본의 상대 간격 유지). 원본 fixture 의 "이번 달 5건 / 지난 달 2건 / new 3건" 구성이 보존되면서, 언제 시드해도 대시보드 숫자가 0 이 아닙니다.

fixture 날짜를 그대로 넣는 선택지도 있습니다(원본 충실). 그 경우 대시보드가 0 으로 보이는 것이 정상임을 QA 문서에 남겨야 합니다. **둘 중 하나를 골라 시드 스크립트 주석에 명시하세요** — 지금 두 방식이 섞여 있으면 나중에 아무도 어느 쪽이 의도인지 알 수 없습니다.

### 8.6 이전하지 않는 fixture

- `trendingSearches.ts` (인기 검색어 10/10/6/8 + 추천 검색어 6) — 값이 코드에 하드코딩된 고정 샘플이고, 관리 화면이 없으며, 순위 변동(`▲2`)도 실제 집계가 아닙니다. 테이블로 옮기면 "관리하는 곳이 없는 테이블" 이 됩니다 (§9 제안 1)
- `placeholder-company-info.ts` (회사 정보) — 코드 상수. 사업자 정보가 확정되면 파일만 교체하면 됩니다
- 홈 배너 3장 — 화면 코드에 하드코딩. 링크도 없어 저장할 필드가 없습니다 (§9 제안 2)

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
3. **`partner_inquiries`** — `/partner-inquiry` 는 `문의 폼은 준비중입니다` 한 줄입니다. 폼 항목이 정해지지 않아 컬럼을 추측할 수 없습니다.
4. **`legal_documents`** — 약관 3종의 전문이 어디에도 없습니다. 버전·동의 이력이 필요해지면 `legal_documents` + `user_agreements` 가 필요합니다(회원가입에 약관 동의 절차가 없다는 것도 별도 문제입니다).
5. **`reviews.user_id`** — 후기 작성 기능이 없어 계정 연결을 두지 않았습니다. 작성 기능이 생기면 `user_id` 추가 + `author_name` 은 마스킹 표시값으로 유지.
6. **`hospital_event_notes` 의 기간** — 병원 상세 '진행중인 이벤트' 자유 문구에 기간 개념이 문서에 없습니다. `promotions` 처럼 기간이 필요해지면 추가합니다.
7. **`qa_post_views`** — 조회수가 방문마다 올라가는 문제(같은 사람이 다시 봐도 증가)를 제대로 고치려면 `(post_id, user_id 또는 세션, viewed_at)` 이 필요합니다. 지금은 `view_count` 한 컬럼입니다.
8. **`audit_logs`** — 관리자 행위 감사. 지금은 상태 변경(`changed_by_user_id`)과 검수(`reviewed_by_user_id`)에만 부분적으로 있습니다. 개인정보(고객 실명·전화번호) 조회 로그가 필요해지면 전용 테이블이 맞습니다.
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
