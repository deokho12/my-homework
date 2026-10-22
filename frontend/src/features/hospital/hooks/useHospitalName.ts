import { useHospital } from '@/features/hospital/hooks/useHospital';

/**
 * 병원 id 만 들고 있는 줄 옆에 적을 병원 이름.
 *
 * **조회가 끝나기 전의 "없음"은 "아직 모름"이지 "알 수 없는 병원"이 아니다** — 로딩 중에는
 * 중립 표시(`—`)를 쓰고, 조회가 끝났는데도 없을 때만 모른다고 말한다.
 *
 * 쓰는 곳은 이제 **검색 제안 줄 하나뿐이다** (`features/search`): 제안 응답이 전문의의
 * 소속 병원 id 만 들고 온다. 상담 화면들은 2026-10-22(요청서 15)에 이 훅을 떠났다 —
 * 서버가 `hospitalName` 을 함께 내려주므로 줄마다 병원을 조회할 이유가 없어졌다.
 */
export function useHospitalName(hospitalId: string): string {
  const { data, isLoading } = useHospital(hospitalId);

  return isLoading ? '—' : (data?.name ?? '알 수 없는 병원');
}
