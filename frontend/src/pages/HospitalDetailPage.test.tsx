import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';
import HospitalDetailPage from '@/pages/HospitalDetailPage';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Hospital } from '@/types/domain';

/**
 * `fetchHospitalById` 는 이제 HTTP 를 부른다 — 목 백엔드를 거치지 않으므로 매 테스트가
 * `hospitalApi.fetchHospitalById` 를 직접 스파이한다.
 */
describe('HospitalDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('로딩 중에는 status 영역을 보여준다', () => {
    const target = baseHospital();
    // 응답이 오지 않은 상태를 고정한다 — resolve/reject 하지 않는 프라미스.
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('불러오는 중이에요')).toBeInTheDocument();
  });

  it('불러온 병원 이름을 렌더한다', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(screen.getByText('병원 소개')).toBeInTheDocument();
  });

  it('404 HOSPITAL_NOT_FOUND 면 안내 문구를 보여주고 다시 시도 버튼은 없다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );

    renderWithProviders(<HospitalDetailPage />, {
      route: '/hospital/no-such-id',
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument());
    // 존재하지 않는 병원이다 — 재시도해도 성공하지 않으므로 에러 화면이 아니라 빈 상태여야 한다.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('네트워크 오류 등 그 외 에러는 에러 문구와 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '연결에 문제가 있어요. 잠시 후 다시 시도해주세요' })
    );

    renderWithProviders(<HospitalDetailPage />, {
      route: '/hospital/h1',
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('정보를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도가 성공하면 병원 정보를 렌더하고 에러를 치운다', async () => {
    const target = baseHospital();
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitalById')
      .mockRejectedValueOnce(
        new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '연결에 문제가 있어요. 잠시 후 다시 시도해주세요' })
      )
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
    const base = baseHospital();
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

  it('대표 시술을 대분류별로 묶어 보여준다 — 라벨 아래에 세부 시술 이름', async () => {
    // `cavity` 는 화면에서 "레진", `implant` 는 "일반 임플란트" 다 (서버 이름과 다르다).
    const target = baseHospital({ procedureIds: ['cavity', 'implant'] });
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText('대표 시술')).toBeInTheDocument());
    // 대분류 라벨은 `CATEGORIES` 순서대로 — 임플란트가 충치치료보다 먼저다.
    expect(screen.getByText('충치치료')).toBeInTheDocument();
    expect(screen.getByText('레진')).toBeInTheDocument();
    expect(screen.getByText('일반 임플란트')).toBeInTheDocument();
  });

  it('시술이 하나도 없는 병원은 대표 시술 자리에 안내 문구를 보여준다', async () => {
    const target = baseHospital({ procedureIds: [] });
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText('등록된 시술 정보가 없어요')).toBeInTheDocument());
  });

  /**
   * 서버가 taxonomy 가 모르는 시술만 내려주는 경우(백엔드가 시술을 추가했는데 프론트 분류가
   * 아직 못 따라간 상태). 그릴 그룹이 하나도 없으니 빈 목록과 **같은** 안내를 보여야 한다 —
   * 라벨 없는 빈 상자가 남으면 "대표 시술" 제목만 덩그러니 뜬다.
   */
  it('모르는 시술 id 만 있는 병원도 같은 안내 문구를 보여준다', async () => {
    const target = baseHospital({ procedureIds: ['future-id' as never] });
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText('등록된 시술 정보가 없어요')).toBeInTheDocument());
  });
});
