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

  it('야간상담 칩은 두 모드 모두 nightConsult 로 간다 (라벨만 `진료시간` 에서 바뀌었다)', () => {
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

  /**
   * 카테고리 탭은 **선택(`selection`)만** 내려준다. 그 선택이 `procedureId` 가 될지
   * `pageSize=100` + 클라이언트 필터가 될지는 `useHospitalsByCategory.test` 가 고정한다 —
   * 대분류 하나가 서버 시술 여러 개에 걸릴 수 있어 여기서 한 값으로 옮길 수 없다.
   */
  it('카테고리 탭은 서버 필터가 아니라 대분류 선택으로 내려간다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setSelectedCategory('cavity');
    });
    expect(result.current.selection).toEqual({
      kind: 'category',
      categoryId: 'cavity',
      subProcedureId: null,
    });

    act(() => {
      result.current.setSelectedCategory('recommended');
    });
    expect(result.current.selection).toEqual({ kind: 'recommended' });
  });

  it('hospitalFilters·doctorFilters 에는 procedureId·recommended 키가 아예 없다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper });

    act(() => {
      result.current.setSelectedCategory('implant');
    });

    expect(result.current.hospitalFilters).not.toHaveProperty('procedureId');
    expect(result.current.hospitalFilters).not.toHaveProperty('recommended');
    expect(result.current.doctorFilters).not.toHaveProperty('procedureId');
    expect(result.current.doctorFilters).not.toHaveProperty('recommended');
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
   * 그 값을 서버로 흘려보내면 안 된다 — 서버는 문자열 존재만 검사하므로 그대로 통과시켜
   * "설명 없는 빈 목록" 을 만든다. 모르는 값은 추천으로 떨어뜨린다.
   *
   * `'all'` 은 옛 "기타" 탭의 북마크다. 탭이 사라졌으므로 같은 자리로 보낸다.
   */
  it.each([
    ['/explore?category=bogus', 'recommended'],
    ['/explore?category=all', 'recommended'],
    ['/explore?category=recommended', 'recommended'],
    ['/explore?category=implant', 'implant'],
    ['/explore?category=crown', 'cavity'],
    ['/explore?category=gum-disease', 'gum'],
    ['/explore', 'recommended'],
  ])('%s → 카테고리 탭 %s', (route, expected) => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper: wrapperWithRoute(route) });

    expect(result.current.selectedCategory).toBe(expected);
  });

  it('/explore?category=bogus 는 모르는 값을 서버 필터로 흘려보내지 않는다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper: wrapperWithRoute('/explore?category=bogus') });

    expect(result.current.selection).toEqual({ kind: 'recommended' });
    expect(result.current.hospitalFilters).not.toHaveProperty('procedureId');
  });

  it('/explore?category=crown 같은 옛 시술 id 는 그 시술이 속한 대분류 선택이 된다', () => {
    const { result } = renderHook(() => useExploreFilters(), { wrapper: wrapperWithRoute('/explore?category=crown') });

    expect(result.current.selection).toEqual({
      kind: 'category',
      categoryId: 'cavity',
      subProcedureId: null,
    });
  });
});
