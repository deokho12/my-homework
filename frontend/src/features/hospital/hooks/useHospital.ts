import { useQuery } from '@tanstack/react-query';

import { fetchHospitalById } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

export function useHospital(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hospitals.detail(id ?? ''),
    queryFn: () => fetchHospitalById(id as string),
    enabled: Boolean(id),
  });
}
