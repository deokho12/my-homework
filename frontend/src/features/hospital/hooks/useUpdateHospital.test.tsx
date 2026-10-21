import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HospitalWriteInput } from '@/features/hospital/api/hospitalApi';
import { useUpdateHospital } from '@/features/hospital/hooks/useUpdateHospital';
import { queryKeys } from '@/lib/queryKeys';

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return { Wrapper, invalidateSpy };
}

function writeInput(overrides: Partial<HospitalWriteInput> = {}): HospitalWriteInput {
  return {
    name: '강남 스마일 치과',
    specialty: '',
    region: '서울 강남구',
    address: '서울 강남구 어딘가',
    latitude: 37.5,
    longitude: 127,
    thumbnail: '',
    introduction: '',
    priceRange: { min: 0, max: 0 },
    tags: [],
    procedureIds: ['implant-general'],
    consultAvailable: true,
    isOneDay: false,
    businessHours: [],
    directions: '',
    features: {
      coordinator: false,
      painlessAnesthesia: false,
      digitalCare: false,
      parking: false,
      nightConsult: false,
      cctv: false,
    },
    ...overrides,
  };
}

describe('useUpdateHospital', () => {
  it('PATCH /hospitals/:id 를 부르고 병원 캐시를 무효화한다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'h1' }));
    const { Wrapper, invalidateSpy } = makeWrapper();

    const { result } = renderHook(() => useUpdateHospital(), { wrapper: Wrapper });

    result.current.mutate({ id: 'h1', input: writeInput({ name: '수정된치과' }) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.hospitals.all });
  });

  /**
   * 요청서 14 의 첫 확인 항목이 이 경로다: 스케일링을 체크하고 저장하면 홈 "시술로 찾기" 의
   * 스케일링·예방이 더 이상 `준비중` 이 아니어야 한다. `isAvailable` 은 저장된 컬럼이 아니라
   * 서버가 매 요청 세는 값이라(계약 §22.3), 저장 성공 시 그 쿼리를 깨 주지 않으면 화면은
   * 옛 값을 계속 보여준다.
   */
  it('시술 목록 캐시도 무효화한다 — 방금 저장한 체크가 `준비중` 배지를 바꾼다', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'h1' }));
    const { Wrapper, invalidateSpy } = makeWrapper();

    const { result } = renderHook(() => useUpdateHospital(), { wrapper: Wrapper });

    result.current.mutate({ id: 'h1', input: writeInput({ procedureIds: ['scaling'] }) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.procedures.all });
  });
});
