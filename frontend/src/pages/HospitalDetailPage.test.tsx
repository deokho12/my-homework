import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { mockDb } from '@/mocks/db';
import HospitalDetailPage from '@/pages/HospitalDetailPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Hospital } from '@/types/domain';

describe('HospitalDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('로딩 중에는 status 영역을 보여준다', () => {
    const target = mockDb.read('hospitals')[0];
    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('불러오는 중이에요')).toBeInTheDocument();
  });

  it('불러온 병원 이름을 렌더한다', async () => {
    const target = mockDb.read('hospitals')[0];
    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(screen.getByText('병원 소개')).toBeInTheDocument();
  });

  it('없는 병원이면 안내 문구를 보여준다', async () => {
    renderWithProviders(<HospitalDetailPage />, {
      route: '/hospital/no-such-id',
      path: '/hospital/:id',
    });

    await waitFor(() =>
      expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument()
    );
  });

  it('조회가 실패하면 에러 문구와 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(new Error('network down'));

    renderWithProviders(<HospitalDetailPage />, {
      route: '/hospital/h1',
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('정보를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도가 성공하면 병원 정보를 렌더하고 에러를 치운다', async () => {
    const target = mockDb.read('hospitals')[0];
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitalById')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('businessHours/features 가 없는 병원도 폴백 문구로 렌더한다', async () => {
    const base = mockDb.read('hospitals')[0];
    // 목 데이터 백필이 끝나지 않은 레코드를 재현한다 — 타입상 필수지만 실제로는 빠질 수 있다.
    const partial = {
      ...base,
      businessHours: undefined,
      features: undefined,
      isOneDay: false,
      directions: '',
    } as unknown as Hospital;
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(partial);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${base.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText('등록된 진료시간 정보가 없어요')).toBeInTheDocument());
    expect(screen.getByText('등록된 병원 특징이 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
