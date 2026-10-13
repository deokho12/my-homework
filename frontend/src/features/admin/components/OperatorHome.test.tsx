import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as dashboardApi from '@/features/admin/api/dashboardApi';
import OperatorHome from '@/features/admin/components/OperatorHome';
import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { ManagedHospitalsResponse, User, VerificationQueueItem } from '@/types/domain';

/**
 * 운영자의 `/admin`. **대시보드를 쓰지 않는다** — 답할 수도 연락할 수도 없는 역할에게
 * `답변 안 한 문의 N건` 은 할 일이 아니다.
 */

function signIn(): void {
  const user: User = {
    id: 'u-op',
    email: 'op@molarmolar.example',
    name: '운영자',
    provider: 'email',
    role: 'operator',
    managedHospitalIds: [],
  };

  act(() => {
    useAuthStore.setState({ user, status: 'ready' });
  });
}

function managed(count: number): ManagedHospitalsResponse {
  return {
    items: Array.from({ length: count }, (_, index) =>
      baseHospital({ id: `h${index + 1}`, name: `${index + 1}번 치과`, region: '서울 강남구' })
    ),
    meta: { page: 1, pageSize: 20, totalItems: count, totalPages: 1 },
    scope: 'all',
  };
}

function queueItem(id: string): VerificationQueueItem {
  return {
    id,
    name: '이수진',
    title: '원장',
    specialty: '치과보철전문의',
    hospitalId: 'h1',
    hospitalName: '1번 치과',
    certificateUrl: null,
    verificationStatus: 'pending',
    rejectionReason: null,
    submittedAt: '2026-10-10T00:00:00.000Z',
  } as VerificationQueueItem;
}

beforeEach(() => {
  signIn();
  vi.spyOn(dashboardApi, 'fetchAdminDashboard');
  vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(managed(2));
  vi.spyOn(doctorApi, 'fetchVerificationQueue').mockResolvedValue({
    items: [queueItem('d1'), queueItem('d2'), queueItem('d3')],
    meta: { page: 1, pageSize: 20, totalItems: 3, totalPages: 1 },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    useAuthStore.setState({ user: null, status: 'ready' });
  });
});

describe('OperatorHome', () => {
  it('검수 대기 수와 두 입구를 보여준다', async () => {
    renderWithProviders(<OperatorHome />, { route: '/admin', path: '/admin' });

    expect(await screen.findByText('전문의 인증 검수 대기')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('3 건')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '검수하러 가기' })).toHaveAttribute('href', '/admin/specialists');
    expect(screen.getByRole('link', { name: '새 병원 등록' })).toHaveAttribute('href', '/admin/hospital/new');
  });

  it('등록된 병원 목록을 그리고 각 줄이 수정 화면으로 간다', async () => {
    renderWithProviders(<OperatorHome />, { route: '/admin', path: '/admin' });

    expect(await screen.findByRole('heading', { name: '등록된 병원' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /1번 치과/ })).toHaveAttribute('href', '/admin/hospital/h1');
    expect(screen.getByRole('link', { name: /2번 치과/ })).toHaveAttribute('href', '/admin/hospital/h2');
  });

  it('등록된 병원이 없으면 그렇게 적는다', async () => {
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(managed(0));

    renderWithProviders(<OperatorHome />, { route: '/admin', path: '/admin' });

    expect(await screen.findByText('등록된 병원이 없어요')).toBeInTheDocument();
  });

  it('대시보드 집계를 부르지 않는다 — 운영자에게는 403 이 확정이다', async () => {
    renderWithProviders(<OperatorHome />, { route: '/admin', path: '/admin' });

    await screen.findByRole('heading', { name: '등록된 병원' });
    expect(dashboardApi.fetchAdminDashboard).not.toHaveBeenCalled();
  });

  it('검수 수를 아직 모르는 동안에는 `—` 다', async () => {
    vi.spyOn(doctorApi, 'fetchVerificationQueue').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<OperatorHome />, { route: '/admin', path: '/admin' });

    expect(await screen.findByText('—')).toBeInTheDocument();
  });
});
