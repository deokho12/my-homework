import AsyncStorage from '@/lib/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FavoritesState {
  hospitalIds: string[];
  isFavorite: (hospitalId: string) => boolean;
  toggleFavorite: (hospitalId: string) => void;
  /**
   * 로그아웃 시 비운다. 찜이 계정과 연결되어 있지 않아, 비우지 않으면 다음 로그인 계정에
   * 앞 사람의 찜이 그대로 보인다 (`useAuthStore` 의 `clearAccountScopedState` 주석 참고).
   */
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      hospitalIds: [],
      isFavorite: (hospitalId) => get().hospitalIds.includes(hospitalId),
      toggleFavorite: (hospitalId) =>
        set((state) => ({
          hospitalIds: state.hospitalIds.includes(hospitalId)
            ? state.hospitalIds.filter((id) => id !== hospitalId)
            : [...state.hospitalIds, hospitalId],
        })),
      clear: () => set({ hospitalIds: [] }),
    }),
    {
      name: 'molarmolar-favorites',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
