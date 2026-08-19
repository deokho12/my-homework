export {
  addConsultMemo,
  createConsultRequest,
  fetchConsultRequestById,
  fetchConsultRequests,
  fetchConsultSummary,
  fetchMyConsultRequests,
  updateConsultStatus,
  type ConsultRequestCreateInput,
  type ConsultRequestFilters,
  type ConsultSummary,
  type MyConsultRequest,
} from '@/features/consult/api/consultApi';
export { useAddConsultMemo } from '@/features/consult/hooks/useAddConsultMemo';
export { useConsultRequest } from '@/features/consult/hooks/useConsultRequest';
export { useConsultRequests } from '@/features/consult/hooks/useConsultRequests';
export { useConsultSummary } from '@/features/consult/hooks/useConsultSummary';
export { useCreateConsultRequest } from '@/features/consult/hooks/useCreateConsultRequest';
export { useMyConsultRequests } from '@/features/consult/hooks/useMyConsultRequests';
export { useUpdateConsultStatus } from '@/features/consult/hooks/useUpdateConsultStatus';
