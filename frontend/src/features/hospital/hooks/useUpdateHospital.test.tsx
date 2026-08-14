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
    procedureIds: ['implant'],
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
});
