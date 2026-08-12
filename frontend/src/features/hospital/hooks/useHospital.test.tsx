import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useHospital, useHospitals } from '@/features/hospital';
import { mockDb } from '@/mocks/db';
import { queryWrapper } from '@/test/queryWrapper';

describe('hospital 조회 훅', () => {
  it('useHospitals 는 loading 을 지나 목록을 반환한다', async () => {
    const { result } = renderHook(() => useHospitals(), { wrapper: queryWrapper });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBe(mockDb.read('hospitals').length);
  });

  it('useHospital 은 id 로 한 건을 반환한다', async () => {
    const target = mockDb.read('hospitals')[0];
    const { result } = renderHook(() => useHospital(target.id), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe(target.name);
  });

  it('없는 id 는 null 을 반환한다 (에러가 아니다)', async () => {
    const { result } = renderHook(() => useHospital('no-such-hospital'), {
      wrapper: queryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('id 가 undefined 면 조회를 시작하지 않는다', () => {
    const { result } = renderHook(() => useHospital(undefined), { wrapper: queryWrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
