# 병원·전문의 도메인 API 설계

**날짜**: 2026-08-13
**상태**: 승인됨
**범위**: `openapi.yaml` 오퍼레이션 15개 + 프론트엔드 데이터 계층 교체
**선행**: `8d5d7f0` (인증·인가·감사 기반), `98a47f2` (실제 API 인증 + 라우트 인가)
**DB**: SQLite 로 구현·검증한다. PostgreSQL 전환은 이후이며, 이 조각은 §4.9 의 이식성 규칙을
지켜 `docs/database/README.md` §7.2 이전 절차를 유효하게 유지한다.

---

## 1. 배경

백엔드가 `auth` / `legal` / `health` 만 구현한 상태다. `openapi.yaml` 의 오퍼레이션 57개 중 7개다.
나머지 도메인은 프론트엔드가 `src/mocks/db.ts` (localStorage) 로 대신하고 있다.

이 문서는 그중 **병원·전문의 도메인**을 서버로 옮기는 첫 조각을 설계한다.
전체 도메인 절단은 4조각으로 나눴고 이 문서는 1조각이다:

| 조각 | 내용 | ops |
|---|---|---|
| **1 (이 문서)** | 병원·전문의 — 조회·편집·검수 | 15 |
| 2 | 찜·상담접수·알림 (남은 🔴 해소) | 9 |
| 3 | 관리자 상담 처리 (PII 마스킹 + 감사 로그 배선) | 17 |
| 4 | 커뮤니티·콘텐츠·검색·입점문의 | 17 |

조각마다 백엔드 구현 → 프론트 교체 → QA 까지 끝내는 **수직 절단**이다.
중간에 멈춰도 화면이 동작하는 상태로 남는다.

## 2. 절단선 — 왜 "읽기만"이 아니라 "도메인 통째로"인가

첫 초안은 조회 7개(`/procedures`, `/hospitals`, `/hospitals/{id}`, `/hospitals/{id}/doctors`,
`/hospitals/{id}/reviews`, `/doctors`, `/doctors/{id}`)만 옮기는 것이었다. 코드를 확인한 결과
**그대로 하면 새 결함이 생긴다.**

`useHospitalStore` / `useDoctorStore` 는 조회용 스토어가 아니라 **관리자 편집 화면이 소유한 쓰기 경로**다:

| 화면 | 호출 |
|---|---|
| `screens/admin/hospital/new.tsx` | `addHospital()` |
| `screens/admin/hospital/[id].tsx` | `updateHospital()` |
| `screens/admin/specialists.tsx` | 전문의 인증 상태 변경 |
| `components/admin/HospitalForm.tsx` | 전문의 추가·수정·삭제 |

읽기만 서버로 옮기면 사용자 화면은 서버 DB 를, 관리자 편집은 브라우저 `mockDb` 를 보게 되어
**관리자가 병원을 수정해도 사용자 화면에 영원히 반영되지 않는다.**
`docs/features/known-issues.md` 의 개발자 메모가 "저장소 갈라짐 위험"으로 경고한 상황이 그대로 실현된다.

인가가 조각 1로 앞당겨지지만 추가 비용은 작다. `@Roles`, `@HospitalScope`, `ResourceScopeService`,
가드 3종이 `8d5d7f0` 에서 이미 구현·테스트됐고 지금은 붙일 도메인 컨트롤러가 없어 놀고 있다.
이 조각이 그 첫 소비자가 된다.

## 3. 범위

### 들어오는 것 (15 ops)

