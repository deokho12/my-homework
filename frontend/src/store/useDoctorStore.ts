import AsyncStorage from '@/lib/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { doctors as seedDoctors } from '@/mocks/fixtures/doctors';
import type { Doctor } from '@/types/domain';

interface DoctorState {
  doctors: Doctor[];
  addDoctor: (doctor: Doctor) => void;
  updateDoctor: (id: string, patch: Partial<Doctor>) => void;
  removeDoctor: (id: string) => void;
  setVerification: (id: string, status: 'approved' | 'rejected', rejectionReason?: string | null) => void;
}

export const useDoctorStore = create<DoctorState>()(
  persist(
    (set) => ({
      doctors: seedDoctors,
      addDoctor: (doctor) => set((state) => ({ doctors: [...state.doctors, doctor] })),
      updateDoctor: (id, patch) =>
        set((state) => ({
          doctors: state.doctors.map((doctor) => (doctor.id === id ? { ...doctor, ...patch } : doctor)),
        })),
      removeDoctor: (id) => set((state) => ({ doctors: state.doctors.filter((doctor) => doctor.id !== id) })),
      setVerification: (id, status, rejectionReason = null) =>
        set((state) => ({
          doctors: state.doctors.map((doctor) =>
            doctor.id === id
              ? { ...doctor, verificationStatus: status, rejectionReason: status === 'rejected' ? rejectionReason : null }
              : doctor
          ),
        })),
    }),
    {
      name: 'molarmolar-doctors',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function getDoctorsByHospital(hospitalId: string) {
  return useDoctorStore.getState().doctors.filter((doctor) => doctor.hospitalId === hospitalId);
}
