import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import { mockDb } from '@/mocks/db';
import { delay } from '@/mocks/latency';
import type { Hospital, Paged } from '@/types/domain';

/**
 * 병원 조회는 실제 백엔드(`GET /hospitals`, `GET /hospitals/:id`)를 부른다.
 * 등록·수정은 아직 `mockDb` 를 쓴다 — 관리자 화면이 이관되는 나중 Task 에서 함께 바뀐다.
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

export async function createHospital(hospital: Hospital): Promise<Hospital> {
  await delay();
  mockDb.write('hospitals', [...mockDb.read('hospitals'), hospital]);
  return hospital;
}

export async function updateHospital(id: string, patch: Partial<Hospital>): Promise<Hospital> {
  await delay();

  const rows = mockDb.read('hospitals');
  const index = rows.findIndex((hospital) => hospital.id === id);

  if (index === -1) throw new Error(`병원을 찾을 수 없어요: ${id}`);

  const updated = { ...rows[index], ...patch };
  // Array.prototype.with 은 ES2023 이고 이 프로젝트의 tsconfig lib 은 ES2022 다 — 쓰지 않는다.
  const next = [...rows];
  next[index] = updated;
  mockDb.write('hospitals', next);

  return updated;
}
