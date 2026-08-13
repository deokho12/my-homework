import { useQuery } from '@tanstack/react-query';

import { fetchDoctors, type DoctorFilters } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

export function useDoctors(filters: DoctorFilters = {}) {
  return useQuery({
    queryKey: queryKeys.doctors.list(filters),
    queryFn: () => fetchDoctors(filters),
  });
}
