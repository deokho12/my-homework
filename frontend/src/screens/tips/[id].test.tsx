import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { guides } from '@/mocks/fixtures/guides';
import TipDetailScreen from '@/screens/tips/[id]';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 관련 병원은 이제 `useHospital(hospitalId)` 로 조회한다(예전 `getHospitalById()` 는
 * zustand `getState()` 스냅샷이라 비반응형이었다 — `docs/features/known-issues.md`).
 * `g1` 의 `relatedHospitals`(`@/mocks/fixtures/guides`) 에 실린 id 마다 서로 다른
 * 이름의 fixture 병원을 만들어 준다 — 이름이 겹치면 `getByText` 가 여러 건을 찾아 실패한다.
 */
describe('TipDetailScreen — 관련 병원', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('관련 병원을 useHospital 로 조회해 이름을 렌더한다', async () => {
    const guide = guides.find((item) => item.id === 'g1')!;
    const hospitals = (guide.relatedHospitals ?? []).map((id, index) =>
      baseHospital({ id, name: `관련병원${index + 1}` })
    );
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
