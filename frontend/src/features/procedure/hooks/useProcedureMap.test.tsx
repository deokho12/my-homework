import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProcedureMap, useProcedures } from '@/features/procedure';
import { procedures } from '@/mocks/fixtures/procedures';
import { queryWrapper } from '@/test/queryWrapper';

/**
 * `fetchProcedures` 가 HTTP 를 부르므로 `vi.stubGlobal('fetch', ...)` 로 가로챈다.
 * 픽스처는 응답 본문을 채우는 데만 쓴다 — 실제 요청 경로는 아니다.
 */
function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useProcedureMap', () => {
  it('로딩 중에는 빈 맵이다 — 호출부가 옵셔널 체이닝으로 넘어간다', () => {
    fetchMock.mockResolvedValue(ok(procedures));

    const { result } = renderHook(() => useProcedureMap(), { wrapper: queryWrapper });

    expect(result.current.size).toBe(0);
  });

  it('id 로 시술을 동기 조회할 수 있다', async () => {
    fetchMock.mockResolvedValue(ok(procedures));

    const { result } = renderHook(() => useProcedureMap(), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.size).toBeGreaterThan(0));
    expect(result.current.get('implant')?.name).toBe('임플란트');
  });
});

describe('useProcedures', () => {
  it('/procedures 를 부른다', async () => {
    fetchMock.mockResolvedValue(ok(procedures));

    renderHook(() => useProcedures(), { wrapper: queryWrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/procedures$/);
  });

  it('서버가 준 순서를 그대로 유지한다 — 클라이언트가 재정렬하지 않는다', async () => {
    fetchMock.mockResolvedValue(ok(procedures));

    const { result } = renderHook(() => useProcedures(), { wrapper: queryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((item) => item.id)).toEqual(procedures.map((item) => item.id));
  });
});