| 메서드·경로 | 역할 | 비고 |
|---|---|---|
| `GET /procedures` | 공개 | 13종 고정 순서, ETag + `max-age=3600` |
| `GET /hospitals` | 공개 | 필터 12종 · 정렬 3 · 페이지네이션 · 스폰서 우선 노출 |
| `GET /hospitals/{id}` | 공개 | ETag |
| `POST /hospitals` | operator | |
| `PATCH /hospitals/{id}` | hospital_admin(담당) · operator | |
| `GET /hospitals/{id}/doctors` | 공개 | 미승인 전공 가림 |
| `PUT /hospitals/{id}/doctors` | hospital_admin(담당) · operator | 일괄 교체 |
| `GET /hospitals/{id}/reviews` | 공개 | 읽기 전용 |
| `GET /admin/hospitals` | hospital_admin · operator | `scope: managed \| all` |
| `GET /doctors` | 공개 | 탐색 `의사` 모드 |
| `GET /doctors/{id}` | 공개(선택 인증) | 비로그인은 `rating: null` |
| `PATCH /doctors/{id}` | hospital_admin(담당) · operator | |
| `DELETE /doctors/{id}` | hospital_admin(담당) · operator | |
| `GET /doctors/verification-queue` | **operator 전용** | |
| `PUT /doctors/{id}/verification` | **operator 전용** | 알림 행 생성 포함 |

### 나가는 것

- **알림 조회 API** — 조각 2. 단, 검수 결정 시 `notifications` / `notification_recipients`
  **행 생성은 이 조각에서 한다.** 계약이 같은 트랜잭션을 요구하고, 행을 안 만들면 조각 2에서
  과거 검수 이력이 통째로 비게 된다. 조각 2는 그 행을 읽는 API 만 붙인다.
- 상담 상세 열람 감사 로그 — 상담 컨트롤러가 생기는 조각 3
- `GET /promotions?hospitalId=` (병원 상세의 진행중 이벤트) — 조각 4
- 후기 작성 — 계약에 없다. 어느 화면에도 작성 기능이 없다
- `POST /hospitals/{id}/admins` 등 담당자 지정 — 조각 3

## 4. 백엔드 설계

### 4.1 모듈 구조

기존 `src/auth/` 패턴(module + controller + service + repository + zod schemas)을 따른다.

```
src/procedure/   procedure.module.ts  .controller.ts  .service.ts
src/hospital/    hospital.module.ts   .controller.ts  .service.ts
                 hospital.repository.ts      Prisma 조회·쓰기
                 hospital.projection.ts      DB 행 → 계약 응답
                 hospital.filters.ts         쿼리 → Prisma where/orderBy
                 hospital.schemas.ts         zod
                 sponsorship.ts              광고 계산 (순수 함수)
src/doctor/      doctor.module.ts     .controller.ts  .service.ts
                 doctor.repository.ts
                 doctor.projection.ts        공개 / 관리자 두 시야
                 doctor.filters.ts
                 doctor.schemas.ts
                 verification.service.ts     검수 큐·승인·반려 + 부수효과
src/review/      review.module.ts     .controller.ts  .repository.ts  .projection.ts
```

**투영을 별도 파일로 분리하는 이유:** DB 는 정규화돼 있고(`priceMin`/`priceMax` 두 컬럼,
`featureXxx` boolean 6개, `HospitalProcedure`·`HospitalImage`·`HospitalTag`·`BusinessHour`·
`HospitalSponsorship` 조인 테이블) 계약은 프론트의 `Hospital` 타입을 보존한다
(`priceRange` 객체, `features` 객체, `procedureIds`·`images`·`tags`·`businessHours` 배열).
이 변환을 15개 중 8개 엔드포인트가 공유한다. 한 곳에 두고 순수 함수로 테스트한다.

### 4.2 스폰서(광고) 계산을 서버로 옮긴다

계약이 못 박은 사항이다 — 클라이언트가 기기 시계로 광고 기간을 계산하면 시계가 틀린 사용자에게
광고가 잘못 노출된다. `frontend/src/utils/sponsorship.ts` 의 규칙을 `hospital/sponsorship.ts` 로
옮기고 프론트의 것은 삭제한다.

응답의 `sponsorship` 계산 필드는 **두 값이 다르다:**

| 필드 | 조건 | 쓰임 |
|---|---|---|
| `isActive` | 광고 기간 중 | `광고` 배지 |
| `isPlacementEligible` | 기간 + `rating >= 3.5` + 카테고리 일치 | 상단 노출 |

정렬 규칙(계약 §`GET /hospitals`):

1. `procedureId` 지정 → 기간 중 && `sponsoredCategories` 포함 && `rating >= 3.5`
2. `recommended=true` → 기간 중 && `rating >= 3.5`
3. 대상들을 `sponsoredRank` 오름차순으로 맨 앞, 나머지는 `sort` 기준
4. **필터가 없으면(`기타` 칩) 우선 노출을 적용하지 않는다**

