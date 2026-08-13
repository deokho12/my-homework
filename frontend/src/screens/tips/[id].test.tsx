import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { mockDb } from '@/mocks/db';
import TipDetailScreen from '@/screens/tips/[id]';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 관련 병원은 이제 `useHospital(hospitalId)` 로 조회한다(예전 `getHospitalById()` 는
 * zustand `getState()` 스냅샷이라 비반응형이었다 — `docs/features/known-issues.md`).
 */
describe('TipDetailScreen — 관련 병원', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('관련 병원을 useHospital 로 조회해 이름을 렌더한다', async () => {
    const hospitals = mockDb.read('hospitals');
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) => {
      const found = hospitals.find((hospital) => hospital.id === id);
      if (!found) throw new Error(`no fixture hospital: ${id}`);
      return found;
    });

    renderWithProviders(<TipDetailScreen />, { route: '/tips/g1', path: '/tips/:id' });

    const h1 = hospitals.find((hospital) => hospital.id === 'h1')!;
    await waitFor(() => expect(screen.getByText(h1.name)).toBeInTheDocument());
    expect(screen.getByText('관련 병원 보기')).toBeInTheDocument();
  });
});
