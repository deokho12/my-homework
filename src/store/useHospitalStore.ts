import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { hospitals as seedHospitals } from '@/data/hospitals';
import type { Hospital } from '@/types/domain';

interface HospitalState {
  hospitals: Hospital[];
  addHospital: (hospital: Hospital) => void;
  updateHospital: (id: string, patch: Partial<Hospital>) => void;
}

// Admin-editable hospital directory, seeded from the static mock data.
// Swap this store's internals for real backend calls once a hospital-admin API exists.
export const useHospitalStore = create<HospitalState>()(
  persist(
    (set) => ({
      hospitals: seedHospitals,
      addHospital: (hospital) => set((state) => ({ hospitals: [...state.hospitals, hospital] })),
      updateHospital: (id, patch) =>
        set((state) => ({
          hospitals: state.hospitals.map((hospital) =>
            hospital.id === id ? { ...hospital, ...patch } : hospital
          ),
        })),
    }),
    {
      name: 'molarmolar-hospitals',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function getHospitalById(id: string) {
  return useHospitalStore.getState().hospitals.find((hospital) => hospital.id === id);
}

export function getHospitalsByProcedure(procedureId: string) {
  return useHospitalStore
    .getState()
    .hospitals.filter((hospital) =>
      hospital.procedureIds.includes(procedureId as Hospital['procedureIds'][number])
    );
}
