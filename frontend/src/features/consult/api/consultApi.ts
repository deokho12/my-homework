import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import type {
  ConsultRequest,
  ConsultStatus,
  MyConsultRequest,
  Paged,
  ProcedureId,
} from '@/types/domain';

/**
 * 상담 API. **관리자 시야와 신청자 시야가 다른 타입이다** — 관리자 응답에만
 * `memos` 와 처리자 이름이 있다. 서버가 그렇게 나눠 보내므로 화면이 걸러낼 필요가 없다.
 */

export interface CreateConsultRequestInput {
  hospitalId: string;
  doctorId?: string | null;
  procedureId?: ProcedureId | null;
  name: string;
  /** 하이픈은 있어도 없어도 된다. 서버가 `010-1234-5678` 로 정규화해 저장한다. */
  phone: string;
  preferredTime: string;
  message?: string;
}

/**
 * 상담 신청. 서버가 상담 마감(`409 CONSULT_CLOSED`)·전문의 소속
 * (`422 DOCTOR_NOT_AT_HOSPITAL`)·취급 시술(`422 PROCEDURE_NOT_OFFERED`)·연락처 형식을
 * 검사한다 — 화면 검사는 남기되 권위는 서버다.
 */
export async function createConsultRequest(input: CreateConsultRequestInput): Promise<MyConsultRequest> {
  return apiRequest<MyConsultRequest>('/consult-requests', { method: 'POST', body: input });
}

/* --------------------------------------------------------------------- 신청자 */

export interface ListMyConsultRequestsParams {
  page?: number;
  pageSize?: number;
  status?: ConsultStatus;
}

export async function fetchMyConsultRequests(
  params: ListMyConsultRequestsParams = {}
): Promise<Paged<MyConsultRequest>> {
  return apiRequest<Paged<MyConsultRequest>>(`/me/consult-requests${toSearchParams({ ...params })}`);
}

export async function fetchMyConsultRequest(id: string): Promise<MyConsultRequest> {
  return apiRequest<MyConsultRequest>(`/me/consult-requests/${encodeURIComponent(id)}`);
}

/* --------------------------------------------------------------------- 관리자 */

export interface ListConsultRequestsParams {
  page?: number;
  pageSize?: number;
  /** `전체` 는 이 값을 보내지 않는 것이다. */
  status?: ConsultStatus;
  hospitalId?: string;
}

export interface AdminConsultListResponse extends Paged<ConsultRequest> {
  /** `managed` 면 담당 병원만, `all` 이면 전 병원. 화면이 빈 목록의 이유를 구분한다. */
  scope: 'managed' | 'all';
}

export async function fetchConsultRequests(
  params: ListConsultRequestsParams = {}
): Promise<AdminConsultListResponse> {
  return apiRequest<AdminConsultListResponse>(`/consult-requests${toSearchParams({ ...params })}`);
}

export async function fetchConsultRequest(id: string): Promise<ConsultRequest> {
  return apiRequest<ConsultRequest>(`/consult-requests/${encodeURIComponent(id)}`);
}

export interface ConsultSummary {
  newThisMonth: number;
  pending: number;
  /** 달 경계 계산에 쓴 시간대. 화면이 기준을 표시할 수 있게 서버가 명시한다. */
  timezone: string;
  calculatedAt: string;
}

export async function fetchConsultSummary(): Promise<ConsultSummary> {
  return apiRequest<ConsultSummary>('/consult-requests/summary');
}

/** 같은 상태를 다시 보내도 서버가 아무 일도 하지 않는다(멱등). 오탭이 실패로 보이지 않는다. */
export async function updateConsultStatus(id: string, status: ConsultStatus): Promise<ConsultRequest> {
  return apiRequest<ConsultRequest>(`/consult-requests/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export async function addConsultMemo(id: string, content: string): Promise<ConsultRequest> {
  return apiRequest<ConsultRequest>(`/consult-requests/${encodeURIComponent(id)}/memos`, {
    method: 'POST',
    body: { content },
  });
}
