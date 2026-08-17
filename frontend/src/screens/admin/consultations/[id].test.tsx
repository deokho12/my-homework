import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as consultApi from '@/features/consult/api/consultApi';
import AdminConsultationDetailScreen from '@/screens/admin/consultations/[id]';
import { useAuthStore } from '@/store/useAuthStore';
import { baseConsultRequest } from '@/test/consultFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { User } from '@/types/domain';

vi.mock('@/navigation', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/navigation');

  return { ...actual, useLocalSearchParams: () => ({ id: 'cr1' }) };
});

function userWithRole(role: User['role']): User {
  return {
    id: role === 'operator' ? 'u-operator' : 'u-admin-h1',
    email: `${role}@molarmolar.example`,
    name: '테스트',
    provider: 'email',
    role,
    managedHospitalIds: role === 'operator' ? [] : ['h1'],
  };
}

/**
 * 관리자 상담 상세.
 *
 * 지키는 것 셋: 서버가 준 이름들을 그대로 그리는가, 마스킹 상태를 알려주는가,
 * **운영자에게 처리 수단을 열지 않는가**(서버도 403 이지만 누를 수 없는 버튼을
 * 보여주는 편이 낫다).
 */
describe('AdminConsultationDetailScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  it('메모에 작성자 이름과 시각이 함께 보인다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequest').mockResolvedValue(
      baseConsultRequest({
        memos: [
          {
            id: 'm1',
            content: '전화 연결 시도, 부재중',
            createdAt: '2026-08-16T01:00:00.000Z',
            authorName: '김담당',
          },
        ],
      })
    );

    renderWithProviders(<AdminConsultationDetailScreen />);

    await waitFor(() => expect(screen.getByText('전화 연결 시도, 부재중')).toBeInTheDocument());
    expect(screen.getByText(/김담당/)).toBeInTheDocument();
  });

  it('상태 이력에 처리자 이름이 보인다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequest').mockResolvedValue(
      baseConsultRequest({
        status: 'contacted',
        statusHistory: [
          { status: 'new', changedAt: '2026-08-16T00:00:00.000Z', changedByName: null },
          { status: 'contacted', changedAt: '2026-08-16T02:00:00.000Z', changedByName: '김담당' },
        ],
      })
    );

    renderWithProviders(<AdminConsultationDetailScreen />);

    await waitFor(() => expect(screen.getByText(/연락중 · 김담당/)).toBeInTheDocument());
  });

  it('★ 마스킹된 응답에는 이유를 함께 보여준다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(consultApi, 'fetchConsultRequest').mockResolvedValue(
      baseConsultRequest({ name: '박*영', phone: '010-****-5678', piiMasked: true })
    );

    renderWithProviders(<AdminConsultationDetailScreen />);

    await waitFor(() =>
      expect(screen.getByText(/담당 병원에서만 전체를 확인할 수 있어요/)).toBeInTheDocument()
    );
  });

  it('★ 운영자에게는 상태 변경·메모 작성 수단을 열지 않는다 (읽기 전용)', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(consultApi, 'fetchConsultRequest').mockResolvedValue(baseConsultRequest());

    renderWithProviders(<AdminConsultationDetailScreen />);

    await waitFor(() => expect(screen.getByText(/상태 변경은 담당 병원에서 할 수 있어요/)).toBeInTheDocument());
    expect(screen.getByText(/메모는 담당 병원에서 남길 수 있어요/)).toBeInTheDocument();
    expect(screen.queryByText('메모 추가')).not.toBeInTheDocument();
  });

  it('담당 병원 담당자에게는 상태 변경과 메모 작성이 열려 있다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequest').mockResolvedValue(baseConsultRequest());

    renderWithProviders(<AdminConsultationDetailScreen />);

    await waitFor(() => expect(screen.getByText('메모 추가')).toBeInTheDocument());
    expect(screen.queryByText(/상태 변경은 담당 병원에서/)).not.toBeInTheDocument();
  });

  it('지목한 전문의가 있으면 보여준다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequest').mockResolvedValue(
      baseConsultRequest({ doctorId: 'd1', doctorName: '김민준' })
    );

    renderWithProviders(<AdminConsultationDetailScreen />);

    await waitFor(() => expect(screen.getByText('지목 전문의')).toBeInTheDocument());
    expect(screen.getByText('김민준')).toBeInTheDocument();
  });
});
