import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router-dom';

import { writeCollection, readCollection, type StoredHospitalInquiry } from '@/lib/localCollection';
import { RouterBridge } from '@/navigation';
import AdminInquiriesPage from '@/pages/admin/AdminInquiriesPage';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { User, UserRole } from '@/types/domain';

function signIn(role: UserRole, managedHospitalIds: string[] = []): User {
  const user: User = {
    id: role === 'operator' ? 'u-op' : 'u-admin',
    email: 'admin@molarmolar.example',
    name: '담당자',
    provider: 'email',
    role,
    managedHospitalIds,
  };

  useAuthStore.setState({ user, status: 'ready' });

  return user;
}

function seedInquiries(rows: Partial<StoredHospitalInquiry>[]): void {
  writeCollection(
    'inquiries',
    rows.map((row, index) => ({
      id: `hi${index + 1}`,
      hospitalId: 'h1',
      hospitalName: '강남 스마일 치과',
      topic: 'price' as const,
      content: `질문 ${index + 1}`,
      isPublic: true,
      answer: null,
      createdAt: `2026-10-0${index + 1}T09:20:00.000Z`,
      ownerUserId: 'u-me',
      askerDisplayName: '김민준',
      ...row,
    }))
  );
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function probe(): string {
  return screen.getByTestId('location').textContent ?? '';
}

function renderAdminInquiries(route = '/admin/inquiries') {
  return renderWithProviders(
    <>
      <RouterBridge />
      <LocationProbe />
      <AdminInquiriesPage />
    </>,
    { route, path: '/admin/inquiries/:id' }
  );
}

function tab(name: RegExp | string) {
  return screen.getByRole('tab', { name });
}

describe('AdminInquiriesPage', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    writeCollection('notifications', []);
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ user: null, status: 'ready' });
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('목록과 상태 탭', () => {
    beforeEach(() => {
      seedInquiries([
        { id: 'hi-waiting', content: '임플란트 비용이 궁금해요' },
        {
          id: 'hi-done',
          content: '토요일에도 진료하나요?',
          topic: 'hours',
          answer: { content: '토요일은 2시까지 진료합니다', isPublic: true, answeredAt: '2026-10-06T00:00:00.000Z' },
        },
      ]);
      signIn('hospital_admin', ['h1']);
    });

    it('탭 숫자는 요약에서 오고, 기본 탭은 미답변이다', async () => {
      renderAdminInquiries();

      await waitFor(() => expect(tab('미답변 1')).toHaveAttribute('aria-selected', 'true'));
      expect(tab('답변완료 1')).toBeInTheDocument();
      expect(tab('전체 2')).toBeInTheDocument();
      expect(await screen.findByText('임플란트 비용이 궁금해요')).toBeInTheDocument();
      expect(screen.queryByText('토요일에도 진료하나요?')).not.toBeInTheDocument();
    });

    it('탭을 바꾸면 목록이 그 상태만 보여주고 주소에 남는다 (기본 탭은 주소에 적지 않는다)', async () => {
      renderAdminInquiries();

      await userEvent.click(await screen.findByRole('tab', { name: '답변완료 1' }));

      expect(await screen.findByText('토요일에도 진료하나요?')).toBeInTheDocument();
      expect(screen.queryByText('임플란트 비용이 궁금해요')).not.toBeInTheDocument();
      expect(probe()).toBe('/admin/inquiries?status=answered');

      await userEvent.click(tab(/전체/));

      expect(await screen.findByText('임플란트 비용이 궁금해요')).toBeInTheDocument();
      expect(probe()).toBe('/admin/inquiries?status=all');
    });

    it('키보드 ←/→/Home/End 로 탭을 옮긴다', async () => {
      renderAdminInquiries();

      await waitFor(() => expect(tab('미답변 1')).toBeInTheDocument());
      act(() => tab('미답변 1').focus());

      await userEvent.keyboard('{ArrowRight}');
      expect(tab('답변완료 1')).toHaveAttribute('aria-selected', 'true');
      expect(tab('답변완료 1')).toHaveFocus();

      await userEvent.keyboard('{End}');
      expect(tab('전체 2')).toHaveAttribute('aria-selected', 'true');

      await userEvent.keyboard('{ArrowRight}');
      expect(tab('미답변 1')).toHaveAttribute('aria-selected', 'true');

      await userEvent.keyboard('{Home}');
      expect(tab('미답변 1')).toHaveAttribute('aria-selected', 'true');
    });

    it('목록 항목은 상태 칩·시각·제목·마스킹된 이름과 주제를 보여준다', async () => {
      renderAdminInquiries('/admin/inquiries?status=all');

      await screen.findByText('김*준 · 가격');

      const list = screen.getByRole('tabpanel');
      expect(within(list).getByText('미답변')).toBeInTheDocument();
      expect(within(list).getByText('답변완료')).toBeInTheDocument();
      // 접수 시각은 Asia/Seoul 절대 시각이다.
      expect(within(list).getByText('10/1 18:20')).toBeInTheDocument();
      expect(within(list).getByText('김*준 · 가격')).toBeInTheDocument();
      expect(within(list).getByText('김*준 · 진료시간')).toBeInTheDocument();
      expect(within(list).queryByText('김민준')).not.toBeInTheDocument();
    });

    it('좁은 화면 규칙은 CSS 로만 가른다 — 선택 전에는 상세가, 선택 후에는 목록이 감춰진다', async () => {
      renderAdminInquiries();

      const listSection = await screen.findByRole('region', { name: '문의 목록' });
      const detailSection = screen.getByRole('region', { name: '문의 상세' });
      expect(listSection.className).not.toContain('hidden');
      expect(detailSection.className).toContain('hidden md:block');

      await userEvent.click(await screen.findByText('임플란트 비용이 궁금해요'));

      await waitFor(() => expect(probe()).toBe('/admin/inquiries/hi-waiting'));
      expect(screen.getByRole('region', { name: '문의 목록' }).className).toContain('hidden md:block');
      expect(screen.getByRole('region', { name: '문의 상세' }).className).not.toContain('hidden');
    });

    it('선택 전 상세 자리에는 안내가 있다', async () => {
      renderAdminInquiries();

      expect(await screen.findByText('왼쪽에서 문의를 선택하세요')).toBeInTheDocument();
    });

    it('미답변이 없으면 탭에 맞는 빈 문구를 보여준다', async () => {
      writeCollection('inquiries', []);

      renderAdminInquiries();

      expect(await screen.findByText('답변할 문의가 없어요')).toBeInTheDocument();
    });
  });

  describe('상세와 답변', () => {
    beforeEach(() => {
      seedInquiries([
        { id: 'hi-waiting', content: '임플란트 비용이 궁금해요\n뼈이식도 필요할까요?' },
        { id: 'hi-private', content: '비공개로 묻습니다', isPublic: false },
      ]);
      signIn('hospital_admin', ['h1']);
    });

    it('상세에 마스킹된 이름·주제·시각과 본문 전문이 보인다', async () => {
      renderAdminInquiries('/admin/inquiries/hi-waiting');

      expect(await screen.findByText('김*준 · 가격 · 10/1 18:20')).toBeInTheDocument();

      const detail = screen.getByRole('region', { name: '문의 상세' });
      expect(within(detail).getByText('뼈이식도 필요할까요?', { exact: false })).toBeInTheDocument();
    });

    it('자주 쓰는 답변을 누르면 답변칸이 채워진다', async () => {
      renderAdminInquiries('/admin/inquiries/hi-waiting');

      await userEvent.click(await screen.findByRole('button', { name: '진료시간 안내' }));

      expect((screen.getByLabelText('답변') as HTMLTextAreaElement).value).toContain('평일 [진료시간]');
    });

    it('쓰던 답변이 있으면 템플릿으로 덮어쓰기 전에 물어본다', async () => {
      const confirmSpy = vi.fn(() => false);
      vi.stubGlobal('confirm', confirmSpy);
      renderAdminInquiries('/admin/inquiries/hi-waiting');

      const answerInput = await screen.findByLabelText('답변');
      await userEvent.type(answerInput, '직접 쓴 답변입니다');
      await userEvent.click(screen.getByRole('button', { name: '비용 안내' }));

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('작성 중인 답변이 있어요'));
      // 취소했으므로 쓰던 글이 남는다.
      expect(answerInput).toHaveValue('직접 쓴 답변입니다');
    });

    it('대괄호가 남아 있으면 경고하고, 제출할 때 한 번 더 확인한다', async () => {
      const confirmSpy = vi.fn(() => false);
      vi.stubGlobal('confirm', confirmSpy);
      renderAdminInquiries('/admin/inquiries/hi-waiting');

      await userEvent.click(await screen.findByRole('button', { name: '진료시간 안내' }));

      expect(
        await screen.findByText('[진료시간] 처럼 대괄호로 남은 부분을 실제 정보로 바꿔주세요')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: '답변 등록' }));

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('대괄호가 그대로예요'));
      // 취소하면 등록되지 않는다.
      expect(readCollection('inquiries').find((row) => row.id === 'hi-waiting')?.answer).toBeNull();
    });

    it('환자가 비공개로 남긴 문의에는 공개 체크박스 대신 안내가 있다', async () => {
      renderAdminInquiries('/admin/inquiries/hi-private');

      expect(await screen.findByText('환자가 비공개로 요청함')).toBeInTheDocument();
      expect(screen.getByText('환자가 비공개로 남긴 문의예요. 답변도 환자에게만 보여요.')).toBeInTheDocument();
      expect(screen.queryByLabelText('다른 환자에게도 공개 (병원 상세 문의)')).not.toBeInTheDocument();
    });

    it('답변을 등록하면 완료 모습으로 바뀌고 탭 숫자와 목록이 따라 바뀐다', async () => {
      renderAdminInquiries('/admin/inquiries/hi-waiting');

      await waitFor(() => expect(tab('미답변 2')).toBeInTheDocument());
      await userEvent.type(
        await screen.findByLabelText('답변'),
        '임플란트는 재료에 따라 90만원부터 150만원 사이입니다.'
      );
      await userEvent.click(screen.getByRole('button', { name: '답변 등록' }));

      expect(await screen.findByRole('status')).toHaveTextContent('답변을 등록했어요. 환자에게 알림이 갔어요.');
      expect(screen.getByText('강남 스마일 치과 답변 · 공개')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '답변 등록' })).not.toBeInTheDocument();

      // 숫자와 목록이 한 번에 갱신된다 — 미답변 탭에서 빠진다.
      await waitFor(() => expect(tab('미답변 1')).toBeInTheDocument());
      expect(tab('답변완료 1')).toBeInTheDocument();
      const list = screen.getByRole('region', { name: '문의 목록' });
      expect(within(list).queryByText('임플란트 비용이 궁금해요', { exact: false })).not.toBeInTheDocument();
    });
  });

  describe('스코프', () => {
    beforeEach(() => {
      seedInquiries([
        { id: 'hi-h1', hospitalId: 'h1', content: 'h1 에 남긴 질문' },
        { id: 'hi-h2', hospitalId: 'h2', hospitalName: 'B치과', content: 'h2 에 남긴 질문' },
      ]);
    });

    it('다른 병원 담당자에게는 목록에도 없고 직접 주소로도 열리지 않는다', async () => {
      signIn('hospital_admin', ['h1']);

      renderAdminInquiries('/admin/inquiries?status=all');

      expect(await screen.findByText('h1 에 남긴 질문')).toBeInTheDocument();
      expect(screen.queryByText('h2 에 남긴 질문')).not.toBeInTheDocument();
    });

    it('담당하지 않는 문의의 주소로 들어오면 찾을 수 없다고 한다', async () => {
      signIn('hospital_admin', ['h1']);

      renderAdminInquiries('/admin/inquiries/hi-h2');

      expect(await screen.findByText('문의를 찾을 수 없어요')).toBeInTheDocument();
    });

    it('운영자는 전 병원을 보지만 답변 영역 대신 안내를 본다', async () => {
      signIn('operator');

      renderAdminInquiries('/admin/inquiries/hi-h2');

      // 목록에도 같은 글이 보이므로 상세의 제목으로 가른다.
      expect(await screen.findByRole('heading', { name: 'h2 에 남긴 질문' })).toBeInTheDocument();
      expect(screen.getByText('답변은 병원 담당자만 할 수 있어요')).toBeInTheDocument();
      expect(screen.queryByLabelText('답변')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '답변 등록' })).not.toBeInTheDocument();
    });
  });
});
