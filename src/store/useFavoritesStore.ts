import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FavoritesState {
  hospitalIds: string[];
  isFavorite: (hospitalId: string) => boolean;
  toggleFavorite: (hospitalId: string) => void;
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
    }),
    {
      name: 'molarmolar-favorites',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
