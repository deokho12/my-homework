import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as procedureApi from '@/features/procedure/api/procedureApi';
import { procedures } from '@/mocks/fixtures/procedures';
import ExploreScreen from '@/screens/tabs/explore';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * `fetchProcedures` 를 스파이해 응답 시점을 직접 제어한다 — `/explore?category=implant`
 * 콜드 로드에서 헤더가 로딩 중에 다른 카테고리("추천")를 사실처럼 주장하지 않는지 검증한다.
 */
describe('탐색 화면 — 시술 목록 로딩 중 카테고리 헤더', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('/explore?category=implant 콜드 로드에서 시술 목록이 아직 없으면 "추천" 이라고 주장하지 않는다', async () => {
    let resolveProcedures!: (value: typeof procedures) => void;
    vi.spyOn(procedureApi, 'fetchProcedures').mockReturnValue(
      new Promise((resolve) => {
        resolveProcedures = resolve;
      })
    );

    renderWithProviders(<ExploreScreen />, { route: '/explore?category=implant' });

    // 아직 로딩 중이다 — "추천" 병원이라고 잘못 주장하면 안 된다(실제 목록은 이미
    // `implant` 로 필터링돼 있다). 헤더는 &ldquo;/&rdquo; (U+201C/U+201D) 를 쓴다.
    expect(screen.queryByText('“추천” 병원')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: '카테고리 이름을 불러오는 중이에요' })).toBeInTheDocument();
    // 시술 카테고리 칩 목록도 [추천, 기타] 뿐인 잘린 목록을 실제처럼 보여주면 안 된다.
    expect(screen.getByRole('status', { name: '시술 카테고리를 불러오는 중이에요' })).toBeInTheDocument();

    resolveProcedures(procedures);

    await waitFor(() => expect(screen.getByText('“임플란트” 병원')).toBeInTheDocument());
    expect(screen.queryByText('“추천” 병원')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '카테고리 이름을 불러오는 중이에요' })).not.toBeInTheDocument();
  });

  it('시술 목록이 이미 있으면(캐시 적중) 바로 올바른 카테고리 라벨을 보여준다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);

    renderWithProviders(<ExploreScreen />, { route: '/explore?category=implant' });

    await waitFor(() => expect(screen.getByText('“임플란트” 병원')).toBeInTheDocument());
  });
});
