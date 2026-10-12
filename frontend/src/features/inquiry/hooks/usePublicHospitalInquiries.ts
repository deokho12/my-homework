import { useQuery } from '@tanstack/react-query';

import {
  fetchPublicHospitalInquiries,
  type PublicInquiryFilters,
} from '@/features/inquiry/api/inquiryApi';
import { queryKeys } from '@/lib/queryKeys';

/** 병원 상세의 공개 Q/A. `GET /hospitals/{id}/inquiries`. 로그인이 필요 없다. */
export function usePublicHospitalInquiries(hospitalId: string, filters: PublicInquiryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.inquiries.byHospital(hospitalId, filters),
    queryFn: () => fetchPublicHospitalInquiries(hospitalId, filters),
  });
}
