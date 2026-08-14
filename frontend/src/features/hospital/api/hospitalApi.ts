import { apiRequest } from '@/lib/apiClient';
import type { DoctorUpsertInput } from '@/features/doctor/api/doctorApi';
import { toSearchParams } from '@/lib/searchParams';
import type {
  BusinessHourEntry,
  Hospital,
  HospitalFeatures,
  ManagedHospitalsResponse,
  Paged,
  PriceRange,
  ProcedureId,
} from '@/types/domain';

/**
 * 병원 조회·쓰기 전부 실제 백엔드를 부른다
 * (`GET /hospitals`, `GET /hospitals/:id`, `POST /hospitals`, `PATCH /hospitals/:id`,
 * `GET /admin/hospitals`).
 */
export type HospitalFilters = {
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
};

export function fetchHospitals(filters: HospitalFilters = {}): Promise<Paged<Hospital>> {
  return apiRequest<Paged<Hospital>>(`/hospitals${toSearchParams(filters)}`);
}

/**
 * 없는 병원은 `null` 이 아니라 `404 HOSPITAL_NOT_FOUND`(`ApiError`)를 던진다.
 * 소비자는 `isApiError(error) && error.code === 'HOSPITAL_NOT_FOUND'` 로 "없음"을 분기한다.
 */
export function fetchHospitalById(id: string): Promise<Hospital> {
  return apiRequest<Hospital>(`/hospitals/${encodeURIComponent(id)}`);
}

/**
 * 관리자 병원 폼이 다루는 필드. `HospitalCreateRequest`/`HospitalUpdateRequest` 와 같은
 * 필드 집합이다 (id·집계·광고 필드·`sponsorship`·`representativeSpecialty` 제외).
 *
 * `isRecommended` 만 optional 이다 — **`operator` 만 이 키를 보낼 수 있다.** `hospital_admin`
 * 은 이 키를 아예 생략해야 한다. 보내면(값이 같아도) `422 FIELD_NOT_WRITABLE` 로 거절된다.
 */
export interface HospitalWriteInput {
  name: string;
  specialty: string;
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  thumbnail: string;
  introduction: string;
  priceRange: PriceRange;
  tags: string[];
  procedureIds: ProcedureId[];
  consultAvailable: boolean;
  isOneDay: boolean;
  isRecommended?: boolean;
  businessHours: BusinessHourEntry[];
  directions: string;
  features: HospitalFeatures;
}

export type ManagedHospitalFilters = {
  page?: number;
  pageSize?: number;
  q?: string;
};

/**
 * `operator` 전용. `doctors` 를 함께 보내면 병원 등록과 소속 전문의 등록이 **한 요청**으로
 * 끝난다 — 등록 화면(새 병원)은 아직 `hospitalId` 가 없어 두 요청으로 나누면 중간 실패 시
 * 전문의 없는 병원이 남는다. 수정 화면은 이 원자성이 없다(`PATCH` + `PUT` 두 호출).
 */
export function createHospital(input: HospitalWriteInput & { doctors?: DoctorUpsertInput[] }): Promise<Hospital> {
  return apiRequest<Hospital>('/hospitals', { method: 'POST', body: input });
}

/** 부분 수정. 인가: `hospital_admin` 은 담당 병원만 (`403 HOSPITAL_NOT_MANAGED`), `operator` 는 전체. */
export function updateHospital(id: string, input: HospitalWriteInput): Promise<Hospital> {
  return apiRequest<Hospital>(`/hospitals/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

/**
 * `/admin` 병원 목록. 응답의 `scope` 로 빈 목록 문구를 가른다 — `managed`(담당 병원만) vs
 * `all`(전 병원). `GET /hospitals` 와 분리된 이유는 openapi 참고.
 */
export function fetchManagedHospitals(filters: ManagedHospitalFilters = {}): Promise<ManagedHospitalsResponse> {
  return apiRequest<ManagedHospitalsResponse>(`/admin/hospitals${toSearchParams(filters)}`);
}
