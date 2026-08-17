import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as consultApi from '@/features/consult/api/consultApi';
import AdminConsultationsScreen from '@/screens/admin/consultations/index';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { baseConsultRequest, consultPage } from '@/test/consultFixture';
import type { User } from '@/types/domain';

function adminUser(): User {
  return {
    id: 'u-admin-h1',
    email: 'admin-h1@molarmolar.example',
    name: '담당자',
    provider: 'email',
    role: 'hospital_admin',
    managedHospitalIds: ['h1'],
  };
}

/**
 * 관리자 상담 목록.
 *
 * 예전 테스트는 "병원 이름 조회가 끝나기 전" 을 다뤘는데, 그 조회가 **사라졌다** —
 * 서버 응답에 `hospitalName` 이 이미 들어 있다. 그래서 이 스펙은 다른 것을 지킨다:
 * 목록이 서버 응답을 그대로 그리는지, 필터가 **서버 쿼리**로 나가는지,
 * 마스킹 상태를 화면이 알려주는지.
 */
describe('AdminConsultationsScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: adminUser(), status: 'ready' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  it('서버가 준 병원 이름·시술 이름을 그대로 그린다 (병원을 따로 조회하지 않는다)', async () => {
    const fetchSpy = vi
      .spyOn(consultApi, 'fetchConsultRequests')
      .mockResolvedValue(
        consultPage([baseConsultRequest({ hospitalName: '강남 스마일 치과', procedureName: '임플란트' })])
      );

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.getByText(/강남 스마일 치과 · 임플란트/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('시술이 없으면 "시술 미지정" 이다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(
      consultPage([baseConsultRequest({ procedureName: null })])
    );

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByText(/시술 미지정/)).toBeInTheDocument());
  });

  it('★ 마스킹된 연락처에는 이유를 함께 보여준다 (값만 보고는 구분할 수 없다)', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(
      consultPage([baseConsultRequest({ phone: '010-****-5678', piiMasked: true })])
    );

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() =>
      expect(screen.getByText(/담당 병원에서만 전체 번호를 볼 수 있어요/)).toBeInTheDocument()
    );
  });

  it('마스킹이 아니면 그 안내를 띄우지 않는다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(
      consultPage([baseConsultRequest({ piiMasked: false })])
    );

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.queryByText(/담당 병원에서만 전체 번호를/)).not.toBeInTheDocument();
  });

  it('★ 상태 칩은 화면에서 거르지 않고 서버 쿼리로 나간다 (페이지네이션과 어긋나지 않게)', async () => {
    const fetchSpy = vi
      .spyOn(consultApi, 'fetchConsultRequests')
      .mockResolvedValue(consultPage([baseConsultRequest()]));

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

    // `예약완료` 는 상단 필터 칩과 카드의 빠른 상태 버튼 양쪽에 있다. 앞의 것이 필터다.
    await userEvent.click(screen.getAllByText('예약완료')[0]);

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'booked' }))
    );
  });

  it('담당 병원 범위에서 0건이면 그 이유가 드러나는 문구를 쓴다', async () => {
    vi.spyOn(consultApi, 'fetchConsultRequests').mockResolvedValue(consultPage([], 'managed'));

    renderWithProviders(<AdminConsultationsScreen />);

    await waitFor(() =>
      expect(screen.getByText(/담당 병원에 접수된 상담 신청이 없어요/)).toBeInTheDocument()
    );
  });
});
