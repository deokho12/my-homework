import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as consultApi from '@/features/consult/api/consultApi';
import type { MyConsultRequest } from '@/features/consult/api/consultApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';
import { writeCollection } from '@/lib/localCollection';
import { RouterBridge, router } from '@/navigation';
import ConsultRequestPage from '@/pages/ConsultRequestPage';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import { CONSULT_STATUS_TONE } from '@/features/consult';
import { CONSULT_STATUS_LABEL } from '@/types/domain';
import type { Hospital, Paged, User } from '@/types/domain';

const CONSENT = { agreed: true, noticeVersion: '2026-10-12' };

function signedInAs(id: string, name: string): void {
  const user: User = {
    id,
    email: `${id}@molarmolar.example`,
    name,
    provider: 'email',
    role: 'user',
    managedHospitalIds: [],
  };

  useAuthStore.setState({ user, status: 'ready' });
}

function createdConsult(overrides: Partial<MyConsultRequest> = {}): MyConsultRequest {
  return {
    id: 'cr-new',
    hospitalId: 'h1',
    hospitalName: null,
    procedureId: null,
    name: '김민준',
    phone: '010-1234-5678',
    preferredTime: '평일 오전',
    message: '',
    createdAt: '2026-10-12T04:21:00.000Z',
    status: 'new',
    visitAt: null,
    statusHistory: [{ status: 'new', changedAt: '2026-10-12T04:21:00.000Z', visitAt: null }],
    thirdPartyConsent: { agreedAt: '2026-10-12T04:21:00.000Z', noticeVersion: '2026-10-12' },
    ...overrides,
  };
}

/**
 * 이전 신청으로 연락처가 자동 채워지는 경로는 **api 를 목하지 않고** 실제 저장소에
 * 한 건 접수해서 만든다 — "내 것만 채워진다" 는 계정 스코프 판정이 api 계층에 있어서,
 * 목을 끼우면 그 판정이 테스트에서 통째로 사라진다.
 */
/**
 * 지난 신청 조회를 **내가 원할 때 끝나게** 붙잡아 둔다. 실제 저장소는 같은 tick 에 답해서
 * "자동 채움이 늦게 도착하는 동안 사용자가 입력한다" 는 순서를 만들 수 없다 —
 * 서버가 생기면 그 순서가 기본이 되므로 여기서 고정해 둔다.
 */
function deferMyConsultRequests(): (phone: string | null) => void {
  let settle: (page: Paged<MyConsultRequest>) => void = () => {};

  vi.spyOn(consultApi, 'fetchMyConsultRequests').mockReturnValue(
    new Promise<Paged<MyConsultRequest>>((resolve) => {
      settle = resolve;
    })
  );

  return (phone) => {
    const items = phone === null ? [] : [createdConsult({ phone })];

    settle({ items, meta: { page: 1, pageSize: 1, totalItems: items.length, totalPages: 1 } });
  };
}

async function previousRequestBy(userId: string, phone: string): Promise<void> {
  signedInAs(userId, '지난사람');
  await consultApi.createConsultRequest({
    hospitalId: 'h1',
    procedureId: null,
    name: '지난사람',
    phone,
    preferredTime: '평일 오전',
    message: '',
    thirdPartyConsent: CONSENT,
  });
}

