import { apiRequest } from '@/lib/apiClient';
import type { Procedure } from '@/types/domain';

/**
 * 시술 13종 마스터 데이터. 서버가 순서를 고정해 응답한다
 * (`implant → orthodontics → laminate → inlay → crown → whitening → wisdom-tooth →
 * cavity → gum-disease → splint → snoring-device → tmj → botox`). 클라이언트가 재정렬하지 않는다.
 */
export function fetchProcedures(): Promise<Procedure[]> {
  return apiRequest<Procedure[]>('/procedures');
}
