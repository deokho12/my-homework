import { useQuery } from '@tanstack/react-query';

import { fetchDoctorById } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

export function useDoctor(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.doctors.detail(id ?? ''),
    queryFn: () => fetchDoctorById(id as string),
    enabled: Boolean(id),
  });
}
