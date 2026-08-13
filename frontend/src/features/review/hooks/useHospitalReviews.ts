import { useQuery } from '@tanstack/react-query';

import { fetchHospitalReviews, type ReviewFilters } from '@/features/review/api/reviewApi';
import { queryKeys } from '@/lib/queryKeys';

export function useHospitalReviews(hospitalId: string | undefined, filters: ReviewFilters = {}) {
  return useQuery({
    queryKey: queryKeys.reviews.byHospital(hospitalId ?? '', filters),
    queryFn: () => fetchHospitalReviews(hospitalId as string, filters),
    enabled: Boolean(hospitalId),
  });
}
