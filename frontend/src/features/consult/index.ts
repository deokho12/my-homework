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
export {
  ConsultRequestComplete,
  type CompletedConsult,
} from '@/features/consult/components/ConsultRequestComplete';
export { ConsultRequestForm, type ProcedureChoice } from '@/features/consult/components/ConsultRequestForm';
export { THIRD_PARTY_CONSENT_NOTICE_VERSION } from '@/features/consult/content/thirdPartyConsentNotice';
export type { ConsultRequestFormInput } from '@/features/consult/schemas/consultRequestSchema';
