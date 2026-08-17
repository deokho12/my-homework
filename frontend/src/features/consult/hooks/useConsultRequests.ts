import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addConsultMemo,
  createConsultRequest,
  fetchConsultRequest,
  fetchConsultRequests,
  fetchConsultSummary,
  fetchMyConsultRequest,
  fetchMyConsultRequests,
  updateConsultStatus,
} from '@/features/consult/api/consultApi';
import type {
  CreateConsultRequestInput,
  ListConsultRequestsParams,
  ListMyConsultRequestsParams,
} from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/useAuthStore';
import type { ConsultStatus } from '@/types/domain';

/** 관리자 상담 화면을 열 수 있는 역할. 일반 사용자가 부르면 서버가 403 을 준다. */
function isAdminRole(role: string | undefined): boolean {
  return role === 'hospital_admin' || role === 'operator';
}

/* --------------------------------------------------------------------- 신청자 */

/**
 * 상담 신청.
 *
 * 성공하면 **관리자 쪽 캐시까지 무효화한다** — 같은 상담이 관리자 목록·요약에도
 * 나타나야 한다. 예전에는 사용자 저장소와 관리자 저장소가 갈려서 이 연결이 없었다.
 */
export function useCreateConsultRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateConsultRequestInput) => createConsultRequest(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
      // 접수되면 담당자에게 알림이 생긴다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMyConsultRequests(params: ListMyConsultRequestsParams = {}) {
  const isAuthenticated = useAuthStore((state) => state.user !== null);

  return useQuery({
    queryKey: queryKeys.consultRequests.mine(params),
    queryFn: () => fetchMyConsultRequests(params),
    enabled: isAuthenticated,
  });
}

export function useMyConsultRequest(id: string | undefined) {
  const isAuthenticated = useAuthStore((state) => state.user !== null);

  return useQuery({
    queryKey: queryKeys.consultRequests.mineDetail(id ?? ''),
    queryFn: () => fetchMyConsultRequest(id!),
    enabled: isAuthenticated && Boolean(id),
  });
}

/* --------------------------------------------------------------------- 관리자 */

export function useConsultRequests(params: ListConsultRequestsParams = {}) {
  const role = useAuthStore((state) => state.user?.role);

  return useQuery({
    queryKey: queryKeys.consultRequests.list(params),
    queryFn: () => fetchConsultRequests(params),
    enabled: isAdminRole(role),
  });
}

export function useConsultRequest(id: string | undefined) {
  const role = useAuthStore((state) => state.user?.role);

  return useQuery({
    queryKey: queryKeys.consultRequests.detail(id ?? ''),
    queryFn: () => fetchConsultRequest(id!),
    enabled: isAdminRole(role) && Boolean(id),
  });
}

/**
 * 관리자 홈의 숫자 카드. 달 경계는 서버가 `Asia/Seoul` 로 계산한다 — 기기 시계를
 * 쓰지 않는다.
 */
export function useConsultSummary() {
  const role = useAuthStore((state) => state.user?.role);

  return useQuery({
    queryKey: queryKeys.consultRequests.summary,
    queryFn: () => fetchConsultSummary(),
    enabled: isAdminRole(role),
  });
}

export function useUpdateConsultStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ConsultStatus }) => updateConsultStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
      // 상태가 실제로 바뀌면 신청자에게 알림이 간다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useAddConsultMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => addConsultMemo(id, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
    },
  });
}
