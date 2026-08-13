import { createId } from '@paralleldrive/cuid2';

import { ApiError } from '../common/errors/api-error';
import { DAY_LABELS } from './hospital.projection';
import {
  OPERATOR_ONLY_HOSPITAL_FIELDS,
  READONLY_HOSPITAL_FIELDS,
} from './hospital.schemas';
import type { CreateHospitalDto, UpdateHospitalDto } from './hospital.schemas';

/**
 * 병원 쓰기 경로의 순수 변환 로직 (DB 접근 없음). 서비스가 조립하고 리포지토리가
 * 그대로 Prisma 에 넘긴다 — 리포지토리를 열지 않고도 이 변환을 단위 테스트할 수 있다.
 */

/**
 * 요일 라벨 → `dayOfWeek`(1=월 … 7=일).
 *
 * `BusinessHour` 에는 라벨 컬럼이 없다 — 정수만 저장하고 라벨은 읽기 경로
 * (`hospital.projection.ts`)가 만든다. 이 함수가 쓰기 경로의 역변환이다.
 *
 * zod 스키마가 이미 `day` 를 `z.enum([...DAY_LABELS])` 로 제한하므로 이 throw 는
 * 스키마를 통과한 뒤에는 도달하지 않는 방어선이다 — 그래도 둔다(스키마가 느슨해지면
 * 조용히 0이 들어가는 것을 막는다).
 */
export function dayOfWeekFromLabel(label: string): number {
  const index = DAY_LABELS.indexOf(label as (typeof DAY_LABELS)[number]);

  if (index === -1) {
    throw new ApiError('VALIDATION_FAILED', {
      details: [{ field: 'businessHours', code: 'invalid_day', message: '요일이 올바르지 않아요' }],
    });
  }

  return index + 1;
}

/**
 * 쓰기 금지 필드 검사. **역할을 알아야 하므로 zod 가 아니라 여기서 한다** —
 * `isRecommended` 는 운영자에게만 허용된다.
 *
 * `body` 는 zod 통과 전 원본을 받는다. zod 가 모르는 키를 떨어뜨리면 "보냈는데
 * 거절되지 않는" 구멍이 생기기 때문이다.
 */
export function assertWritableHospitalFields(body: Record<string, unknown>, role: string): void {
  const blocked: string[] = READONLY_HOSPITAL_FIELDS.filter((field) => field in body);

  if (role !== 'operator') {
    blocked.push(...OPERATOR_ONLY_HOSPITAL_FIELDS.filter((field) => field in body));
  }

  if (blocked.length > 0) {
    throw new ApiError('FIELD_NOT_WRITABLE', {
      details: blocked.map((field) => ({ field, code: 'not_writable', message: '수정할 수 없는 항목이에요' })),
    });
  }
}

/** `Hospital` 실 컬럼 중 이 엔드포인트가 쓸 수 있는 스칼라 필드. 생성·수정이 공유한다. */
export interface HospitalScalarFields {
  name?: string;
  nameNormalized?: string;
  specialty?: string;
  region?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  thumbnail?: string;
  introduction?: string;
  directions?: string;
  priceMin?: number;
  priceMax?: number;
  consultAvailable?: boolean;
  isOneDay?: boolean;
  isRecommended?: boolean;
  featureCoordinator?: boolean;
  featurePainlessAnesthesia?: boolean;
  featureDigitalCare?: boolean;
  featureParking?: boolean;
  featureNightConsult?: boolean;
  featureCctv?: boolean;
}

/** `PATCH` — 보낸 키만 채운다. 부분 수정에서 보내지 않은 필드는 건드리지 않는다. */
export function buildScalarChanges(dto: UpdateHospitalDto): HospitalScalarFields {
  const changes: HospitalScalarFields = {};

  if (dto.name !== undefined) {
    changes.name = dto.name;
    // Global Constraints — name 을 건드리는 모든 경로에서 채운다
    changes.nameNormalized = dto.name.trim().toLowerCase();
  }
  if (dto.specialty !== undefined) changes.specialty = dto.specialty;
  if (dto.region !== undefined) changes.region = dto.region;
  if (dto.address !== undefined) changes.address = dto.address;
  if (dto.latitude !== undefined) changes.latitude = dto.latitude;
  if (dto.longitude !== undefined) changes.longitude = dto.longitude;
  if (dto.thumbnail !== undefined) changes.thumbnail = dto.thumbnail;
  if (dto.introduction !== undefined) changes.introduction = dto.introduction;
  if (dto.directions !== undefined) changes.directions = dto.directions;
  if (dto.priceRange !== undefined) {
    changes.priceMin = dto.priceRange.min;
    changes.priceMax = dto.priceRange.max;
  }
  if (dto.consultAvailable !== undefined) changes.consultAvailable = dto.consultAvailable;
  if (dto.isOneDay !== undefined) changes.isOneDay = dto.isOneDay;
  // isRecommended 는 `assertWritableHospitalFields` 가 이미 운영자 전용임을 확인했다
  if (dto.isRecommended !== undefined) changes.isRecommended = dto.isRecommended;
  if (dto.features !== undefined) {
    changes.featureCoordinator = dto.features.coordinator;
    changes.featurePainlessAnesthesia = dto.features.painlessAnesthesia;
    changes.featureDigitalCare = dto.features.digitalCare;
    changes.featureParking = dto.features.parking;
    changes.featureNightConsult = dto.features.nightConsult;
    changes.featureCctv = dto.features.cctv;
  }

  return changes;
}

