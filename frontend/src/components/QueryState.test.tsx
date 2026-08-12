import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { QueryState } from '@/components/QueryState';

describe('QueryState', () => {
  it('isLoading 이면 status 역할과 스크린리더 문구를 렌더한다', () => {
    render(
      <QueryState<string>
        isLoading
        isError={false}
        data={undefined}
        emptyState={{ title: '없어요' }}
      >
        {(data) => <p>{data}</p>}
      </QueryState>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('불러오는 중이에요')).toBeInTheDocument();
  });

  it('로딩이 200ms 넘게 이어지면 스피너를 렌더한다', () => {
    vi.useFakeTimers();
    try {
      render(
        <QueryState<string> isLoading isError={false} data={undefined} emptyState={{ title: '없어요' }}>
          {(data) => <p>{data}</p>}
        </QueryState>
      );

      // 임계값 전에는 깜빡임을 막기 위해 스피너를 띄우지 않는다.
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('isError 이면 에러 문구와 다시 시도 버튼을 렌더하고 onRetry 를 호출한다', async () => {
    const onRetry = vi.fn();
    render(
      <QueryState<string>
        isLoading={false}
        isError
        data={undefined}
        onRetry={onRetry}
        emptyState={{ title: '없어요' }}
      >
        {(data) => <p>{data}</p>}
      </QueryState>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('isError 여도 data 가 있으면 children 을 유지한다 (refetch 실패)', () => {
    render(
      <QueryState<string[]>
        isLoading={false}
        isError
        data={['라온치과']}
        emptyState={{ title: '없어요' }}
      >
        {(data) => <p>{data[0]}</p>}
      </QueryState>
    );

    expect(screen.getByText('라온치과')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('errorState 로 에러 문구를 덮어쓸 수 있다', () => {
    render(
      <QueryState<string>
        isLoading={false}
        isError
        data={undefined}
        emptyState={{ title: '없어요' }}
        errorState={{ title: '병원 정보를 불러오지 못했어요' }}
      >
        {(data) => <p>{data}</p>}
      </QueryState>
    );

    expect(screen.getByText('병원 정보를 불러오지 못했어요')).toBeInTheDocument();
  });

  it('data 가 null 이면 emptyState.title 을 렌더한다', () => {
    render(
      <QueryState<string | null>
        isLoading={false}
        isError={false}
        data={null}
        emptyState={{ title: '병원 정보를 찾을 수 없어요' }}
      >
        {(data) => <p>{data}</p>}
      </QueryState>
    );

    expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument();
  });

  it('data 가 빈 배열이면 empty 로 본다', () => {
    render(
      <QueryState<string[]>
        isLoading={false}
        isError={false}
        data={[]}
        emptyState={{ title: '결과가 없어요' }}
      >
        {(data) => <p>{data.length}개</p>}
      </QueryState>
    );

    expect(screen.getByText('결과가 없어요')).toBeInTheDocument();
  });

  it('isRetrying 이면 재시도 버튼을 잠그고 라벨을 바꾼다', () => {
    render(
      <QueryState<string>
        isLoading={false}
        isError
        data={undefined}
        onRetry={() => {}}
        isRetrying
        emptyState={{ title: '없어요' }}
      >
        {(data) => <p>{data}</p>}
      </QueryState>
    );

    expect(screen.getByRole('button', { name: '다시 시도 중' })).toBeDisabled();
  });

  it('data 가 null 이면 커스텀 isEmpty 보다 null 우선 규약을 따른다', () => {
    render(
      <QueryState<string | null>
        isLoading={false}
        isError={false}
        data={null}
        isEmpty={() => false}
        emptyState={{ title: '병원 정보를 찾을 수 없어요' }}
      >
        {(data) => <p>{data}</p>}
      </QueryState>
    );

    expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument();
  });

  it('빈 배열도 isEmpty 가 false 를 주면 children 을 렌더한다', () => {
    render(
      <QueryState<string[]>
        isLoading={false}
        isError={false}
        data={[]}
        isEmpty={() => false}
        emptyState={{ title: '결과가 없어요' }}
      >
        {(data) => <p>{data.length}개</p>}
      </QueryState>
    );

    expect(screen.getByText('0개')).toBeInTheDocument();
    expect(screen.queryByText('결과가 없어요')).not.toBeInTheDocument();
  });

  it('isEmpty 를 넘기면 기본 판정 대신 그 함수를 쓴다', () => {
    render(
      <QueryState<{ items: string[] }>
        isLoading={false}
        isError={false}
        data={{ items: [] }}
        isEmpty={(data) => data.items.length === 0}
        emptyState={{ title: '결과가 없어요' }}
      >
        {(data) => <p>{data.items.length}개</p>}
      </QueryState>
    );

    expect(screen.getByText('결과가 없어요')).toBeInTheDocument();
  });

  it('데이터가 있으면 children 을 렌더한다', () => {
    render(
      <QueryState<string[]>
        isLoading={false}
        isError={false}
        data={['라온치과']}
        emptyState={{ title: '결과가 없어요' }}
      >
        {(data) => <p>{data[0]}</p>}
      </QueryState>
    );

    expect(screen.getByText('라온치과')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