describe('ConsultRequestPage', () => {
  beforeEach(() => {
    writeCollection('consultRequests', []);
    writeCollection('notifications', []);
    signedInAs('u-me', '김민준');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderScreen(hospitalId: string) {
    return renderWithProviders(
      <>
        <RouterBridge />
        <ConsultRequestPage />
      </>,
      { route: `/consult/${hospitalId}`, path: '/consult/:hospitalId' }
    );
  }

  async function renderLoadedForm(hospital: Hospital = baseHospital()) {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(hospital);

    renderScreen(hospital.id);

    await waitFor(() => expect(screen.getByText(hospital.name)).toBeInTheDocument());

    return hospital;
  }

  const nameInput = () => screen.getByLabelText('이름');
  const phoneInput = () => screen.getByLabelText('연락처');
  const consentCheckbox = () => screen.getByLabelText('[필수] 개인정보 제3자 제공 동의');
  const submitButton = () => screen.getByRole('button', { name: '상담 신청하기' });

  /** 제출 가능한 최소 입력. 이름은 자동 채움으로 이미 들어가 있다. */
  async function fillValidForm(phone = '010-1234-5678') {
    await userEvent.clear(phoneInput());
    await userEvent.type(phoneInput(), phone);
    await userEvent.click(consentCheckbox());
  }

  it('로딩 중에는 병원을 찾을 수 없다고 단정하지 않는다', () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderScreen('h1');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('병원 정보를 찾을 수 없어요')).not.toBeInTheDocument();
  });

  it('404 HOSPITAL_NOT_FOUND 면 안내 문구를 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );

    renderScreen('no-such-hospital');

    await waitFor(() => expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument());
  });

  describe('자동 채움', () => {
    it('이름을 로그인한 계정에서 채우고 안내를 보여준다. 한 글자라도 고치면 안내가 사라진다', async () => {
      await renderLoadedForm();

      expect(nameInput()).toHaveValue('김민준');
      expect(screen.getByText('계정 정보에서 자동으로 채웠어요')).toBeInTheDocument();

      await userEvent.type(nameInput(), '이');

      expect(nameInput()).toHaveValue('김민준이');
      expect(screen.queryByText('계정 정보에서 자동으로 채웠어요')).not.toBeInTheDocument();
    });

    it('연락처를 내 지난 신청에서 채우고 안내를 보여준다', async () => {
      await previousRequestBy('u-me', '010-9999-8888');
      signedInAs('u-me', '김민준');

      await renderLoadedForm();

      await waitFor(() => expect(phoneInput()).toHaveValue('010-9999-8888'));
      expect(screen.getByText('지난 상담 신청에 쓴 번호예요')).toBeInTheDocument();
    });

    it('같은 브라우저라도 다른 계정이 쓴 번호는 채우지 않는다', async () => {
      await previousRequestBy('u-other', '010-7777-6666');
      signedInAs('u-me', '김민준');

      await renderLoadedForm();

      // 자동 채움은 비동기라 "아직 안 왔을 뿐" 일 수 있다 — 이름이 들어온 뒤에도 비어 있는지 본다.
      await waitFor(() => expect(nameInput()).toHaveValue('김민준'));
      expect(phoneInput()).toHaveValue('');
      expect(screen.queryByText('지난 상담 신청에 쓴 번호예요')).not.toBeInTheDocument();
    });

    it('늦게 도착한 번호가 이미 입력한 값을 덮어쓰지 않는다', async () => {
      const arrive = deferMyConsultRequests();
      await renderLoadedForm();

      await userEvent.type(phoneInput(), '010-5555-4444');
      await act(async () => {
        arrive('010-9999-8888');
      });

      expect(phoneInput()).toHaveValue('010-5555-4444');
      expect(screen.queryByText('지난 상담 신청에 쓴 번호예요')).not.toBeInTheDocument();
    });

    it('빈 칸을 지나쳐 오류를 본 뒤에 번호가 도착하면 오류도 함께 사라진다', async () => {
      const arrive = deferMyConsultRequests();
      await renderLoadedForm();

      await userEvent.click(phoneInput());
      await userEvent.tab();
      expect(await screen.findByText('연락처를 입력해주세요')).toBeInTheDocument();

      await act(async () => {
        arrive('010-9999-8888');
      });

      await waitFor(() => expect(phoneInput()).toHaveValue('010-9999-8888'));
      // 채워진 번호 위에 `연락처를 입력해주세요` 가 남으면 사용자는 무엇이 틀렸는지 알 수 없다.
      await waitFor(() => expect(screen.queryByText('연락처를 입력해주세요')).not.toBeInTheDocument());
      expect(screen.getByText('지난 상담 신청에 쓴 번호예요')).toBeInTheDocument();
    });

    it('첫 신청이면 연락처가 비어 있고 안내도 없다', async () => {
      await renderLoadedForm();

      expect(phoneInput()).toHaveValue('');
      expect(screen.queryByText('지난 상담 신청에 쓴 번호예요')).not.toBeInTheDocument();
    });
  });

  describe('연락처 형식 검사', () => {
    it('abc 를 넣고 칸을 벗어나면 안내가 뜨고 신청 버튼이 잠긴다', async () => {
      await renderLoadedForm();

      await userEvent.type(phoneInput(), 'abc');
      expect(screen.queryByText('휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요')).not.toBeInTheDocument();

      await userEvent.tab();

      expect(
        await screen.findByText('휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요')
      ).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();
    });

    it.each(['01012345678', '010-1234-5678'])('%s 는 동의까지 하면 신청할 수 있다', async (phone) => {
      await renderLoadedForm();

      await fillValidForm(phone);

      await waitFor(() => expect(submitButton()).toBeEnabled());
    });
  });

  describe('제3자 제공 동의', () => {
    it('체크 전에는 신청 버튼이 잠겨 있고 안내 한 줄이 보인다', async () => {
      await renderLoadedForm();

      await userEvent.type(phoneInput(), '010-1234-5678');

      expect(submitButton()).toBeDisabled();
      expect(screen.getByText('이름 · 연락처 · 동의를 모두 채우면 신청할 수 있어요')).toBeInTheDocument();

      await userEvent.click(consentCheckbox());

      await waitFor(() => expect(submitButton()).toBeEnabled());
      expect(screen.queryByText('이름 · 연락처 · 동의를 모두 채우면 신청할 수 있어요')).not.toBeInTheDocument();
    });

    it('자세히 를 누르면 병원 이름과 미확정 항목이 적힌 안내가 열리고, Esc 로 닫으면 포커스가 돌아온다', async () => {
      const hospital = await renderLoadedForm();
      const detail = screen.getByRole('button', { name: '자세히' });

      await userEvent.click(detail);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('개인정보 제3자 제공 동의')).toBeInTheDocument();
      expect(within(dialog).getByText(hospital.name)).toBeInTheDocument();
      expect(within(dialog).getByText('[확정 필요]')).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(detail).toHaveFocus();
      // 읽기 전용 안내다 — 닫아도 체크박스는 켜지지 않는다.
      expect(consentCheckbox()).not.toBeChecked();
    });

    it('확인 버튼으로도 닫힌다', async () => {
      await renderLoadedForm();

      await userEvent.click(screen.getByRole('button', { name: '자세히' }));
      const dialog = await screen.findByRole('dialog');

      await userEvent.click(within(dialog).getByRole('button', { name: '확인' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
  });

  describe('제출', () => {
    it('기본값 그대로 보내면 시술은 null, 시간은 평일 오전, 동의는 안내문 버전과 함께 실린다', async () => {
      const create = vi.spyOn(consultApi, 'createConsultRequest').mockResolvedValue(createdConsult());
      const hospital = await renderLoadedForm();

      await fillValidForm();
      await userEvent.click(submitButton());

      await waitFor(() =>
        expect(create).toHaveBeenCalledWith({
          hospitalId: hospital.id,
          procedureId: null,
          name: '김민준',
          phone: '010-1234-5678',
          preferredTime: '평일 오전',
          message: '',
          thirdPartyConsent: { agreed: true, noticeVersion: '2026-10-12' },
        })
      );
    });

    it('세부 시술 칩을 고르면 서버가 아는 시술 id 로 보낸다', async () => {
      const create = vi.spyOn(consultApi, 'createConsultRequest').mockResolvedValue(
        createdConsult({ procedureId: 'cavity' })
      );
      await renderLoadedForm(baseHospital({ procedureIds: ['cavity'] }));

      await userEvent.click(screen.getByRole('button', { name: '충치치료 · 레진' }));
      await fillValidForm();
      await userEvent.click(submitButton());

      await waitFor(() =>
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ procedureId: 'cavity' }))
      );
    });

    it('연타해도 한 번만 접수된다', async () => {
      const create = vi.spyOn(consultApi, 'createConsultRequest').mockResolvedValue(createdConsult());
      await renderLoadedForm();

      await fillValidForm();

      // 접수가 끝난 **뒤** 다시 누르는 것은 연타가 아니다 — 그때는 폼이 완료 화면으로 바뀌어
      // 버튼 자체가 없다. 막아야 하는 것은 첫 제출이 끝나기 전에 들어오는 두 번째 제출이라,
      // 같은 tick 에 submit 을 두 번 보낸다 (더블클릭·Enter 연타가 만드는 순서다).
      const form = submitButton().closest('form') as HTMLFormElement;

      fireEvent.submit(form);
      fireEvent.submit(form);

      await waitFor(() => expect(screen.getByText('상담 신청이 접수되었어요')).toBeInTheDocument());
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('실패하면 서버 문구를 그대로 알리고 입력은 그대로 남는다', async () => {
      const alertSpy = vi.fn();
      vi.stubGlobal('alert', alertSpy);
      vi.spyOn(consultApi, 'createConsultRequest').mockRejectedValue(
        new ApiError({ status: 409, code: 'CONSULT_CLOSED', message: '지금은 이 병원의 상담 신청을 받지 않아요' })
      );
      await renderLoadedForm();

      await fillValidForm();
      await userEvent.click(submitButton());

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('지금은 이 병원의 상담 신청을 받지 않아요')
        )
      );
      expect(screen.queryByText('상담 신청이 접수되었어요')).not.toBeInTheDocument();
      expect(phoneInput()).toHaveValue('010-1234-5678');
      await waitFor(() => expect(submitButton()).toBeEnabled());
    });
  });

  describe('완료 화면', () => {
    it('접수 내용을 요약해 보여준다 (시술을 고르지 않았으면 시술 미지정)', async () => {
      vi.spyOn(consultApi, 'createConsultRequest').mockResolvedValue(createdConsult());
      const hospital = await renderLoadedForm();

      await fillValidForm();
      await userEvent.click(submitButton());

      const title = await screen.findByText('상담 신청이 접수되었어요');
      expect(title).toHaveFocus();
      expect(screen.queryByLabelText('연락처')).not.toBeInTheDocument();

      expect(screen.getByText('병원')).toBeInTheDocument();
      expect(screen.getByText(hospital.name)).toBeInTheDocument();
      expect(screen.getByText('시술')).toBeInTheDocument();
      expect(screen.getByText('시술 미지정')).toBeInTheDocument();
      expect(screen.getByText('연락 시간')).toBeInTheDocument();
      expect(screen.getByText('평일 오전')).toBeInTheDocument();
      expect(screen.getByText('상태')).toBeInTheDocument();
      expect(screen.getByText('신규')).toBeInTheDocument();
    });

    it('상태 칩은 마이페이지·관리자 목록과 같은 색표를 쓴다 (한 번 누르면 가는 화면끼리 색이 갈리지 않게)', async () => {
      vi.spyOn(consultApi, 'createConsultRequest').mockResolvedValue(createdConsult());
      await renderLoadedForm();

      await fillValidForm();
      await userEvent.click(submitButton());

      const label = await screen.findByText(CONSULT_STATUS_LABEL.new);
      // `Badge` 는 라벨 텍스트를 감싼 알약에 톤 클래스를 붙인다. `new` 의 공용 톤은 `info`(sky).
      expect(CONSULT_STATUS_TONE.new).toBe('info');
      expect(label.parentElement?.className).toContain('bg-sky-50');
    });

    it('내 상담 내역 보기 는 마이페이지로 바꿔 이동한다 (뒤로 눌러도 폼으로 돌아오지 않게)', async () => {
      vi.spyOn(consultApi, 'createConsultRequest').mockResolvedValue(createdConsult());
      const replaceSpy = vi.spyOn(router, 'replace');
      await renderLoadedForm();

      await fillValidForm();
      await userEvent.click(submitButton());

      await userEvent.click(await screen.findByRole('button', { name: '내 상담 내역 보기' }));

      expect(replaceSpy).toHaveBeenCalledWith('/mypage');
    });
  });
});