/**
 * `POST /hospitals` 전용. `createHospitalSchema` 가 강제하는 필수 필드는 여기서도
 * 필수로 둔다 — `HospitalScalarFields`(전부 optional, `PATCH` 용)를 재사용하면 리포지토리가
 * "없으면 빈 문자열" 같은 가짜 기본값을 만들어야 해서 따로 둔다.
 */
export interface HospitalCreateFields {
  name: string;
  nameNormalized: string;
  specialty?: string;
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  thumbnail: string;
  introduction?: string;
  directions?: string;
  priceMin: number;
  priceMax: number;
  consultAvailable?: boolean;
  isOneDay?: boolean;
  featureCoordinator?: boolean;
  featurePainlessAnesthesia?: boolean;
  featureDigitalCare?: boolean;
  featureParking?: boolean;
  featureNightConsult?: boolean;
  featureCctv?: boolean;
}

export function buildCreateFields(dto: CreateHospitalDto): HospitalCreateFields {
  return {
    name: dto.name,
    nameNormalized: dto.name.trim().toLowerCase(),
    specialty: dto.specialty,
    region: dto.region,
    address: dto.address,
    latitude: dto.latitude,
    longitude: dto.longitude,
    thumbnail: dto.thumbnail,
    introduction: dto.introduction,
    directions: dto.directions,
    priceMin: dto.priceRange.min,
    priceMax: dto.priceRange.max,
    consultAvailable: dto.consultAvailable,
    isOneDay: dto.isOneDay,
    ...(dto.features
      ? {
          featureCoordinator: dto.features.coordinator,
          featurePainlessAnesthesia: dto.features.painlessAnesthesia,
          featureDigitalCare: dto.features.digitalCare,
          featureParking: dto.features.parking,
          featureNightConsult: dto.features.nightConsult,
          featureCctv: dto.features.cctv,
        }
      : {}),
  };
}

/**
 * 자식 테이블(`procedures`·`images`·`tags`·`eventNotes`·`businessHours`) 쓰기 행.
 *
 * 각 필드는 **dto 에 그 키가 있을 때만** 채워진다(`undefined` = 안 건드림). 리포지토리는
 * `undefined` 인 자식은 `deleteMany`/`createMany` 를 하지 않는다 — `PATCH` 로
 * `introduction` 만 보냈는데 태그가 지워지면 안 되기 때문이다.
 */
export interface HospitalChildRows {
  procedures?: { id: string; hospitalId: string; procedureId: string }[];
  images?: { id: string; hospitalId: string; url: string; sortOrder: number }[];
  tags?: { id: string; hospitalId: string; tag: string; tagNormalized: string }[];
  eventNotes?: { id: string; hospitalId: string; content: string; sortOrder: number }[];
  businessHours?: { id: string; hospitalId: string; dayOfWeek: number; hours: string; isClosed: boolean }[];
}

export function buildChildRows(hospitalId: string, dto: UpdateHospitalDto): HospitalChildRows {
  const rows: HospitalChildRows = {};

  if (dto.procedureIds !== undefined) {
    rows.procedures = dto.procedureIds.map((procedureId) => ({ id: createId(), hospitalId, procedureId }));
  }

  if (dto.images !== undefined) {
    rows.images = dto.images.map((url, index) => ({ id: createId(), hospitalId, url, sortOrder: index }));
  }

  if (dto.tags !== undefined) {
    rows.tags = dto.tags.map((tag) => ({
      id: createId(),
      hospitalId,
      tag,
      // Global Constraints — HospitalTag 유니크가 (hospitalId, tagNormalized) 다
      tagNormalized: tag.trim().toLowerCase(),
    }));
  }

  if (dto.events !== undefined) {
    rows.eventNotes = dto.events.map((content, index) => ({ id: createId(), hospitalId, content, sortOrder: index }));
  }

  if (dto.businessHours !== undefined) {
    rows.businessHours = dto.businessHours.map((item) => ({
      id: createId(),
      hospitalId,
      dayOfWeek: dayOfWeekFromLabel(item.day),
      hours: item.hours,
      isClosed: item.isClosed ?? false,
    }));
  }

  return rows;
}