"오늘"은 `Asia/Seoul` 기준으로 서버가 계산한다. 기간 경계 테스트를 위해
날짜를 주입 가능한 인자로 둔다(현재 프론트 구현과 동일한 형태).

### 4.3 필터·정렬·페이지네이션

`GET /hospitals` 하나가 탐색 화면의 시술 칩 15 · 정렬 3 · 조건 칩 5 · 지도 반경 4를 전부 받는다.

**서버에서만 가능한 것** — 클라이언트로 되돌릴 수 없다:

- `hasVerifiedSpecialist` — 병원↔전문의 조인이 필요하다
- `minDoctorYearsOfExperience` — 같은 이유
- 의사 모드의 `consultAvailable` / `oneDay` / `nightConsult` — 소속 **병원** 속성으로 의사를 거른다

**클라이언트에 남는 것:** `리스트` / `지도` / `가격 비교표` 보기 전환. 순수 표현이며 파라미터가 없다.

`radiusKm` 반경 필터는 SQLite·PostgreSQL 양쪽에서 도는 형태여야 한다(§7.2 이식성 기준).
위경도 bounding box 로 1차 좁힌 뒤 하버사인 거리로 정밀 필터하고 `distanceKm` 를 응답에 담는다.
DB 함수에 의존하지 않는다.

정렬은 전부 내림차순이다. `rating` 이 화면의 `인기순` — 별도 인기 지표가 없다.

### 4.4 인가

| 리소스 | 없는 id | 권한 없는 id |
|---|---|---|
| 병원 (공개) | 404 `HOSPITAL_NOT_FOUND` | **403 `HOSPITAL_NOT_MANAGED`** |
| 전문의 (공개) | 404 `DOCTOR_NOT_FOUND` | **403 `HOSPITAL_NOT_MANAGED`** |

상담·입점문의(조각 3)와 **반대**다. 병원은 공개 리소스라 `GET /hospitals/{id}` 로 누구나 존재를
확인할 수 있으므로 존재를 숨겨서 얻는 것이 없고, 403 이 "담당 병원이 아니다"라는 정확한 원인을
알려주어 담당자가 id 를 잘못 넣은 경우를 구분할 수 있다.

`PATCH /hospitals/{id}` 의 쓰기 금지 필드는 **조용히 무시하지 않고 `422 FIELD_NOT_WRITABLE` 로 거절한다.**
조용히 무시하면 관리자 화면이 "저장했는데 안 바뀐다" 상태가 된다 — 지금 `대표 이미지 URL` 에서
실제로 겪고 있는 증상이다.

| 필드 | 누가 |
|---|---|
| `isSponsored` · `sponsoredCategories` · `sponsoredRank` · `sponsoredStartDate` · `sponsoredEndDate` | 아무도 (이 엔드포인트로는) |
| `rating` · `reviewCount` · `consultCount` | 아무도 (집계값) |
| `isRecommended` | operator 만 |

### 4.5 라우트 선언 순서 (계약이 경고한 함정)

NestJS 는 선언 순서로 매칭한다. `@Get('verification-queue')` 를 `@Get(':doctorId')` **앞에**
선언해야 한다. 뒤에 두면 `verification-queue` 가 `doctorId` 로 잡혀 `404 DOCTOR_NOT_FOUND` 가 난다.
이 순서를 테스트로 고정한다 — 리팩터링으로 메서드 순서가 바뀌면 조용히 깨지는 종류다.

### 4.6 재검수 규칙 (지금 없는 것을 서버가 넣는다)

`PUT /hospitals/{id}/doctors` 와 `PATCH /doctors/{id}` 양쪽에 동일하게 적용한다:

- 기존 전문의의 `specialty` 또는 `certificateUrl` 이 바뀌면 → `verificationStatus` 를 `pending` 으로
  되돌리고 `rejectionReason` 을 지우고 `DoctorVerification` 에 pending 행을 새로 만든다
- `verificationStatus` 는 이 두 엔드포인트로 **바꿀 수 없다.** 승인은 operator 전용이다

