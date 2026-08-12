import { create } from 'zustand';

// 임시 결합: 관리자 화면이 아직 이 스토어에 쓰고 상세 화면은 useQuery 로 읽으므로,
// 쓰기 후 쿼리 캐시를 직접 깨야 한다. Task 12 에서 관리자 화면이 hospitalApi 의
// mutation 을 쓰게 되면 이 스토어와 이 import 는 함께 사라진다.
import { queryClient } from '@/app/providers';
import { queryKeys } from '@/lib/queryKeys';
import { mockDb } from '@/mocks/db';
import type { Hospital } from '@/types/domain';

interface HospitalState {
  hospitals: Hospital[];
  addHospital: (hospital: Hospital) => void;
  updateHospital: (id: string, patch: Partial<Hospital>) => void;
}

function invalidateHospitals() {
  void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
}

/**
 * 관리자가 편집하는 병원 목록. 영속화는 `mockDb` 가 맡는다 — zustand persist 를
 * 쓰면 `molarmolar-hospitals` 와 `molarmolar-mockdb-hospitals` 두 저장소가 갈라져,
 * 관리자 수정이 상세 화면(`hospitalApi` → `mockDb`)에 영원히 반영되지 않는다.
 * 저장소를 하나로 두어 불일치가 생길 수 없게 한다.
 */
export const useHospitalStore = create<HospitalState>()((set) => ({
  hospitals: mockDb.read('hospitals'),

  addHospital: (hospital) => {
    const next = [...mockDb.read('hospitals'), hospital];
    mockDb.write('hospitals', next);
    set({ hospitals: next });
    invalidateHospitals();
  },

  updateHospital: (id, patch) => {
    const rows = mockDb.read('hospitals');
    const index = rows.findIndex((hospital) => hospital.id === id);

    // 없는 id 는 조용히 무시한다 (기존 map 기반 동작과 동일). 관리자 화면이
    // 낙관적으로 호출하므로 여기서 throw 하면 화면이 깨진다 —
    // `hospitalApi.updateHospital` 이 throw 하는 것과는 의도적으로 다르다.
    if (index === -1) return;

    const next = [...rows];
    next[index] = { ...rows[index], ...patch };
    mockDb.write('hospitals', next);
    set({ hospitals: next });
    invalidateHospitals();
  },
}));

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
