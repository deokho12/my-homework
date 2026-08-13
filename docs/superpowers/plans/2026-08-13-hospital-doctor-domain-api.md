# 병원·전문의 도메인 API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `openapi.yaml` 의 병원·전문의 오퍼레이션 15개를 NestJS 로 구현하고, 프론트엔드의 병원·전문의 데이터 계층을 `mockDb` 에서 실제 API 로 교체한다.

**Architecture:** 기존 `src/auth/` 의 모듈 패턴(module + controller + service + repository + zod schemas)을 따르되, DB 정규화 구조와 계약 응답 사이의 변환을 `*.projection.ts` 순수 함수로 분리한다. 인가는 이미 구현된 3층(`AuthGuard` → `RolesGuard` → `HospitalScopeGuard`)에 데코레이터만 붙여 쓴다. 프론트는 `features/{hospital,doctor,procedure,review}/api/` 내부만 HTTP 로 바꾸고 훅·페이지 시그니처는 유지한다.

**Tech Stack:** NestJS 11 · Prisma 6 · SQLite · Zod · Vitest + supertest / React 19 · TanStack Query 5 · Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-08-13-hospital-doctor-domain-api-design.md`

## Global Constraints

이 절의 규칙은 **모든 Task 에 적용된다.** 값은 스펙과 `docs/database/README.md` 에서 그대로 옮긴 것이다.

- **DB 는 SQLite 다.** PostgreSQL 전환은 이후다. 아래 이식성 규칙을 어기면 `docs/database/README.md` §7.2 이전 절차가 무효가 된다
- **`$queryRaw` / `$executeRaw` 를 쓰지 않는다.** Prisma Client 만 쓴다 (§3.8)
- **`mode: 'insensitive'` 를 쓰지 않는다.** Prisma 에서 PostgreSQL 전용이고 SQLite 는 미지원. 이름 검색은 `nameNormalized` 컬럼에 `contains` 를 쓴다 (§3.9)
- **`nameNormalized` = `name.trim().toLowerCase()`.** 병원·전문의를 만들거나 이름을 고치는 모든 경로가 이 컬럼을 함께 채운다
- **`updatedAt` 은 애플리케이션이 세팅한다.** 스키마에 `@updatedAt` 이 없다. 모든 쓰기에 `updatedAt: new Date()` 를 명시한다
- **모든 목록 쿼리의 `orderBy` 에 `{ id: 'asc' }` tiebreaker 를 더한다.** 동점 시 반환 순서가 DB 마다 달라 페이지 경계에서 중복·누락이 생긴다
- **모든 조회에 `deletedAt: null` 을 넣는다.** 병원·전문의는 soft delete 다
- **삭제는 soft delete 다.** `deletedAt` 을 세팅하고 행을 지우지 않는다. `ConsultRequest.doctor` 의 FK 가 `onDelete: SetNull` 이라 물리 삭제하면 상담의 `doctorId` 가 사라진다
- **응답 필드명은 `camelCase`**, 금액은 정수(원), 시각은 UTC ISO-8601. `Review.createdAt` · `Hospital.sponsoredStartDate` · `Hospital.sponsoredEndDate` 만 날짜(`YYYY-MM-DD`) 문자열이다
- **에러는 `ApiError` 로만 던진다.** 코드는 `src/common/errors/api-error.ts` 의 `ERROR_CATALOG` 에 있는 것만 쓴다. 새 코드가 필요하면 카탈로그에 먼저 추가한다
- **"오늘" 은 `Asia/Seoul` 기준으로 서버가 계산한다.** 응답 시각은 UTC 다
- 백엔드 게이트: `npm run lint && npm run typecheck && npm run test:run` (backend/)
- 프론트 게이트: `npm run lint && npm run typecheck && npm run test:run && npm run build` (frontend/)

## 선행 조건

**이 계획은 반응형 레이아웃 작업이 커밋된 뒤에 시작한다.** Task 15 이후가 `screens/tabs/explore.tsx`, `components/admin/HospitalForm.tsx`, `screens/admin/*`, `screens/doctor/[id].tsx` 를 다시 쓰는데 그 작업이 같은 파일을 수정 중이다. Task 1~14(백엔드)는 겹치지 않으므로 먼저 진행해도 된다.

## 파일 구조

### 백엔드 (신규)

| 파일 | 책임 |
|---|---|
| `src/procedure/procedure.module.ts` · `.controller.ts` · `.repository.ts` | 시술 13종 조회 |
| `src/hospital/hospital.module.ts` | 병원 모듈 배선 |
| `src/hospital/hospital.controller.ts` | 라우트 + 데코레이터 |
| `src/hospital/hospital.service.ts` | 조회 조합·쓰기 규칙 |
| `src/hospital/hospital.repository.ts` | Prisma 조회·쓰기 |
| `src/hospital/hospital.projection.ts` | DB 행 → 계약 `Hospital` |
| `src/hospital/hospital.filters.ts` | 쿼리 → Prisma `where`/`orderBy` |
| `src/hospital/sponsorship.ts` | 광고 계산 (순수 함수) |
| `src/hospital/distance.ts` | bounding box + 하버사인 (순수 함수) |
| `src/hospital/hospital.schemas.ts` | zod |
| `src/doctor/doctor.module.ts` · `.controller.ts` · `.service.ts` · `.repository.ts` | 전문의 |
| `src/doctor/doctor.projection.ts` | 공개 시야 / 관리자 시야 두 함수 |
| `src/doctor/doctor.filters.ts` · `doctor.schemas.ts` | |
| `src/doctor/verification.service.ts` | 검수 큐·승인·반려 + 부수효과 |
| `src/doctor/specialty-procedures.ts` | 전공 → 시술 유도 (프론트 `utils/specialty.ts` 에서 이동) |
| `src/review/review.module.ts` · `.controller.ts` · `.repository.ts` · `.projection.ts` | 후기 조회 |
| `src/common/pagination.ts` | `PageMeta` 계산 |

### 프론트엔드

| 파일 | 처분 |
|---|---|
| `src/features/hospital/api/hospitalApi.ts` | `mockDb` → `apiRequest` |
| `src/features/hospital/hooks/*` | 필터 인자 + mutation 훅 |
| `src/features/doctor/**` · `src/features/procedure/**` · `src/features/review/**` | 신설 |
| `src/pages/ExplorePage.tsx` · `DoctorDetailPage.tsx` · `admin/*.tsx` | 이관 |
| `src/store/useHospitalStore.ts` · `useDoctorStore.ts` | 삭제 |
| `src/utils/sponsorship.ts` | 백엔드로 이동 후 삭제 |
| `src/utils/specialty.ts` | 판정 3함수 삭제, `PROCEDURE_SPECIALTY_MAP` 은 백엔드로 이동 |
| `src/mocks/fixtures/{hospitals,doctors,procedures,reviews}.ts` | 백엔드로 이동 |
| `src/mocks/db.ts` | `hospitals` · `doctors` 테이블 제거 |

---

## Task 1: 시술 목록 — 모듈 패턴 확립

가장 단순한 엔드포인트로 도메인 모듈의 형태를 확정한다. 이후 Task 가 이 구조를 복제한다.

**Files:**
- Create: `backend/src/procedure/procedure.repository.ts`
- Create: `backend/src/procedure/procedure.controller.ts`
- Create: `backend/src/procedure/procedure.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/procedure.e2e.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`src/prisma/prisma.service.ts`)
- Produces: `ProcedureRepository.findAll(): Promise<ProcedureResponse[]>`, `ProcedureResponse = { id, name, emoji, shortDescription, description }`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/procedure.e2e.spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './support/app';

/** 계약이 고정한 순서 (openapi `listProcedures`). 화면 3곳이 같은 목록을 쓴다. */
const EXPECTED_ORDER = [
  'implant', 'orthodontics', 'laminate', 'inlay', 'crown', 'whitening',
  'wisdom-tooth', 'cavity', 'gum-disease', 'splint', 'snoring-device', 'tmj', 'botox',
];

describe('GET /api/v1/procedures', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('13종을 계약이 고정한 순서로 준다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.status).toBe(200);
    expect(response.body.map((item: { id: string }) => item.id)).toEqual(EXPECTED_ORDER);
  });

  it('화면이 쓰는 필드를 전부 담는다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.body[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      emoji: expect.any(String),
      shortDescription: expect.any(String),
      description: expect.any(String),
    });
  });

  it('인증 없이 접근할 수 있다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.status).toBe(200);
  });

  it('마스터 데이터라 캐시 헤더를 붙인다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/procedures');

    expect(response.headers['cache-control']).toBe('public, max-age=3600');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/procedure.e2e.spec.ts`
Expected: FAIL — 404 (라우트 없음)

- [ ] **Step 3: 리포지토리 구현**

`backend/src/procedure/procedure.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';

/** 계약 `Procedure` 스키마. 프론트 `types/domain.ts` 의 `Procedure` 와 같은 모양이다. */
export interface ProcedureResponse {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  description: string;
}

/**
 * 시술 마스터 13종.
 *
 * **정렬을 DB 컬럼에 의존하지 않는다.** 계약이 순서를 고정했고(`implant` → … → `botox`),
 * 그 순서는 이름순도 id순도 아닌 편집상의 순서다. 시드가 넣은 `sortOrder` 를 쓴다.
 */
@Injectable()
export class ProcedureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ProcedureResponse[]> {
    return this.prisma.procedure.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, emoji: true, shortDescription: true, description: true },
    });
  }
}
```

> `Procedure.sortOrder` 는 이미 있다 (`schema.prisma` 42행, `@@index([sortOrder])` 포함).
> 시드가 `procedures.entries()` 의 인덱스를 넣는다. 마이그레이션이 필요 없다.

- [ ] **Step 4: 컨트롤러 구현**

`backend/src/procedure/procedure.controller.ts`:

```ts
import { Controller, Get, Header } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProcedureRepository } from './procedure.repository';
import type { ProcedureResponse } from './procedure.repository';

/**
 * `GET /api/v1/procedures` — 시술 마스터 13종.
 *
 * 인증이 없다. 홈·탐색·커뮤니티 작성·상담 신청이 모두 이 하나의 목록을 쓴다.
 * 거의 변하지 않으므로 캐시 헤더를 붙인다 (계약 `listProcedures`).
 */
@Controller('procedures')
export class ProcedureController {
  constructor(private readonly procedures: ProcedureRepository) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  findAll(): Promise<ProcedureResponse[]> {
    return this.procedures.findAll();
  }
}
```

`backend/src/procedure/procedure.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { ProcedureController } from './procedure.controller';
import { ProcedureRepository } from './procedure.repository';

@Module({
  controllers: [ProcedureController],
  providers: [ProcedureRepository],
  exports: [ProcedureRepository],
})
export class ProcedureModule {}
```

- [ ] **Step 5: 루트 모듈에 등록**

`backend/src/app.module.ts` 의 `imports` 에 `ProcedureModule` 을 더하고, 주석의 "도메인 모듈은 아직 없다" 문장을 현재 상태로 고친다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/procedure.e2e.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/src/procedure backend/src/app.module.ts backend/test/procedure.e2e.spec.ts backend/prisma
git commit -m "feat(backend): add the procedures endpoint

도메인 모듈의 첫 사례. 정렬을 계약이 고정한 순서로 두고 DB 컬럼에 의존하지
않는다 — 이름순도 id순도 아닌 편집상의 순서다."
```

---

## Task 2: 병원 투영 — DB 정규화 구조 → 계약 응답

병원 응답을 만드는 순수 함수. 15개 중 8개 엔드포인트가 이것을 공유하므로 먼저 고정한다.

**Files:**
- Create: `backend/src/hospital/hospital.projection.ts`
- Test: `backend/test/hospital-projection.spec.ts`

**Interfaces:**
- Produces:
  - `type HospitalRow` — Prisma `include` 결과 형태
  - `projectHospital(row: HospitalRow, options: { today: string; distanceKm?: number }): HospitalResponse`
  - `HOSPITAL_INCLUDE` — 리포지토리가 쓰는 Prisma `include` 상수

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/hospital-projection.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { projectHospital } from '../src/hospital/hospital.projection';
import type { HospitalRow } from '../src/hospital/hospital.projection';

/** 최소 행. 각 테스트가 필요한 부분만 덮어쓴다. */
function row(overrides: Partial<HospitalRow> = {}): HospitalRow {
  return {
    id: 'h1',
    name: '강남 스마일 치과',
    nameNormalized: '강남 스마일 치과',
    specialty: '임플란트 전문의원',
    region: '서울 강남구',
    address: '서울 강남구 테헤란로 1',
    latitude: 37.5,
    longitude: 127.03,
    thumbnail: 'https://example.test/thumb.jpg',
    introduction: '소개',
    directions: '2번 출구',
    priceMin: 500000,
    priceMax: 1500000,
    rating: 4.8,
    reviewCount: 312,
    consultCount: 90,
    consultAvailable: true,
    isOneDay: true,
    isRecommended: false,
    featureCoordinator: true,
    featurePainlessAnesthesia: false,
    featureDigitalCare: true,
    featureParking: true,
    featureNightConsult: false,
    featureCctv: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    procedures: [{ procedureId: 'implant' }, { procedureId: 'crown' }],
    images: [{ url: 'https://example.test/1.jpg', sortOrder: 0 }],
    tags: [{ tag: '야간진료', sortOrder: 0 }],
    eventNotes: [{ content: '첫 상담 무료', sortOrder: 0 }],
    businessHours: [{ dayOfWeek: 1, hours: '10:00 - 19:00', isClosed: false }],
    sponsorships: [],
    doctors: [],
    ...overrides,
  } as HospitalRow;
}

