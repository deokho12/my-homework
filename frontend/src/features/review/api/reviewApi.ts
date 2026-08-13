import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import type { Paged, Review } from '@/types/domain';

export type ReviewFilters = {
  page?: number;
  pageSize?: number;
  procedureId?: string;
};

/**
 * 없는 병원은 `404 HOSPITAL_NOT_FOUND`(`ApiError`)를 던진다 — 경로 소유자가 병원이라
 * `fetchHospitalDoctors` 와 같은 코드다. `Review.createdAt` 은 날짜만(`YYYY-MM-DD`)이다.
 */
export function fetchHospitalReviews(hospitalId: string, filters: ReviewFilters = {}): Promise<Paged<Review>> {
  return apiRequest<Paged<Review>>(`/hospitals/${encodeURIComponent(hospitalId)}/reviews${toSearchParams(filters)}`);
}
