import { useHospital } from '@/features/hospital/hooks/useHospital';

/**
 * 상담 한 건 옆에 적을 병원 이름.
 *
 * **조회가 끝나기 전의 "없음"은 "아직 모름"이지 "알 수 없는 병원"이 아니다** — 로딩 중에는
 * 중립 표시(`—`)를 쓰고, 조회가 끝났는데도 없을 때만 모른다고 말한다.
 *
 * 마이페이지 상담 내역과 관리자 상담 목록이 같은 판정을 쓰도록 떼어낸 훅이다. 상담 응답의
 * `hospitalName` 이 로컬 구현에서 항상 `null` 이라 **행마다 병원을 따로 조회한다** —
 * 서버가 이름을 함께 내려주면 이 훅은 사라진다
 * (`docs/features/known-issues.md`, `features/consult/api/consultApi.ts`).
 */
export function useHospitalName(hospitalId: string): string {
  const { data, isLoading } = useHospital(hospitalId);

  return isLoading ? '—' : (data?.name ?? '알 수 없는 병원');
}
