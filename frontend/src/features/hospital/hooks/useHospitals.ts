import { useQuery } from '@tanstack/react-query';

import { fetchHospitals } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

export function useHospitals() {
  return useQuery({
    queryKey: queryKeys.hospitals.all,
    queryFn: fetchHospitals,
  });
}
