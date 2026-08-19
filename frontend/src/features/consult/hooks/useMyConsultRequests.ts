import { useQuery } from '@tanstack/react-query';

import { fetchMyConsultRequests, type ConsultRequestFilters } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 내 상담 신청 내역. `GET /me/consult-requests`.
 *
 * 관리자 목록(`useConsultRequests`)과 **다른 투영**이다 — 내부 메모가 없고 병원 이름이
 * 함께 온다. 알림함이 `상담 상태 변경` 알림을 눌렀을 때 어느 병원으로 보낼지 여기서 찾는다.
 */
export function useMyConsultRequests(filters: ConsultRequestFilters = {}) {
  return useQuery({
    queryKey: queryKeys.consultRequests.mine(filters),
    queryFn: () => fetchMyConsultRequests(filters),
  });
}
