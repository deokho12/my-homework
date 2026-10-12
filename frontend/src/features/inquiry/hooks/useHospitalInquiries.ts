import { useQuery } from '@tanstack/react-query';

import { fetchHospitalInquiries, type HospitalInquiryFilters } from '@/features/inquiry/api/inquiryApi';
import { queryKeys } from '@/lib/queryKeys';

/** 관리자 문의 화면의 목록. `GET /hospital-inquiries`. 상태 필터는 **서버 필터**다. */
export function useHospitalInquiries(filters: HospitalInquiryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.inquiries.admin(filters),
    queryFn: () => fetchHospitalInquiries(filters),
  });
}
