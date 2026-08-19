import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as consultApi from '@/features/consult/api/consultApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';
import { RouterBridge } from '@/navigation';
import ConsultRequestScreen from '@/screens/consult/[hospitalId]';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * `getHospitalById()`(동기 스냅샷)를 `useHospital(hospitalId)` 로 바꿨다 — 조회 상태(로딩·404·
 * 에러)를 실제로 구분해야 한다 (`HospitalDetailPage` 와 같은 패턴).
 */
describe('ConsultRequestScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderScreen(hospitalId: string) {
    return renderWithProviders(
      <>
        <RouterBridge />
        <ConsultRequestScreen />
      </>,
      { route: `/consult/${hospitalId}`, path: '/consult/:hospitalId' }
    );
  }

  it('로딩 중에는 병원을 찾을 수 없다고 단정하지 않는다', () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderScreen('h1');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('병원 정보를 찾을 수 없어요')).not.toBeInTheDocument();
  });

  it('불러온 병원 이름과 폼을 렌더하고, 제출하면 접수 API 를 부른다', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);
    const create = vi.spyOn(consultApi, 'createConsultRequest').mockResolvedValue({
      id: 'cr-new',
      hospitalId: target.id,
      hospitalName: null,
      procedureId: 'implant',
      name: '홍길동',
      phone: '01012345678',
      preferredTime: '평일 오전',
      message: '',
      createdAt: new Date().toISOString(),
      status: 'new',
      statusHistory: [],
    });

    renderScreen(target.id);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
    await userEvent.type(screen.getByPlaceholderText('010-0000-0000'), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        hospitalId: target.id,
        procedureId: 'implant',
        name: '홍길동',
        phone: '01012345678',
        preferredTime: '평일 오전',
        message: '',
      })
    );
  });

  it('접수에 실패하면 서버 문구를 그대로 알리고 "접수되었어요" 는 띄우지 않는다', async () => {
    const target = baseHospital();
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);
    vi.spyOn(consultApi, 'createConsultRequest').mockRejectedValue(
      new ApiError({ status: 409, code: 'CONSULT_CLOSED', message: '지금은 이 병원의 상담 신청을 받지 않아요' })
    );

    renderScreen(target.id);

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
    await userEvent.type(screen.getByPlaceholderText('010-0000-0000'), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('지금은 이 병원의 상담 신청을 받지 않아요')
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringContaining('상담 신청이 접수되었어요'));

    vi.unstubAllGlobals();
  });

  it('404 HOSPITAL_NOT_FOUND 면 안내 문구를 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );

    renderScreen('no-such-hospital');

    await waitFor(() => expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument());
  });
});
