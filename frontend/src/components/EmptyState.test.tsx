import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  it('title 을 렌더하고 alert 역할은 붙이지 않는다', () => {
    render(<EmptyState title="찜한 병원이 없어요" />);

    expect(screen.getByText('찜한 병원이 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('description 이 없으면 렌더하지 않는다', () => {
    const { container } = render(<EmptyState title="찜한 병원이 없어요" />);

    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('actionLabel 과 onAction 이 둘 다 있을 때만 버튼을 렌더한다', () => {
    const { unmount } = render(<EmptyState title="없어요" actionLabel="둘러보기" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();

    render(<EmptyState title="없어요" onAction={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('버튼을 누르면 onAction 을 호출한다', async () => {
    const onAction = vi.fn();
    render(<EmptyState title="없어요" actionLabel="둘러보기" onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: '둘러보기' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('기본 variant 는 아이콘과 넉넉한 여백을 가진다', () => {
    const { container } = render(<EmptyState title="없어요" />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('py-16', 'px-6');
  });

  it('icon={null} 이면 아이콘을 렌더하지 않는다', () => {
    const { container } = render(<EmptyState title="없어요" icon={null} />);

    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('inline variant 는 아이콘 없이 한 줄로 렌더한다', () => {
    const { container } = render(<EmptyState title="아직 등록된 후기가 없어요" variant="inline" />);

    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('py-8');
    expect(container.firstElementChild).not.toHaveClass('py-16');
    expect(screen.getByText('아직 등록된 후기가 없어요')).toHaveClass('text-sm', 'text-neutral-400');
  });

  it('inline variant 도 description 과 버튼을 렌더한다', () => {
    render(
      <EmptyState
        title="없어요"
        description="조건을 바꿔보세요"
        actionLabel="초기화"
        onAction={() => {}}
        variant="inline"
      />
    );

    expect(screen.getByText('조건을 바꿔보세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '초기화' })).toBeInTheDocument();
  });
});