describe('projectHospital', () => {
  const today = '2026-08-13';

  it('두 컬럼을 priceRange 객체로 되돌린다', () => {
    expect(projectHospital(row(), { today }).priceRange).toEqual({ min: 500000, max: 1500000 });
  });

  it('feature 컬럼 6개를 features 객체로 되돌린다', () => {
    expect(projectHospital(row(), { today }).features).toEqual({
      coordinator: true,
      painlessAnesthesia: false,
      digitalCare: true,
      parking: true,
      nightConsult: false,
      cctv: true,
    });
  });

  it('조인 테이블을 배열 필드로 되돌린다', () => {
    const result = projectHospital(row(), { today });

    expect(result.procedureIds).toEqual(['implant', 'crown']);
    expect(result.images).toEqual(['https://example.test/1.jpg']);
    expect(result.tags).toEqual(['야간진료']);
    expect(result.events).toEqual(['첫 상담 무료']);
    expect(result.businessHours).toEqual([{ day: '월', hours: '10:00 - 19:00', isClosed: false }]);
  });

  it('dayOfWeek 정수를 요일 라벨로 바꾼다 (1=월 … 7=일)', () => {
    const result = projectHospital(
      row({
        businessHours: [
          { dayOfWeek: 6, hours: '10:00 - 14:00', isClosed: false },
          { dayOfWeek: 7, hours: '휴무', isClosed: true },
        ],
      }),
      { today }
    );

    expect(result.businessHours.map((item) => item.day)).toEqual(['토', '일']);
  });

  it('광고가 없으면 isSponsored 는 false 이고 기간 필드는 null 이다', () => {
    const result = projectHospital(row(), { today });

    expect(result.isSponsored).toBe(false);
    expect(result.sponsoredCategories).toEqual([]);
    expect(result.sponsoredRank).toBeNull();
    expect(result.sponsoredStartDate).toBeNull();
    expect(result.sponsoredEndDate).toBeNull();
    expect(result.sponsorship).toEqual({ isActive: false, isPlacementEligible: false });
  });

  it('광고 행을 카테고리 배열과 기간으로 합친다', () => {
    const result = projectHospital(
      row({
        sponsorships: [
          { procedureId: 'implant', rank: 1, startDate: '2026-07-01', endDate: '2026-09-30' },
          { procedureId: 'crown', rank: 1, startDate: '2026-07-01', endDate: '2026-09-30' },
        ],
      }),
      { today }
    );

    expect(result.isSponsored).toBe(true);
    expect(result.sponsoredCategories).toEqual(['implant', 'crown']);
    expect(result.sponsoredRank).toBe(1);
    expect(result.sponsoredStartDate).toBe('2026-07-01');
    expect(result.sponsoredEndDate).toBe('2026-09-30');
  });

  it('distanceKm 는 인자로 받은 값을 그대로 싣고, 없으면 필드가 없다', () => {
    expect(projectHospital(row(), { today, distanceKm: 1.234 }).distanceKm).toBe(1.234);
    expect(projectHospital(row(), { today }).distanceKm).toBeUndefined();
  });

  it('배지 자격이 있는 첫 전문의의 전공을 representativeSpecialty 로 준다', () => {
    const result = projectHospital(
      row({
        doctors: [
          // 미승인 — 대표가 될 수 없다
          { specialty: '치과교정전문의', verifiedSpecialty: null, verificationStatus: 'pending' },
          { specialty: '치과보철전문의', verifiedSpecialty: '치과보철전문의', verificationStatus: 'approved' },
        ],
      }),
      { today }
    );

    expect(result.representativeSpecialty).toBe('치과보철전문의');
  });

  it('일반의만 있으면 representativeSpecialty 는 null 이다', () => {
    const result = projectHospital(
      row({ doctors: [{ specialty: '일반의', verifiedSpecialty: null, verificationStatus: 'approved' }] }),
      { today }
    );

    expect(result.representativeSpecialty).toBeNull();
  });

  it('승인 후 전공이 바뀐 전문의는 대표가 되지 않는다', () => {
    const result = projectHospital(
      row({
        doctors: [
          { specialty: '치과교정전문의', verifiedSpecialty: '치과보철전문의', verificationStatus: 'approved' },
        ],
      }),
      { today }
    );

    expect(result.representativeSpecialty).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/hospital-projection.spec.ts`
Expected: FAIL — `Cannot find module '../src/hospital/hospital.projection'`

- [ ] **Step 3: 투영 구현**

`backend/src/hospital/hospital.projection.ts`:

```ts
import { computeSponsorship } from './sponsorship';
import type { SponsorshipState } from './sponsorship';

/**
 * 이 투영이 읽는 Prisma 행의 모양. `HOSPITAL_INCLUDE` 로 조회한 결과와 같다.
 *
 * Prisma 가 만든 타입을 그대로 쓰지 않고 여기서 다시 선언하는 이유: 투영을
 * 순수 함수로 테스트하려면 DB 없이 행을 만들 수 있어야 한다.
 */
export interface HospitalRow {
  id: string;
  name: string;
  nameNormalized: string;
  specialty: string | null;
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  thumbnail: string;
  introduction: string;
  directions: string;
  priceMin: number;
  priceMax: number;
  rating: number;
  reviewCount: number;
  consultCount: number;
  consultAvailable: boolean;
  isOneDay: boolean;
  isRecommended: boolean;
  featureCoordinator: boolean;
  featurePainlessAnesthesia: boolean;
  featureDigitalCare: boolean;
  featureParking: boolean;
  featureNightConsult: boolean;
  featureCctv: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  procedures: { procedureId: string }[];
  images: { url: string; sortOrder: number }[];
  tags: { tag: string; sortOrder: number }[];
  eventNotes: { content: string; sortOrder: number }[];
  /** `day` 라벨 컬럼은 **없다.** DB 는 `dayOfWeek`(1=월 … 7=일)만 저장하고 라벨은 앱이 만든다. */
  businessHours: { dayOfWeek: number; hours: string; isClosed: boolean }[];
  sponsorships: { procedureId: string; rank: number; startDate: string; endDate: string }[];
  /** `representativeSpecialty` 계산에만 쓴다. 전체 전문의 정보가 아니라 판정에 필요한 3필드다. */
  doctors: { specialty: string; verifiedSpecialty: string | null; verificationStatus: string }[];
}

/** `BusinessHour.dayOfWeek` 는 1=월 … 7=일이다 (스키마 주석). 인덱스는 `dayOfWeek - 1`. */
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** 검수 대상이 아닌 전공. `doctor.projection.ts` 의 상수와 같은 값이다. */
const GENERAL_PRACTITIONER = '일반의';

/**
 * 병원 카드의 `OO전문의 상주` 배지에 쓸 전공.
 *
 * 배지 자격 판정은 `doctor.projection.ts` 의 `isVerifiedSpecialist` 와 **같은 규칙**이다 —
 * `approved` && `일반의` 아님 && `verifiedSpecialty === specialty`. 두 곳의 규칙이 갈리면
 * 카드에는 `치과보철전문의 상주` 가 뜨는데 전문의 목록에는 배지가 없는 상태가 된다.
 */
function representativeSpecialty(
  doctors: HospitalRow['doctors']
): string | null {
  const found = doctors.find(
    (doctor) =>
      doctor.verificationStatus === 'approved' &&
      doctor.specialty !== GENERAL_PRACTITIONER &&
      doctor.verifiedSpecialty === doctor.specialty
  );

  return found?.specialty ?? null;
}

export interface HospitalResponse {
  id: string;
  name: string;
  specialty: string;
  region: string;
  latitude: number;
  longitude: number;
  thumbnail: string;
  images: string[];
  procedureIds: string[];
  priceRange: { min: number; max: number };
  rating: number;
  reviewCount: number;
  consultCount: number;
  consultAvailable: boolean;
  businessHours: { day: string; hours: string; isClosed: boolean }[];
  directions: string;
  features: {
    coordinator: boolean;
    painlessAnesthesia: boolean;
    digitalCare: boolean;
    parking: boolean;
    nightConsult: boolean;
    cctv: boolean;
  };
  isOneDay: boolean;
  isRecommended: boolean;
  isSponsored: boolean;
  sponsoredCategories: string[];
  sponsoredRank: number | null;
  sponsoredStartDate: string | null;
  sponsoredEndDate: string | null;
  tags: string[];
  address: string;
  introduction: string;
  events: string[];
  sponsorship: SponsorshipState;
  /** 병원 카드의 `OO전문의 상주` 배지. 없으면 null. */
  representativeSpecialty: string | null;
  distanceKm?: number;
}

/** 리포지토리가 쓰는 Prisma include. 투영이 요구하는 관계를 한 곳에 모은다. */
export const HOSPITAL_INCLUDE = {
  procedures: { select: { procedureId: true } },
  images: { select: { url: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
  tags: { select: { tag: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
  eventNotes: { select: { content: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
  businessHours: {
    select: { dayOfWeek: true, day: true, hours: true, isClosed: true },
    orderBy: { dayOfWeek: 'asc' },
  },
  sponsorships: { select: { procedureId: true, rank: true, startDate: true, endDate: true } },
  // `representativeSpecialty` 계산용. 삭제된 전문의는 대표가 될 수 없다.
  doctors: {
    where: { deletedAt: null },
    select: { specialty: true, verifiedSpecialty: true, verificationStatus: true },
    orderBy: { id: 'asc' },
  },
} as const;

export interface ProjectHospitalOptions {
  /** `Asia/Seoul` 기준 오늘 (`YYYY-MM-DD`). 광고 기간 판정에 쓴다. */
  today: string;
  /** 지도 반경 조회에서만 채운다. */
  distanceKm?: number;
}

/**
 * DB 행 → 계약 `Hospital`.
 *
 * 광고는 `hospital_sponsorships` 에 **카테고리마다 1행**으로 저장되어 있고, 계약은
 * 그것을 `sponsoredCategories` 배열 + 단일 `sponsoredRank`/기간으로 되돌린다.
 * 한 병원의 광고 행들은 같은 기간·같은 rank 를 공유한다는 전제이며, 시드가 그렇게 넣는다.
 * 여러 행의 값이 갈리면 첫 행을 대표로 쓴다 — 관리 화면에 광고 편집이 없어 갈릴 수 없다.
 *
 * ★ **`isSponsored` 는 원본값이다 — 기간을 반영하지 않는다.**
 *   스키마 주석(`HospitalSponsorship`)은 "오늘이 [startDate, endDate] 안인 행의 존재"로
 *   파생하라고 하고, 계약은 "`sponsoredRank`/`sponsoredStartDate`/`sponsoredEndDate` **원본
 *   필드도 함께 유지한다** (기존 `Hospital` 타입 보존)"고 한다. 두 문서가 갈린다.
 *
 *   **원본 유지를 택한다.** 기간을 반영하면 `isSponsored` 와 `sponsorship.isActive` 가 같은
 *   값이 되어 계산 필드를 따로 둔 의미가 사라지고, 관리자 화면의 `광고 현황 (읽기 전용)`
 *   카드가 "계약은 되어 있으나 기간이 지난" 상태를 표시할 수 없게 된다.
 *   기간 판정이 필요한 곳은 전부 `sponsorship.isActive` 를 쓴다 — 배지도 정렬도 그렇다.
 */
export function projectHospital(row: HospitalRow, options: ProjectHospitalOptions): HospitalResponse {
  const sponsoredCategories = row.sponsorships.map((item) => item.procedureId);
  const lead = row.sponsorships[0] ?? null;
  const isSponsored = row.sponsorships.length > 0;

  const response: HospitalResponse = {
    id: row.id,
    name: row.name,
    // 계약은 `specialty` 를 필수 문자열로 둔다. DB 는 nullable 이므로 빈 문자열로 메운다.
    specialty: row.specialty ?? '',
    region: row.region,
    latitude: row.latitude,
    longitude: row.longitude,
    thumbnail: row.thumbnail,
    images: row.images.map((item) => item.url),
    procedureIds: row.procedures.map((item) => item.procedureId),
    priceRange: { min: row.priceMin, max: row.priceMax },
    rating: row.rating,
    reviewCount: row.reviewCount,
    consultCount: row.consultCount,
    consultAvailable: row.consultAvailable,
    businessHours: row.businessHours.map((item) => ({
      day: DAY_LABELS[item.dayOfWeek - 1] ?? '',
      hours: item.hours,
      isClosed: item.isClosed,
    })),
    directions: row.directions,
    features: {
      coordinator: row.featureCoordinator,
      painlessAnesthesia: row.featurePainlessAnesthesia,
      digitalCare: row.featureDigitalCare,
      parking: row.featureParking,
      nightConsult: row.featureNightConsult,
      cctv: row.featureCctv,
    },
    isOneDay: row.isOneDay,
    isRecommended: row.isRecommended,
    isSponsored,
    sponsoredCategories,
    sponsoredRank: lead?.rank ?? null,
    sponsoredStartDate: lead?.startDate ?? null,
    sponsoredEndDate: lead?.endDate ?? null,
    tags: row.tags.map((item) => item.tag),
    address: row.address,
    introduction: row.introduction,
    events: row.eventNotes.map((item) => item.content),
    representativeSpecialty: representativeSpecialty(row.doctors),
    sponsorship: computeSponsorship(
      { isSponsored, sponsoredCategories, startDate: lead?.startDate ?? null, endDate: lead?.endDate ?? null, rating: row.rating },
      { today }
    ),
  };

  if (options.distanceKm !== undefined) {
    response.distanceKm = options.distanceKm;
  }

  return response;
}
```

> `computeSponsorship` 은 Task 3 에서 만든다. 이 Task 의 테스트를 통과시키려면 Task 3 을
> 먼저 하거나, Task 3 의 구현을 여기서 함께 넣는다. **Task 3 을 먼저 하는 것을 권한다** —
> 순수 함수라 의존이 한 방향이다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/hospital-projection.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && npm run lint && npm run typecheck
git add backend/src/hospital/hospital.projection.ts backend/test/hospital-projection.spec.ts
git commit -m "feat(backend): add the hospital projection

DB 는 정규화돼 있고(priceMin/priceMax 두 컬럼, featureXxx boolean 6개, 조인
테이블 6개) 계약은 프론트의 Hospital 타입을 보존한다. 15개 중 8개 엔드포인트가
이 변환을 공유하므로 순수 함수로 분리해 DB 없이 테스트한다."
```

---

## Task 3: 스폰서 계산 — 프론트 규칙을 서버로

`frontend/src/utils/sponsorship.ts` 의 규칙을 서버로 옮긴다. 클라이언트가 기기 시계로 광고 기간을 계산하면 시계가 틀린 사용자에게 광고가 잘못 노출된다.

**Files:**
- Create: `backend/src/hospital/sponsorship.ts`
- Test: `backend/test/sponsorship.spec.ts`

**Interfaces:**
- Produces:
  - `MIN_SPONSORED_RATING = 3.5`
  - `SponsorshipState = { isActive: boolean; isPlacementEligible: boolean }`
  - `computeSponsorship(input: SponsorshipInput, options: { today: string; procedureId?: string }): SponsorshipState`
  - `seoulToday(now?: Date): string` — `Asia/Seoul` 기준 `YYYY-MM-DD`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/sponsorship.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { computeSponsorship, seoulToday } from '../src/hospital/sponsorship';
import type { SponsorshipInput } from '../src/hospital/sponsorship';

function input(overrides: Partial<SponsorshipInput> = {}): SponsorshipInput {
  return {
    isSponsored: true,
    sponsoredCategories: ['implant'],
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    rating: 4.5,
    ...overrides,
  };
}

describe('computeSponsorship', () => {
  it('기간 안이면 isActive 다', () => {
    expect(computeSponsorship(input(), { today: '2026-08-13' }).isActive).toBe(true);
  });

  it('시작일·종료일 당일도 포함이다', () => {
    expect(computeSponsorship(input(), { today: '2026-07-01' }).isActive).toBe(true);
    expect(computeSponsorship(input(), { today: '2026-09-30' }).isActive).toBe(true);
  });

  it('기간 밖이면 isActive 가 아니다', () => {
    expect(computeSponsorship(input(), { today: '2026-06-30' }).isActive).toBe(false);
    expect(computeSponsorship(input(), { today: '2026-10-01' }).isActive).toBe(false);
  });

  it('광고 계약이 없으면 기간과 무관하게 false 다', () => {
    const result = computeSponsorship(
      input({ isSponsored: false, startDate: null, endDate: null }),
      { today: '2026-08-13' }
    );

    expect(result).toEqual({ isActive: false, isPlacementEligible: false });
  });

  it('평점 3.5 미만은 상단 노출 자격이 없다 — 배지는 유지된다', () => {
    const result = computeSponsorship(input({ rating: 3.4 }), {
      today: '2026-08-13',
      procedureId: 'implant',
    });

    expect(result.isActive).toBe(true);
    expect(result.isPlacementEligible).toBe(false);
  });

  it('평점 3.5 정확히는 자격이 있다 (경계 포함)', () => {
    const result = computeSponsorship(input({ rating: 3.5 }), {
      today: '2026-08-13',
      procedureId: 'implant',
    });

    expect(result.isPlacementEligible).toBe(true);
  });

  it('지정한 시술이 광고 카테고리에 없으면 자격이 없다', () => {
    const result = computeSponsorship(input(), { today: '2026-08-13', procedureId: 'orthodontics' });

    expect(result.isPlacementEligible).toBe(false);
  });

  it('procedureId 를 지정하지 않으면(추천 탭) 카테고리를 보지 않는다', () => {
    const result = computeSponsorship(input(), { today: '2026-08-13' });

    expect(result.isPlacementEligible).toBe(true);
  });
});

describe('seoulToday', () => {
  it('UTC 자정 직후를 서울 기준 같은 날로 본다', () => {
    // 2026-08-13T00:30Z = 서울 09:30 같은 날
    expect(seoulToday(new Date('2026-08-13T00:30:00.000Z'))).toBe('2026-08-13');
  });

  it('UTC 로 전날 늦은 시각이 서울에서는 다음 날이다', () => {
    // 2026-08-12T15:30Z = 서울 2026-08-13 00:30
    expect(seoulToday(new Date('2026-08-12T15:30:00.000Z'))).toBe('2026-08-13');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/sponsorship.spec.ts`
Expected: FAIL — `Cannot find module '../src/hospital/sponsorship'`

- [ ] **Step 3: 구현**

`backend/src/hospital/sponsorship.ts`:

```ts
/**
 * 광고(스폰서) 판정. `frontend/src/utils/sponsorship.ts` 의 규칙을 그대로 옮긴 것이다.
 *
 * **서버가 계산하는 이유:** 클라이언트가 기기 시계로 기간을 판정하면 시계가 틀린 사용자에게
 * 광고가 잘못 노출된다. 계약(`listHospitals`)이 두 값을 각각 내려주라고 명시한다.
 *
 * 순수 함수다 — `new Date()` 를 부르지 않고 `today` 를 인자로 받는다. 기간 경계를
 * 테스트할 수 있어야 하기 때문이다.
 */

/** 이 평점 미만이면 계약·기간이 유효해도 상단 노출에서 제외한다. */
export const MIN_SPONSORED_RATING = 3.5;

export interface SponsorshipInput {
  isSponsored: boolean;
  sponsoredCategories: string[];
  /** 'YYYY-MM-DD' (KST 달력일, 포함). 광고가 없으면 null. */
  startDate: string | null;
  endDate: string | null;
  rating: number;
}

export interface SponsorshipState {
  /** 광고 기간 중인가. `광고` 배지의 조건. */
  isActive: boolean;
  /** 상단 노출 자격이 있는가. 기간 + 평점 + (지정 시) 카테고리. */
  isPlacementEligible: boolean;
}

export interface ComputeSponsorshipOptions {
  /** `Asia/Seoul` 기준 오늘 (`YYYY-MM-DD`). */
  today: string;
  /**
   * 시술 칩으로 좁힌 경우의 시술 id. `추천` 탭이나 필터 없음이면 넘기지 않는다.
   * 넘기지 않으면 카테고리 일치 검사를 하지 않는다 (계약 규칙 2).
   */
  procedureId?: string;
}

export function computeSponsorship(
  input: SponsorshipInput,
  options: ComputeSponsorshipOptions
): SponsorshipState {
  const isActive =
    input.isSponsored &&
    input.startDate !== null &&
    input.endDate !== null &&
    options.today >= input.startDate &&
    options.today <= input.endDate;

  if (!isActive) {
    return { isActive: false, isPlacementEligible: false };
  }

  const ratingOk = input.rating >= MIN_SPONSORED_RATING;
  const categoryOk =
    options.procedureId === undefined || input.sponsoredCategories.includes(options.procedureId);

  return { isActive: true, isPlacementEligible: ratingOk && categoryOk };
}

/**
 * `Asia/Seoul` 기준 오늘 (`YYYY-MM-DD`).
 *
 * 광고·프로모션 기간은 KST 달력일이다 (docs/database/README.md §3.7). 서버가 UTC 로
 * 돌더라도 "오늘"의 경계는 한국 자정이어야 하며, 그렇지 않으면 광고가 9시간 일찍 끝난다.
 *
 * `Intl` 로 계산한다 — 오프셋을 직접 더하면 서버 로컬 타임존에 오염된다.
 */
export function seoulToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
```

> `en-CA` 로케일은 `YYYY-MM-DD` 형식을 준다. `sv-SE` 도 같지만 `en-CA` 가 Node 의 기본
> ICU 빌드에서 더 안전하다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/sponsorship.spec.ts test/hospital-projection.spec.ts`
Expected: PASS (10 + 10 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && npm run lint && npm run typecheck
git add backend/src/hospital/sponsorship.ts backend/test/sponsorship.spec.ts
git commit -m "feat(backend): move the sponsorship rules to the server

클라이언트가 기기 시계로 광고 기간을 판정하면 시계가 틀린 사용자에게 광고가
잘못 노출된다. 배지 조건(기간만)과 상단 노출 조건(기간+평점 3.5+카테고리)이
다르므로 두 값을 각각 내려준다.

'오늘' 은 Asia/Seoul 달력일이다. 오프셋을 직접 더하지 않고 Intl 로 계산한다 —
더하는 방식은 서버 로컬 타임존에 오염된다."
```

---

## Task 4: 거리 계산 — bounding box + 하버사인

지도 반경 필터. `$queryRaw` 도 PostGIS 도 쓰지 않고 앱에서 계산한다 (`docs/database/README.md` §3.8 이 이전 이후로 못 박았다).

**Files:**
- Create: `backend/src/hospital/distance.ts`
- Test: `backend/test/distance.spec.ts`

**Interfaces:**
- Produces:
  - `haversineKm(a: Coordinate, b: Coordinate): number`
  - `boundingBox(center: Coordinate, radiusKm: number): { minLat, maxLat, minLon, maxLon }`
  - `Coordinate = { latitude: number; longitude: number }`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/distance.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { boundingBox, haversineKm } from '../src/hospital/distance';

const GANGNAM = { latitude: 37.4979, longitude: 127.0276 };
const SEOUL_STATION = { latitude: 37.5547, longitude: 126.9707 };

describe('haversineKm', () => {
  it('같은 좌표는 0 이다', () => {
    expect(haversineKm(GANGNAM, GANGNAM)).toBe(0);
  });

  it('강남역 ↔ 서울역은 약 8.2km 다', () => {
    expect(haversineKm(GANGNAM, SEOUL_STATION)).toBeCloseTo(8.2, 0);
  });

  it('대칭이다', () => {
    expect(haversineKm(GANGNAM, SEOUL_STATION)).toBeCloseTo(haversineKm(SEOUL_STATION, GANGNAM), 6);
  });
});

describe('boundingBox', () => {
  it('반경 안의 점을 반드시 포함한다 (상위집합이어야 한다)', () => {
    const box = boundingBox(GANGNAM, 10);

    expect(SEOUL_STATION.latitude).toBeGreaterThanOrEqual(box.minLat);
    expect(SEOUL_STATION.latitude).toBeLessThanOrEqual(box.maxLat);
    expect(SEOUL_STATION.longitude).toBeGreaterThanOrEqual(box.minLon);
    expect(SEOUL_STATION.longitude).toBeLessThanOrEqual(box.maxLon);
  });

  it('반경이 커지면 상자도 커진다', () => {
    const small = boundingBox(GANGNAM, 0.5);
    const large = boundingBox(GANGNAM, 5);

    expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat);
  });

  it('중심을 포함한다', () => {
    const box = boundingBox(GANGNAM, 0.5);

    expect(GANGNAM.latitude).toBeGreaterThanOrEqual(box.minLat);
    expect(GANGNAM.latitude).toBeLessThanOrEqual(box.maxLat);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/distance.spec.ts`
Expected: FAIL — `Cannot find module '../src/hospital/distance'`

- [ ] **Step 3: 구현**

`backend/src/hospital/distance.ts`:

```ts
/**
 * 지도 반경 필터의 거리 계산.
 *
 * **DB 함수를 쓰지 않는다.** SQLite 에는 PostGIS 대응물이 없고, `$queryRaw` 는 이식성
 * 규칙이 금지한다 (docs/database/README.md §3.8). 같은 문서가 "병원이 수천 곳이 되기
 * 전까지는 앱 계산을 유지하고 PostGIS 는 PostgreSQL 이전 이후에 도입한다" 고 못 박았다.
 * 현재 병원은 11곳이다.
 *
 * 순서: `boundingBox` 로 SQL 에서 후보를 좁히고(단순 부등호라 인덱스를 탄다),
 * 좁혀진 후보에만 `haversineKm` 을 적용한다.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 두 좌표 사이의 대권 거리(km). */
export function haversineKm(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * 반경을 감싸는 위경도 사각형. **반드시 상위집합이어야 한다** — 상자가 반경보다 작으면
 * 실제로 반경 안에 있는 병원이 SQL 단계에서 탈락해 영원히 보이지 않는다.
 *
 * 경도 1도의 거리는 위도에 따라 줄어들므로 `cos(latitude)` 로 나눈다. 극지방에서
 * `cos` 가 0에 가까워지는 것은 하한을 두어 막는다 (한국 위도에서는 발생하지 않지만,
 * 0으로 나누면 상자가 무한대가 되어 필터가 사라진다).
 */
export function boundingBox(center: Coordinate, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.max(0.01, Math.cos(toRadians(center.latitude)));
  const lonDelta = radiusKm / (111.32 * cosLat);

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLon: center.longitude - lonDelta,
    maxLon: center.longitude + lonDelta,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/distance.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && npm run lint && npm run typecheck
git add backend/src/hospital/distance.ts backend/test/distance.spec.ts
git commit -m "feat(backend): add haversine distance and bounding box helpers

SQLite 에 PostGIS 대응물이 없고 raw SQL 은 이식성 규칙이 금지한다. bounding box
로 SQL 에서 후보를 좁히고(단순 부등호라 인덱스를 탄다) 좁혀진 후보에만 하버사인을
적용한다. 상자는 반드시 반경의 상위집합이어야 한다 — 작으면 반경 안의 병원이
SQL 단계에서 탈락해 영원히 보이지 않는다."
```

---

## Task 5: 페이지네이션 헬퍼

`PageMeta` 는 목록 엔드포인트 5개(`/hospitals`, `/doctors`, `/admin/hospitals`, `/hospitals/{id}/reviews`, `/doctors/verification-queue`)가 공유한다.

**Files:**
- Create: `backend/src/common/pagination.ts`
- Test: `backend/test/pagination.spec.ts`

**Interfaces:**
- Produces:
  - `PageMeta = { page: number; pageSize: number; totalItems: number; totalPages: number }`
  - `buildPageMeta(params: { page: number; pageSize: number; totalItems: number }): PageMeta`
  - `paginate<T>(items: T[], params: { page: number; pageSize: number }): T[]`
  - `DEFAULT_PAGE_SIZE = 20`, `MAX_PAGE_SIZE = 100`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/pagination.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildPageMeta, paginate } from '../src/common/pagination';

describe('buildPageMeta', () => {
  it('나머지가 있으면 페이지 수를 올림한다', () => {
    expect(buildPageMeta({ page: 1, pageSize: 20, totalItems: 41 }).totalPages).toBe(3);
  });

  it('0건이면 totalPages 는 0 이다', () => {
    expect(buildPageMeta({ page: 1, pageSize: 20, totalItems: 0 })).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it('딱 나누어떨어지면 올림하지 않는다', () => {
    expect(buildPageMeta({ page: 1, pageSize: 20, totalItems: 40 }).totalPages).toBe(2);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, index) => index);

  it('1페이지는 앞에서 pageSize 만큼이다', () => {
    expect(paginate(items, { page: 1, pageSize: 10 })).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('마지막 페이지는 남은 만큼만 준다', () => {
    expect(paginate(items, { page: 3, pageSize: 10 })).toEqual([20, 21, 22, 23, 24]);
  });

  it('범위를 넘은 페이지는 빈 배열이다', () => {
    expect(paginate(items, { page: 9, pageSize: 10 })).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/pagination.spec.ts`
Expected: FAIL — `Cannot find module '../src/common/pagination'`

- [ ] **Step 3: 구현**

`backend/src/common/pagination.ts`:

```ts
/**
 * offset 페이지네이션. 계약이 cursor 가 아니라 offset 을 쓰는 이유는 화면이
 * `총 11곳` 처럼 전체 건수를 표시하기 때문이다 (openapi 공통 규약).
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface PageMeta extends PageParams {
  totalItems: number;
  totalPages: number;
}

export function buildPageMeta(params: PageParams & { totalItems: number }): PageMeta {
  return {
    page: params.page,
    pageSize: params.pageSize,
    totalItems: params.totalItems,
    // 0건일 때 1이 아니라 0이다 — 화면이 "1 / 0 페이지" 를 그리지 않게 한다.
    totalPages: Math.ceil(params.totalItems / params.pageSize),
  };
}

/**
 * 메모리 배열 페이징. **반경 필터가 걸린 병원 목록에서만 쓴다** — 거리 계산이 앱에서
 * 일어나 SQL 의 `LIMIT/OFFSET` 을 쓸 수 없기 때문이다 (Task 6 참고).
 * 반경이 없는 경로는 Prisma 의 `skip`/`take` 를 쓴다.
 */
export function paginate<T>(items: T[], params: PageParams): T[] {
  const start = (params.page - 1) * params.pageSize;

  return items.slice(start, start + params.pageSize);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/pagination.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && npm run lint && npm run typecheck
git add backend/src/common/pagination.ts backend/test/pagination.spec.ts
git commit -m "feat(backend): add offset pagination helpers

계약이 cursor 가 아니라 offset 을 쓰는 이유는 화면이 '총 11곳' 처럼 전체 건수를
표시하기 때문이다. 0건일 때 totalPages 는 1 이 아니라 0 이다."
```

---

## Task 6: `GET /hospitals` — 필터·정렬·스폰서 우선 노출

탐색 화면의 시술 칩 15 · 정렬 3 · 조건 칩 5 · 지도 반경 4가 이 엔드포인트 하나에 들어온다.

### 정렬과 페이지네이션에 대한 판단 (구현 전에 읽을 것)

**스폰서 우선 노출은 전역 재정렬이라 SQL 페이징과 함께 쓸 수 없다.** `skip`/`take` 로 20건을 받아온 뒤 그 20건 안에서만 광고를 앞으로 당기면, 광고 병원이 2페이지에 있을 때 1페이지 상단에 오지 못한다. 계약은 "서버가 계산해서 **이미 정렬된 배열**로 내려준다" 고 요구한다.

또 광고 자격(`isPlacementEligible`)은 오늘 날짜·평점·카테고리의 조합이고, 기간은 `hospital_sponsorships` 의 문자열 날짜다. 이것을 SQL `ORDER BY` 로 표현하려면 raw SQL 이 필요한데 이식성 규칙이 금지한다.

**따라서 이 엔드포인트는 필터에 맞는 행을 전부 읽고 앱에서 정렬·페이징한다.** 반경 필터 유무와 무관하게 같은 경로를 쓴다 — 분기를 두면 두 경로 중 하나에만 버그가 생긴다.

이것이 허용되는 근거와 한계:

- 병원은 현재 11곳이고, 이 서비스의 병원 수는 수천 단위로 늘어나는 종류가 아니다
- 한계는 코드 주석과 이 계획에 남긴다. 수천 곳이 되는 시점은 이미 PostgreSQL 로 옮겨간 뒤이고, 그때 광고 자격을 실 컬럼으로 비정규화하거나 PostGIS 를 도입한다 (`docs/database/README.md` §3.8 · §7.6)
- `GET /doctors` 에는 스폰서 정렬이 없으므로(광고는 병원 단위 상품) Prisma `skip`/`take` 를 쓴다. 이 차이는 의도적이다

**Files:**
- Create: `backend/src/hospital/hospital.schemas.ts`
- Create: `backend/src/hospital/hospital.filters.ts`
- Create: `backend/src/hospital/hospital.repository.ts`
- Create: `backend/src/hospital/hospital.service.ts`
- Create: `backend/src/hospital/hospital.controller.ts`
- Create: `backend/src/hospital/hospital.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/hospital-filters.spec.ts`, `backend/test/hospital-list.e2e.spec.ts`

**Interfaces:**
- Consumes: `projectHospital`, `HOSPITAL_INCLUDE` (Task 2), `computeSponsorship`, `seoulToday` (Task 3), `boundingBox`, `haversineKm` (Task 4), `buildPageMeta`, `paginate` (Task 5)
- Produces:
  - `listHospitalsQuerySchema` (zod) → `ListHospitalsQuery`
  - `HospitalRepository.findMany(where): Promise<HospitalRow[]>`
  - `HospitalService.list(query): Promise<{ items: HospitalResponse[]; meta: PageMeta }>`
  - `orderHospitals(items, options): HospitalResponse[]`

- [ ] **Step 1: 정렬 함수의 실패하는 테스트 작성**

`backend/test/hospital-filters.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { orderHospitals } from '../src/hospital/hospital.filters';
import type { HospitalResponse } from '../src/hospital/hospital.projection';

function hospital(overrides: Partial<HospitalResponse>): HospitalResponse {
  return {
    id: 'h1',
    rating: 4,
    reviewCount: 10,
    consultCount: 5,
    sponsoredRank: null,
    sponsorship: { isActive: false, isPlacementEligible: false },
    ...overrides,
  } as HospitalResponse;
}

describe('orderHospitals', () => {
  it('기본은 평점 내림차순이다', () => {
    const result = orderHospitals(
      [hospital({ id: 'a', rating: 4.1 }), hospital({ id: 'b', rating: 4.9 })],
      { sort: 'rating', sponsoredFirst: false }
    );

    expect(result.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('동점이면 id 오름차순으로 안정 정렬한다', () => {
    const result = orderHospitals(
      [hospital({ id: 'h3', rating: 4.5 }), hospital({ id: 'h1', rating: 4.5 }), hospital({ id: 'h2', rating: 4.5 })],
      { sort: 'rating', sponsoredFirst: false }
    );

    expect(result.map((item) => item.id)).toEqual(['h1', 'h2', 'h3']);
  });

  it('reviewCount·consultCount 정렬을 지원한다', () => {
    const items = [
      hospital({ id: 'a', reviewCount: 5, consultCount: 90 }),
      hospital({ id: 'b', reviewCount: 50, consultCount: 1 }),
    ];

    expect(orderHospitals(items, { sort: 'reviewCount', sponsoredFirst: false })[0].id).toBe('b');
    expect(orderHospitals(items, { sort: 'consultCount', sponsoredFirst: false })[0].id).toBe('a');
  });

  it('자격 있는 광고를 sponsoredRank 오름차순으로 맨 앞에 놓는다', () => {
    const result = orderHospitals(
      [
        hospital({ id: 'plain', rating: 5.0 }),
        hospital({
          id: 'ad2',
          rating: 3.6,
          sponsoredRank: 2,
          sponsorship: { isActive: true, isPlacementEligible: true },
        }),
        hospital({
          id: 'ad1',
          rating: 3.6,
          sponsoredRank: 1,
          sponsorship: { isActive: true, isPlacementEligible: true },
        }),
      ],
      { sort: 'rating', sponsoredFirst: true }
    );

    expect(result.map((item) => item.id)).toEqual(['ad1', 'ad2', 'plain']);
  });

  it('자격이 없는 광고는 당겨지지 않는다', () => {
    const result = orderHospitals(
      [
        hospital({ id: 'plain', rating: 5.0 }),
        hospital({
          id: 'ad',
          rating: 3.4,
          sponsoredRank: 1,
          sponsorship: { isActive: true, isPlacementEligible: false },
        }),
      ],
      { sort: 'rating', sponsoredFirst: true }
    );

    expect(result.map((item) => item.id)).toEqual(['plain', 'ad']);
  });

  it('필터가 없으면(sponsoredFirst=false) 광고를 당기지 않는다 — 계약 규칙 4', () => {
    const result = orderHospitals(
      [
        hospital({ id: 'plain', rating: 5.0 }),
        hospital({
          id: 'ad',
          rating: 4.9,
          sponsoredRank: 1,
          sponsorship: { isActive: true, isPlacementEligible: true },
        }),
      ],
      { sort: 'rating', sponsoredFirst: false }
    );

    expect(result.map((item) => item.id)).toEqual(['plain', 'ad']);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/hospital-filters.spec.ts`
Expected: FAIL — `Cannot find module '../src/hospital/hospital.filters'`

- [ ] **Step 3: 쿼리 스키마 구현**

`backend/src/hospital/hospital.schemas.ts`:

```ts
import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/pagination';

/**
 * 쿼리 문자열은 전부 문자열로 온다. `z.coerce` 로 변환하되 **boolean 은 coerce 를
 * 쓰지 않는다** — `z.coerce.boolean()` 은 `'false'` 를 `true` 로 만든다(빈 문자열이
 * 아닌 모든 문자열이 truthy). 명시적으로 `'true'` 만 참으로 본다.
 */
const booleanParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const SORT_FIELDS = ['rating', 'reviewCount', 'consultCount'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const listHospitalsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    procedureId: z.string().min(1).optional(),
    recommended: booleanParam,
    consultAvailable: booleanParam,
    oneDay: booleanParam,
    hasVerifiedSpecialist: booleanParam,
    nightConsult: booleanParam,
    minDoctorYearsOfExperience: z.coerce.number().int().min(0).optional(),
    sort: z.enum(SORT_FIELDS).default('rating'),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().optional(),
    q: z.string().max(100).optional(),
  })
  .refine(
    (value) =>
      // 세 값은 함께 와야 한다. 하나만 오면 조용히 무시하지 않고 422 로 알린다 —
      // 지도 화면이 반경을 보냈는데 필터가 안 걸리면 원인을 찾을 수 없다.
      [value.latitude, value.longitude, value.radiusKm].every((item) => item === undefined) ||
      [value.latitude, value.longitude, value.radiusKm].every((item) => item !== undefined),
    { message: 'latitude·longitude·radiusKm 는 함께 보내야 해요', path: ['radiusKm'] }
  );

export type ListHospitalsQuery = z.infer<typeof listHospitalsQuerySchema>;
```

- [ ] **Step 4: 필터·정렬 구현**

`backend/src/hospital/hospital.filters.ts`:

```ts
import type { Prisma } from '@prisma/client';

import type { HospitalResponse } from './hospital.projection';
import type { ListHospitalsQuery, SortField } from './hospital.schemas';

/**
 * 쿼리 → Prisma `where`.
 *
 * **`q` 는 `nameNormalized` 를 쓴다.** `mode: 'insensitive'` 는 Prisma 에서 PostgreSQL
 * 전용이라 SQLite 에서 동작하지 않는다 (docs/database/README.md §3.9).
 *
 * `hasVerifiedSpecialist` 와 `minDoctorYearsOfExperience` 는 병원↔전문의 조인이라
 * 클라이언트에서 할 수 없다. Prisma 관계 필터(`doctors: { some }`)로 표현한다 —
 * raw SQL 을 쓰지 않는다.
 *
 * 좌표 조건(`bounds`)은 호출부가 bounding box 를 계산해 넘긴다. 단순 부등호라
 * `latitude`/`longitude` 인덱스를 탈 수 있다.
 */
export function buildHospitalWhere(
  query: ListHospitalsQuery,
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Prisma.HospitalWhereInput {
  const where: Prisma.HospitalWhereInput = { deletedAt: null };

  if (query.procedureId !== undefined) {
    where.procedures = { some: { procedureId: query.procedureId } };
  }

  if (query.recommended !== undefined) where.isRecommended = query.recommended;
  if (query.consultAvailable !== undefined) where.consultAvailable = query.consultAvailable;
  if (query.oneDay !== undefined) where.isOneDay = query.oneDay;
  if (query.nightConsult !== undefined) where.featureNightConsult = query.nightConsult;

  if (query.q !== undefined && query.q.trim() !== '') {
    where.nameNormalized = { contains: query.q.trim().toLowerCase() };
  }

  // 전문의 조건 두 개는 같은 `doctors.some` 안에서 AND 로 묶는다. 따로 두면
  // "인증 전문의가 있고, (다른) 10년차가 있다" 가 되어 의미가 달라진다.
  const doctorConditions: Prisma.DoctorWhereInput = { deletedAt: null };
  let hasDoctorCondition = false;

  if (query.hasVerifiedSpecialist === true) {
    doctorConditions.verificationStatus = 'approved';
    doctorConditions.specialty = { not: '일반의' };
    hasDoctorCondition = true;
  }

  if (query.minDoctorYearsOfExperience !== undefined) {
    doctorConditions.yearsOfExperience = { gte: query.minDoctorYearsOfExperience };
    hasDoctorCondition = true;
  }

  if (hasDoctorCondition) {
    where.doctors = { some: doctorConditions };
  }

  if (bounds !== undefined) {
    where.latitude = { gte: bounds.minLat, lte: bounds.maxLat };
    where.longitude = { gte: bounds.minLon, lte: bounds.maxLon };
  }

  return where;
}

export interface OrderHospitalsOptions {
  sort: SortField;
  /**
   * 광고를 맨 앞으로 당길지. 계약 규칙 4 — **필터가 없으면(`기타` 칩) 우선 노출을
   * 적용하지 않는다.** 호출부가 `procedureId` 나 `recommended` 가 있을 때만 켠다.
   */
  sponsoredFirst: boolean;
}

/**
 * 계약이 정한 순서로 정렬한다.
 *
 * 1. 자격 있는 광고를 `sponsoredRank` 오름차순으로 맨 앞
 * 2. 나머지는 `sort` 기준 내림차순
 * 3. 동점은 `id` 오름차순 — DB 마다 반환 순서가 달라 페이지 경계에서 중복·누락이 생긴다
 *
 * 입력을 변형하지 않는다 (`toSorted` 대신 복사 후 `sort` — tsconfig lib 이 ES2022 다).
 */
export function orderHospitals(
  items: HospitalResponse[],
  options: OrderHospitalsOptions
): HospitalResponse[] {
  const promoted = (item: HospitalResponse): boolean =>
    options.sponsoredFirst && item.sponsorship.isPlacementEligible;

  return [...items].sort((a, b) => {
    const aPromoted = promoted(a);
    const bPromoted = promoted(b);

    if (aPromoted !== bPromoted) return aPromoted ? -1 : 1;

    if (aPromoted && bPromoted) {
      const rankDiff = (a.sponsoredRank ?? Number.MAX_SAFE_INTEGER) - (b.sponsoredRank ?? Number.MAX_SAFE_INTEGER);
      if (rankDiff !== 0) return rankDiff;
    }

    const valueDiff = b[options.sort] - a[options.sort];
    if (valueDiff !== 0) return valueDiff;

    return a.id.localeCompare(b.id);
  });
}
```

- [ ] **Step 5: 정렬 테스트 통과 확인**

Run: `cd backend && npx vitest run test/hospital-filters.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: 리포지토리·서비스·컨트롤러 구현**

`backend/src/hospital/hospital.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { HOSPITAL_INCLUDE } from './hospital.projection';
import type { HospitalRow } from './hospital.projection';

@Injectable()
export class HospitalRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 필터에 맞는 병원을 **전부** 읽는다. `skip`/`take` 를 쓰지 않는 이유는
   * 광고 우선 노출이 전역 재정렬이라 페이징 후에 적용할 수 없기 때문이다
   * (계획 Task 6 의 판단 절 참고). 병원 수가 수천이 되면 이 구조를 바꿔야 한다.
   */
  async findMany(where: Prisma.HospitalWhereInput): Promise<HospitalRow[]> {
    return this.prisma.hospital.findMany({
      where,
      include: HOSPITAL_INCLUDE,
      orderBy: { id: 'asc' },
    }) as unknown as Promise<HospitalRow[]>;
  }

  async findById(id: string): Promise<HospitalRow | null> {
    return this.prisma.hospital.findFirst({
      where: { id, deletedAt: null },
      include: HOSPITAL_INCLUDE,
    }) as unknown as Promise<HospitalRow | null>;
  }
}
```

`backend/src/hospital/hospital.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { ApiError } from '../common/errors/api-error';
import { buildPageMeta, paginate } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
import { boundingBox, haversineKm } from './distance';
import { buildHospitalWhere, orderHospitals } from './hospital.filters';
import { projectHospital } from './hospital.projection';
import type { HospitalResponse } from './hospital.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from './hospital.repository';
import type { ListHospitalsQuery } from './hospital.schemas';
import { seoulToday } from './sponsorship';

export interface HospitalListResult {
  items: HospitalResponse[];
  meta: PageMeta;
}

@Injectable()
export class HospitalService {
  constructor(private readonly hospitals: HospitalRepository) {}

  async list(query: ListHospitalsQuery): Promise<HospitalListResult> {
    const today = seoulToday();
    const hasCoordinates = query.latitude !== undefined && query.longitude !== undefined && query.radiusKm !== undefined;

    const bounds = hasCoordinates
      ? boundingBox({ latitude: query.latitude!, longitude: query.longitude! }, query.radiusKm!)
      : undefined;

    const rows = await this.hospitals.findMany(buildHospitalWhere(query, bounds));

    // 광고 자격 판정에 시술 카테고리가 필요하다. `추천` 탭과 필터 없음은 카테고리를 보지 않는다.
    let items = rows.map((row) =>
      projectHospital(row, {
        today,
        distanceKm: hasCoordinates
          ? haversineKm(
              { latitude: query.latitude!, longitude: query.longitude! },
              { latitude: row.latitude, longitude: row.longitude }
            )
          : undefined,
      })
    );

    // bounding box 는 반경의 상위집합이라 모서리 밖이 섞여 있다. 정밀 필터를 여기서 건다.
    if (hasCoordinates) {
      items = items.filter((item) => (item.distanceKm ?? Number.POSITIVE_INFINITY) <= query.radiusKm!);
    }

    // 계약 규칙 4 — 필터가 없으면 광고를 당기지 않는다.
    const sponsoredFirst = query.procedureId !== undefined || query.recommended === true;
    const ordered = orderHospitals(items, { sort: query.sort, sponsoredFirst });

    return {
      items: paginate(ordered, query),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems: ordered.length }),
    };
  }

  async getById(id: string): Promise<HospitalResponse> {
    const row = await this.hospitals.findById(id);

    if (row === null) {
      throw new ApiError('HOSPITAL_NOT_FOUND');
    }

    return projectHospital(row, { today: seoulToday() });
  }
}
```

> 광고 자격이 시술 카테고리에 걸리는 부분은 `projectHospital` 이 `procedureId` 를 모른 채
> 계산한다. `computeSponsorship` 에 `procedureId` 를 넘기려면 투영에 옵션을 더해야 한다 —
> **`ProjectHospitalOptions` 에 `procedureId?: string` 를 추가하고 `computeSponsorship` 에
> 그대로 전달한다.** Task 2 의 투영을 이 Step 에서 함께 고치고, Task 2 테스트에
> "procedureId 를 넘기면 카테고리 불일치 시 isPlacementEligible 이 false" 케이스를 더한다.

`backend/src/hospital/hospital.controller.ts`:

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { HospitalResponse } from './hospital.projection';
import { listHospitalsQuerySchema } from './hospital.schemas';
import type { ListHospitalsQuery } from './hospital.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalService } from './hospital.service';
import type { HospitalListResult } from './hospital.service';

@Controller('hospitals')
export class HospitalController {
  constructor(private readonly hospitals: HospitalService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listHospitalsQuerySchema)) query: ListHospitalsQuery
  ): Promise<HospitalListResult> {
    return this.hospitals.list(query);
  }

  @Get(':hospitalId')
  getById(@Param('hospitalId') hospitalId: string): Promise<HospitalResponse> {
    return this.hospitals.getById(hospitalId);
  }
}
```

`backend/src/hospital/hospital.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { HospitalController } from './hospital.controller';
import { HospitalRepository } from './hospital.repository';
import { HospitalService } from './hospital.service';

@Module({
  controllers: [HospitalController],
  providers: [HospitalService, HospitalRepository],
  exports: [HospitalService, HospitalRepository],
})
export class HospitalModule {}
```

`backend/src/app.module.ts` 의 `imports` 에 `HospitalModule` 을 더한다.

- [ ] **Step 7: e2e 테스트 작성**

`backend/test/hospital-list.e2e.spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './support/app';

describe('GET /api/v1/hospitals', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (query = ''): request.Test =>
    request(app.getHttpServer()).get(`/api/v1/hospitals${query}`);

  it('인증 없이 목록과 총계를 준다', async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.meta.totalItems).toBe(response.body.items.length);
  });

  it('계약이 정한 필드를 담는다', async () => {
    const [first] = (await get()).body.items;

    expect(first.priceRange).toEqual({ min: expect.any(Number), max: expect.any(Number) });
    expect(first.features).toHaveProperty('nightConsult');
    expect(first.sponsorship).toEqual({
      isActive: expect.any(Boolean),
      isPlacementEligible: expect.any(Boolean),
    });
    expect(Array.isArray(first.procedureIds)).toBe(true);
  });

  it('procedureId 로 좁힌다', async () => {
    const response = await get('?procedureId=implant');

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.every((item: { procedureIds: string[] }) => item.procedureIds.includes('implant'))).toBe(true);
  });

  it('consultAvailable=false 는 상담을 받지 않는 병원만 준다', async () => {
    const response = await get('?consultAvailable=false');

    expect(response.body.items.every((item: { consultAvailable: boolean }) => item.consultAvailable === false)).toBe(true);
  });

  it('hasVerifiedSpecialist=true 는 인증 전문의가 있는 병원만 준다', async () => {
    const response = await get('?hasVerifiedSpecialist=true');
    const all = await get();

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.length).toBeLessThan(all.body.items.length);
  });

  it('sort=reviewCount 는 후기 많은 순이다', async () => {
    const counts = (await get('?sort=reviewCount')).body.items.map(
      (item: { reviewCount: number }) => item.reviewCount
    );

    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
  });

  it('페이지 경계에서 중복·누락이 없다', async () => {
    const first = await get('?pageSize=3&page=1');
    const second = await get('?pageSize=3&page=2');

    const ids = [...first.body.items, ...second.body.items].map((item: { id: string }) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('반경 필터는 distanceKm 를 싣고 반경 밖을 제외한다', async () => {
    const response = await get('?latitude=37.4979&longitude=127.0276&radiusKm=3');

    expect(response.status).toBe(200);
    expect(
      response.body.items.every((item: { distanceKm: number }) => item.distanceKm <= 3)
    ).toBe(true);
  });

  it('좌표를 일부만 보내면 422 다', async () => {
    const response = await get('?latitude=37.4979');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('q 는 병원명 부분 일치다', async () => {
    const all = await get();
    const name: string = all.body.items[0].name;
    const response = await get(`?q=${encodeURIComponent(name.slice(0, 2))}`);

    expect(response.body.items.some((item: { id: string }) => item.id === all.body.items[0].id)).toBe(true);
  });
});

describe('GET /api/v1/hospitals/:hospitalId', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('상세를 준다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1');

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('h1');
  });

  it('없는 병원은 404 HOSPITAL_NOT_FOUND 다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    expect(response.body.error.message).toBe('병원 정보를 찾을 수 없어요');
  });
});
```

- [ ] **Step 8: e2e 통과 확인**

Run: `cd backend && npx vitest run test/hospital-list.e2e.spec.ts`
Expected: PASS (12 tests)

- [ ] **Step 9: 게이트 실행 후 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/src/hospital backend/src/app.module.ts backend/test/hospital-filters.spec.ts backend/test/hospital-list.e2e.spec.ts
git commit -m "feat(backend): add hospital list and detail endpoints

탐색 화면의 시술 칩 15 · 정렬 3 · 조건 칩 5 · 지도 반경 4가 이 엔드포인트
하나에 들어온다.

★ 필터에 맞는 행을 전부 읽고 앱에서 정렬·페이징한다. 광고 우선 노출이 전역
재정렬이라 skip/take 로 20건을 받은 뒤 그 안에서만 당기면 광고 병원이 2페이지에
있을 때 1페이지 상단에 오지 못한다. 광고 자격은 오늘 날짜·평점·카테고리의
조합이고 기간은 문자열 날짜라 ORDER BY 로 표현하려면 raw SQL 이 필요한데
이식성 규칙이 금지한다. 병원이 수천 곳이 되면 이 구조를 바꿔야 한다 —
주석과 계획에 한계를 남겼다.

z.coerce.boolean() 을 쓰지 않는다. 'false' 를 true 로 만든다."
```

---

## Task 7: 전문의 투영 — 공개 시야와 관리자 시야

계약이 `Doctor`(공개)와 `DoctorAdminView`(관리자) 두 스키마를 나눠 뒀다. **두 개의 함수로 만들고, 공개 함수가 `certificateUrl`·`rejectionReason` 을 애초에 읽지 않게 한다.** 하나의 함수에 플래그를 두면 언젠가 기본값이 뒤집혀 자격증 URL 이 공개 응답으로 샌다.

`specialty` 와 `rating` 은 계약의 `required` 에 **없다** — 조건부로 빠지는 필드다:

- `specialty` — 승인 전에는 응답에 포함되지 않는다. "검수 대기·반려 상태의 전공 주장이 공개되면 검수의 의미가 없어진다"
- `rating` — 비로그인이면 `null`. 지금은 반투명 막을 덮는 방식이라 응답을 직접 보면 그냥 노출된다

**Files:**
- Create: `backend/src/doctor/doctor.projection.ts`
- Test: `backend/test/doctor-projection.spec.ts`

**Interfaces:**
- Produces:
  - `DOCTOR_INCLUDE`
  - `DoctorRow`
  - `projectDoctorPublic(row, options: { authenticated: boolean }): DoctorPublicResponse`
  - `projectDoctorAdmin(row, options?: { hospitalName?: string }): DoctorAdminResponse`
  - `isVerifiedSpecialist(row): boolean`, `visibleSpecialty(row): string | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/doctor-projection.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { projectDoctorAdmin, projectDoctorPublic } from '../src/doctor/doctor.projection';
import type { DoctorRow } from '../src/doctor/doctor.projection';

function row(overrides: Partial<DoctorRow> = {}): DoctorRow {
  return {
    id: 'd1',
    hospitalId: 'h1',
    name: '김치과',
    nameNormalized: '김치과',
    title: '원장',
    specialty: '치과보철전문의',
    verifiedSpecialty: '치과보철전문의',
    verificationStatus: 'approved',
    certificateUrl: 'https://example.test/cert.pdf',
    rejectionReason: null,
    photo: 'https://example.test/photo.jpg',
    rating: 4.7,
    reviewCount: 180,
    consultCount: 90,
    yearsOfExperience: 15,
    isRecommended: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    procedures: [{ procedureId: 'implant' }],
    careers: [{ content: '서울대 치의학 박사', sortOrder: 0 }],
    ...overrides,
  } as DoctorRow;
}

describe('projectDoctorPublic', () => {
  it('승인된 전공은 specialty 와 visibleSpecialty 를 모두 싣는다', () => {
    const result = projectDoctorPublic(row(), { authenticated: true });

    expect(result.specialty).toBe('치과보철전문의');
    expect(result.visibleSpecialty).toBe('치과보철전문의');
    expect(result.isVerifiedSpecialist).toBe(true);
  });

  it('검수 대기 중이면 specialty 원본을 응답에서 뺀다', () => {
    const result = projectDoctorPublic(row({ verificationStatus: 'pending', verifiedSpecialty: null }), {
      authenticated: true,
    });

    expect(result).not.toHaveProperty('specialty');
    expect(result.visibleSpecialty).toBeNull();
    expect(result.isVerifiedSpecialist).toBe(false);
  });

  it('반려된 전공도 응답에서 뺀다', () => {
    const result = projectDoctorPublic(
      row({ verificationStatus: 'rejected', verifiedSpecialty: null, rejectionReason: '자격증 불명확' }),
      { authenticated: true }
    );

    expect(result).not.toHaveProperty('specialty');
    expect(result.visibleSpecialty).toBeNull();
  });

  it('일반의는 검수 대상이 아니라 항상 표시된다', () => {
    const result = projectDoctorPublic(
      row({ specialty: '일반의', verifiedSpecialty: null, verificationStatus: 'pending' }),
      { authenticated: true }
    );

    expect(result.specialty).toBe('일반의');
    expect(result.visibleSpecialty).toBe('일반의');
    expect(result.isVerifiedSpecialist).toBe(false);
  });

  it('승인 후 전공이 바뀌면 배지를 잃는다 (verifiedSpecialty 불일치)', () => {
    const result = projectDoctorPublic(
      row({ specialty: '치과교정전문의', verifiedSpecialty: '치과보철전문의' }),
      { authenticated: true }
    );

    expect(result.isVerifiedSpecialist).toBe(false);
    expect(result.visibleSpecialty).toBeNull();
  });

  it('비로그인은 rating 이 null 이고 reviewCount 는 그대로다', () => {
    const result = projectDoctorPublic(row(), { authenticated: false });

    expect(result.rating).toBeNull();
    expect(result.reviewCount).toBe(180);
  });

  it('자격증 URL 과 반려 사유를 절대 담지 않는다', () => {
    const result = projectDoctorPublic(row({ rejectionReason: '흐릿함' }), { authenticated: true });

    expect(result).not.toHaveProperty('certificateUrl');
    expect(result).not.toHaveProperty('rejectionReason');
  });

  it('경력을 sortOrder 순 문자열 배열로 되돌린다', () => {
    const result = projectDoctorPublic(
      row({ careers: [{ content: '두번째', sortOrder: 1 }, { content: '첫번째', sortOrder: 0 }] }),
      { authenticated: true }
    );

    expect(result.career).toEqual(['첫번째', '두번째']);
  });
});

describe('projectDoctorAdmin', () => {
  it('자격증 URL 과 반려 사유를 담는다', () => {
    const result = projectDoctorAdmin(row({ rejectionReason: '흐릿함' }));

    expect(result.certificateUrl).toBe('https://example.test/cert.pdf');
    expect(result.rejectionReason).toBe('흐릿함');
  });

  it('검수 화면은 미승인 전공도 그대로 본다', () => {
    const result = projectDoctorAdmin(row({ verificationStatus: 'pending', verifiedSpecialty: null }));

    expect(result.specialty).toBe('치과보철전문의');
  });

  it('rating 을 잠그지 않는다', () => {
    expect(projectDoctorAdmin(row()).rating).toBe(4.7);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/doctor-projection.spec.ts`
Expected: FAIL — `Cannot find module '../src/doctor/doctor.projection'`

- [ ] **Step 3: 구현**

`backend/src/doctor/doctor.projection.ts`:

```ts
/** 검수 대상이 아닌 전공. 자격증이 없고 승인/반려가 화면 표시를 바꾸지 않는다. */
export const GENERAL_PRACTITIONER = '일반의';

export interface DoctorRow {
  id: string;
  hospitalId: string;
  name: string;
  nameNormalized: string;
  title: string;
  specialty: string;
  /** 실제로 승인받은 전공. `specialty` 와 다르면 배지 자격을 잃는다. */
  verifiedSpecialty: string | null;
  verificationStatus: string;
  certificateUrl: string | null;
  rejectionReason: string | null;
  photo: string;
  rating: number;
  reviewCount: number;
  consultCount: number;
  yearsOfExperience: number;
  isRecommended: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  procedures: { procedureId: string }[];
  careers: { content: string; sortOrder: number }[];
}

export const DOCTOR_INCLUDE = {
  procedures: { select: { procedureId: true } },
  careers: { select: { content: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
} as const;

/**
 * `전문의` 배지 조건. **`verifiedSpecialty === specialty` 를 함께 본다.**
 *
 * 프론트의 기존 구현은 `verificationStatus === 'approved' && specialty !== '일반의'` 뿐이라,
 * 승인 후 전공을 다른 과로 바꿔도 배지가 유지됐다 — 검수 없이 새 과의 전문의로 보이는
 * 결함이다 (docs/features/known-issues.md 🟡). DB 가 두 값을 나눠 둔 이유가 이것이다.
 */
export function isVerifiedSpecialist(row: DoctorRow): boolean {
  return (
    row.verificationStatus === 'approved' &&
    row.specialty !== GENERAL_PRACTITIONER &&
    row.verifiedSpecialty === row.specialty
  );
}

/**
 * 화면에 표시해도 되는 전공.
 * `일반의` → 항상 그대로. 그 밖 → 배지 자격이 있을 때만, 아니면 null.
 */
export function visibleSpecialty(row: DoctorRow): string | null {
  if (row.specialty === GENERAL_PRACTITIONER) return GENERAL_PRACTITIONER;

  return isVerifiedSpecialist(row) ? row.specialty : null;
}

export interface DoctorPublicResponse {
  id: string;
  name: string;
  title: string;
  hospitalId: string;
  photo: string;
  procedureIds: string[];
  /** 비로그인이면 null. `reviewCount` 는 잠금 대상이 아니다. */
  rating: number | null;
  reviewCount: number;
  consultCount: number;
  /** 표시 가능할 때만 존재한다. 미승인 전공 주장은 응답에 포함되지 않는다. */
  specialty?: string;
  visibleSpecialty: string | null;
  isVerifiedSpecialist: boolean;
  verificationStatus: string;
  isRecommended: boolean;
  yearsOfExperience: number;
  career: string[];
}

export interface DoctorAdminResponse extends Omit<DoctorPublicResponse, 'specialty' | 'rating'> {
  /** 검수 화면은 미승인 전공을 그대로 봐야 판단할 수 있다. 항상 존재한다. */
  specialty: string;
  rating: number;
  certificateUrl: string | null;
  rejectionReason: string | null;
  /** 검수 큐에서만 채운다. */
  hospitalName?: string;
}

function common(row: DoctorRow): Omit<DoctorPublicResponse, 'rating' | 'specialty'> {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    hospitalId: row.hospitalId,
    photo: row.photo,
    procedureIds: row.procedures.map((item) => item.procedureId),
    reviewCount: row.reviewCount,
    consultCount: row.consultCount,
    visibleSpecialty: visibleSpecialty(row),
    isVerifiedSpecialist: isVerifiedSpecialist(row),
    verificationStatus: row.verificationStatus,
    isRecommended: row.isRecommended,
    yearsOfExperience: row.yearsOfExperience,
    career: [...row.careers].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.content),
  };
}

/**
 * 공개 시야. **`certificateUrl` 과 `rejectionReason` 을 읽지 않는다** — 필드를 빼는 것이
 * 아니라 애초에 참조하지 않는다. 플래그 하나로 두 시야를 만들면 언젠가 기본값이 뒤집혀
 * 자격증 URL 이 공개 응답으로 샌다.
 */
export function projectDoctorPublic(
  row: DoctorRow,
  options: { authenticated: boolean }
): DoctorPublicResponse {
  const response: DoctorPublicResponse = {
    ...common(row),
    // 평점 잠금은 클라이언트 표현이 아니라 서버 응답으로 구현한다 (계약 `getDoctor`).
    rating: options.authenticated ? row.rating : null,
  };

  const visible = visibleSpecialty(row);
  if (visible !== null) {
    response.specialty = row.specialty;
  }

  return response;
}

/** 관리자 시야. 담당 병원 관리자와 운영자만 받는다. */
export function projectDoctorAdmin(
  row: DoctorRow,
  options: { hospitalName?: string } = {}
): DoctorAdminResponse {
  const response: DoctorAdminResponse = {
    ...common(row),
    specialty: row.specialty,
    rating: row.rating,
    certificateUrl: row.certificateUrl,
    rejectionReason: row.rejectionReason,
  };

  if (options.hospitalName !== undefined) {
    response.hospitalName = options.hospitalName;
  }

  return response;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/doctor-projection.spec.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && npm run lint && npm run typecheck
git add backend/src/doctor/doctor.projection.ts backend/test/doctor-projection.spec.ts
git commit -m "feat(backend): add public and admin doctor projections

두 개의 함수로 나눈다. 공개 함수는 certificateUrl / rejectionReason 을 애초에
읽지 않는다 — 플래그 하나로 두 시야를 만들면 언젠가 기본값이 뒤집혀 자격증
URL 이 공개 응답으로 샌다.

배지 판정이 프론트보다 엄격해진다. verifiedSpecialty === specialty 를 함께
보므로 승인 후 전공을 바꾼 전문의는 배지를 잃는다 — known-issues 🟡 의 해결이다.

미승인 전공은 필드 자체를 뺀다 (계약의 required 에 specialty 가 없다).
비로그인은 rating 이 null 이다."
```

---

## Task 8: 전문의 조회 엔드포인트 3개

`GET /doctors`, `GET /doctors/{doctorId}`, `GET /hospitals/{hospitalId}/doctors`.

**Files:**
- Create: `backend/src/doctor/doctor.schemas.ts`, `doctor.filters.ts`, `doctor.repository.ts`, `doctor.service.ts`, `doctor.controller.ts`, `doctor.module.ts`
- Modify: `backend/src/hospital/hospital.controller.ts` (병원 소속 전문의 라우트)
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/doctor-list.e2e.spec.ts`

**Interfaces:**
- Consumes: `projectDoctorPublic`, `DOCTOR_INCLUDE` (Task 7), `buildPageMeta` (Task 5), `AuthGuard` 의 선택 인증
- Produces: `DoctorService.list(query, viewer)`, `DoctorService.getById(id, viewer)`, `DoctorService.listByHospital(hospitalId, viewer)`

- [ ] **Step 1: 실패하는 e2e 테스트 작성**

`backend/test/doctor-list.e2e.spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

describe('전문의 조회', () => {
  let app: INestApplication;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    userToken = (await logIn(app, SEED_ACCOUNTS.user)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/doctors', () => {
    it('인증 없이 목록을 준다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors');

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('hospitalId 로 좁힌다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors?hospitalId=h1');

      expect(response.body.items.every((item: { hospitalId: string }) => item.hospitalId === 'h1')).toBe(true);
    });

    it('verifiedSpecialist=true 는 배지 자격이 있는 전문의만 준다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors?verifiedSpecialist=true');

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(
        response.body.items.every((item: { isVerifiedSpecialist: boolean }) => item.isVerifiedSpecialist)
      ).toBe(true);
    });

    it('consultAvailable 은 소속 병원 속성으로 거른다', async () => {
      const all = await request(app.getHttpServer()).get('/api/v1/doctors');
      const filtered = await request(app.getHttpServer()).get('/api/v1/doctors?consultAvailable=false');

      expect(filtered.body.items.length).toBeLessThan(all.body.items.length);
    });

    it('minYearsOfExperience 는 본인 경력으로 거른다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors?minYearsOfExperience=10');

      expect(
        response.body.items.every((item: { yearsOfExperience: number }) => item.yearsOfExperience >= 10)
      ).toBe(true);
    });

    it('자격증 URL 을 절대 담지 않는다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors');

      expect(response.body.items.every((item: object) => !('certificateUrl' in item))).toBe(true);
    });
  });

  describe('GET /api/v1/doctors/:doctorId', () => {
    it('비로그인은 rating 이 null 이다', async () => {
      const response = await request(app.getHttpServer()).get(`/api/v1/doctors/${SEED_FIXTURES.doctorAtH1}`);

      expect(response.status).toBe(200);
      expect(response.body.rating).toBeNull();
      expect(typeof response.body.reviewCount).toBe('number');
    });

    it('로그인하면 rating 이 숫자다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/doctors/${SEED_FIXTURES.doctorAtH1}`)
        .set('Authorization', bearer(userToken));

      expect(typeof response.body.rating).toBe('number');
    });

    it('없는 전문의는 404 DOCTOR_NOT_FOUND 다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/doctors/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });
  });

  describe('GET /api/v1/hospitals/:hospitalId/doctors', () => {
    it('소속 전문의를 준다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/doctors');

      expect(response.status).toBe(200);
      expect(response.body.every((item: { hospitalId: string }) => item.hospitalId === 'h1')).toBe(true);
    });

    it('없는 병원은 404 HOSPITAL_NOT_FOUND 다', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/hospitals/nope/doctors');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/doctor-list.e2e.spec.ts`
Expected: FAIL — 404 (라우트 없음)

- [ ] **Step 3: 스키마·필터 구현**

`backend/src/doctor/doctor.schemas.ts` — `hospital.schemas.ts` 와 같은 `booleanParam` 패턴을 쓴다:

```ts
import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/pagination';
import { SORT_FIELDS } from '../hospital/hospital.schemas';

const booleanParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const listDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  hospitalId: z.string().min(1).optional(),
  procedureId: z.string().min(1).optional(),
  recommended: booleanParam,
  consultAvailable: booleanParam,
  oneDay: booleanParam,
  verifiedSpecialist: booleanParam,
  nightConsult: booleanParam,
  minYearsOfExperience: z.coerce.number().int().min(0).optional(),
  sort: z.enum(SORT_FIELDS).default('rating'),
  q: z.string().max(100).optional(),
});

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
```

`backend/src/doctor/doctor.filters.ts`:

```ts
import type { Prisma } from '@prisma/client';

import { GENERAL_PRACTITIONER } from './doctor.projection';
import type { ListDoctorsQuery } from './doctor.schemas';

/**
 * 쿼리 → Prisma `where`.
 *
 * `consultAvailable` · `oneDay` · `nightConsult` 는 **소속 병원 속성으로 전문의를 거른다.**
 * 클라이언트에서 하려면 병원 전체 목록이 필요하므로 서버 필터다 (계약 `listDoctors`).
 *
 * `verifiedSpecialist` 는 `approved` + `일반의` 제외까지만 SQL 로 표현한다.
 * `verifiedSpecialty === specialty` 비교는 컬럼 간 비교라 Prisma 로 표현할 수 없어
 * 투영 후 앱에서 거른다 (호출부 참고).
 */
export function buildDoctorWhere(query: ListDoctorsQuery): Prisma.DoctorWhereInput {
  const where: Prisma.DoctorWhereInput = { deletedAt: null };

  if (query.hospitalId !== undefined) where.hospitalId = query.hospitalId;
  if (query.recommended !== undefined) where.isRecommended = query.recommended;
  if (query.minYearsOfExperience !== undefined) {
    where.yearsOfExperience = { gte: query.minYearsOfExperience };
  }

  if (query.procedureId !== undefined) {
    where.procedures = { some: { procedureId: query.procedureId } };
  }

  if (query.verifiedSpecialist === true) {
    where.verificationStatus = 'approved';
    where.specialty = { not: GENERAL_PRACTITIONER };
  }

  if (query.q !== undefined && query.q.trim() !== '') {
    where.nameNormalized = { contains: query.q.trim().toLowerCase() };
  }

  const hospitalConditions: Prisma.HospitalWhereInput = { deletedAt: null };

  if (query.consultAvailable !== undefined) hospitalConditions.consultAvailable = query.consultAvailable;
  if (query.oneDay !== undefined) hospitalConditions.isOneDay = query.oneDay;
  if (query.nightConsult !== undefined) hospitalConditions.featureNightConsult = query.nightConsult;

  // 삭제된 병원의 전문의는 목록에 나오지 않아야 하므로 조건 유무와 무관하게 붙인다.
  where.hospital = { is: hospitalConditions };

  return where;
}
```

- [ ] **Step 4: 리포지토리·서비스·컨트롤러 구현**

`backend/src/doctor/doctor.repository.ts` — `findMany(where, { skip, take })`, `count(where)`, `findById(id)`, `findByHospital(hospitalId)` 를 제공한다. 모두 `DOCTOR_INCLUDE` 를 쓰고 `orderBy` 에 `{ id: 'asc' }` tiebreaker 를 넣는다. `GET /doctors` 는 스폰서 정렬이 없으므로 Prisma `skip`/`take` 를 쓴다 (병원 목록과 의도적으로 다르다).

`backend/src/doctor/doctor.service.ts` 의 핵심:

```ts
async list(query: ListDoctorsQuery, viewer: { authenticated: boolean }): Promise<DoctorListResult> {
  const where = buildDoctorWhere(query);

  const [rows, totalItems] = await Promise.all([
    this.doctors.findMany(where, {
      sort: query.sort,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    this.doctors.count(where),
  ]);

  return {
    items: rows.map((row) => projectDoctorPublic(row, viewer)),
    meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
  };
}
```

> **`verifiedSpecialist=true` 의 잔여 조건.** SQL 은 `approved` + `일반의 제외`까지만
> 거른다. `verifiedSpecialty === specialty` 는 컬럼 간 비교라 Prisma 로 표현할 수 없다.
> 남은 조건은 투영 결과의 `isVerifiedSpecialist` 로 앱에서 거르고, **그 경우에만**
> 병원 목록과 같은 방식(전부 읽고 앱 페이징)으로 처리한다. 조건이 켜졌을 때만 경로가
> 갈리므로 `if (query.verifiedSpecialist === true)` 분기를 서비스에 명시하고 주석을 남긴다.

`backend/src/doctor/doctor.controller.ts` — **라우트 선언 순서가 중요하다:**

```ts
@Controller('doctors')
export class DoctorController {
  constructor(private readonly doctors: DoctorService) {}

  @Get()
  list(...) {}

  // ★ `verification-queue` 를 `:doctorId` **앞에** 둔다. 뒤에 두면 NestJS 가 선언 순서로
  //   매칭하므로 `verification-queue` 가 doctorId 로 잡혀 404 DOCTOR_NOT_FOUND 가 난다.
  //   Task 13 에서 이 자리에 추가한다.

  @Get(':doctorId')
  getById(...) {}
}
```

**선택 인증**(`security: [{}, bearerAuth]`)은 `AuthGuard` 를 붙이지 않고 요청 헤더의 토큰을 직접 해석해 `authenticated` 만 판정한다. 토큰이 있어도 만료·위조면 `authenticated: false` 로 보고 **401 을 내지 않는다** — 공개 화면이므로 로그인 실패가 조회 실패가 되면 안 된다.

`GET /hospitals/:hospitalId/doctors` 는 `HospitalController` 에 둔다 (경로 소유자가 병원이다). 병원 존재를 먼저 확인해 `404 HOSPITAL_NOT_FOUND` 를 낸다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/doctor-list.e2e.spec.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: 게이트 실행 후 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/src/doctor backend/src/hospital backend/src/app.module.ts backend/test/doctor-list.e2e.spec.ts
git commit -m "feat(backend): add doctor list, detail, and hospital roster endpoints

평점 잠금을 서버 응답으로 구현한다. 비로그인은 rating 이 null 이다 — 지금은
반투명 막을 덮는 방식이라 응답을 직접 보면 그냥 노출된다.

선택 인증 경로는 토큰이 만료·위조여도 401 을 내지 않는다. 공개 화면이라
로그인 실패가 조회 실패가 되면 안 된다.

verifiedSpecialist 필터의 verifiedSpecialty === specialty 비교는 컬럼 간
비교라 Prisma 로 표현할 수 없어 투영 후 앱에서 거른다."
```

---

## Task 9: 후기 조회

**Files:**
- Create: `backend/src/review/review.projection.ts`, `review.repository.ts`, `review.controller.ts`, `review.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/review.e2e.spec.ts`

**Interfaces:**
- Produces: `projectReview(row): ReviewResponse` — `{ id, hospitalId, procedureId, authorName, rating, content, createdAt, photos? }`

작성 엔드포인트는 **없다.** 어느 화면에도 후기 작성 기능이 없다 (`docs/features/hospital-detail.md` — "후기를 작성하는 기능은 없습니다. 읽기만 됩니다"). `rating`/`reviewCount` 가 후기로부터 집계되지 않고 병원 컬럼에 직접 들어 있는 것도 같은 이유다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/review.e2e.spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './support/app';

describe('GET /api/v1/hospitals/:hospitalId/reviews', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('최신순으로 준다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/reviews');

    expect(response.status).toBe(200);

    const dates = response.body.items.map((item: { createdAt: string }) => item.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('createdAt 은 날짜만이다 (기존 도메인 타입 보존)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/reviews');

    expect(response.body.items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('procedureId 로 좁힌다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/reviews?procedureId=implant');

    expect(
      response.body.items.every((item: { procedureId: string }) => item.procedureId === 'implant')
    ).toBe(true);
  });

  it('없는 병원은 404 HOSPITAL_NOT_FOUND 다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/hospitals/nope/reviews');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
  });

  it('후기 작성 엔드포인트는 없다', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/hospitals/h1/reviews')
      .send({ rating: 5, content: '좋아요' });

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/review.e2e.spec.ts`
Expected: FAIL — 404 (라우트 없음)

- [ ] **Step 3: 구현**

투영은 `Review` 행 + `ReviewPhoto` 자식을 `photos: string[]` 로 되돌린다. `createdAt` 은 **날짜만**(`YYYY-MM-DD`) 문자열이다 — openapi 공통 규약이 `Review.createdAt` 을 `format: date` 로 명시했다. DB 가 `DateTime` 이면 `toISOString().slice(0, 10)` 로 자른다.

라우트는 `HospitalController` 에 둔다. 병원 존재를 먼저 확인한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/review.e2e.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/src/review backend/src/hospital backend/src/app.module.ts backend/test/review.e2e.spec.ts
git commit -m "feat(backend): add hospital reviews endpoint

읽기 전용이다. 어느 화면에도 후기 작성 기능이 없고, rating/reviewCount 가
후기로부터 집계되지 않고 병원 컬럼에 직접 들어 있는 것도 같은 이유다.
작성 경로가 없음을 테스트로 고정한다."
```

---

## Task 10: 병원 등록·수정 — 인가와 쓰기 금지 필드

**Files:**
- Modify: `backend/src/hospital/hospital.schemas.ts`, `hospital.repository.ts`, `hospital.service.ts`, `hospital.controller.ts`, `hospital.module.ts`
- Test: `backend/test/hospital-write.e2e.spec.ts`

**Interfaces:**
- Consumes: `AuthGuard`, `RolesGuard`, `HospitalScopeGuard`, `@Roles`, `@HospitalScope` (`src/auth/`), `ApiError` 코드 `HOSPITAL_NOT_MANAGED` · `FIELD_NOT_WRITABLE`
- Produces: `createHospitalSchema`, `updateHospitalSchema`, `HospitalService.create(dto)`, `HospitalService.update(id, dto, actor)`

### 쓰기 금지 필드는 조용히 무시하지 않는다

계약이 명시한다 — 조용히 무시하면 관리자 화면이 "저장했는데 안 바뀐다" 상태가 된다. **지금 `대표 이미지 URL` 에서 실제로 겪고 있는 증상이다.**

| 필드 | 누가 바꿀 수 있나 |
|---|---|
| `isSponsored` · `sponsoredCategories` · `sponsoredRank` · `sponsoredStartDate` · `sponsoredEndDate` | 아무도 (이 엔드포인트로는) |
| `rating` · `reviewCount` · `consultCount` | 아무도 (집계값) |
| `isRecommended` | `operator` 만 |

보내면 `422 FIELD_NOT_WRITABLE` 로 거절한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/hospital-write.e2e.spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

describe('병원 쓰기', () => {
  let app: INestApplication;
  let operator: string;
  let adminH1: string;
  let user: string;

  beforeAll(async () => {
    app = await createTestApp();
    operator = (await logIn(app, SEED_ACCOUNTS.operator)).accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;
    user = (await logIn(app, SEED_ACCOUNTS.user)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const patch = (id: string, token: string | null, body: object): request.Test => {
    const test = request(app.getHttpServer()).patch(`/api/v1/hospitals/${id}`).send(body);

    return token === null ? test : test.set('Authorization', bearer(token));
  };

  describe('PATCH /hospitals/:hospitalId', () => {
    it('담당자는 자기 병원을 고칠 수 있다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, adminH1, {
        introduction: '수정된 소개',
      });

      expect(response.status).toBe(200);
      expect(response.body.introduction).toBe('수정된 소개');
    });

    it('담당하지 않는 병원은 403 HOSPITAL_NOT_MANAGED 다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalNotManagedByH1Admin, adminH1, {
        introduction: '남의 병원',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });

    it('운영자는 전 병원을 고칠 수 있다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalNotManagedByH1Admin, operator, {
        introduction: '운영자 수정',
      });

      expect(response.status).toBe(200);
    });

    it('일반 사용자는 403 이다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, user, { introduction: 'x' });

      expect(response.status).toBe(403);
    });

    it('비로그인은 401 이다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, null, { introduction: 'x' });

      expect(response.status).toBe(401);
    });

    it('없는 병원은 404 HOSPITAL_NOT_FOUND 다 (병원은 공개 자원이라 존재를 숨기지 않는다)', async () => {
      const response = await patch('does-not-exist', operator, { introduction: 'x' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
    });

    it('광고 필드를 보내면 422 FIELD_NOT_WRITABLE 이다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, operator, {
        sponsoredRank: 1,
      });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('FIELD_NOT_WRITABLE');
    });

    it('집계 필드를 보내면 422 FIELD_NOT_WRITABLE 이다', async () => {
      const response = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, operator, { rating: 5 });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('FIELD_NOT_WRITABLE');
    });

    it('isRecommended 는 운영자만 바꿀 수 있다', async () => {
      const byAdmin = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, adminH1, {
        isRecommended: true,
      });
      const byOperator = await patch(SEED_FIXTURES.hospitalManagedByH1Admin, operator, {
        isRecommended: true,
      });

      expect(byAdmin.status).toBe(422);
      expect(byAdmin.body.error.code).toBe('FIELD_NOT_WRITABLE');
      expect(byOperator.status).toBe(200);
    });

    it('이름을 고치면 검색용 정규화 컬럼도 함께 바뀐다', async () => {
      await patch(SEED_FIXTURES.hospitalManagedByH1Admin, operator, { name: 'Smile Dental 강남' });

      const found = await request(app.getHttpServer()).get('/api/v1/hospitals?q=smile');

      expect(found.body.items.some((item: { id: string }) => item.id === SEED_FIXTURES.hospitalManagedByH1Admin)).toBe(true);
    });
  });

  describe('POST /hospitals', () => {
    const body = {
      name: '테스트 치과',
      region: '서울 강남구',
      address: '서울 강남구 테헤란로 2',
      latitude: 37.5,
      longitude: 127.03,
      thumbnail: 'https://example.test/t.jpg',
      procedureIds: ['implant'],
      priceRange: { min: 100000, max: 200000 },
    };

    it('운영자만 병원을 만들 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(operator))
        .send(body);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeTruthy();
      expect(response.body.rating).toBe(0);
    });

    it('병원 담당자는 만들 수 없다 — 아무나 병원을 만들 수 있으면 안 된다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(adminH1))
        .send(body);

      expect(response.status).toBe(403);
    });

    it('시술이 비면 422 다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/hospitals')
        .set('Authorization', bearer(operator))
        .send({ ...body, procedureIds: [] });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/hospital-write.e2e.spec.ts`
Expected: FAIL — 404 (라우트 없음)

- [ ] **Step 3: 쓰기 스키마 구현**

`backend/src/hospital/hospital.schemas.ts` 에 더한다:

```ts
/**
 * 이 엔드포인트로 바꿀 수 없는 필드.
 *
 * **조용히 무시하지 않고 422 로 거절한다.** 무시하면 관리자 화면이 "저장했는데 안 바뀐다"
 * 상태가 된다 — 지금 `대표 이미지 URL` 에서 실제로 겪고 있는 증상이다 (계약 `updateHospital`).
 */
export const READONLY_HOSPITAL_FIELDS = [
  'isSponsored',
  'sponsoredCategories',
  'sponsoredRank',
  'sponsoredStartDate',
  'sponsoredEndDate',
  'rating',
  'reviewCount',
  'consultCount',
] as const;

/** `operator` 만 바꿀 수 있는 필드. `hospital_admin` 이 보내면 422. */
export const OPERATOR_ONLY_HOSPITAL_FIELDS = ['isRecommended'] as const;

const featuresSchema = z.object({
  coordinator: z.boolean(),
  painlessAnesthesia: z.boolean(),
  digitalCare: z.boolean(),
  parking: z.boolean(),
  nightConsult: z.boolean(),
  cctv: z.boolean(),
});

const businessHourSchema = z.object({
  day: z.enum(['월', '화', '수', '목', '금', '토', '일']),
  hours: z.string().min(1),
  isClosed: z.boolean().optional().default(false),
});

export const createHospitalSchema = z.object({
  name: z.string().trim().min(1),
  specialty: z.string().trim().optional(),
  region: z.string().trim().min(1),
  address: z.string().trim().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  thumbnail: z.string().url(),
  images: z.array(z.string().url()).optional(),
  procedureIds: z.array(z.string().min(1)).min(1),
  priceRange: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }),
  consultAvailable: z.boolean().optional(),
  isOneDay: z.boolean().optional(),
  features: featuresSchema.optional(),
  businessHours: z.array(businessHourSchema).optional(),
  directions: z.string().optional(),
  introduction: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  events: z.array(z.string().min(1)).optional(),
});

/** 부분 수정 + 운영자 전용 필드. 금지 필드는 스키마가 아니라 서비스가 판정한다(역할을 알아야 한다). */
export const updateHospitalSchema = createHospitalSchema.partial().extend({
  isRecommended: z.boolean().optional(),
});

export type CreateHospitalDto = z.infer<typeof createHospitalSchema>;
export type UpdateHospitalDto = z.infer<typeof updateHospitalSchema>;
```

- [ ] **Step 4: 금지 필드 판정을 서비스에 구현**

```ts
/**
 * 쓰기 금지 필드 검사. **역할을 알아야 하므로 zod 가 아니라 여기서 한다** —
 * `isRecommended` 는 운영자에게만 허용된다.
 *
 * `body` 는 zod 통과 전 원본을 받는다. zod 가 모르는 키를 떨어뜨리면 "보냈는데
 * 거절되지 않는" 구멍이 생기기 때문이다.
 */
private assertWritable(body: Record<string, unknown>, role: string): void {
  const blocked = READONLY_HOSPITAL_FIELDS.filter((field) => field in body);

  if (role !== 'operator') {
    blocked.push(...OPERATOR_ONLY_HOSPITAL_FIELDS.filter((field) => field in body));
  }

  if (blocked.length > 0) {
    throw new ApiError('FIELD_NOT_WRITABLE', {
      details: blocked.map((field) => ({ field, code: 'not_writable', message: '수정할 수 없는 항목이에요' })),
    });
  }
}
```

> 컨트롤러가 `@Body()` 를 **두 번** 받는다 — 하나는 zod 검증본, 하나는 원본
> (`@Body() raw: Record<string, unknown>`). 원본으로 금지 필드를 판정한다.

- [ ] **Step 5: 컨트롤러에 인가 데코레이터 부착**

```ts
@Post()
@HttpCode(HttpStatus.CREATED)
@Roles('operator')
@UseGuards(AuthGuard, RolesGuard)
create(...) {}

@Patch(':hospitalId')
@Roles('hospital_admin', 'operator')
@HospitalScope({ resource: 'hospital' })
@UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
update(...) {}
```

`HospitalModule` 이 `AuthModule` 을 import 해 가드가 주입받는 `ResourceScopeService`·`UsersRepository` 를 얻게 한다.

**쓰기 경로가 반드시 채우는 것** (Global Constraints):
- `nameNormalized = name.trim().toLowerCase()` — `name` 을 건드릴 때마다
- `updatedAt = new Date()` — 모든 수정
- `createdAt` — 생성 시
- `id` — `cuid()` 를 애플리케이션이 만든다 (`autoincrement` 없음)

`procedureIds`·`images`·`tags`·`events`·`businessHours` 는 자식 테이블이므로 **트랜잭션 안에서 지우고 다시 넣는다**(`deleteMany` + `createMany`). 부분 수정에서 보내지 않은 자식은 건드리지 않는다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/hospital-write.e2e.spec.ts`
Expected: PASS (14 tests)

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/src/hospital backend/test/hospital-write.e2e.spec.ts
git commit -m "feat(backend): add hospital create and update with authorization

지금은 주소의 병원 id 만 바꾸면 남의 병원을 고칠 수 있다. HospitalScopeGuard 가
그것을 막는다.

쓰기 금지 필드를 조용히 무시하지 않고 422 FIELD_NOT_WRITABLE 로 거절한다.
무시하면 관리자 화면이 '저장했는데 안 바뀐다' 상태가 된다 — 대표 이미지 URL
에서 실제로 겪고 있는 증상이다.

판정은 zod 가 아니라 서비스가 한다. 역할을 알아야 하고(isRecommended 는 운영자
전용), zod 가 모르는 키를 떨어뜨리면 '보냈는데 거절되지 않는' 구멍이 생긴다."
```

---

## Task 11: `GET /admin/hospitals` — 역할별 범위

**Files:**
- Create: `backend/src/hospital/admin-hospital.controller.ts`
- Modify: `backend/src/hospital/hospital.service.ts`, `hospital.module.ts`
- Test: `backend/test/admin-hospitals.e2e.spec.ts`

**Interfaces:**
- Produces: `HospitalService.listForAdmin(query, actor): Promise<{ items; meta; scope: 'managed' | 'all' }>`

공개 목록과 **경로를 분리한 이유**: 지금 관리자 홈은 등록된 모든 병원을 보여주고 전부 수정할 수 있다(확인된 결함). 경로가 분리돼 있으면 "관리자 화면이 공개 목록을 쓰다가 스코프를 잃는" 회귀가 구조적으로 불가능해진다.

응답의 `scope` 는 화면이 빈 목록의 문구를 구분하는 근거다 — `담당 병원이 아직 지정되지 않았어요` 와 `등록된 병원이 없어요` 는 다른 상황이다. 지금은 둘 다 그냥 빈 화면이다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/admin-hospitals.e2e.spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bearer, createTestApp, logIn, SEED_ACCOUNTS } from './support/app';

describe('GET /api/v1/admin/hospitals', () => {
  let app: INestApplication;
  let operator: string;
  let adminH1: string;
  let user: string;

  beforeAll(async () => {
    app = await createTestApp();
    operator = (await logIn(app, SEED_ACCOUNTS.operator)).accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;
    user = (await logIn(app, SEED_ACCOUNTS.user)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (token: string | null): request.Test => {
    const test = request(app.getHttpServer()).get('/api/v1/admin/hospitals');

    return token === null ? test : test.set('Authorization', bearer(token));
  };

  it('담당자는 담당 병원만 보고 scope 가 managed 다', async () => {
    const response = await get(adminH1);

    expect(response.status).toBe(200);
    expect(response.body.scope).toBe('managed');
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(['h1']);
  });

  it('운영자는 전 병원을 보고 scope 가 all 이다', async () => {
    const response = await get(operator);

    expect(response.body.scope).toBe('all');
    expect(response.body.items.length).toBeGreaterThan(1);
  });

  it('일반 사용자는 403 이다', async () => {
    expect((await get(user)).status).toBe(403);
  });

  it('비로그인은 401 이다', async () => {
    expect((await get(null)).status).toBe(401);
  });

  it('캐시하지 않는다', async () => {
    const response = await get(adminH1);

    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('광고 현황 표시용 sponsorship 계산 필드가 항상 있다', async () => {
    const response = await get(adminH1);

    expect(response.body.items[0].sponsorship).toEqual({
      isActive: expect.any(Boolean),
      isPlacementEligible: expect.any(Boolean),
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/admin-hospitals.e2e.spec.ts`
Expected: FAIL — 404

- [ ] **Step 3: 구현**

```ts
@Controller('admin/hospitals')
export class AdminHospitalController {
  constructor(private readonly hospitals: HospitalService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('hospital_admin', 'operator')
  @UseGuards(AuthGuard, RolesGuard)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query(new ZodValidationPipe(listManagedHospitalsQuerySchema)) query: ListManagedHospitalsQuery
  ): Promise<AdminHospitalListResult> {
    return this.hospitals.listForAdmin(query, actor);
  }
}
```

서비스는 `actor.role === 'operator'` 면 `scope: 'all'` 로 전 병원을, 아니면 `scope: 'managed'` 로 `where.id = { in: actor.managedHospitalIds }` 를 건다. **담당 병원이 0개면 빈 배열이고 에러가 아니다** — 아직 지정되지 않은 정상 상태다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/admin-hospitals.e2e.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/src/hospital backend/test/admin-hospitals.e2e.spec.ts
git commit -m "feat(backend): add the admin hospital list with role-scoped results

공개 목록과 경로를 분리한다. 지금 관리자 홈은 등록된 모든 병원을 보여주고 전부
수정할 수 있다. 경로가 분리돼 있으면 '관리자 화면이 공개 목록을 쓰다가 스코프를
잃는' 회귀가 구조적으로 불가능해진다.

scope 를 함께 내려준다 — '담당 병원이 아직 지정되지 않았어요' 와 '등록된 병원이
없어요' 는 다른 상황인데 지금은 둘 다 빈 화면이다."
```

---

## Task 12: 전문의 일괄 교체 · 단건 수정 · 삭제

관리자 병원 폼의 저장 동작을 그대로 표현한다 — "화면에 남겨둔 전문의 목록이 그대로 정답이 된다".

**Files:**
- Modify: `backend/src/doctor/doctor.schemas.ts`, `doctor.repository.ts`, `doctor.service.ts`, `doctor.controller.ts`
- Create: `backend/src/doctor/specialty-procedures.ts`
- Modify: `backend/src/hospital/hospital.controller.ts` (`PUT /hospitals/:id/doctors`)
- Test: `backend/test/doctor-write.e2e.spec.ts`

**Interfaces:**
- Produces:
  - `doctorUpsertSchema`, `replaceDoctorsSchema`, `updateDoctorSchema`
  - `getProceduresForSpecialty(specialty: string, hospitalProcedureIds: string[]): string[]`
  - `DoctorService.replaceForHospital(hospitalId, dto)`, `.update(id, dto)`, `.softDelete(id)`

### 이 Task 가 고치는 세 가지 결함

1. **이름을 비우고 저장하면 전문의가 조용히 삭제된다** → `name` 을 `minLength: 1` 필수로. 삭제는 목록에서 항목을 빼는 것으로만
2. **승인된 전문의의 전공을 바꿔도 재검수되지 않는다** → `specialty`/`certificateUrl` 변경 시 `pending` 복귀 + `rejectionReason` 삭제 + `DoctorVerification` pending 행 생성
3. **물리 삭제하면 상담의 `doctorId` 가 사라진다** → soft delete (`ConsultRequest.doctor` 가 `onDelete: SetNull`)

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/doctor-write.e2e.spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

describe('전문의 쓰기', () => {
  let app: INestApplication;
  let operator: string;
  let adminH1: string;

  beforeAll(async () => {
    app = await createTestApp();
    operator = (await logIn(app, SEED_ACCOUNTS.operator)).accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const roster = (token: string): request.Test =>
    request(app.getHttpServer()).get('/api/v1/hospitals/h1/doctors').set('Authorization', bearer(token));

  describe('PUT /hospitals/:hospitalId/doctors', () => {
    const put = (token: string, doctors: object[]): request.Test =>
      request(app.getHttpServer())
        .put('/api/v1/hospitals/h1/doctors')
        .set('Authorization', bearer(token))
        .send({ doctors });

    it('이름이 비면 422 다 — 조용한 삭제 경로를 막는다', async () => {
      const response = await put(adminH1, [{ id: SEED_FIXTURES.doctorAtH1, name: '', specialty: '일반의' }]);

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('id 없는 항목은 신규로 만들고 pending 으로 들어간다', async () => {
      const existing = (await roster(adminH1)).body;
      const response = await put(adminH1, [
        ...existing.map((item: { id: string; name: string; specialty: string }) => ({
          id: item.id,
          name: item.name,
          specialty: item.specialty,
        })),
        { name: '새전문의', specialty: '치과교정전문의' },
      ]);

      expect(response.status).toBe(200);

      const created = response.body.find((item: { name: string }) => item.name === '새전문의');
      expect(created.verificationStatus).toBe('pending');
    });

    it('목록에서 빠진 항목은 삭제된다', async () => {
      const before = (await roster(adminH1)).body;
      const keep = before.slice(0, 1);

      await put(
        adminH1,
        keep.map((item: { id: string; name: string; specialty: string }) => ({
          id: item.id,
          name: item.name,
          specialty: item.specialty,
        }))
      );

      const after = (await roster(adminH1)).body;
      expect(after).toHaveLength(1);
    });

    it('전공을 바꾸면 승인이 pending 으로 되돌아간다', async () => {
      const approved = (await roster(adminH1)).body.find(
        (item: { verificationStatus: string }) => item.verificationStatus === 'approved'
      );

      const response = await put(adminH1, [
        { id: approved.id, name: approved.name, specialty: '소아치과전문의' },
      ]);

      const updated = response.body.find((item: { id: string }) => item.id === approved.id);
      expect(updated.verificationStatus).toBe('pending');
      expect(updated.rejectionReason).toBeNull();
    });

    it('verificationStatus 를 직접 보내도 승인되지 않는다', async () => {
      const response = await put(adminH1, [
        { name: '자칭전문의', specialty: '치주과전문의', verificationStatus: 'approved' },
      ]);

      const created = response.body.find((item: { name: string }) => item.name === '자칭전문의');
      expect(created.verificationStatus).toBe('pending');
    });

    it('담당하지 않는 병원은 403 HOSPITAL_NOT_MANAGED 다', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/hospitals/${SEED_FIXTURES.hospitalNotManagedByH1Admin}/doctors`)
        .set('Authorization', bearer(adminH1))
        .send({ doctors: [{ name: '침입', specialty: '일반의' }] });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HOSPITAL_NOT_MANAGED');
    });
  });

  describe('DELETE /doctors/:doctorId', () => {
    it('삭제하면 공개 목록·상세·소속 목록에서 모두 사라진다', async () => {
      const created = await request(app.getHttpServer())
        .put('/api/v1/hospitals/h1/doctors')
        .set('Authorization', bearer(adminH1))
        .send({ doctors: [{ name: '삭제대상', specialty: '일반의' }] });

      const target = created.body.find((item: { name: string }) => item.name === '삭제대상');

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/doctors/${target.id}`)
        .set('Authorization', bearer(adminH1));

      expect(response.status).toBe(204);

      expect((await request(app.getHttpServer()).get(`/api/v1/doctors/${target.id}`)).status).toBe(404);

      const list = await request(app.getHttpServer()).get('/api/v1/doctors');
      expect(list.body.items.some((item: { id: string }) => item.id === target.id)).toBe(false);

      const hospitalRoster = await request(app.getHttpServer()).get('/api/v1/hospitals/h1/doctors');
      expect(hospitalRoster.body.some((item: { id: string }) => item.id === target.id)).toBe(false);
    });

    it('물리 삭제가 아니라 soft delete 다 — 상담의 doctorId 가 보존된다', async () => {
      // cr1 이 지목한 전문의를 삭제해도 상담 행이 남고 doctorId 가 null 이 되지 않는다.
      // (상담 조회 API 는 조각 3 이므로 여기서는 DB 를 직접 확인한다)
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        const consult = await prisma.consultRequest.findUnique({ where: { id: SEED_FIXTURES.consultAtH1 } });
        if (consult?.doctorId == null) return; // 지목 전문의가 없는 상담이면 이 검사는 해당 없음

        await request(app.getHttpServer())
          .delete(`/api/v1/doctors/${consult.doctorId}`)
          .set('Authorization', bearer(operator));

        const after = await prisma.consultRequest.findUnique({ where: { id: SEED_FIXTURES.consultAtH1 } });
        expect(after?.doctorId).toBe(consult.doctorId);
      } finally {
        await prisma.$disconnect();
      }
    });
  });
});
```

> **테스트 격리 주의.** 이 파일은 시드 DB 를 수정한다. 기존 e2e 도 같은 DB 를 쓰므로
> 실행 순서에 따라 다른 테스트가 오염될 수 있다 — `8d5d7f0` 커밋에서 실제로 겪은 문제다
> (`--actor` 없는 revoke 가 조용히 실패해 seed-1 이 operator 로 남아 7개 테스트가 오염된 DB
> 위에서 돌았다). **이 파일의 `beforeEach` 에서 `npm run prisma:seed` 에 해당하는 재시드를
> 하거나, 각 테스트가 자기가 만든 행만 건드리도록 격리한다.** 위 테스트들은 h1 의 전문의
> 목록을 통째로 바꾸므로 재시드가 필요하다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/doctor-write.e2e.spec.ts`
Expected: FAIL — 404

- [ ] **Step 3: 전공 → 시술 유도를 백엔드로 이동**

`backend/src/doctor/specialty-procedures.ts` — `frontend/src/utils/specialty.ts` 의 `PROCEDURE_SPECIALTY_MAP` 을 그대로 옮긴다:

```ts
/**
 * 시술 → 대응 전공. `frontend/src/utils/specialty.ts` 에서 옮겨 왔다.
 *
 * 신규 전문의를 등록할 때 `procedureIds` 를 보내지 않으면 서버가 전공에서 유도한다
 * (계약 `replaceHospitalDoctors`). 관리자 폼에 시술 선택 칸이 없기 때문이다.
 */
export const PROCEDURE_SPECIALTY_MAP: Record<string, string> = {
  implant: '치과보철전문의',
  laminate: '치과보철전문의',
  inlay: '치과보철전문의',
  crown: '치과보철전문의',
  orthodontics: '치과교정전문의',
  whitening: '통합치의학과전문의',
  cavity: '통합치의학과전문의',
  'gum-disease': '치주과전문의',
  'wisdom-tooth': '구강악안면외과전문의',
  splint: '구강악안면외과전문의',
  'snoring-device': '구강악안면외과전문의',
  tmj: '구강악안면외과전문의',
  botox: '구강악안면외과전문의',
};

/**
 * 전공이 다루는 시술. **`일반의` 는 병원이 취급하는 시술 전체**를 받는다 —
 * 특정 과에 묶이지 않기 때문이다 (계약 `replaceHospitalDoctors`).
 */
export function getProceduresForSpecialty(specialty: string, hospitalProcedureIds: string[]): string[] {
  if (specialty === '일반의') return [...hospitalProcedureIds];

  return Object.keys(PROCEDURE_SPECIALTY_MAP).filter(
    (procedureId) => PROCEDURE_SPECIALTY_MAP[procedureId] === specialty
  );
}
```

- [ ] **Step 4: 일괄 교체 서비스 구현**

한 트랜잭션에서:

1. 요청 목록의 `id` 집합을 만든다
2. **기존 행 중 집합에 없는 것을 soft delete** (`deletedAt = now`)
3. `id` 있는 항목 → 갱신. `specialty` 또는 `certificateUrl` 이 **바뀌었으면** `verificationStatus = 'pending'`, `verifiedSpecialty = null`, `rejectionReason = null` 로 되돌리고 `DoctorVerification` 에 pending 행을 만든다
4. `id` 없는 항목 → 신규. `verificationStatus = 'pending'`, `DoctorVerification` pending 행. `procedureIds` 미지정이면 `getProceduresForSpecialty` 로 채운다
5. `nameNormalized`, `updatedAt` 을 항상 채운다

`verificationStatus` 는 **요청 본문에서 읽지 않는다.** zod 스키마에 아예 없다 — 있으면 언젠가 통과한다.

- [ ] **Step 5: 단건 수정·삭제 구현**

`PATCH /doctors/:doctorId` 는 같은 재검수 규칙을 쓴다. `DELETE /doctors/:doctorId` 는 `deletedAt` 을 세팅하고 `204` 를 준다.

두 라우트 모두 `@Roles('hospital_admin', 'operator')` + `@HospitalScope({ resource: 'doctor' })`.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/doctor-write.e2e.spec.ts`
Expected: PASS (8 tests)

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/src/doctor backend/src/hospital backend/test/doctor-write.e2e.spec.ts
git commit -m "feat(backend): add doctor roster replace, update, and soft delete

세 가지 결함을 고친다.

1. 이름을 비우고 저장하면 전문의가 조용히 삭제되고 되돌릴 수 없었다.
   name 을 필수로 두면 그 사고 경로가 막힌다. 삭제는 목록에서 빼는 것으로만.
2. 승인된 전문의의 전공을 바꿔도 승인이 유지돼, 검수 없이 다른 과의 전문의
   배지가 노출됐다. specialty/certificateUrl 변경 시 pending 으로 되돌린다.
3. 물리 삭제하면 ConsultRequest.doctor 가 SetNull 이라 그 전문의를 지목한
   상담들의 doctorId 가 전부 사라진다 — 계약이 고치려는 결함을 다시 부순다.
   soft delete 로 두고 모든 조회에 deletedAt: null 을 건다.

verificationStatus 는 zod 스키마에 아예 없다. 받아서 무시하는 필드는 언젠가
통과한다."
```

---

## Task 13: 전문의 인증 검수 — 운영자 전용 + 알림 부수효과

**Files:**
- Create: `backend/src/doctor/verification.service.ts`
- Modify: `backend/src/doctor/doctor.controller.ts`, `doctor.schemas.ts`, `doctor.module.ts`
- Test: `backend/test/doctor-verification.e2e.spec.ts`

**Interfaces:**
- Produces: `VerificationService.listQueue(query)`, `.decide(doctorId, dto, actor)`

### 라우트 선언 순서 (계약이 경고한 함정)

`@Get('verification-queue')` 를 `@Get(':doctorId')` **앞에** 선언한다. 뒤에 두면 NestJS 가 선언 순서로 매칭하므로 `verification-queue` 가 `doctorId` 로 잡혀 `404 DOCTOR_NOT_FOUND` 가 난다. 리팩터링으로 메서드 순서가 바뀌면 조용히 깨지는 종류라 테스트로 고정한다.

### 알림 행은 이 조각에서 만든다

계약이 같은 트랜잭션을 요구한다. 알림 조회 API 는 조각 2 지만, 행을 안 만들면 조각 2 에서 과거 검수 이력이 통째로 빈다. 담당자가 없는 병원이면 알림은 만들어지되 수신자가 0명이고 **승인 자체는 성공한다.**

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/doctor-verification.e2e.spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

describe('전문의 인증 검수', () => {
  let app: INestApplication;
  let operator: string;
  let adminH1: string;

  beforeAll(async () => {
    app = await createTestApp();
    operator = (await logIn(app, SEED_ACCOUNTS.operator)).accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /doctors/verification-queue', () => {
    it('★ :doctorId 라우트에 잡히지 않는다 (선언 순서)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue')
        .set('Authorization', bearer(operator));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body.error).toBeUndefined();
    });

    it('운영자 전용이다 — 병원 담당자는 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue')
        .set('Authorization', bearer(adminH1));

      expect(response.status).toBe(403);
    });

    it('대기 → 반려 → 승인 순이다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue?status=&includeGeneralPractitioners=true')
        .set('Authorization', bearer(operator));

      const order = { pending: 0, rejected: 1, approved: 2 };
      const ranks = response.body.items.map(
        (item: { verificationStatus: keyof typeof order }) => order[item.verificationStatus]
      );

      expect(ranks).toEqual([...ranks].sort((a: number, b: number) => a - b));
    });

    it('일반의를 기본으로 제외한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue')
        .set('Authorization', bearer(operator));

      expect(response.body.items.every((item: { specialty: string }) => item.specialty !== '일반의')).toBe(true);
    });

    it('검수 화면은 자격증 URL 과 병원명을 본다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/doctors/verification-queue')
        .set('Authorization', bearer(operator));

      expect(response.body.items[0]).toHaveProperty('certificateUrl');
      expect(response.body.items[0]).toHaveProperty('hospitalName');
    });
  });

  describe('PUT /doctors/:doctorId/verification', () => {
    const decide = (token: string, doctorId: string, body: object): request.Test =>
      request(app.getHttpServer())
        .put(`/api/v1/doctors/${doctorId}/verification`)
        .set('Authorization', bearer(token))
        .send(body);

    it('운영자가 승인하면 상태가 바뀌고 반려 사유가 지워진다', async () => {
      const response = await decide(operator, SEED_FIXTURES.doctorAtH1, { status: 'approved' });

      expect(response.status).toBe(200);
      expect(response.body.verificationStatus).toBe('approved');
      expect(response.body.rejectionReason).toBeNull();
    });

    it('반려에는 사유가 필수다', async () => {
      const response = await decide(operator, SEED_FIXTURES.doctorAtH1, { status: 'rejected' });

      expect(response.status).toBe(422);
    });

    it('병원 담당자는 검수할 수 없다 — 자기 병원 전문의를 스스로 승인하면 안 된다', async () => {
      const response = await decide(adminH1, SEED_FIXTURES.doctorAtH1, { status: 'approved' });

      expect(response.status).toBe(403);
    });

    it('승인하면 소속 병원 담당자에게 알림 행이 생긴다', async () => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        const before = await prisma.notification.count();

        await decide(operator, SEED_FIXTURES.doctorAtH1, { status: 'approved' });

        const after = await prisma.notification.count();
        expect(after).toBeGreaterThan(before);

        const created = await prisma.notification.findFirst({
          where: { relatedId: SEED_FIXTURES.doctorAtH1 },
          orderBy: { createdAt: 'desc' },
        });

        expect(created?.audience).toBe('admin');
      } finally {
        await prisma.$disconnect();
      }
    });

    it('검수 기록을 남긴다 — 누가, 언제, 무엇을', async () => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        await decide(operator, SEED_FIXTURES.doctorAtH1, {
          status: 'rejected',
          rejectionReason: '자격증 이미지가 흐려요',
        });

        const record = await prisma.doctorVerification.findFirst({
          where: { doctorId: SEED_FIXTURES.doctorAtH1 },
          orderBy: { createdAt: 'desc' },
        });

        expect(record?.status).toBe('rejected');
        expect(record?.reviewedByUserId).toBe('u-operator');
        expect(record?.reviewedAt).not.toBeNull();
      } finally {
        await prisma.$disconnect();
      }
    });

    it('없는 전문의는 404 다', async () => {
      const response = await decide(operator, 'does-not-exist', { status: 'approved' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run test/doctor-verification.e2e.spec.ts`
Expected: FAIL — 404

- [ ] **Step 3: 구현**

`verification.service.ts` 의 `decide()` 는 한 트랜잭션에서:

```ts
await this.prisma.$transaction(async (tx) => {
  // 1. 상태 갱신. approved 면 verifiedSpecialty 에 현재 specialty 를 새긴다 —
  //    이 값이 나중에 specialty 와 갈리면 배지 자격을 잃는다 (Task 7).
  await tx.doctor.update({
    where: { id: doctorId },
    data: {
      verificationStatus: dto.status,
      verifiedSpecialty: dto.status === 'approved' ? doctor.specialty : null,
      rejectionReason: dto.status === 'rejected' ? dto.rejectionReason : null,
      updatedAt: now,
    },
  });

  // 2. 검수 기록. 현재는 반려 사유만 남고 승인 시 그것도 지워진다.
  await tx.doctorVerification.create({ data: { /* … reviewedByUserId: actor.id, reviewedAt: now */ } });

  // 3. 소속 병원 담당자에게 알림. 담당자가 0명이면 수신자 없이 알림만 남는다 —
  //    승인 자체는 성공해야 한다 (계약).
  const admins = await tx.hospitalAdmin.findMany({ where: { hospitalId: doctor.hospitalId } });
  const notification = await tx.notification.create({ data: { audience: 'admin', type: 'system', relatedResource: 'doctor', relatedId: doctorId, /* … */ } });
  if (admins.length > 0) {
    await tx.notificationRecipient.createMany({ data: admins.map((admin) => ({ /* … */ })) });
  }
});
```

컨트롤러:

```ts
@Get('verification-queue')   // ★ :doctorId 보다 반드시 위
@Roles('operator')
@UseGuards(AuthGuard, RolesGuard)
listQueue(...) {}

@Put(':doctorId/verification')
@Roles('operator')
@UseGuards(AuthGuard, RolesGuard)
decide(...) {}

@Get(':doctorId')
getById(...) {}
```

**`@HospitalScope` 를 쓰지 않는다** — 운영자 전용이라 담당 범위 개념이 없다. 존재 확인은 서비스가 하고 `404 DOCTOR_NOT_FOUND` 를 던진다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run test/doctor-verification.e2e.spec.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 게이트 실행 후 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/src/doctor backend/test/doctor-verification.e2e.spec.ts
git commit -m "feat(backend): add doctor verification queue and decisions

운영자 전용이다. /admin/specialists 는 모든 병원의 전문의를 심사하는 화면이라
병원 담당자에게 열면 남의 병원 전문의를 심사하게 되고 자기 병원 전문의를
스스로 승인할 수도 있다.

★ @Get('verification-queue') 를 @Get(':doctorId') 앞에 선언한다. 뒤에 두면
NestJS 가 선언 순서로 매칭해 verification-queue 가 doctorId 로 잡혀 404 가
난다. 리팩터링으로 순서가 바뀌면 조용히 깨지므로 테스트로 고정했다.

알림 행을 여기서 만든다. 조회 API 는 조각 2 지만 행을 안 만들면 조각 2 에서
과거 검수 이력이 통째로 빈다. 담당자가 0명인 병원도 승인은 성공한다.

승인 시 verifiedSpecialty 에 현재 specialty 를 새긴다 — 나중에 전공이 갈리면
배지 자격을 잃는 근거가 된다.

일반의는 검수 큐에서 기본 제외한다. 자격증이 없고 승인/반려가 화면 표시를
바꾸지도 않는다."
```

---

## Task 14: 이식성 정적 검사

PostgreSQL 전용 문법이 들어오는 것을 사람 리뷰가 아니라 테스트로 막는다.

**Files:**
- Test: `backend/test/portability.spec.ts`

- [ ] **Step 1: 테스트 작성**

`backend/test/portability.spec.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * PostgreSQL 이전 절차(docs/database/README.md §7.2)를 유효하게 유지하기 위한 검사.
 *
 * 사람 리뷰에 맡기지 않는다 — 편의로 한 번 넣으면 이전 시점까지 아무도 모른다.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return path.endsWith('.ts') ? [path] : [];
  });
}

const SOURCES = sourceFiles(join(__dirname, '..', 'src')).map((path) => ({
  path,
  content: readFileSync(path, 'utf8'),
}));

describe('PostgreSQL 이식성', () => {
  it('raw SQL 을 쓰지 않는다', () => {
    const offenders = SOURCES.filter(
      (file) => file.content.includes('$queryRaw') || file.content.includes('$executeRaw')
    );

    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it("mode: 'insensitive' 를 쓰지 않는다 — SQLite 미지원이다", () => {
    const offenders = SOURCES.filter((file) => /mode:\s*['"]insensitive['"]/.test(file.content));

    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it('스키마에 DB enum·스칼라 배열·Json·autoincrement 가 없다', () => {
    const schema = readFileSync(join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

    expect(schema).not.toMatch(/^enum\s/m);
    expect(schema).not.toContain('Json');
    expect(schema).not.toContain('autoincrement()');
    expect(schema).not.toContain('@updatedAt');
  });
});
```

- [ ] **Step 2: 실행하고 통과 확인**

Run: `cd backend && npx vitest run test/portability.spec.ts`
Expected: PASS (3 tests) — 위반이 있으면 파일 경로가 그대로 드러난다. 있으면 고친다.

- [ ] **Step 3: 커밋**

```bash
cd backend && npm run lint && npm run typecheck && npm run test:run
git add backend/test/portability.spec.ts
git commit -m "test(backend): fix the PostgreSQL portability rules as tests

리뷰에 맡기지 않는다 — 편의로 한 번 넣으면 이전 시점까지 아무도 모른다.
$queryRaw, mode:'insensitive', DB enum, 스칼라 배열, Json, autoincrement,
@updatedAt 이 없음을 고정한다."
```

---

## Task 15: 도메인 타입 확장과 병원 api 의 HTTP 교체

> **여기서부터 프론트엔드다. 반응형 레이아웃 작업이 커밋된 뒤에 시작한다.**

**Files:**
- Modify: `frontend/src/types/domain.ts`
- Modify: `frontend/src/features/hospital/api/hospitalApi.ts`
- Modify: `frontend/src/features/hospital/api/hospitalApi.test.ts`
- Modify: `frontend/src/lib/queryKeys.ts`
- Modify: `frontend/src/features/hospital/hooks/useHospitals.ts`
- Create: `frontend/src/features/hospital/hooks/useHospitalMutations.ts`

**Interfaces:**
- Consumes: `apiRequest` (`src/lib/apiClient.ts`)
- Produces:
  - `fetchHospitals(filters?: HospitalFilters): Promise<Paged<Hospital>>`
  - `fetchHospitalById(id): Promise<Hospital>`
  - `createHospital(input): Promise<Hospital>`, `updateHospital(id, patch): Promise<Hospital>`
  - `queryKeys.hospitals.list(filters)`

- [ ] **Step 1: 도메인 타입에 계산 필드 추가**

`frontend/src/types/domain.ts` — **기존 필드는 지우거나 이름을 바꾸지 않는다.** 계약이 그렇게 설계됐으므로 기존 화면 코드가 수정 없이 통과한다.

```ts
export interface SponsorshipState {
  /** 광고 기간 중인가. `광고` 배지의 조건. 서버가 Asia/Seoul 기준으로 계산한다. */
  isActive: boolean;
  /** 상단 노출 자격. 기간 + 평점 3.5 + 카테고리. 정렬은 서버가 이미 끝냈다. */
  isPlacementEligible: boolean;
}

export interface Hospital {
  // … 기존 필드 그대로 …
  sponsorship: SponsorshipState;
  /** 지도 반경 조회에서만 온다. */
  distanceKm?: number;
  /**
   * 병원 카드의 `OO전문의 상주` 배지. 서버가 계산한다 — 판정 규칙이 전문의 배지와
   * 같은 곳에 있어야 "카드에는 상주라는데 목록에는 배지가 없다" 가 생기지 않는다.
   */
  representativeSpecialty: DentalSpecialty | null;
}

export interface Doctor {
  // … 기존 필드에서 아래 셋만 바뀐다 …
  /** 비로그인이면 null. 평점 잠금이 클라이언트 표현이 아니라 서버 응답이 됐다. */
  rating: number | null;
  /** 승인 전에는 응답에 없다. 미승인 전공 주장은 공개되지 않는다. */
  specialty?: DentalSpecialty;
  /** 표시해도 되는 전공. 규칙 판정이 서버로 갔다. */
  visibleSpecialty: DentalSpecialty | null;
  /** `전문의` 배지 조건. 서버가 verifiedSpecialty 까지 본다. */
  isVerifiedSpecialist: boolean;
}

export interface Paged<T> {
  items: T[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
```

`rating` 이 nullable 이 되면서 전문의 평점을 읽는 곳이 컴파일 에러가 난다. `npm run typecheck` 가 그 목록을 준다 — 각 자리에서 `doctor.rating ?? null` 분기를 명시한다. **`?? 0` 으로 덮지 않는다.** 잠긴 것과 평점 0을 구분해야 한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/src/features/hospital/api/hospitalApi.test.ts` 를 다시 쓴다:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchHospitalById, fetchHospitals } from '@/features/hospital/api/hospitalApi';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as Response;
}

describe('fetchHospitals', () => {
  it('필터를 쿼리 파라미터로 보낸다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchHospitals({ procedureId: 'implant', sort: 'reviewCount', consultAvailable: true });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('procedureId=implant');
    expect(url).toContain('sort=reviewCount');
    expect(url).toContain('consultAvailable=true');
  });

  it('값이 없는 필터는 보내지 않는다 — 서버가 "지정 안 함" 과 false 를 구분한다', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));

    await fetchHospitals({ procedureId: undefined, consultAvailable: undefined });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain('procedureId');
    expect(url).not.toContain('consultAvailable');
  });

  it('items 와 meta 를 그대로 돌려준다', async () => {
    const body = { items: [{ id: 'h1' }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };
    fetchMock.mockResolvedValue(ok(body));

    await expect(fetchHospitals()).resolves.toEqual(body);
  });
});

describe('fetchHospitalById', () => {
  it('상세 경로를 부른다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'h1' }));

    await fetchHospitalById('h1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/hospitals/h1');
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `cd frontend && npx vitest run src/features/hospital/api`
Expected: FAIL — `mockDb` 를 부르므로 fetch 가 호출되지 않는다

- [ ] **Step 4: api 교체 구현**

```ts
import { apiRequest } from '@/lib/apiClient';
import type { Hospital, Paged } from '@/types/domain';

export interface HospitalFilters {
  page?: number;
  pageSize?: number;
  procedureId?: string;
  recommended?: boolean;
  consultAvailable?: boolean;
  oneDay?: boolean;
  hasVerifiedSpecialist?: boolean;
  nightConsult?: boolean;
  minDoctorYearsOfExperience?: number;
  sort?: 'rating' | 'reviewCount' | 'consultCount';
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  q?: string;
}

/**
 * `undefined` 인 필터는 보내지 않는다. 서버는 "지정 안 함" 과 `false` 를 구분한다 —
 * `consultAvailable=false` 는 "상담을 받지 않는 병원만" 이라는 필터다.
 */
export function toSearchParams(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

export function fetchHospitals(filters: HospitalFilters = {}): Promise<Paged<Hospital>> {
  return apiRequest<Paged<Hospital>>(`/hospitals${toSearchParams(filters)}`);
}

export function fetchHospitalById(id: string): Promise<Hospital> {
  return apiRequest<Hospital>(`/hospitals/${encodeURIComponent(id)}`);
}
```

**`fetchHospitalById` 가 더 이상 `null` 을 돌려주지 않는다.** 없는 병원은 서버가 `404 HOSPITAL_NOT_FOUND` 를 주고 `apiRequest` 가 `ApiError` 를 던진다. `useHospital` 소비자의 "없음" 분기를 `isError && error.code === 'HOSPITAL_NOT_FOUND'` 로 바꾼다.

- [ ] **Step 5: 쿼리 키에 필터 추가**

```ts
hospitals: {
  all: ['hospitals'] as const,
  list: (filters: object = {}) => ['hospitals', 'list', filters] as const,
  detail: (id: string) => ['hospitals', id] as const,
},
```

`all` 은 무효화 접두사로 남긴다. mutation 의 `onSuccess` 가 `queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all })` 로 목록·상세를 한 번에 깬다.

- [ ] **Step 6: 테스트 통과 확인 후 커밋**

```bash
cd frontend && npx vitest run src/features/hospital && npm run typecheck
git add frontend/src/types/domain.ts frontend/src/features/hospital frontend/src/lib/queryKeys.ts
git commit -m "feat(frontend): point the hospital api at the real backend

계약이 기존 Hospital 타입을 보존하도록 설계돼서 계산 필드만 더하면 된다.
Doctor 는 셋이 바뀐다 — rating 이 nullable(비로그인 잠금), specialty 가
선택적(미승인 전공은 응답에 없음), visibleSpecialty/isVerifiedSpecialist 가
서버 계산 필드가 됐다.

rating 을 ?? 0 으로 덮지 않는다. 잠긴 것과 평점 0 을 구분해야 한다.

undefined 필터는 보내지 않는다. 서버는 '지정 안 함' 과 false 를 구분한다 —
consultAvailable=false 는 '상담을 받지 않는 병원만' 이라는 필터다."
```

---

## Task 16: procedure feature — 동기 조회를 맵으로

`getProcedureById()` 는 렌더 중 동기 호출로 10곳 이상에서 쓰인다. 서버 쿼리로 바꾸면 그 호출부가 전부 비동기가 되므로, **부팅 시 한 번 받아 맵으로 들고** 동기 조회 성질을 유지한다.

**Files:**
- Create: `frontend/src/features/procedure/api/procedureApi.ts`
- Create: `frontend/src/features/procedure/hooks/useProcedures.ts`, `useProcedureMap.ts`
- Create: `frontend/src/features/procedure/index.ts`
- Create: `frontend/src/features/procedure/hooks/useProcedureMap.test.tsx`
- Modify: 호출부 10곳 (아래 목록)

**Interfaces:**
- Produces: `useProcedures(): UseQueryResult<Procedure[]>`, `useProcedureMap(): Map<ProcedureId, Procedure>`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useProcedureMap } from '@/features/procedure';
import { queryWrapper } from '@/test/queryWrapper';

describe('useProcedureMap', () => {
  it('id 로 시술을 동기 조회할 수 있다', async () => {
    const { result } = renderHook(() => useProcedureMap(), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.size).toBeGreaterThan(0));
    expect(result.current.get('implant')?.name).toBeTruthy();
  });

  it('로딩 중에는 빈 맵이다 — 호출부가 옵셔널 체이닝으로 넘어간다', () => {
    const { result } = renderHook(() => useProcedureMap(), { wrapper: queryWrapper });

    expect(result.current.size).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run src/features/procedure`
Expected: FAIL — `Failed to resolve import "@/features/procedure"`

- [ ] **Step 3: 구현**

```ts
// api/procedureApi.ts
import { apiRequest } from '@/lib/apiClient';
import type { Procedure } from '@/types/domain';

export function fetchProcedures(): Promise<Procedure[]> {
  return apiRequest<Procedure[]>('/procedures');
}

// hooks/useProcedures.ts
export function useProcedures() {
  return useQuery({
    queryKey: queryKeys.procedures.all,
    queryFn: fetchProcedures,
    // 13종 고정 마스터 데이터다. 서버도 max-age=3600 을 준다.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// hooks/useProcedureMap.ts
/**
 * `getProcedureById()` 를 대신한다. 렌더 중 동기 조회라는 성질을 유지하려고
 * 맵으로 들고 있는다 — 호출부 10곳을 비동기로 바꾸지 않기 위해서다.
 *
 * 로딩 중에는 빈 맵이다. 호출부는 `map.get(id)?.name` 처럼 옵셔널로 쓴다.
 */
export function useProcedureMap(): Map<string, Procedure> {
  const { data } = useProcedures();

  return useMemo(() => new Map((data ?? []).map((item) => [item.id, item])), [data]);
}
```

`queryKeys` 에 `procedures: { all: ['procedures'] as const }` 를 더한다.

- [ ] **Step 4: 호출부 치환**

`getProcedureById` 를 쓰는 파일에서 `useProcedureMap()` 으로 바꾼다:

```
src/components/DoctorCard.tsx
src/components/admin/HospitalForm.tsx          (procedures 배열 전체를 쓴다 → useProcedures())
src/features/hospital/components/HospitalCard.tsx
src/features/hospital/components/HospitalDetailView.tsx
src/features/hospital/components/HospitalExploreCard.tsx
src/features/hospital/components/HospitalMapView.tsx
src/screens/admin/consultations/index.tsx
src/screens/admin/consultations/[id].tsx
src/screens/admin/hospital/[id].tsx
```

`grep -rn "fixtures/procedures" src` 로 남은 것이 없는지 확인한다.

> 컴포넌트 안에서 훅을 부를 수 없는 자리(맵 콜백 안 등)가 있으면, 상위에서 한 번 부르고
> 맵을 props 로 내린다. **호출부마다 `useProcedures()` 를 부르는 것은 문제없다** —
> 같은 쿼리 키라 요청은 한 번이다.

- [ ] **Step 5: 통과 확인 후 커밋**

```bash
cd frontend && npm run typecheck && npx vitest run
git add frontend/src/features/procedure frontend/src/lib/queryKeys.ts frontend/src/components frontend/src/screens frontend/src/features/hospital
git commit -m "feat(frontend): add the procedure feature with a lookup map

getProcedureById() 는 렌더 중 동기 호출로 10곳 이상에서 쓰인다. 서버 쿼리로
바꾸면 호출부가 전부 비동기가 되므로, 13종 고정 마스터 데이터를 부팅 시 한 번
받아 맵으로 들고 동기 조회 성질을 유지한다."
```

---

## Task 17: doctor · review feature 신설

**Files:**
- Create: `frontend/src/features/doctor/api/doctorApi.ts`, `hooks/{useDoctor,useDoctors,useHospitalDoctors,useDoctorMutations}.ts`, `index.ts`
- Move: `src/components/DoctorCard.tsx` → `src/features/doctor/components/DoctorCard.tsx`
- Create: `frontend/src/features/review/api/reviewApi.ts`, `hooks/useHospitalReviews.ts`, `index.ts`
- Create: `frontend/src/features/doctor/hooks/useDoctors.test.tsx`

**Interfaces:**
- Produces: `useDoctors(filters)`, `useDoctor(id)`, `useHospitalDoctors(hospitalId)`, `useReplaceHospitalDoctors()`, `useUpdateDoctor()`, `useDeleteDoctor()`, `useDecideVerification()`, `useVerificationQueue()`, `useHospitalReviews(hospitalId)`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDoctors } from '@/features/doctor';
import { queryWrapper } from '@/test/queryWrapper';

describe('useDoctors', () => {
  it('필터가 다르면 캐시가 갈라진다', async () => {
    const a = renderHook(() => useDoctors({ hospitalId: 'h1' }), { wrapper: queryWrapper });
    const b = renderHook(() => useDoctors({ hospitalId: 'h2' }), { wrapper: queryWrapper });

    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    expect(a.result.current.data).not.toBe(b.result.current.data);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run src/features/doctor`
Expected: FAIL — `Failed to resolve import "@/features/doctor"`

- [ ] **Step 3: 구현**

`hospitalApi.ts` 의 `toSearchParams` 를 `src/lib/searchParams.ts` 로 올려 공유한다. api 함수는 계약 경로를 그대로 부른다:

```
GET  /doctors{?filters}                     fetchDoctors
GET  /doctors/{id}                          fetchDoctorById
GET  /hospitals/{id}/doctors                fetchHospitalDoctors
PUT  /hospitals/{id}/doctors                replaceHospitalDoctors
PATCH  /doctors/{id}                        updateDoctor
DELETE /doctors/{id}                        deleteDoctor
GET  /doctors/verification-queue            fetchVerificationQueue
PUT  /doctors/{id}/verification             decideVerification
GET  /hospitals/{id}/reviews                fetchHospitalReviews
```

mutation 훅의 `onSuccess` 는 **병원 캐시도 함께 깬다** — 병원 카드의 `OO전문의 상주` 배지와 탐색의 `전문의` 조건 칩이 전문의 상태에 걸려 있다:

```ts
onSuccess: (_, variables) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
},
```

`DoctorCard.tsx` 를 옮기면서 `getVisibleSpecialtyLabel(doctor)` → `doctor.visibleSpecialty`, `isVerifiedSpecialist(doctor)` → `doctor.isVerifiedSpecialist` 로 바꾼다. `useHospitalStore`/`useDoctorStore` 참조를 props 로 올린다.

- [ ] **Step 4: 통과 확인 후 커밋**

```bash
cd frontend && npm run typecheck && npx vitest run
git add frontend/src/features/doctor frontend/src/features/review frontend/src/lib/searchParams.ts
git commit -m "feat(frontend): add the doctor and review feature slices

전문의 mutation 은 병원 캐시도 함께 깬다. 병원 카드의 'OO전문의 상주' 배지와
탐색의 '전문의' 조건 칩이 전문의 상태에 걸려 있어서, 전문의만 무효화하면
병원 목록이 옛 배지를 계속 보여준다."
```

---

## Task 18: 탐색 화면 — 필터를 서버 쿼리로

계획 문서 `2026-08-12-frontend-stack-alignment.md` 의 **Task 4 를 이것이 대체한다.** 필터를 서버 쿼리 파라미터로 옮기는 작업이 곧 그 Task 였다.

**Files:**
- Create: `frontend/src/pages/ExplorePage.tsx`
- Create: `frontend/src/features/hospital/hooks/useExploreFilters.ts`
- Delete: `frontend/src/screens/tabs/explore.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/ExplorePage.test.tsx`

**Interfaces:**
- Produces: `useExploreFilters()` — 화면 상태(모드·칩·정렬·반경) → `HospitalFilters` / `DoctorFilters` 변환

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import ExplorePage from '@/pages/ExplorePage';
import { renderWithProviders } from '@/test/renderWithProviders';

describe('ExplorePage', () => {
  it('조건 칩을 누르면 목록이 실제로 바뀐다', async () => {
    renderWithProviders(<ExplorePage />);

    await waitFor(() => expect(screen.getByText(/총 \d+곳/)).toBeInTheDocument());
    const before = screen.getByText(/총 (\d+)곳/).textContent;

    await userEvent.click(screen.getByRole('button', { name: '전문의' }));

    await waitFor(() => expect(screen.getByText(/총 \d+곳/).textContent).not.toBe(before));
  });

  it('모드를 의사로 바꾸면 선택한 조건이 유지된 채 다시 적용된다', async () => {
    renderWithProviders(<ExplorePage />);

    await userEvent.click(screen.getByRole('button', { name: '상담가능' }));
    await userEvent.click(screen.getByRole('button', { name: '의사' }));

    await waitFor(() => expect(screen.getByText(/총 \d+명/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '상담가능' })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run src/pages/ExplorePage`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 필터 변환 훅 구현**

화면의 칩 이름과 서버 파라미터는 이름이 다르다. 그 매핑을 이 훅 하나에 모은다:

| 화면 | 병원 모드 | 의사 모드 |
|---|---|---|
| `상담가능` | `consultAvailable=true` | `consultAvailable=true` |
| `원데이` | `oneDay=true` | `oneDay=true` |
| `전문의` | `hasVerifiedSpecialist=true` | `verifiedSpecialist=true` |
| `진료시간` (실제로는 야간상담) | `nightConsult=true` | `nightConsult=true` |
| `경력` | `minDoctorYearsOfExperience=10` | `minYearsOfExperience=10` |
| 시술 칩 `추천` | `recommended=true` | `recommended=true` |
| 시술 칩 `기타` | 아무것도 안 보냄 | 아무것도 안 보냄 |

**클라이언트 정렬을 하지 않는다.** 서버가 스폰서 우선 노출을 이미 적용한 배열을 준다. `utils/sponsorship.ts` 호출부를 전부 제거하고, `광고` 배지는 `hospital.sponsorship.isActive` 로 판정한다.

- [ ] **Step 4: 페이지 이관**

`screens/tabs/explore.tsx` 를 `pages/ExplorePage.tsx` 로 옮기고 `useHospitalStore` / `useDoctorStore` 를 `useHospitals(filters)` / `useDoctors(filters)` 로 바꾼다. `App.tsx` 의 `ROUTES` 항목을 갱신한다.

로딩·에러·빈 상태를 명시한다. `총 N곳` 은 `data.meta.totalItems` 다.

- [ ] **Step 5: 브라우저에서 확인**

```bash
cd backend && npm run start:dev    # 터미널 1
cd frontend && npm run dev          # 터미널 2
```

`http://localhost:5173/explore` 에서 조건 칩·정렬·모드 전환·지도 반경이 실제로 목록을 바꾸는지 확인한다.

- [ ] **Step 6: 게이트 실행 후 커밋**

```bash
cd frontend && npm run lint && npm run typecheck && npm run test:run && npm run build
git add frontend/src/pages frontend/src/features/hospital frontend/src/App.tsx
git rm frontend/src/screens/tabs/explore.tsx
git commit -m "feat(frontend): drive explore filters from server queries

계획 문서의 Task 4(explore 필터 훅 분리)를 이것이 대체한다. 필터를 서버 쿼리
파라미터로 옮기는 작업이 곧 그 Task 였다.

클라이언트 정렬을 하지 않는다. 서버가 스폰서 우선 노출을 이미 적용한 배열을
준다. 광고 배지는 sponsorship.isActive 로 판정한다 — 기기 시계로 기간을
계산하면 시계가 틀린 사용자에게 광고가 잘못 노출된다.

화면 칩 이름과 서버 파라미터 이름이 다른 매핑(특히 '진료시간' → nightConsult)
을 훅 하나에 모았다."
```

---

## Task 19: 관리자 화면 4개 교체

**Files:**
- Create: `frontend/src/pages/admin/{AdminHomePage,AdminHospitalNewPage,AdminHospitalEditPage,AdminSpecialistsPage}.tsx`
- Modify: `frontend/src/components/admin/HospitalForm.tsx`
- Create: `frontend/src/pages/DoctorDetailPage.tsx`
- Delete: `frontend/src/screens/admin/{index,specialists}.tsx`, `screens/admin/hospital/{new,[id]}.tsx`, `screens/doctor/[id].tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/admin/AdminSpecialistsPage.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AdminSpecialistsPage from '@/pages/admin/AdminSpecialistsPage';
import { renderWithProviders } from '@/test/renderWithProviders';

describe('AdminSpecialistsPage', () => {
  it('검수 큐가 비면 안내 문구를 보여준다', async () => {
    renderWithProviders(<AdminSpecialistsPage />, { queueResponse: { items: [], meta: { totalItems: 0 } } });

    await waitFor(() => expect(screen.getByText(/검수할 전문의가 없어요/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 실패 확인 → Step 3: 구현**

- `AdminHomePage` — `useManagedHospitals()`. **응답의 `scope` 로 빈 목록 문구를 나눈다:** `managed` 면 `담당 병원이 아직 지정되지 않았어요`, `all` 이면 `등록된 병원이 없어요`
- `AdminHospitalNewPage` — `useCreateHospital()`. 저장 후 목록으로
- `AdminHospitalEditPage` — `useUpdateHospital()` + `useReplaceHospitalDoctors()`. **`422 FIELD_NOT_WRITABLE` 응답의 `details[].field` 를 해당 입력 칸 아래에 표시한다** (`features/auth/lib/serverFieldErrors.ts` 의 기존 매핑 방식을 재사용한다)
- `AdminSpecialistsPage` — `useVerificationQueue()` + `useDecideVerification()`. 빈 상태 안내 추가
- `DoctorDetailPage` — `useDoctor(id)` + `useHospital(doctor.hospitalId)`. `rating` 이 `null` 이면 잠금 표시

`HospitalForm.tsx` 는 `useDoctorStore` 를 끊고 전문의 목록을 **props 로 받아 부모가 `useReplaceHospitalDoctors()` 로 저장**한다. 지금은 병원(mockDb)과 전문의(persist)가 서로 다른 저장소로 가는데, 교체 후에는 한 화면의 저장이 두 API 호출이 된다 — 병원 `PATCH` 가 성공하고 전문의 `PUT` 이 실패하는 경우를 사용자에게 알린다.

- [ ] **Step 4: 브라우저 확인** — 관리자 수정이 사용자 화면에 반영되는지 (이 조각의 존재 이유)

- [ ] **Step 5: 게이트 실행 후 커밋**

```bash
cd frontend && npm run lint && npm run typecheck && npm run test:run && npm run build
git add frontend/src/pages frontend/src/components/admin frontend/src/App.tsx
git rm -r frontend/src/screens/admin frontend/src/screens/doctor
git commit -m "feat(frontend): move admin screens onto the hospital/doctor APIs

관리자 편집과 사용자 조회가 같은 저장소를 보게 된다. 지금은 병원(mockDb)과
전문의(persist)가 갈라져 있어 HospitalForm 저장 한 번에 두 저장소로 간다.

빈 목록 문구를 scope 로 나눈다 — '담당 병원이 아직 지정되지 않았어요' 와
'등록된 병원이 없어요' 는 다른 상황인데 지금은 둘 다 빈 화면이다.

422 FIELD_NOT_WRITABLE 의 details[].field 를 해당 입력 칸 아래에 표시한다.
'저장했는데 안 바뀐다' 를 화면에서 드러낸다."
```

---

## Task 20: 스토어·유틸·fixture 정리와 소유권 이전

**순서를 지켜야 시드가 깨지지 않는다.** 백엔드 시드가 프론트 fixture 를 import 하고 있다.

**Files:**
- Delete: `frontend/src/store/useHospitalStore.ts`, `useDoctorStore.ts`, 각 테스트
- Delete: `frontend/src/utils/sponsorship.ts`
- Modify: `frontend/src/utils/specialty.ts`
- Move: `frontend/src/mocks/fixtures/{hospitals,doctors,procedures,reviews}.ts` → `backend/prisma/seed/data/`
- Modify: `backend/prisma/seed/fixtures.ts`
- Modify: `frontend/src/mocks/db.ts`

- [ ] **Step 1: 남은 참조가 없는지 확인**

```bash
cd frontend
grep -rn "useHospitalStore\|useDoctorStore\|utils/sponsorship" src
grep -rn "getVisibleSpecialtyLabel\|isVerifiedSpecialist\|getRepresentativeSpecialist" src
```

Expected: 결과 없음. 남아 있으면 그 파일을 먼저 고친다.

- [ ] **Step 2: 스토어와 유틸 삭제**

`utils/specialty.ts` 에서 판정 3함수를 지운다. `PROCEDURE_SPECIALTY_MAP` 과 `getProceduresForSpecialty` 도 지운다 — 백엔드로 옮겼다(Task 12). 파일이 비면 파일째 지운다.

- [ ] **Step 3: fixture 를 백엔드로 이동**

```bash
cd /c/Users/USER/Desktop/Project/mola
mkdir -p backend/prisma/seed/data
git mv frontend/src/mocks/fixtures/hospitals.ts backend/prisma/seed/data/hospitals.ts
git mv frontend/src/mocks/fixtures/doctors.ts backend/prisma/seed/data/doctors.ts
git mv frontend/src/mocks/fixtures/procedures.ts backend/prisma/seed/data/procedures.ts
git mv frontend/src/mocks/fixtures/reviews.ts backend/prisma/seed/data/reviews.ts
```

옮긴 파일들이 `@/types/domain` 을 import 하고 있다. 백엔드에서는 그 경로가 없으므로 **타입 import 를 지역 타입으로 바꾸거나** `prisma/tsconfig.seed.json` 의 경로 별칭을 유지한다. 별칭 유지가 변경이 적다.

`backend/prisma/seed/fixtures.ts` 의 해당 4줄을 `./data/*` 로 바꾸고, 나머지 5개(`consultRequests`·`notifications`·`qaPosts`·`guides`·`promotions`)는 **그대로 둔다** — 조각 2~4 가 각자 옮긴다. 파일 상단 주석에 이 상태를 적는다.

- [ ] **Step 4: mockDb 에서 두 테이블 제거**

`Tables` 에서 `hospitals`·`doctors` 를 지우고 `SEEDS`·`LEGACY_SOURCES` 의 해당 항목도 지운다. `consultRequests`·`communityPosts`·`notifications` 세 개는 남는다.

- [ ] **Step 5: 양쪽 게이트 실행**

```bash
cd backend && npm run prisma:seed && npm run lint && npm run typecheck && npm run test:run
cd ../frontend && npm run lint && npm run typecheck && npm run test:run && npm run build
```

시드가 통과해야 한다 — 이동 후 경로가 틀리면 여기서 잡힌다.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "refactor: move hospital/doctor fixtures to the backend seed

DB 가 원본이 됐으므로 fixture 소유권을 옮긴다. 순서가 중요하다 — 백엔드 시드가
프론트 fixture 를 import 하고 있어서, 프론트 교체가 끝나기 전에 옮기면 시드가
깨진다.

조각 2~4 가 쓰는 fixture 5개(consultRequests·notifications·qaPosts·guides·
promotions)는 그대로 둔다. 각 조각이 같은 절차로 옮긴다.

mockDb 에는 세 테이블이 남는다."
```

---

## Task 21: 문서 갱신과 QA

**Files:**
- Modify: `docs/features/known-issues.md`
- Modify: `docs/superpowers/plans/2026-08-12-frontend-stack-alignment.md`
- Modify: `AGENTS.md`, `backend/README.md`
- Modify: `docs/api/openapi.yaml` (`x-screen-status`)

- [ ] **Step 1: known-issues 갱신**

해소된 항목을 지운다 (스펙 §9):

- 🟡 전문의 이름을 비우고 저장하면 삭제됨
- 🟡 인증된 전문의의 전공을 바꿔도 재검수되지 않음
- 🟡 대표 이미지를 바꿔도 병원 상세 사진이 그대로
- 🟡 병원 목록·전문의 검수 목록이 0건일 때 빈 화면
- 🟡 검수 목록에 `일반의` 포함
- 개발자 메모: 비반응형 `getHospitalById()` 3곳, 병원/전문의 저장소 갈라짐

**부분 해소로 남기는 것:** 🟡 "전문의 승인/반려 결과가 병원에 통보되지 않습니다" — 알림 행은 생기고, 화면 표시는 조각 2 에서 완성된다. 이 상태를 문구에 적는다.

- [ ] **Step 2: 계획 문서 갱신**

`2026-08-12-frontend-stack-alignment.md` 의 Task 4·5 에 "이 문서의 조각 1 이 대체함" 을 적는다.

- [ ] **Step 3: `x-screen-status` 갱신**

이 조각이 구현한 15개 오퍼레이션의 `x-screen-status` 를 🟡(샘플 데이터) → ✅ 로 바꾼다.

- [ ] **Step 4: 백엔드 README 갱신**

"아직 없는 것 (다음 Task 로 넘김)" 절에서 이 조각이 채운 것을 빼고, 남은 도메인(조각 2~4)을 적는다. 구조 절에 새 모듈 4개를 더한다.

- [ ] **Step 5: QA (CLAUDE.md 규칙 — 통과 전에는 완료가 아니다)**

`qa-master` 에이전트를 호출해 **실제 동작까지** 검증한다:

- **필터/검색** — 조건 칩 5개를 각각 켜고 끌 때 목록이 실제로 바뀌는가. `총 N곳` 이 맞는가. 모드를 `의사` 로 바꿔도 조건이 유지되는가
- **폼 제출** — 병원 등록·수정이 저장되는가. 전문의 이름을 비우고 저장하면 거절되는가. 광고 필드를 보내면 원인이 화면에 보이는가
- **관리자 수정이 사용자 화면에 반영되는가** — 이 조각의 존재 이유다. 관리자에서 병원 소개를 바꾸고 사용자 화면 새로고침
- **인가** — `admin-h1` 계정으로 로그인해 `/admin/hospital/h2` 주소로 직접 들어가면 막히는가. `/admin/specialists` 가 운영자가 아니면 막히는가
- **검수** — 운영자가 승인/반려하면 상태가 바뀌는가. 승인된 전문의의 전공을 바꾸면 `pending` 으로 돌아가는가
- **평점 잠금** — 로그아웃 상태에서 전문의 상세의 평점이 응답에 없는가 (개발자 도구 네트워크 탭 확인)

**사전 확인 항목:** 시드 데이터에 `verifiedSpecialty !== specialty` 인 전문의가 있으면 배지가 사라져 보인다. 의도된 변화이므로 QA 전에 해당 행을 확인하고 결과에 적는다.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "docs: record what the hospital/doctor domain cut resolved

known-issues 🟡 5건과 개발자 메모 2건이 해소됐다. '검수 결과가 병원에 통보되지
않음' 은 부분 해소로 남긴다 — 알림 행은 생기고 화면 표시는 조각 2 에서 완성된다."
```

---

## 실행 순서 요약

```
백엔드 (반응형 작업과 겹치지 않는다 — 먼저 해도 된다)
  Task 1   시술 목록 — 모듈 패턴 확립
  Task 3   스폰서 계산          ← Task 2 보다 먼저 (2가 3을 쓴다)
  Task 2   병원 투영
  Task 4   거리 계산
  Task 5   페이지네이션 헬퍼
  Task 6   GET /hospitals · /hospitals/{id}
  Task 7   전문의 투영
  Task 8   전문의 조회 3개
  Task 9   후기 조회
  Task 10  병원 등록·수정 + 인가
  Task 11  GET /admin/hospitals
  Task 12  전문의 교체·수정·삭제
  Task 13  전문의 검수
  Task 14  이식성 정적 검사

프론트엔드 (반응형 레이아웃 작업이 커밋된 뒤 시작)
  Task 15  도메인 타입 + 병원 api HTTP 교체
  Task 16  procedure feature
  Task 17  doctor · review feature
  Task 18  탐색 화면 서버 필터
  Task 19  관리자 화면 4개
  Task 20  스토어·유틸·fixture 정리
  Task 21  문서 갱신 + QA
```

## 다음 조각

| 조각 | 내용 | 이 조각이 남긴 연결점 |
|---|---|---|
| 2 | 찜·상담접수·알림 | 검수가 만든 알림 행을 읽는 API |
| 3 | 관리자 상담 처리 | `@HospitalScope({ resource: 'consultRequest' })` 가 이미 준비돼 있다 |
| 4 | 커뮤니티·콘텐츠·검색 | `mockDb` 의 남은 테이블 3개 |
