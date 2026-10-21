import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import { useDoctorsByCategory } from '@/features/doctor/hooks/useDoctorsByCategory';
import { LIST_PAGE_SIZE } from '@/lib/pagination';
import { queryWrapper } from '@/test/queryWrapper';
import type { Doctor, Paged } from '@/types/domain';

/** `useHospitalsByCategory.test.tsx` 와 같은 규칙을 전문의 목록에서도 고정한다. */

function doctor(id: string): Doctor {
  return { id } as unknown as Doctor;
}

function paged(items: Doctor[], meta: Partial<Paged<Doctor>['meta']> = {}): Paged<Doctor> {
  return {
    items,
    meta: { page: 1, pageSize: LIST_PAGE_SIZE, totalItems: items.length, totalPages: 1, ...meta },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDoctorsByCategory', () => {
  it('추천은 recommended=true 로 부른다', async () => {
    const spy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(paged([]));

    const { result } = renderHook(() => useDoctorsByCategory({ kind: 'recommended' }, { sort: 'rating' }), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ recommended: true, sort: 'rating' }));
  });

  it('세부 시술은 procedureId 로 서버가 거른다', async () => {
    const spy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(paged([doctor('d2')]));

    const { result } = renderHook(
      () => useDoctorsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: 'crown' }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'crown', pageSize: LIST_PAGE_SIZE }));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('categoryId');
  });

  it('분야 전체는 categoryId 한 번으로 받는다 — 병원 목록과 같은 규칙이다', async () => {
    const spy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(paged([doctor('d2'), doctor('d3')]));

    const { result } = renderHook(
      () => useDoctorsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cavity' }));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');
    expect(result.current.data?.items.map((d) => d.id)).toEqual(['d2', 'd3']);
  });

  it('준비중 분야도 물어본다 — 빈 목록은 서버가 준 사실이다', async () => {
    const spy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(paged([]));

    const { result } = renderHook(
      () => useDoctorsByCategory({ kind: 'category', categoryId: 'prevention', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'prevention' }));
    expect(result.current.data?.items).toEqual([]);
  });

  it('더 보기가 다음 페이지를 이어 붙인다', async () => {
    vi.spyOn(doctorApi, 'fetchDoctors')
      .mockResolvedValueOnce(paged([doctor('d1')], { page: 1, totalItems: 2, totalPages: 2 }))
      .mockResolvedValueOnce(paged([doctor('d2')], { page: 2, totalItems: 2, totalPages: 2 }));

    const { result } = renderHook(() => useDoctorsByCategory({ kind: 'recommended' }, {}), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));
    expect(result.current.data?.items.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(result.current.hasNextPage).toBe(false);
  });
});
