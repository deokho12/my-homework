import { useQuery } from '@tanstack/react-query';

import { fetchHospitalInquirySummary } from '@/features/inquiry/api/inquiryApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 문의 현황 요약. `GET /hospital-inquiries/summary`.
 *
 * **관리자 문의 화면의 탭 숫자와 관리자 홈 입구가 같은 응답을 쓴다** — 두 화면이 서로 다른
 * 숫자를 보여줄 자리를 없앤다.
 */
export function useInquirySummary(hospitalId?: string) {
  return useQuery({
    queryKey: queryKeys.inquiries.summary(hospitalId),
    queryFn: () => fetchHospitalInquirySummary(hospitalId),
  });
}
