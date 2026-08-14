import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import AdminHomePage from '@/pages/admin/AdminHomePage';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { ManagedHospitalsResponse, User } from '@/types/domain';

function userWithRole(role: 'hospital_admin' | 'operator'): User {
  return {
    id: `u-${role}`,
    email: `${role}@molarmolar.example`,
    name: '테스트',
    provider: 'email',
    role,
    managedHospitalIds: role === 'hospital_admin' ? ['h1'] : [],
  };
}

function emptyManaged(scope: 'managed' | 'all'): ManagedHospitalsResponse {
  return { items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, scope };
}

describe('AdminHomePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  it('로딩 중에는 "없어요" 문구를 보여주지 않는다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AdminHomePage />);

    expect(screen.queryByText(/없어요|지정되지 않았어요/)).not.toBeInTheDocument();
  });

  it('scope=managed 이고 0건이면 "담당 병원이 아직 지정되지 않았어요" 를 보여준다', async () => {
    useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(emptyManaged('managed'));

    renderWithProviders(<AdminHomePage />);

    await waitFor(() => expect(screen.getByText('담당 병원이 아직 지정되지 않았어요')).toBeInTheDocument());
    expect(screen.queryByText('등록된 병원이 없어요')).not.toBeInTheDocument();
  });

  it('scope=all 이고 0건이면 "등록된 병원이 없어요" 를 보여준다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(emptyManaged('all'));

    renderWithProviders(<AdminHomePage />);

    await waitFor(() => expect(screen.getByText('등록된 병원이 없어요')).toBeInTheDocument());
    expect(screen.queryByText('담당 병원이 아직 지정되지 않았어요')).not.toBeInTheDocument();
  });

  it('hospital_admin 에게는 전문의 인증 검수·새 병원 등록 진입 버튼을 보여주지 않는다', async () => {
    useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(emptyManaged('managed'));

    renderWithProviders(<AdminHomePage />);

    await waitFor(() => expect(screen.getByText('담당 병원이 아직 지정되지 않았어요')).toBeInTheDocument());
    expect(screen.queryByText('전문의 인증 검수')).not.toBeInTheDocument();
    expect(screen.queryByText('새 병원 등록')).not.toBeInTheDocument();
  });

  it('operator 에게는 전문의 인증 검수·새 병원 등록 진입 버튼을 보여준다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(emptyManaged('all'));

    renderWithProviders(<AdminHomePage />);

    await waitFor(() => expect(screen.getByText('전문의 인증 검수')).toBeInTheDocument());
    expect(screen.getByText('새 병원 등록')).toBeInTheDocument();
  });
});
