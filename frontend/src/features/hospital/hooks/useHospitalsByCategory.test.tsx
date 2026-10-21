import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { useHospitalsByCategory } from '@/features/hospital/hooks/useHospitalsByCategory';
import { LIST_PAGE_SIZE } from '@/lib/pagination';
import { queryWrapper } from '@/test/queryWrapper';
import type { Hospital, Paged } from '@/types/domain';

/**
 * `fetchHospitals` 를 스파이해서 **어떤 파라미터로 불렀는지**를 직접 검증한다
 * (`src/pages/ExplorePage.test.tsx` 와 같은 방식). 이 훅의 일은 선택을 서버 파라미터로
 * 옮기고 페이지를 이어 붙이는 것이므로, 호출 인자가 곧 명세다.
 */

function hospital(id: string): Hospital {
  return { id } as unknown as Hospital;
}

function paged(items: Hospital[], meta: Partial<Paged<Hospital>['meta']> = {}): Paged<Hospital> {
  return {
    items,
    meta: { page: 1, pageSize: LIST_PAGE_SIZE, totalItems: items.length, totalPages: 1, ...meta },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useHospitalsByCategory — 선택 → 서버 파라미터', () => {
  it('추천은 recommended=true 로 부른다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    const { result } = renderHook(() => useHospitalsByCategory({ kind: 'recommended' }, { sort: 'rating' }), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ recommended: true, sort: 'rating' }));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');
    expect(spy.mock.calls[0][0]).not.toHaveProperty('categoryId');
  });

  it('세부 시술은 procedureId 로 서버가 거른다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([hospital('h7')]));

    const { result } = renderHook(
      () => useHospitalsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: 'crown' }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'crown' }));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('categoryId');
    expect(result.current.data?.items.map((h) => h.id)).toEqual(['h7']);
  });

  /** 요청 14 전에는 이 선택이 100곳을 받아 화면에서 걸렀다 (광고 순서도 총계도 없었다). */
  it('분야 전체는 categoryId 한 번으로 받는다 — 받아서 거르지 않는다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([hospital('h1')]));

    const { result } = renderHook(
      () => useHospitalsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cavity' }));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');
  });

  it('준비중 분야도 물어본다 — 빈 목록은 서버가 준 사실이다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    const { result } = renderHook(
      () => useHospitalsByCategory({ kind: 'category', categoryId: 'prevention', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'prevention' }));
    expect(result.current.data?.items).toEqual([]);
  });

  it('enabled: false 면 아무것도 부르지 않는다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    renderHook(
      () =>
        useHospitalsByCategory(
          { kind: 'category', categoryId: 'implant', subProcedureId: null },
          {},
          { enabled: false }
        ),
      { wrapper: queryWrapper }
    );

    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useHospitalsByCategory — 더 보기', () => {
  it('첫 요청은 page 1 · pageSize 20 이다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    const { result } = renderHook(() => useHospitalsByCategory({ kind: 'recommended' }, {}), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: LIST_PAGE_SIZE }));
  });

  it('다음 페이지를 이어 붙이고 meta 는 마지막 페이지 것을 쓴다', async () => {
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitals')
      .mockResolvedValueOnce(paged([hospital('h1'), hospital('h2')], { page: 1, totalItems: 3, totalPages: 2 }))
      .mockResolvedValueOnce(paged([hospital('h3')], { page: 2, totalItems: 3, totalPages: 2 }));

    const { result } = renderHook(() => useHospitalsByCategory({ kind: 'recommended' }, {}), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    await waitFor(() => expect(result.current.data?.items).toHaveLength(3));
    expect(result.current.data?.items.map((h) => h.id)).toEqual(['h1', 'h2', 'h3']);
    expect(result.current.data?.meta.page).toBe(2);
    expect(result.current.data?.meta.totalItems).toBe(3);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('페이지 경계에 같은 병원이 두 번 와도 한 번만 그린다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitals')
      .mockResolvedValueOnce(paged([hospital('h1'), hospital('h2')], { page: 1, totalItems: 4, totalPages: 2 }))
      .mockResolvedValueOnce(paged([hospital('h2'), hospital('h3')], { page: 2, totalItems: 4, totalPages: 2 }));

    const { result } = renderHook(() => useHospitalsByCategory({ kind: 'recommended' }, {}), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.items).toHaveLength(3));
    expect(result.current.data?.items.map((h) => h.id)).toEqual(['h1', 'h2', 'h3']);
  });

  it('필터가 바뀌면 새 쿼리라 다시 첫 묶음부터다', async () => {
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitals')
      .mockResolvedValue(paged([hospital('h1')], { totalItems: 50, totalPages: 3 }));

    const { result, rerender } = renderHook(
      ({ sort }: { sort: 'rating' | 'reviewCount' }) => useHospitalsByCategory({ kind: 'recommended' }, { sort }),
      { wrapper: queryWrapper, initialProps: { sort: 'rating' as 'rating' | 'reviewCount' } }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    rerender({ sort: 'reviewCount' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'reviewCount', page: 1 }));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('호출부가 pageSize 를 지정하면 그것이 이긴다 (지도 100곳)', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    const { result } = renderHook(() => useHospitalsByCategory({ kind: 'recommended' }, { pageSize: 100 }), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
  });
});
