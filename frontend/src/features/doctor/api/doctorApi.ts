import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import type {
  DentalSpecialty,
  Doctor,
  DoctorAdminView,
  Paged,
  ProcedureId,
  VerificationQueueItem,
  VerificationStatus,
} from '@/types/domain';

/**
 * 전문의 조회·쓰기 전부 실제 백엔드를 부른다
 * (`GET /doctors`, `GET /doctors/:id`, `GET|PUT /hospitals/:id/doctors`,
 * `PATCH|DELETE /doctors/:id`, `GET /doctors/verification-queue`, `PUT /doctors/:id/verification`).
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

/**
 * 병원 폼의 전문의 한 명 (`DoctorUpsert`). `id` 가 있으면 갱신, 없으면 신규.
 *
 * ★ 함정1 — `certificateUrl` 키를 **아예 생략**하면 서버가 기존 값을 유지한다. 빈 문자열이나
 * `null` 을 보내면 "지우겠다"·"바꾸겠다"로 읽혀 재검수 규칙(`specialty`/`certificateUrl` 변경
 * → `pending` 복귀)을 건드린다 — 관리자가 실제로 입력했을 때만 이 키를 넣는다.
 */
export interface DoctorUpsertInput {
  id?: string;
  name: string;
  title?: string;
  specialty: DentalSpecialty;
  certificateUrl?: string | null;
}

/** `PATCH /doctors/{id}` (`DoctorUpdateRequest`). 전부 부분 수정 — 보낸 필드만 바뀐다. */
export interface DoctorUpdateInput {
  name?: string;
  title?: string;
  specialty?: DentalSpecialty;
  certificateUrl?: string | null;
  photo?: string;
  yearsOfExperience?: number;
  career?: string[];
  procedureIds?: ProcedureId[];
  isRecommended?: boolean;
}

export type VerificationQueueFilters = {
  page?: number;
  pageSize?: number;
  status?: VerificationStatus;
  includeGeneralPractitioners?: boolean;
};

export type VerificationDecisionInput =
  | { status: 'approved' }
  | { status: 'rejected'; rejectionReason: string };

/**
 * 병원 소속 전문의 일괄 교체. 응답은 관리자 시야(`DoctorAdminView[]`) — 방금 보낸
 * `certificateUrl` 을 그대로 확인할 수 있는 유일한 경로다 (`docs/api/openapi.yaml` 참고).
 */
export function replaceHospitalDoctors(hospitalId: string, doctors: DoctorUpsertInput[]): Promise<DoctorAdminView[]> {
  return apiRequest<DoctorAdminView[]>(`/hospitals/${encodeURIComponent(hospitalId)}/doctors`, {
    method: 'PUT',
    body: { doctors },
  });
}

/** 전문의 단건 수정. `verificationStatus` 는 여기서 바꿀 수 없다 (`decideVerification` 전용). */
export function updateDoctor(id: string, patch: DoctorUpdateInput): Promise<DoctorAdminView> {
  return apiRequest<DoctorAdminView>(`/doctors/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
}

/** 되돌릴 수 없다. */
export function deleteDoctor(id: string): Promise<void> {
  return apiRequest<void>(`/doctors/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** `operator` 전용. `/admin/specialists` 의 검수 목록. */
export function fetchVerificationQueue(filters: VerificationQueueFilters = {}): Promise<Paged<VerificationQueueItem>> {
  return apiRequest<Paged<VerificationQueueItem>>(`/doctors/verification-queue${toSearchParams(filters)}`);
}

/** `operator` 전용. 승인/반려 결정 — 반려는 `rejectionReason` 이 필수다. */
export function decideVerification(id: string, decision: VerificationDecisionInput): Promise<DoctorAdminView> {
  return apiRequest<DoctorAdminView>(`/doctors/${encodeURIComponent(id)}/verification`, {
    method: 'PUT',
    body: decision,
  });
}
