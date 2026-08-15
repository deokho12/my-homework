import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDelayedFlag } from '@/hooks/useDelayedFlag';

describe('useDelayedFlag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('지연 시간이 지나기 전에는 false 다', () => {
    const { result } = renderHook(() => useDelayedFlag(true, 200));

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(199);
    });

    expect(result.current).toBe(false);
  });

  it('flag 가 지연 시간 동안 유지되면 true 가 된다', () => {
    const { result } = renderHook(() => useDelayedFlag(true, 200));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(true);
  });

  // 마지막 단정이 flag=false 상태면 반환값(`flag && show`)이 무조건 false 라
  // 무엇을 지워도 통과한다. 아래 세 테스트는 flag 를 다시 켠 뒤를 단정해서
  // 내부 `show` 가 실제로 리셋/취소됐는지 관찰한다.
  it('flag 가 false 로 돌아가면 즉시 false 가 되고 내부 상태도 리셋된다', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedFlag(flag, 200), {
      initialProps: { flag: true },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);

    rerender({ flag: false });
    expect(result.current).toBe(false);

    // cleanup 의 setShow(false) 가 없으면 여기서 곧바로 true 가 되어 실패한다.
    rerender({ flag: true });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('flag 가 false 인 동안에는 타이머가 시작되지 않는다', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedFlag(flag, 200), {
      initialProps: { flag: false },
    });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(false);

    // flag=false 인 동안 타이머가 돌았다면 여기서 즉시 true 가 되어 실패한다.
    rerender({ flag: true });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('지연 시간 안에 flag 가 꺼지면 타이머가 취소되어 지연이 처음부터 다시 걸린다', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedFlag(flag, 200), {
      initialProps: { flag: true },
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ flag: false });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);

    // clearTimeout 이 없으면 첫 타이머가 t=200 에 발화해 show 가 true 로 남고,
    // flag 를 다시 켜는 순간 지연 없이 true 가 되어 실패한다.
    rerender({ flag: true });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});
