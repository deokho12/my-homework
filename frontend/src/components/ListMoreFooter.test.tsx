import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ListMoreFooter } from '@/components/ListMoreFooter';

function renderFooter(props: Partial<React.ComponentProps<typeof ListMoreFooter>> = {}) {
  const onLoadMore = vi.fn();

  render(
    <ListMoreFooter
      loadedCount={20}
      totalCount={57}
      unit="곳"
      noun="병원"
      isLoadingMore={false}
      isError={false}
      onLoadMore={onLoadMore}
      {...props}
    />
  );

  return onLoadMore;
}

describe('ListMoreFooter', () => {
  it('총 개수가 한 묶음 이하면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <ListMoreFooter
        loadedCount={7}
        totalCount={7}
        unit="곳"
        noun="병원"
        isLoadingMore={false}
        isError={false}
        onLoadMore={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('남은 묶음과 진행 상황을 말한다', async () => {
    const onLoadMore = renderFooter();

    expect(screen.getByText('57곳 중 20곳 보는 중')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: '병원 20곳 더 보기' });

    await userEvent.click(button);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('마지막 묶음 라벨은 남은 수를 말한다', () => {
    renderFooter({ loadedCount: 50, totalCount: 57 });

    expect(screen.getByRole('button', { name: '병원 7곳 더 보기' })).toBeInTheDocument();
  });

  it('의사 모드는 단위가 "명" 이다', () => {
    renderFooter({ unit: '명', noun: '의사' });

    expect(screen.getByText('57명 중 20명 보는 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '의사 20명 더 보기' })).toBeInTheDocument();
  });

  /**
   * 네이티브 `disabled` 를 쓰지 않는 이유: Chrome 은 포커스된 엘리먼트가 `disabled` 가 되면
   * 포커스를 body 로 떨어뜨린다 — 키보드로 Enter 를 누른 사람이 제자리를 잃는다 (설계 §7).
   */
  it('불러오는 중에는 aria-disabled·aria-busy 로 잠근다 — 네이티브 disabled 가 아니다', () => {
    renderFooter({ isLoadingMore: true });

    const button = screen.getByRole('button', { name: /불러오는 중/ });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    // 진행 줄은 그대로 남는다 — 카드도 사라지지 않는다.
    expect(screen.getByText('57곳 중 20곳 보는 중')).toBeInTheDocument();
  });

  it('불러오는 동안에도 포커스가 버튼에 남고, 끝나도 그대로다', async () => {
    const onLoadMore = vi.fn();
    const common = {
      totalCount: 57,
      unit: '곳',
      noun: '병원',
      isError: false,
      onLoadMore,
    } as const;
    const { rerender } = render(
      <ListMoreFooter {...common} loadedCount={20} isLoadingMore={false} />
    );

    const button = screen.getByRole('button');
    button.focus();
    await userEvent.click(button);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<ListMoreFooter {...common} loadedCount={20} isLoadingMore />);

    expect(screen.getByRole('button')).toHaveFocus();
    // jsdom 은 Chrome 처럼 `disabled` 가 된 엘리먼트의 포커스를 떨어뜨리지 않는다. 그래서
    // 위 `toHaveFocus()` 만으로는 회귀를 잡지 못한다 — 속성 자체가 없음을 못 박는다.
    expect(screen.getByRole('button')).not.toHaveAttribute('disabled');

    rerender(<ListMoreFooter {...common} loadedCount={40} isLoadingMore={false} />);

    expect(screen.getByRole('button', { name: '병원 17곳 더 보기' })).toHaveFocus();
  });

  it('불러오는 중 누른 클릭은 무시한다 — 같은 묶음을 두 번 받지 않는다', async () => {
    const onLoadMore = renderFooter({ isLoadingMore: true });

    await userEvent.click(screen.getByRole('button', { name: /불러오는 중/ }));

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('실패하면 이유를 alert 로 알리고 버튼이 "다시 시도" 가 된다', () => {
    renderFooter({ isError: true });

    expect(screen.getByRole('alert')).toHaveTextContent('더 불러오지 못했어요');
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다 불러오면 버튼이 사라지고 끝 줄만 남는다', () => {
    renderFooter({ loadedCount: 57 });

    expect(screen.getByText('57곳을 모두 봤어요')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /**
   * 설계 §7. 버튼이 사라지는 순간 포커스가 body 로 떨어지므로 끝 줄로 옮겨 준다 — 다만
   * **누른 사람에게만**이다. 아래 두 테스트가 그 둘을 갈라 고정한다.
   */
  it('버튼을 눌러 끝에 도달하면 끝 줄로 포커스가 옮겨간다', async () => {
    const common = {
      totalCount: 40,
      unit: '곳',
      noun: '병원',
      isLoadingMore: false,
      isError: false,
      onLoadMore: vi.fn(),
    } as const;
    const { rerender } = render(<ListMoreFooter {...common} loadedCount={20} />);

    await userEvent.click(screen.getByRole('button', { name: '병원 20곳 더 보기' }));
    rerender(<ListMoreFooter {...common} loadedCount={40} />);

    expect(screen.getByText('40곳을 모두 봤어요')).toHaveFocus();
  });

  it('처음부터 다 불러온 목록은 포커스를 빼앗지 않는다', () => {
    render(
      <ListMoreFooter
        loadedCount={40}
        totalCount={40}
        unit="곳"
        noun="병원"
        isLoadingMore={false}
        isError={false}
        onLoadMore={vi.fn()}
      />
    );

    expect(screen.getByText('40곳을 모두 봤어요')).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it('진행 줄은 status·live 영역이다 — 숨은 live 영역을 따로 만들지 않는다', () => {
    renderFooter();

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('57곳 중 20곳 보는 중');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