지금은 승인된 전문의의 전공을 다른 과로 바꿔도 승인이 유지되어, 검수 없이 새 과의 `전문의` 배지가
노출된다. 이 규칙이 그 결함을 막는다.

`PUT /hospitals/{id}/doctors` 의 `name` 은 `minLength: 1` 필수다. 지금은 이름을 비우고 저장하면
그 전문의가 조용히 삭제되고 되돌릴 수 없다. `422` 로 거절하면 그 사고 경로가 막힌다.
삭제는 목록에서 항목을 빼는 것으로만 가능하다.

### 4.7 전문의 배지 판정은 `verifiedSpecialty` 로 한다

DB 는 `specialty`(병원이 신고한 값)와 `verifiedSpecialty`(실제 승인받은 값)를 분리해 두고 있다.

```
전문의 배지 = verificationStatus = 'approved'
              AND verifiedSpecialty = specialty
              AND specialty <> '일반의'
```

공개 응답의 `visibleSpecialty` 는 이 조건을 만족하지 않으면 `null` 이다. 원본 `specialty` 를
공개 응답에 싣지 않는다 — 지금은 클라이언트가 `getVisibleSpecialtyLabel()` 로 가리지만, 응답에
값이 실려 있으면 검수 전 전공이 API 를 뜯어보는 누구에게나 보인다. 규칙을 서버로 옮긴다.

`certificateUrl` · `rejectionReason` 은 관리자 시야(`DoctorAdminView`)에만 포함된다.
공개 투영과 관리자 투영을 **다른 함수**로 두고, 공개 함수가 이 필드들을 애초에 읽지 않게 한다.

### 4.8 검수 결정의 부수효과

`PUT /doctors/{id}/verification` 은 한 트랜잭션에서:

1. `verificationStatus` 를 `approved` / `rejected` 로
2. `approved` → `rejectionReason` 을 `null` 로. `rejected` → 사유 저장 (필수, 1자 이상)
3. `DoctorVerification` 에 결정 행 (`reviewedByUserId`, `reviewedAt`)
4. **소속 병원 담당자 전원에게 `audience=admin` 알림 행 생성**
   (`type=system`, `relatedResource=doctor`, `relatedId=doctorId`)

담당자가 아직 지정되지 않은 병원이면 알림은 만들어지되 수신자가 0명이다 — 승인 자체는 성공한다.

`certificateUrl` 이 없는(미제출) 전문의도 승인할 수 있다. 되돌리기(승인↔반려)도 허용한다.

검수 큐는 기본적으로 `일반의` 를 **제외**한다. `일반의` 는 검수할 자격증이 없고 승인/반려가
사용자 화면 표시를 바꾸지도 않는다. `includeGeneralPractitioners=true` 일 때만 포함한다.
정렬은 항상 `대기 → 반려 → 승인`, 같은 상태 안에서는 등록 순이다.

### 4.9 SQLite 로 검증한다 — 조각 1이 밟는 이식성 지점

**DB 는 SQLite 로 두고 PostgreSQL 전환은 나중이다.** 이 조각은 SQLite 에서 구현·검증한다.
스키마·문서에 이미 확립된 규정(`prisma/schema.prisma` 머리말 10개 규칙,
`docs/database/README.md` §3)을 그대로 따르며, **조각 1이 실제로 밟는 지점만** 아래에 못 박는다.
PostgreSQL 전용 문법이나 `$queryRaw` 를 쓰면 §7.2 이전 절차가 무효가 된다.

