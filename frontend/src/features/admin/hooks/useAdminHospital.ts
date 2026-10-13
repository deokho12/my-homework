import { useMemo } from 'react';

import { useSession } from '@/features/auth/hooks/useSession';
import { useManagedHospitals } from '@/features/hospital';
import { useAdminHospitalStore } from '@/store/useAdminHospitalStore';

export interface AdminHospitalOption {
  id: string;
  name: string;
}

export interface AdminHospitalSelection {
  /** 지금 보고 있는 병원. 담당 병원이 없으면(또는 운영자면) `null`. */
  hospitalId: string | null;
  /** 담당 병원 수. **1곳이면 선택기를 그리지 않고, 0곳이면 대시보드 대신 빈 상태다.** */
  count: number;
  /** 드롭다운 선택지. 이름이 필요해 목록을 부르므로 **2곳 이상일 때만** 채워진다. */
  options: AdminHospitalOption[];
  select: (hospitalId: string) => void;
}

/**
 * "지금 어느 병원의 관리자 화면인가" 의 단일 창구.
 *
 * **기억된 선택을 그대로 믿지 않는다** — 읽을 때마다 `managedHospitalIds` 로 검증하고,
 * 범위 밖이면 버리고 첫 번째를 쓴다. 담당에서 빠진 병원의 숫자를 계속 보여주지 않기 위해서다
 * (로컬에 남은 값은 서버가 역할·담당을 바꾼 뒤에도 그대로 있다).
 */
export function useAdminHospital(): AdminHospitalSelection {
  const { user, isOperator } = useSession();
  const stored = useAdminHospitalStore((state) => state.hospitalId);
  const select = useAdminHospitalStore((state) => state.select);

  // 운영자에게는 담당 병원이라는 개념이 없다 — 대시보드도 병원 정보 메뉴도 쓰지 않는다.
  const managedIds = useMemo(
    () => (isOperator ? [] : (user?.managedHospitalIds ?? [])),
    [isOperator, user?.managedHospitalIds]
  );

  const hospitalId = stored !== null && managedIds.includes(stored) ? stored : (managedIds[0] ?? null);

  const list = useManagedHospitals({ pageSize: 100 }, { enabled: managedIds.length > 1 });

  const options = useMemo(
    () =>
      (list.data?.items ?? [])
        .filter((hospital) => managedIds.includes(hospital.id))
        .map((hospital) => ({ id: hospital.id, name: hospital.name })),
    [list.data, managedIds]
  );

  return { hospitalId, count: managedIds.length, options, select };
}
