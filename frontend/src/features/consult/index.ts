export {
  addConsultMemo,
  createConsultRequest,
  fetchConsultRequestById,
  fetchConsultRequests,
  fetchConsultSummary,
  fetchMyConsultRequests,
  updateConsultStatus,
  type AdminConsultRequest,
  type ConsultRequestCreateInput,
  type ConsultRequestFilters,
  type ConsultRequestList,
  type ConsultScope,
  type ConsultStatusChangeView,
  type ConsultStatusCounts,
  type ConsultStatusUpdateInput,
  type ConsultSummary,
  type MyConsultRequest,
  type MyConsultRequestFilters,
} from '@/features/consult/api/consultApi';
export {
  CONSULT_DELAY_MS,
  CONSULT_STATUS_TONE,
  NO_PROCEDURE_LABEL,
  consultHistoryLine,
  consultProcedureLabel,
  consultScheduleLine,
  consultVisitLine,
  /** 문의 화면도 환자 쪽 날짜(`10/7`)를 같은 함수로 적는다 — 새로 만들지 않는다. */
  formatAppliedAt,
  formatDateTimeShort,
  formatVisitAt,
  isConsultDelayed,
  procedurePairLabel,
  todayInSeoul,
  type ConsultScheduleLine,
} from '@/features/consult/consultDisplay';
export {
  cancelReasonOf,
  classifyEvent,
  nextVisitAt,
  periodRange,
  requiredInputs,
  truncateToMinute,
  type ConsultPeriod,
} from '@/features/consult/lib/transition';
export { AdminConsultDetail } from '@/features/consult/components/AdminConsultDetail';
export { AdminConsultFilters } from '@/features/consult/components/AdminConsultFilters';
export { AdminConsultList } from '@/features/consult/components/AdminConsultList';
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
