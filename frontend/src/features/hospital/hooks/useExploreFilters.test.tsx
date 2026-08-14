import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useExploreFilters } from '@/features/hospital/hooks/useExploreFilters';

/**
 * `useLocalSearchParams` 는 라우터 컨텍스트가 필요하다 (`src/test/renderWithProviders.tsx` 와
 * 같은 이유) — `renderHook` 용으로 같은 모양의 얇은 래퍼를 쓴다.
 */
function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/explore']}>
      <Routes>
        <Route path="/explore" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

/** 쿼리 문자열이 있는 콜드 로드(`/explore?category=...`)를 재현할 때 쓴다. */
function wrapperWithRoute(route: string) {
  return function RoutedWrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/explore" element={children} />
        </Routes>
      </MemoryRouter>
    );
  };
}

describe('useExploreFilters — 화면 상태 → 서버 필터 매핑', () => {
  it('기본 상태는 아무 조건 칩도 서버로 보내지 않는다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    expect(result.current.hospitalFilters).toMatchObject({
      sort: 'rating',
      consultAvailable: undefined,
      oneDay: undefined,
      hasVerifiedSpecialist: undefined,
      nightConsult: undefined,
      minDoctorYearsOfExperience: undefined,
    });
    expect(result.current.doctorFilters).toMatchObject({
      sort: 'rating',
      consultAvailable: undefined,
      oneDay: undefined,
      verifiedSpecialist: undefined,
      nightConsult: undefined,
      minYearsOfExperience: undefined,
    });
  });

  it('상담가능·원데이는 병원·의사 모드에서 같은 파라미터 이름을 쓴다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setOnlyConsult(true);
      result.current.setOnlyOneDay(true);
    });

    expect(result.current.hospitalFilters).toMatchObject({ consultAvailable: true, oneDay: true });
    expect(result.current.doctorFilters).toMatchObject({ consultAvailable: true, oneDay: true });
  });

  it('전문의 칩은 병원 모드에서 hasVerifiedSpecialist, 의사 모드에서 verifiedSpecialist 다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setOnlySpecialist(true);
    });

    expect(result.current.hospitalFilters.hasVerifiedSpecialist).toBe(true);
    expect(result.current.doctorFilters.verifiedSpecialist).toBe(true);
    expect((result.current.hospitalFilters as Record<string, unknown>).verifiedSpecialist).toBeUndefined();
  });

  it('진료시간 칩은 실제로는 nightConsult(야간상담) 다 — 이름이 다르지 않다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setOnlyNightConsult(true);
    });

    expect(result.current.hospitalFilters.nightConsult).toBe(true);
    expect(result.current.doctorFilters.nightConsult).toBe(true);
  });

  it('경력 칩은 병원 모드에서 minDoctorYearsOfExperience=10, 의사 모드에서 minYearsOfExperience=10 이다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setOnlyExperienced(true);
    });

    expect(result.current.hospitalFilters.minDoctorYearsOfExperience).toBe(10);
    expect(result.current.doctorFilters.minYearsOfExperience).toBe(10);
  });

  it('시술 칩은 procedureId 로, 추천 칩은 recommended=true 로, 기타 칩은 아무것도 보내지 않는다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setSelectedCategory('implant');
    });
    expect(result.current.hospitalFilters.procedureId).toBe('implant');
    expect(result.current.doctorFilters.procedureId).toBe('implant');

    act(() => {
      result.current.setSelectedCategory('recommended');
    });
    expect(result.current.hospitalFilters.recommended).toBe(true);
    expect(result.current.hospitalFilters.procedureId).toBeUndefined();

    act(() => {
      result.current.setSelectedCategory('all');
    });
    expect(result.current.hospitalFilters.procedureId).toBeUndefined();
    expect(result.current.hospitalFilters.recommended).toBeUndefined();
    expect(result.current.doctorFilters.procedureId).toBeUndefined();
    expect(result.current.doctorFilters.recommended).toBeUndefined();
  });

  it('정렬 칩은 popular→rating, reviews→reviewCount, consults→consultCount 로 옮긴다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setSortBy('reviews');
    });
    expect(result.current.hospitalFilters.sort).toBe('reviewCount');

    act(() => {
      result.current.setSortBy('consults');
    });
    expect(result.current.hospitalFilters.sort).toBe('consultCount');
  });

  it('병원 모드에서 지도 보기로 바꾸면 latitude·longitude·radiusKm 세 값을 함께 채운다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setHospitalView('map');
    });

    expect(result.current.hospitalFilters.latitude).toBeTypeOf('number');
    expect(result.current.hospitalFilters.longitude).toBeTypeOf('number');
    expect(result.current.hospitalFilters.radiusKm).toBe(3);
  });

  it('리스트 보기에서는 좌표를 전혀 보내지 않는다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    expect(result.current.hospitalFilters.latitude).toBeUndefined();
    expect(result.current.hospitalFilters.longitude).toBeUndefined();
    expect(result.current.hospitalFilters.radiusKm).toBeUndefined();
  });

  it('의사 모드로 바꾸면 좌표 필터가 적용되지 않는다(지도 보기는 병원 모드 전용)', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setMode('doctor');
      result.current.setHospitalView('map');
    });

    expect(result.current.hospitalFilters.latitude).toBeUndefined();
  });

  /**
   * [Important 1 리뷰 수정] `/explore?category=bogus` 처럼 인식 못 할 값이 URL 에 오면
   * `procedureId=bogus` 를 서버로 보내면 안 된다 — 서버는 문자열 존재만 검사하므로 그대로
   * 통과시켜 "설명 없는 빈 목록" 을 만든다. 알려진 시술 id 집합으로 검증하고, 아니면
   * `'all'`(필터 없음) 로 떨어뜨린다.
   */
  it('/explore?category=bogus 처럼 알 수 없는 값이 오면 procedureId 를 보내지 않고 all 로 떨어진다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper: wrapperWithRoute('/explore?category=bogus') });

    expect(result.current.selectedCategory).toBe('all');
    expect(result.current.hospitalFilters.procedureId).toBeUndefined();
    expect(result.current.hospitalFilters.recommended).toBeUndefined();
  });

  it('/explore?category=implant 처럼 알려진 시술 id 는 그대로 procedureId 가 된다', () => {
    const { result } = renderHook(() => useExploreFilters(), {
      wrapper: wrapperWithRoute('/explore?category=implant'),
    });

    expect(result.current.selectedCategory).toBe('implant');
    expect(result.current.hospitalFilters.procedureId).toBe('implant');
  });
});
