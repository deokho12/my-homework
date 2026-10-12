import { useQuery } from '@tanstack/react-query';

import { fetchMyInquiries, type MyInquiryFilters } from '@/features/inquiry/api/inquiryApi';
import { queryKeys } from '@/lib/queryKeys';

/** 마이페이지 `내 문의` 탭. `GET /me/inquiries`. */
export function useMyInquiries(filters: MyInquiryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.inquiries.mine(filters),
    queryFn: () => fetchMyInquiries(filters),
  });
}
