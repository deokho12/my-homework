import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ConsultRequest } from '@/types/domain';

interface ConsultState {
  requests: ConsultRequest[];
  addRequest: (request: Omit<ConsultRequest, 'id' | 'createdAt'>) => void;
}

export const useConsultStore = create<ConsultState>()(
  persist(
    (set) => ({
      requests: [],
      addRequest: (request) =>
        set((state) => ({
          requests: [
            {
              ...request,
              id: `consult-${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
            ...state.requests,
          ],
        })),
    }),
    {
      name: 'molarmolar-consult-requests',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
