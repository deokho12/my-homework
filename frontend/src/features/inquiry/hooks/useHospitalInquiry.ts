import { useQuery } from '@tanstack/react-query';

import { fetchHospitalInquiryById } from '@/features/inquiry/api/inquiryApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 관리자 문의 상세. `GET /hospital-inquiries/{id}`.
 *
 * 선택이 없을 때(`undefined`)는 조회하지 않는다 — 목록만 보는 화면에서 요청이 나가지 않게.
 */
export function useHospitalInquiry(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inquiries.detail(id ?? ''),
    queryFn: () => fetchHospitalInquiryById(id as string),
    enabled: id !== undefined,
  });
}
