import { useQuery } from '@tanstack/react-query';

import { fetchHospitalDoctors } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

export function useHospitalDoctors(hospitalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.doctors.byHospital(hospitalId ?? ''),
    queryFn: () => fetchHospitalDoctors(hospitalId as string),
    enabled: Boolean(hospitalId),
  });
}
