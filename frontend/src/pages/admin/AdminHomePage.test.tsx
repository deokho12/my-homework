import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { writeCollection } from '@/lib/localCollection';
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

/** 문의 입구 (요청서 `2026-10-12-03`). 숫자는 요약의 **미답변 수**이지 안 읽은 수가 아니다. */
describe('AdminHomePage — 문의 입구', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    writeCollection('consultRequests', []);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  it('병원 담당자에게는 담당 병원의 미답변 수를 붙여 보여준다', async () => {
    writeCollection('inquiries', [
      {
        id: 'hi1',
        hospitalId: 'h1',
        hospitalName: 'A치과',
        topic: 'price',
        content: '비용이 궁금해요',
        isPublic: true,
        answer: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        ownerUserId: 'u-me',
        askerDisplayName: '김민준',
      },
      {
        id: 'hi2',
        hospitalId: 'h2',
        hospitalName: 'B치과',
        topic: 'price',
        content: '다른 병원 질문',
        isPublic: true,
        answer: null,
        createdAt: '2026-10-02T00:00:00.000Z',
        ownerUserId: 'u-me',
        askerDisplayName: '김민준',
      },
    ]);
    useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(emptyManaged('managed'));

    renderWithProviders(<AdminHomePage />);

    expect(await screen.findByText('문의 1')).toBeInTheDocument();
  });

  it('상담 화면 입구의 이름은 `상담 예약` 이다 (사이드 메뉴·화면 제목과 같은 말)', async () => {
    useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(emptyManaged('managed'));

    renderWithProviders(<AdminHomePage />);

    expect(await screen.findByText('상담 예약')).toBeInTheDocument();
    expect(screen.queryByText('상담 관리')).not.toBeInTheDocument();
  });

  it('운영자에게는 숫자 없이 `문의` 만 보여준다 — 운영자는 답변할 수 없어 할 일 수가 아니다', async () => {
    writeCollection('inquiries', [
      {
        id: 'hi1',
        hospitalId: 'h1',
        hospitalName: 'A치과',
        topic: 'price',
        content: '비용이 궁금해요',
        isPublic: true,
        answer: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        ownerUserId: 'u-me',
        askerDisplayName: '김민준',
      },
    ]);
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue(emptyManaged('all'));

    renderWithProviders(<AdminHomePage />);

    expect(await screen.findByText('문의')).toBeInTheDocument();
    expect(screen.queryByText(/^문의 \d+$/)).not.toBeInTheDocument();
  });
});
