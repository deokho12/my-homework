import { useQuery } from '@tanstack/react-query';

import { fetchHospitals, type HospitalFilters } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

export function useHospitals(filters: HospitalFilters = {}) {
  return useQuery({
    queryKey: queryKeys.hospitals.list(filters),
    queryFn: () => fetchHospitals(filters),
  });
}
