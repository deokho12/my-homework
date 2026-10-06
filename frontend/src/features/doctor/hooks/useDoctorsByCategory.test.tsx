import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import { useDoctorsByCategory } from '@/features/doctor/hooks/useDoctorsByCategory';
import { queryWrapper } from '@/test/queryWrapper';
import type { Doctor, Paged, ProcedureId } from '@/types/domain';

/** `useHospitalsByCategory.test.tsx` 와 같은 규칙을 전문의 목록에서도 고정한다. */

/** 이 테스트가 보는 필드는 `id` 와 `procedureIds` 둘뿐이다. */
function doctor(id: string, procedureIds: ProcedureId[]): Doctor {
  return { id, procedureIds } as unknown as Doctor;
}

function paged(items: Doctor[]): Paged<Doctor> {
  return { items, meta: { page: 1, pageSize: 100, totalItems: items.length, totalPages: 1 } };
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

  it('세부 시술(서버 id 있음)은 procedureId 로 서버가 거른다', async () => {
    const spy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(paged([doctor('d2', ['crown'])]));

    const { result } = renderHook(
      () => useDoctorsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: 'crown' }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'crown' }));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('pageSize');
  });

  it('서버 id 가 여럿인 대분류는 넉넉히 받아 클라이언트가 거른다', async () => {
    const spy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(
      paged([doctor('d1', ['implant']), doctor('d2', ['crown']), doctor('d3', ['cavity', 'gum-disease'])])
    );

    const { result } = renderHook(
      () => useDoctorsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');
    expect(result.current.data?.items.map((d) => d.id)).toEqual(['d2', 'd3']);
    expect(result.current.data?.meta.totalItems).toBe(2);
  });

  it('준비중만 있는 대분류는 요청하지 않고 빈 결과를 바로 준다', async () => {
    const spy = vi.spyOn(doctorApi, 'fetchDoctors').mockResolvedValue(paged([doctor('d1', ['implant'])]));

    const { result } = renderHook(
      () => useDoctorsByCategory({ kind: 'category', categoryId: 'prevention', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    expect(result.current.plan).toEqual({ mode: 'empty' });
    expect(result.current.data?.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
  });
});
