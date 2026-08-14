export {
  createHospital,
  fetchHospitalById,
  fetchHospitals,
  fetchManagedHospitals,
  updateHospital,
  type HospitalFilters,
  type HospitalWriteInput,
  type ManagedHospitalFilters,
} from '@/features/hospital/api/hospitalApi';
export { useCreateHospital } from '@/features/hospital/hooks/useCreateHospital';
export { useHospital } from '@/features/hospital/hooks/useHospital';
export { useHospitals } from '@/features/hospital/hooks/useHospitals';
export { useManagedHospitals } from '@/features/hospital/hooks/useManagedHospitals';
export { useUpdateHospital } from '@/features/hospital/hooks/useUpdateHospital';
