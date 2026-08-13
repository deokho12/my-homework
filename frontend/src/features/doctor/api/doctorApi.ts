import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import type { Doctor, Paged } from '@/types/domain';

/**
 * 전문의 조회는 실제 백엔드(`GET /doctors`, `GET /doctors/:id`, `GET /hospitals/:id/doctors`)를
 * 부른다. mutation(등록·수정·삭제·검수)은 다음 Task(관리자 화면 이관)가 병원 mutation 과
 * 함께 붙인다 — `src/store/useDoctorStore.ts` 가 그 화면들을 아직 지지한다.
 */
export type DoctorFilters = {
  page?: number;
  pageSize?: number;
  hospitalId?: string;
  procedureId?: string;
  recommended?: boolean;
  consultAvailable?: boolean;
  oneDay?: boolean;
  verifiedSpecialist?: boolean;
  nightConsult?: boolean;
  minYearsOfExperience?: number;
  sort?: 'rating' | 'reviewCount' | 'consultCount';
  q?: string;
};

export function fetchDoctors(filters: DoctorFilters = {}): Promise<Paged<Doctor>> {
  return apiRequest<Paged<Doctor>>(`/doctors${toSearchParams(filters)}`);
}

/**
 * 없는 전문의는 `null` 이 아니라 `404 DOCTOR_NOT_FOUND`(`ApiError`)를 던진다.
 * 소비자는 `isApiError(error) && error.code === 'DOCTOR_NOT_FOUND'` 로 "없음"을 분기한다.
 */
export function fetchDoctorById(id: string): Promise<Doctor> {
  return apiRequest<Doctor>(`/doctors/${encodeURIComponent(id)}`);
}

/**
 * 배열 그대로 온다 (페이지네이션 없음). 없는 병원은 `404 HOSPITAL_NOT_FOUND` 를 던진다 —
 * `useHospital` 과 같은 코드다(경로 소유자가 병원이라 그렇다).
 */
export function fetchHospitalDoctors(hospitalId: string): Promise<Doctor[]> {
  return apiRequest<Doctor[]>(`/hospitals/${encodeURIComponent(hospitalId)}/doctors`);
}
