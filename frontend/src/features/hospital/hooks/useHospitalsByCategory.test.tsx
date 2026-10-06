import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { useHospitalsByCategory } from '@/features/hospital/hooks/useHospitalsByCategory';
import { queryWrapper } from '@/test/queryWrapper';
import type { Hospital, Paged, ProcedureId } from '@/types/domain';

/**
 * `fetchHospitals` 를 스파이해서 **어떤 파라미터로 불렀는지**를 직접 검증한다
 * (`src/pages/ExplorePage.test.tsx` 와 같은 방식). 이 훅의 일은 "요청을 보낼지, 서버로
 * 거를지, 받아서 거를지" 셋 중 하나를 고르는 것이므로, 호출 인자가 곧 명세다.
 */

/** 이 테스트가 보는 필드는 `id` 와 `procedureIds` 둘뿐이다 — 나머지는 필터에 관여하지 않는다. */
function hospital(id: string, procedureIds: ProcedureId[]): Hospital {
  return { id, procedureIds } as unknown as Hospital;
}

function paged(items: Hospital[]): Paged<Hospital> {
  return { items, meta: { page: 1, pageSize: 100, totalItems: items.length, totalPages: 1 } };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useHospitalsByCategory', () => {
  it('추천은 recommended=true 로 부른다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    const { result } = renderHook(() => useHospitalsByCategory({ kind: 'recommended' }, { sort: 'rating' }), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.plan).toEqual({ mode: 'recommended' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ recommended: true, sort: 'rating' }));
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');
  });

  it('세부 시술(서버 id 있음)은 procedureId 로 서버가 거른다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([hospital('h7', ['crown'])]));

    const { result } = renderHook(
      () => useHospitalsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: 'crown' }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.plan).toEqual({ mode: 'server', procedureId: 'crown' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'crown' }));
    // 서버가 이미 걸러 줬으므로 클라이언트가 다시 거르지 않는다.
    expect(spy.mock.calls[0][0]).not.toHaveProperty('pageSize');
    expect(result.current.data?.items.map((h) => h.id)).toEqual(['h7']);
  });

  it('서버 id 가 하나뿐인 대분류도 서버 필터로 끝낸다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    const { result } = renderHook(
      () => useHospitalsByCategory({ kind: 'category', categoryId: 'implant', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'implant' }));
  });

  it('서버 id 가 여럿인 대분류는 넉넉히 받아 클라이언트가 거르고 총 개수를 다시 센다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(
      paged([
        hospital('h1', ['implant']),
        hospital('h7', ['crown']),
        hospital('h3', ['cavity', 'gum-disease']),
      ])
    );

    const { result } = renderHook(
      () => useHospitalsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.plan.mode).toBe('client');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
    // procedureId 를 보내면 서버가 하나만 받으므로(배열은 422) 아예 안 보낸다.
    expect(spy.mock.calls[0][0]).not.toHaveProperty('procedureId');

    expect(result.current.data?.items.map((h) => h.id)).toEqual(['h7', 'h3']);
    expect(result.current.data?.meta.totalItems).toBe(2);
  });

  it('준비중만 있는 대분류는 요청하지 않고 빈 결과를 바로 준다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([hospital('h1', ['implant'])]));

    const { result } = renderHook(
      () => useHospitalsByCategory({ kind: 'category', categoryId: 'prevention', subProcedureId: null }, {}),
      { wrapper: queryWrapper }
    );

    expect(result.current.plan).toEqual({ mode: 'empty' });
    expect(result.current.data?.items).toEqual([]);
    expect(result.current.data?.meta.totalItems).toBe(0);
    // 꺼진 쿼리가 영원한 로딩으로 보이면 화면에 스피너가 박힌다.
    expect(result.current.isLoading).toBe(false);

    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
  });

  it('준비중 세부 시술도 요청하지 않는다', async () => {
    const spy = vi.spyOn(hospitalApi, 'fetchHospitals').mockResolvedValue(paged([]));

    const { result } = renderHook(
      () => useHospitalsByCategory({ kind: 'category', categoryId: 'cavity', subProcedureId: 'root-canal' }, {}),
      { wrapper: queryWrapper }
    );

    expect(result.current.plan).toEqual({ mode: 'empty' });
    expect(result.current.isLoading).toBe(false);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
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
