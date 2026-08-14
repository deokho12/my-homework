import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import AdminSpecialistsPage from '@/pages/admin/AdminSpecialistsPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { VerificationQueueItem } from '@/types/domain';

function baseQueueItem(overrides: Partial<VerificationQueueItem> = {}): VerificationQueueItem {
  return {
    id: 'd1',
    name: '김민준',
    title: '대표원장',
    specialty: '치과보철전문의',
    hospitalId: 'h1',
    hospitalName: '강남 스마일 치과',
    photo: 'https://example.com/photo.jpg',
    procedureIds: ['implant'],
    rating: null,
    reviewCount: 0,
    consultCount: 0,
    certificateUrl: 'https://example.com/cert.png',
    verificationStatus: 'pending',
    rejectionReason: null,
    isRecommended: false,
    yearsOfExperience: 0,
    career: [],
    visibleSpecialty: null,
    isVerifiedSpecialist: false,
    submittedAt: null,
    ...overrides,
  };
}

describe('AdminSpecialistsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('검수 큐가 비면 안내 문구를 보여준다', async () => {
    vi.spyOn(doctorApi, 'fetchVerificationQueue').mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    renderWithProviders(<AdminSpecialistsPage />);

    await waitFor(() => expect(screen.getByText(/검수할 전문의가 없어요/)).toBeInTheDocument());
  });

  it('로딩 중에는 "없어요" 문구를 보여주지 않는다', () => {
    vi.spyOn(doctorApi, 'fetchVerificationQueue').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AdminSpecialistsPage />);

    expect(screen.queryByText(/없어요/)).not.toBeInTheDocument();
  });

  it('승인하면 useDecideVerification 이 호출된다', async () => {
    vi.spyOn(doctorApi, 'fetchVerificationQueue').mockResolvedValue({
      items: [baseQueueItem()],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    const decideSpy = vi.spyOn(doctorApi, 'decideVerification').mockResolvedValue(baseQueueItem());

    renderWithProviders(<AdminSpecialistsPage />);

    await waitFor(() => expect(screen.getByText('김민준 · 대표원장')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '승인' }));

    await waitFor(() => expect(decideSpy).toHaveBeenCalledWith('d1', { status: 'approved' }));
  });

  it('반려 사유 없이는 반려 확정 버튼이 막혀 있다', async () => {
    vi.spyOn(doctorApi, 'fetchVerificationQueue').mockResolvedValue({
      items: [baseQueueItem()],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    const decideSpy = vi.spyOn(doctorApi, 'decideVerification').mockResolvedValue(baseQueueItem());

    renderWithProviders(<AdminSpecialistsPage />);

    await waitFor(() => expect(screen.getByText('김민준 · 대표원장')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '반려' }));
    await userEvent.click(screen.getByRole('button', { name: '반려 확정' }));

    expect(decideSpy).not.toHaveBeenCalled();

    await userEvent.type(screen.getByPlaceholderText('반려 사유를 입력해주세요'), '자격증이 흐려요');
    await userEvent.click(screen.getByRole('button', { name: '반려 확정' }));

    await waitFor(() =>
      expect(decideSpy).toHaveBeenCalledWith('d1', { status: 'rejected', rejectionReason: '자격증이 흐려요' })
    );
  });
});