| 지점 | 규칙 | 근거 |
|---|---|---|
| `q` 검색 (`/hospitals`, `/doctors`, `/admin/hospitals`) | `nameNormalized: { contains: lower(trim(q)) }`. **`mode: 'insensitive'` 금지** — Prisma 에서 PostgreSQL 전용이고 SQLite 는 미지원 | §3.9 |
| 쓰기 시 정규화 컬럼 | `POST /hospitals` · `PATCH /hospitals/{id}` · `PUT /hospitals/{id}/doctors` · `PATCH /doctors/{id}` 가 `nameNormalized` 를 반드시 채운다. 빠뜨리면 검색에서 조용히 사라진다 | §3.9 |
| 반경 필터 (`radiusKm`) | **앱에서 계산한다.** 공간 인덱스도 PostGIS 도 쓰지 않는다 | §3.8 이 명시적으로 "그 시점까지는 앱 계산 유지" |
| 조인 필터 (`hasVerifiedSpecialist`, `minDoctorYearsOfExperience`) | Prisma 관계 필터(`doctors: { some: {...} }`). raw SQL 금지 | §3.8 |
| `updatedAt` | `@updatedAt` 이 없다. **모든 쓰기 경로가 UTC 로 직접 세팅한다** | 스키마 머리말 |
| 정렬 동점 | `orderBy` 에 `id` tiebreaker 를 항상 더한다 | 아래 |
| boolean | Prisma Client 로만 접근하면 차이가 드러나지 않는다. 특별 처리 없음 | §3.10 |

**정렬 동점 tiebreaker 는 이식성 문제이자 페이지네이션 정확성 문제다.** `rating` 이 같은 병원이
여럿일 때 SQLite 와 PostgreSQL 의 반환 순서가 다를 수 있고, 순서가 불안정하면 1페이지와 2페이지
사이에서 같은 행이 중복되거나 누락된다. 모든 목록 쿼리의 `orderBy` 를
`[{ <sort>: 'desc' }, { id: 'asc' }]` 로 고정한다.

**반경 필터와 페이지네이션의 상호작용** — 거리 계산이 앱에서 일어나므로 SQL 의 `LIMIT`/`OFFSET`
을 그대로 쓰면 `meta.totalItems` 가 필터 전 개수가 되어 화면의 `총 N곳` 이 틀린다.
`latitude`·`longitude`·`radiusKm` 가 온 요청은 **bounding box 로 후보를 좁혀 전부 읽고, 앱에서
하버사인 거리로 필터·정렬한 뒤 페이징한다.** 현재 병원이 11곳이라 비용이 없고, 수천 곳이 되는
시점은 이미 PostgreSQL + PostGIS 로 옮겨간 뒤다(§3.8·§7.6). 이 제약을 코드 주석에 남긴다.

### 4.10 전문의 삭제는 soft delete 다

계약의 `DELETE /doctors/{id}` 설명("되돌릴 수 없다")은 **사용자 관점의 문구**이며 물리 삭제를
지시하는 것이 아니다. 물리 삭제하면 안 되는 이유가 스키마에 있다:

