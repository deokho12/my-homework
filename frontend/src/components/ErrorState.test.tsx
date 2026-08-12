import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from '@/components/ErrorState';

describe('ErrorState', () => {
  it('기본 문구를 alert 역할로 렌더한다', () => {
    render(<ErrorState />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('정보를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('잠시 후 다시 시도해주세요')).toBeInTheDocument();
  });

  it('전달한 문구로 덮어쓴다', () => {
    render(<ErrorState title="병원 정보를 불러오지 못했어요" description="네트워크를 확인해주세요" />);

    expect(screen.getByText('병원 정보를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('네트워크를 확인해주세요')).toBeInTheDocument();
  });

  it('onRetry 가 없으면 다시 시도 버튼을 렌더하지 않는다', () => {
    render(<ErrorState />);

    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('onRetry 가 있으면 버튼을 렌더하고 클릭 시 호출한다', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('isRetrying 이면 버튼을 잠그고 라벨과 스피너를 바꾼다', () => {
    render(<ErrorState onRetry={() => {}} isRetrying />);

    const button = screen.getByRole('button', { name: '다시 시도 중' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toHaveClass('animate-spin');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('isRetrying 이 아니면 버튼이 눌릴 수 있고 스피너가 돌지 않는다', () => {
    render(<ErrorState onRetry={() => {}} />);

    const button = screen.getByRole('button', { name: '다시 시도' });
    expect(button).toBeEnabled();
    expect(button.querySelector('svg')).not.toHaveClass('animate-spin');
  });

  it('기본 variant 는 아이콘과 넉넉한 여백을 가진다', () => {
    const { container } = render(<ErrorState />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('py-16', 'px-6');
  });

  it('inline variant 는 아이콘 없이 한 줄로 렌더한다', () => {
    const { container } = render(<ErrorState title="후기를 불러오지 못했어요" variant="inline" />);

    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('py-8');
    expect(screen.getByRole('alert')).not.toHaveClass('py-16');
    expect(screen.getByText('후기를 불러오지 못했어요')).toHaveClass('text-sm', 'text-neutral-400');
  });

  it('inline variant 도 재시도 버튼을 렌더한다', async () => {
    const onRetry = vi.fn();
    render(<ErrorState variant="inline" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
