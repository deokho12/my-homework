import AsyncStorage from '@/lib/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { consultRequests as seedConsultRequests } from '@/data/consultRequests';
import { notifyAdmin, notifyUser } from '@/services/notifications';
import { CONSULT_STATUS_LABEL, type ConsultRequest, type ConsultStatus } from '@/types/domain';

interface ConsultState {
  requests: ConsultRequest[];
  addRequest: (request: Omit<ConsultRequest, 'id' | 'createdAt' | 'status' | 'statusHistory' | 'memos'>) => void;
  updateStatus: (id: string, status: ConsultStatus) => void;
  addMemo: (id: string, content: string) => void;
}

export const useConsultStore = create<ConsultState>()(
  persist(
    (set) => ({
      requests: seedConsultRequests,
      addRequest: (request) => {
        const id = `consult-${Date.now()}`;
        const now = new Date().toISOString();

        set((state) => ({
          requests: [
            {
              ...request,
              id,
              createdAt: now,
              status: 'new',
              statusHistory: [{ status: 'new', changedAt: now }],
              memos: [],
            },
            ...state.requests,
          ],
        }));

        notifyAdmin({
          type: 'consult-status',
          title: '새로운 상담 신청',
          message: `${request.name}님이 상담을 신청했어요`,
          relatedId: id,
        });
      },
      updateStatus: (id, status) => {
        const now = new Date().toISOString();

        set((state) => ({
          requests: state.requests.map((request) =>
            request.id === id
              ? {
                  ...request,
                  status,
                  statusHistory: [...request.statusHistory, { status, changedAt: now }],
                }
              : request
          ),
        }));

        notifyUser({
          type: 'consult-status',
          title: '상담 상태 변경',
          message: `상담 상태가 '${CONSULT_STATUS_LABEL[status]}'(으)로 변경되었어요`,
          relatedId: id,
        });
      },
      addMemo: (id, content) => {
        const memo = { id: `memo-${Date.now()}`, content, createdAt: new Date().toISOString() };

        set((state) => ({
          requests: state.requests.map((request) =>
            request.id === id ? { ...request, memos: [...request.memos, memo] } : request
          ),
        }));
      },
    }),
    {
      name: 'molarmolar-consult-requests',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