`ConsultRequest.doctor` 의 FK 가 `onDelete: SetNull` 이다. 전문의를 물리 삭제하면 그 전문의를
지목한 상담들의 `doctorId` 가 전부 `null` 이 되어 **"어느 전문의에게 신청했는지"가 사라진다.**
그 값을 남기는 것이 바로 이 계약이 고치려는 🟠 결함("전문의 상담신청인데 어느 전문의인지
저장되지 않습니다")이다. 물리 삭제는 방금 고친 것을 다시 부순다.

`Doctor.deletedAt` 컬럼과 `@@index([deletedAt])` 가 이미 있다 — 스키마가 soft delete 를 전제하고 있다.

**규칙:**

- `DELETE /doctors/{id}` 와 `PUT /hospitals/{id}/doctors` 의 목록 이탈 삭제는 `deletedAt` 을 세팅한다
- **모든 조회 쿼리에 `deletedAt: null` 을 넣는다** — 목록·상세·검수 큐·조인 필터 전부.
  하나라도 빠뜨리면 삭제된 전문의가 화면에 다시 나타난다. 리포지토리 계층에서 기본 조건으로
  두고, 테스트가 "삭제 후 각 엔드포인트에서 사라지는지"를 엔드포인트별로 확인한다
- 병원도 동일하다 (`Hospital.deletedAt`). 조각 1에 병원 삭제 엔드포인트는 없지만
  조회 쪽 필터는 지금 넣는다

## 5. 프론트엔드 설계

### 5.1 도메인 타입 변경

`src/types/domain.ts` 에 계약의 계산 필드를 더한다. **기존 필드는 지우거나 이름을 바꾸지 않는다** —
계약이 그렇게 설계됐으므로 기존 화면 코드가 수정 없이 통과한다.

```
Hospital  + sponsorship: { isActive, isPlacementEligible }
          + representativeSpecialty, distanceKm?
Doctor    + visibleSpecialty: DentalSpecialty | null
          + isVerifiedSpecialist: boolean
          rating: number → number | null   (비로그인 잠금)
```

`rating` 이 nullable 이 되는 것만 기존 코드에 영향을 준다. 전문의 상세의 평점 표시부가
해당하며, 지금도 비로그인에 반투명 막을 덮는 자리라 분기가 이미 있다.

### 5.2 교체 대상

```
features/hospital/api/hospitalApi.ts   mockDb → apiRequest (시그니처는 필터 인자만 추가)
features/hospital/hooks/               useHospitals(filters), useHospital,
                                       useCreateHospital, useUpdateHospital,
                                       useManagedHospitals
features/doctor/                       신설 — api·hooks·components (DoctorCard 이관)
features/procedure/                    신설 — 읽기 전용
features/review/                       신설 — 읽기 전용
pages/                                 ExplorePage · DoctorDetailPage ·
                                       AdminHomePage · AdminHospitalNewPage ·
                                       AdminHospitalEditPage · AdminSpecialistsPage
```

`queryKeys.hospitals.all` 은 필터를 캐시 단위에 포함해야 하므로 `list(filters)` 를 더한다.
`all` 은 무효화용 접두사로 남긴다.

### 5.3 `getProcedureById()` — 동기 조회를 어떻게 바꾸는가

`mocks/fixtures/procedures.ts` 의 `getProcedureById()` 는 **렌더 중 동기 호출**로 10곳 이상에서
쓰인다 (`HospitalCard`, `HospitalDetailView`, `HospitalExploreCard`, `HospitalMapView`,
`DoctorCard`, `HospitalForm`, 관리자 화면들). 서버 쿼리로 바꾸면 이 호출부가 전부 비동기가 된다.

시술은 13종 고정 마스터 데이터이므로 **앱 부팅 시 한 번 받아 맵으로 들고 있는다:**

```
features/procedure/hooks/useProcedures.ts    GET /procedures (staleTime: Infinity)
features/procedure/hooks/useProcedureMap.ts  Map<ProcedureId, Procedure>
```

호출부는 `getProcedureById(id)` → `useProcedureMap().get(id)` 로 바뀐다. 기계적인 치환이고
렌더 중 동기 조회라는 성질은 유지된다. 계약이 `Cache-Control: max-age=3600` + ETag 를 지정한
것도 같은 의도다.

`ProcedureId` 유니온 타입 자체는 `types/domain.ts` 에 그대로 둔다 — 컴파일 타임 상수이고
서버 응답으로 대체할 수 있는 것이 아니다.

### 5.4 삭제·이동 대상

| 파일 | 처분 |
|---|---|
| `store/useHospitalStore.ts` | 삭제 (`getHospitalById` · `getHospitalsByProcedure` 포함) |
| `store/useDoctorStore.ts` | 삭제 |
| `utils/sponsorship.ts` | **백엔드로 이동** (`hospital/sponsorship.ts`) |
| `utils/specialty.ts` 의 `isVerifiedSpecialist` · `getVisibleSpecialtyLabel` · `getRepresentativeSpecialist` | 삭제 — 서버 계산 필드(`isVerifiedSpecialist` · `visibleSpecialty` · `representativeSpecialty`)로 대체 |
| `utils/specialty.ts` 의 `PROCEDURE_SPECIALTY_MAP` · `getProceduresForSpecialty` | **백엔드로 이동** — 신규 전문의의 `procedureIds` 를 전공에서 유도하는 것은 이제 서버 책임이다 (§4.6) |
| `mocks/fixtures/{hospitals,doctors,procedures,reviews}.ts` | 백엔드로 이동 (§6) |
| `mocks/db.ts` 의 `hospitals` · `doctors` 테이블 | 삭제 |

`mockDb` 에는 `consultRequests` · `communityPosts` · `notifications` 세 테이블이 **남는다.**
조각 2~4 가 각자 걷어낸다. `LEGACY_SOURCES` 의 `hospitals` · `doctors` 항목도 함께 지운다.

`getHospitalById()` 는 `getState()` 스냅샷을 읽는 비반응형 호출로 `PromotionCard`,
`tips/[id].tsx`, `doctor/[id].tsx` 3곳에서 쓰인다(known-issues 개발자 메모의 지적).
스토어가 사라지면서 이 3곳이 `useHospital(id)` 로 바뀌어 함께 해소된다.

**주의 — `isVerifiedSpecialist` 의 판정이 서버에서 더 엄격해진다.** 현재 프론트 구현은
`verificationStatus === 'approved' && specialty !== '일반의'` 뿐이고 `verifiedSpecialty` 를 보지 않는다.
서버는 §4.7 대로 `verifiedSpecialty === specialty` 를 함께 본다. 승인 후 전공이 바뀐 전문의는
배지를 잃는다 — 의도된 변화이며 🟡 결함의 해결이다. 시드 데이터에서 이 조건에 걸리는 행이
있는지 확인하고, 있으면 QA 가 오해하지 않도록 기록한다.

### 5.5 계획 문서와의 관계

이 조각이 `docs/superpowers/plans/2026-08-12-frontend-stack-alignment.md` 의
**Task 4(explore 필터 훅 분리)와 Task 5(doctor feature)를 함께 소화한다.**
필터를 서버 쿼리 파라미터로 옮기는 작업이 곧 Task 4 이기 때문이다.
그 계획 문서는 조각 1 완료 시점에 해당 Task 를 이 문서로 대체한다고 표시한다.

## 6. fixture 소유권 이전

지금은 프론트 fixture 가 원본이고 백엔드 시드가 그것을 import 한다.
이 조각이 끝나면 **DB 가 원본**이 되고 프론트에는 병원·전문의 fixture 가 필요 없다.

순서를 지켜야 시드가 깨지지 않는다:

1. 백엔드 구현 완료 · 시드는 계속 프론트 fixture 를 import
2. 프론트 교체 완료 (화면이 서버에서 읽는다)
3. **fixture 를 `backend/prisma/seed/data/` 로 물리 이동**하고 `seed/fixtures.ts` 의 import 경로를 바꾼다
4. 프론트의 해당 fixture 와 `mockDb` 컬렉션 삭제

조각 2~4 가 쓰는 fixture(`consultRequests`, `notifications`, `qaPosts`, `guides`, `promotions`)는
건드리지 않는다. 그 조각들이 각자 같은 절차로 옮긴다.

## 7. 테스트 전략

### 백엔드

| 대상 | 형태 |
|---|---|
| 투영 (`*.projection.ts`) | 순수 함수 단위 테스트. DB 행 → 계약 응답 |
| 스폰서 계산·정렬 | 순수 함수. 기간 경계·평점 3.5 경계·필터 없음(규칙 4) |
| 필터 조합 | e2e. 조건 칩 5개 교차, `hasVerifiedSpecialist` 조인 |
| 인가 | e2e. **기존 `authorization.e2e.spec.ts` 의 기준을 따른다** |
| 라우트 순서 | e2e. `GET /doctors/verification-queue` 가 큐를 준다 |
| 재검수 규칙 | e2e. 전공 변경 → `pending` 복귀 + 검수 행 생성 |
| 검수 부수효과 | e2e. 알림 행 + 수신자 행, 담당자 0명 병원도 성공 |
| soft delete | e2e. 삭제 후 목록·상세·검수 큐·조인 필터에서 각각 사라지는지 |
| 정렬 안정성 | e2e. 동점 병원이 있는 상태에서 1·2페이지에 중복·누락이 없는지 |
| 이식성 | 정적 검사. `$queryRaw`/`$executeRaw` 와 `mode: 'insensitive'` 사용 0건 |

**DB 는 SQLite 하나로 검증한다.** PostgreSQL 실행 검증은 `docs/database/README.md` §7.2 절차로
이전 시점에 하는 것이고, 지금은 그 절차가 무효화되지 않도록 §4.9 규칙을 지키는 데 집중한다.
`$queryRaw` / `mode: 'insensitive'` 금지는 사람이 리뷰로 잡을 것이 아니라 **테스트로 고정한다** —
소스를 읽어 해당 토큰이 없음을 확인하는 단순 검사이며, 나중에 누가 편의로 넣는 것을 막는다.

인가 e2e 는 **응답 본문이 동일한지까지 본다.** 남의 병원과 없는 병원의 응답이 갈리면
id 를 순차 대입해 존재를 셀 수 있다 — `8d5d7f0` 이 세운 기준이며 이 조각도 따른다.
다만 병원은 공개 리소스라 §4.4 처럼 403/404 가 의도적으로 갈린다. 이 **의도된 차이 자체를**
테스트로 고정해, 나중에 누가 "일관성"을 이유로 404 로 바꾸는 것을 막는다.

### 프론트엔드

기존 패턴을 따른다 — `src/test/queryWrapper.tsx`, `apiClient.test.ts` 의 fetch 모킹(MSW 없음).

- api 함수: 쿼리 파라미터 직렬화, 에러 매핑
- 훅: 필터 변경 시 캐시 키가 갈라지는지, mutation 후 무효화 대상
- 화면: 탐색 필터 조작 → 목록 변경, 관리자 폼 저장 → 상세 반영

### QA (CLAUDE.md 규칙)

`qa-master` 로 실제 동작까지 검증하고, 통과 전에는 완료로 보지 않는다:

- 필터/검색 — 조건 칩 조작 시 실제 리스트가 바뀌는가, `총 N곳` 이 맞는가
- 폼 제출 — 병원 등록·수정, 전문의 이름 비우고 저장 시 거절되는가
- **관리자 수정이 사용자 화면에 반영되는가** (이 조각의 존재 이유)
- 인가 — `hospital_admin` 이 주소로 남의 병원 수정 화면에 들어가면 막히는가
- 검수 — operator 만 `/admin/specialists` 에 접근, 승인 시 상태가 바뀌는가

## 8. 성공 기준

1. 15개 엔드포인트가 계약대로 동작하고 e2e 로 고정된다
2. 프론트에서 병원·전문의 관련 `mockDb` 접근이 0건이다
3. `useHospitalStore` · `useDoctorStore` · `utils/sponsorship.ts` 가 삭제된다
4. 관리자가 병원을 수정하면 사용자 화면에 반영된다 (저장소 갈라짐 없음)
5. 승인된 전문의의 전공을 바꾸면 `pending` 으로 돌아간다
6. 전문의 이름을 비우고 저장하면 거절된다 (조용한 삭제 없음)
7. 미승인 전공이 API 응답에 실리지 않는다
8. 삭제한 전문의가 어느 엔드포인트에서도 다시 나타나지 않고, 그 전문의를 지목한 상담의
   `doctorId` 가 보존된다
9. **PostgreSQL 전용 문법·raw SQL 이 0건이다** — `docs/database/README.md` §7.2 이전 절차가
   그대로 유효하게 남는다
10. 백엔드·프론트 게이트 전부 통과 (`lint` · `typecheck` · `test` · `build`)
11. `qa-master` QA 통과

## 9. 이 조각이 없애는 known-issues 항목

| 등급 | 항목 |
|---|---|
| 🟡 | 전문의 이름을 비우고 저장하면 삭제됨 |
| 🟡 | 인증된 전문의의 전공을 바꿔도 재검수되지 않음 |
| 🟡 | 대표 이미지를 바꿔도 병원 상세 사진이 그대로 (`422` 로 원인을 드러냄) |
| 🟡 | 병원 목록·전문의 검수 목록이 0건일 때 빈 화면 (`scope` 로 문구 구분) |
| 🟡 | 검수 목록에 `일반의` 포함 |
| 개발자 메모 | 비반응형 `getHospitalById()` 3곳 |
| 개발자 메모 | 병원(mockDb) / 전문의(persist) 저장소 갈라짐 |

**부분 해소:** 🟡 "전문의 승인/반려 결과가 병원에 통보되지 않음" — 알림 행은 이 조각에서 생기고,
화면에 보이는 것은 조각 2 에서 완성된다.
