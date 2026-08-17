import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as consultApi from '@/features/consult/api/consultApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';
import { RouterBridge } from '@/navigation';
import ConsultRequestScreen from '@/screens/consult/[hospitalId]';
import { useAuthStore } from '@/store/useAuthStore';
import { baseMyConsultRequest } from '@/test/consultFixture';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 상담 신청 화면.
 *
 * 제출은 이제 **서버로 간다** — 예전에는 브라우저 저장소(zustand persist)에 넣어서
 * 관리자 화면이 그것을 볼 수 없었다. 서버가 거절하면(상담 마감·연락처 형식 등)
 * 그 문구를 그대로 보여준다.
 */
describe('ConsultRequestScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  function renderScreen(hospitalId: string, query = '') {
    return renderWithProviders(
      <>
        <RouterBridge />
        <ConsultRequestScreen />
      </>,
      { route: `/consult/${hospitalId}${query}`, path: '/consult/:hospitalId' }
    );
  }

  it('로딩 중에는 병원을 찾을 수 없다고 단정하지 않는다', () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderScreen('h1');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('병원 정보를 찾을 수 없어요')).not.toBeInTheDocument();
  });

  it('★ 불러온 병원 이름과 폼을 렌더하고, 제출하면 서버로 보낸다', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);
    const createSpy = vi
      .spyOn(consultApi, 'createConsultRequest')
      .mockResolvedValue(baseMyConsultRequest({ hospitalId: target.id, name: '홍길동' }));

    renderScreen(target.id);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
    await userEvent.type(screen.getByPlaceholderText('010-0000-0000'), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0][0]).toMatchObject({
      hospitalId: target.id,
      name: '홍길동',
      phone: '01012345678',
    });
  });

  it('★ 전문의를 지목해 들어오면 그 id 를 함께 보낸다 (예전에는 병원만 넘어갔다)', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);
    const createSpy = vi
      .spyOn(consultApi, 'createConsultRequest')
      .mockResolvedValue(baseMyConsultRequest({ hospitalId: target.id }));

    renderScreen(target.id, '?doctorId=d1');

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(screen.getByText(/지목 전문의/)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
    await userEvent.type(screen.getByPlaceholderText('010-0000-0000'), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0][0]).toMatchObject({ doctorId: 'd1' });
  });

  it('★ 병원 상담으로 들어오면 doctorId 키를 아예 넣지 않는다 (빈 값을 지어내면 422)', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);
    const createSpy = vi
      .spyOn(consultApi, 'createConsultRequest')
      .mockResolvedValue(baseMyConsultRequest({ hospitalId: target.id }));

    renderScreen(target.id);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(screen.queryByText(/지목 전문의/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
    await userEvent.type(screen.getByPlaceholderText('010-0000-0000'), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect('doctorId' in createSpy.mock.calls[0][0]).toBe(false);
  });

  it('★ 서버가 거절하면 그 문구를 그대로 보여준다 (상담 마감 등)', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);
    vi.spyOn(consultApi, 'createConsultRequest').mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONSULT_CLOSED',
        message: '지금은 이 병원의 상담 신청을 받지 않아요',
      })
    );

    renderScreen(target.id);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
    await userEvent.type(screen.getByPlaceholderText('010-0000-0000'), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    await waitFor(() =>
      expect(screen.getByText('지금은 이 병원의 상담 신청을 받지 않아요')).toBeInTheDocument()
    );
  });

  it('404 HOSPITAL_NOT_FOUND 면 안내 문구를 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );

    renderScreen('no-such-hospital');

    await waitFor(() => expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument());
  });
});
