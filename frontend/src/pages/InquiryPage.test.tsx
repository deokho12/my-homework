import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as inquiryApi from '@/features/inquiry/api/inquiryApi';
import type { MyHospitalInquiry } from '@/features/inquiry/api/inquiryApi';
import { ApiError } from '@/lib/apiClient';
import { writeCollection } from '@/lib/localCollection';
import { RouterBridge, router } from '@/navigation';
import InquiryPage from '@/pages/InquiryPage';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Hospital, User } from '@/types/domain';

function signIn(): User {
  const user: User = {
    id: 'u-me',
    email: 'me@molarmolar.example',
    name: '김민준',
    provider: 'email',
    role: 'user',
    managedHospitalIds: [],
  };

  useAuthStore.setState({ user, status: 'ready' });

  return user;
}

function createdInquiry(overrides: Partial<MyHospitalInquiry> = {}): MyHospitalInquiry {
  return {
    id: 'hi-new',
    hospitalId: 'h1',
    hospitalName: '강남 스마일 치과',
    topic: 'price',
    content: '임플란트 1개 비용이 궁금해요',
    isPublic: true,
    status: 'unanswered',
    answer: null,
    createdAt: '2026-10-12T04:21:00.000Z',
    ...overrides,
  };
}

describe('InquiryPage — 문의하기', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    signIn();
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'ready' });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderScreen(hospitalId: string) {
    return renderWithProviders(
      <>
        <RouterBridge />
        <InquiryPage />
      </>,
      { route: `/inquiry/${hospitalId}`, path: '/inquiry/:hospitalId' }
    );
  }

  async function renderLoadedForm(hospital: Hospital = baseHospital()) {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(hospital);

    renderScreen(hospital.id);

    await waitFor(() => expect(screen.getByText(`${hospital.name}에 문의`)).toBeInTheDocument());

    return hospital;
  }

  const contentInput = () => screen.getByLabelText('내용');
  const publicCheckbox = () => screen.getByLabelText('다른 사람도 볼 수 있게 공개');
  const submitButton = () => screen.getByRole('button', { name: '문의 남기기' });

  it('로그인해야 들어올 수 있는 라우트다 (가드는 App 의 ROUTES 한 곳에 있다)', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    const route = appSource.slice(appSource.indexOf("path: '/inquiry/:hospitalId'"));

    expect(route.slice(0, 220)).toContain("guard: 'auth'");
  });

  it('404 HOSPITAL_NOT_FOUND 면 빈 상태를 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );

    renderScreen('no-such-hospital');

    await waitFor(() => expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument());
  });

  it('주제는 처음부터 골라져 있지 않고, 고르기 전에는 보낼 수 없다', async () => {
    await renderLoadedForm();

    for (const label of ['가격', '진료시간', '주차·위치', '시술 방법', '기타']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false');
    }

    await userEvent.type(contentInput(), '임플란트 비용이 궁금해요');

    expect(submitButton()).toBeDisabled();
    expect(screen.getByText('주제를 고르고 내용을 5자 이상 적으면 보낼 수 있어요')).toBeInTheDocument();
  });

  it('내용 글자 수를 세고, 5자 미만이면 잠긴 채로 둔다', async () => {
    await renderLoadedForm();

    await userEvent.click(screen.getByRole('button', { name: '가격' }));
    expect(screen.getByText('0/1000')).toBeInTheDocument();

    await userEvent.type(contentInput(), '비용');

    expect(screen.getByText('2/1000')).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();

    await userEvent.type(contentInput(), '이 궁금해요');

    await waitFor(() => expect(submitButton()).toBeEnabled());
  });

  it('1000자를 넘으면 카운터가 빨개지고 오류를 보여준다', async () => {
    await renderLoadedForm();

    await userEvent.click(screen.getByRole('button', { name: '가격' }));
    fireEvent.change(contentInput(), { target: { value: 'ㄱ'.repeat(1001) } });
    fireEvent.blur(contentInput());

    const counter = await screen.findByText('1001/1000');
    expect(counter.className).toContain('text-rose-500');
    // 폼 문구는 api 가 던지는 422 문구와 **같은 문장**이다 (schemas/ 의 상수 한 벌).
    expect(await screen.findByText('문의 내용은 1000자까지 쓸 수 있어요')).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('공개 체크는 기본으로 켜져 있고, 보내는 값에 그대로 실린다', async () => {
    const create = vi.spyOn(inquiryApi, 'createHospitalInquiry').mockResolvedValue(createdInquiry());
    const hospital = await renderLoadedForm();

    expect(publicCheckbox()).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: '가격' }));
    await userEvent.type(contentInput(), '임플란트 1개 비용이 궁금해요');
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        topic: 'price',
        content: '임플란트 1개 비용이 궁금해요',
        isPublic: true,
      })
    );
  });

  it('공개를 끄면 비공개로 보낸다', async () => {
    const create = vi.spyOn(inquiryApi, 'createHospitalInquiry').mockResolvedValue(
      createdInquiry({ isPublic: false })
    );
    await renderLoadedForm();

    await userEvent.click(screen.getByRole('button', { name: '시술 방법' }));
    await userEvent.type(contentInput(), '교정 중인데 앞니만 치료할 수 있나요?');
    await userEvent.click(publicCheckbox());
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ topic: 'procedure', isPublic: false }))
    );
  });

  it('연타해도 한 번만 접수된다', async () => {
    const create = vi.spyOn(inquiryApi, 'createHospitalInquiry').mockResolvedValue(createdInquiry());
    await renderLoadedForm();

    await userEvent.click(screen.getByRole('button', { name: '가격' }));
    await userEvent.type(contentInput(), '임플란트 1개 비용이 궁금해요');

    const form = submitButton().closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText('문의를 남겼어요')).toBeInTheDocument());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('실패하면 서버 문구를 그대로 알리고 쓴 내용은 남는다', async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    vi.spyOn(inquiryApi, 'createHospitalInquiry').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );
    await renderLoadedForm();

    await userEvent.click(screen.getByRole('button', { name: '가격' }));
    await userEvent.type(contentInput(), '임플란트 1개 비용이 궁금해요');
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('병원 정보를 찾을 수 없어요'))
    );
    expect(screen.queryByText('문의를 남겼어요')).not.toBeInTheDocument();
    expect(contentInput()).toHaveValue('임플란트 1개 비용이 궁금해요');
    await waitFor(() => expect(submitButton()).toBeEnabled());
  });

  describe('완료 화면', () => {
    async function submitOnce(overrides: Partial<MyHospitalInquiry> = {}) {
      vi.spyOn(inquiryApi, 'createHospitalInquiry').mockResolvedValue(createdInquiry(overrides));
      const hospital = await renderLoadedForm();

      await userEvent.click(screen.getByRole('button', { name: '가격' }));
      await userEvent.type(contentInput(), '임플란트 1개 비용이 궁금해요');
      if (overrides.isPublic === false) await userEvent.click(publicCheckbox());
      await userEvent.click(submitButton());

      return hospital;
    }

    it('폼 자리에서 접수 사실과 요약을 보여주고 제목에 포커스를 준다', async () => {
      const hospital = await submitOnce();

      const title = await screen.findByText('문의를 남겼어요');
      expect(title).toHaveFocus();
      expect(screen.queryByLabelText('내용')).not.toBeInTheDocument();

      expect(screen.getByText('병원이 답하면 알림으로 알려드릴게요.')).toBeInTheDocument();
      expect(screen.getByText('병원')).toBeInTheDocument();
      expect(screen.getByText(hospital.name)).toBeInTheDocument();
      expect(screen.getByText('주제')).toBeInTheDocument();
      expect(screen.getByText('가격')).toBeInTheDocument();
      expect(screen.getByText('공개 여부')).toBeInTheDocument();
      expect(screen.getByText('공개 요청함')).toBeInTheDocument();
    });

    it('비공개로 보냈으면 공개 여부에 비공개라고 적는다', async () => {
      await submitOnce({ isPublic: false });

      expect(await screen.findByText('비공개')).toBeInTheDocument();
    });

    it('`내 문의 보기` 는 마이페이지 내 문의 탭으로 바꿔 이동한다 (뒤로 눌러도 폼으로 돌아오지 않게)', async () => {
      const replaceSpy = vi.spyOn(router, 'replace');
      await submitOnce();

      await userEvent.click(await screen.findByRole('button', { name: '내 문의 보기' }));

      expect(replaceSpy).toHaveBeenCalledWith('/mypage?tab=inquiries');
    });
  });
});
