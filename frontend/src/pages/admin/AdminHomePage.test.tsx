import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as dashboardApi from '@/features/admin/api/dashboardApi';
import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import AdminHomePage from '@/pages/admin/AdminHomePage';
import { useAdminHospitalStore } from '@/store/useAdminHospitalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { ManagedHospitalsResponse, User } from '@/types/domain';

/**
 * `/admin` 은 **역할에 따라 다른 화면**이다. 각 화면의 내용은
 * `HospitalDashboard.test.tsx` · `OperatorHome.test.tsx` 가 따로 고정한다 — 여기서는
 * 갈림길 하나만 본다.
 */

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

beforeEach(() => {
  act(() => {
    useAdminHospitalStore.getState().clear();
  });
  vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(emptyManaged('all'));
  vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) => baseHospital({ id }));
  vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
  vi.spyOn(doctorApi, 'fetchVerificationQueue').mockResolvedValue({
    items: [],
    meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    useAuthStore.setState({ user: null, status: 'ready' });
  });
});

describe('AdminHomePage', () => {
  it('병원 담당자에게는 대시보드를 보여준다', async () => {
    act(() => {
      useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });
    });
    vi.spyOn(dashboardApi, 'fetchAdminDashboard').mockResolvedValue({
      hospitalId: 'h1',
      hospitalName: '강남 스마일 치과',
      numbers: {
        todayNew: 0,
        statusNew: 0,
        pending: 0,
        delayed: 0,
        unansweredInquiries: 0,
        oldestUnansweredAt: null,
        newThisMonth: 0,
        bookedThisMonth: 0,
      },
      funnel: { requested: 0, contacted: 0, booked: 0, visited: 0, cancelled: 0 },
      todo: { delayedConsults: [], delayedRemaining: 0, rejectedDoctors: [] },
      recentConsults: [],
      todayVisits: [],
      completeness: { percent: 100, items: [], noProcedures: false },
      timezone: 'Asia/Seoul',
      calculatedAt: '2026-10-13T02:30:00.000Z',
    });

    renderWithProviders(<AdminHomePage />, { route: '/admin', path: '/admin' });

    expect(await screen.findByText('안녕하세요, 강남 스마일 치과')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '등록된 병원' })).not.toBeInTheDocument();
  });

  it('운영자에게는 병원 목록과 검수 입구를 보여준다 — 대시보드가 아니다', async () => {
    act(() => {
      useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    });
    const fetchDashboard = vi.spyOn(dashboardApi, 'fetchAdminDashboard');

    renderWithProviders(<AdminHomePage />, { route: '/admin', path: '/admin' });

    expect(await screen.findByRole('heading', { name: '등록된 병원' })).toBeInTheDocument();
    expect(screen.getByText('전문의 인증 검수 대기')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '새 병원 등록' })).toBeInTheDocument();
    expect(fetchDashboard).not.toHaveBeenCalled();
  });

  it('병원 담당자에게는 운영자 전용 입구가 없다', async () => {
    act(() => {
      useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });
    });
    vi.spyOn(dashboardApi, 'fetchAdminDashboard').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AdminHomePage />, { route: '/admin', path: '/admin' });

    expect(await screen.findByRole('region', { name: '핵심 숫자' })).toBeInTheDocument();
    expect(screen.queryByText('전문의 인증 검수 대기')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '새 병원 등록' })).not.toBeInTheDocument();
  });
});
