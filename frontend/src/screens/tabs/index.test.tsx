import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { CATEGORIES, getLegacyIdsOf } from '@/features/procedure/taxonomy';
import { router } from '@/navigation';
import HomeScreen from '@/screens/tabs/index';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 홈의 "시술로 찾기" 격자는 이제 **정적 taxonomy**(대분류 9개)다 — `useProcedures()` 로
 * 서버 13종을 받아 그리던 예전 동작을 여기서 고정해 되돌아가지 않게 한다.
 *
 * `fetchProcedures` 스파이는 "한 번도 부르지 않는다" 를 단언하기 위한 것이고,
 * `fetchHospitalById` 는 이벤트 카드(`PromotionCard`)가 병원을 조회하기 때문에 필요하다.
 */
describe('HomeScreen — 시술로 찾기', () => {
  /**
   * `View` 의 `onLayout`(히어로 배너가 쓴다)은 `ResizeObserver` 로 구현돼 있는데 jsdom 에는
   * 그 API 가 없다. 측정값을 쓰는 단언이 없으므로 아무것도 알리지 않는 빈 스텁이면 충분하다.
   * 전역 setup 이 아니라 이 파일에만 둔다 — 다른 테스트의 레이아웃 동작을 바꾸지 않기 위해서다.
   */
  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 인기검색어 pill 에도 "임플란트" 버튼이 있다 — 격자 안에서만 찾는다.
   */
  function renderHome() {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    renderWithProviders(<HomeScreen />);
    return within(screen.getByRole('region', { name: '시술로 찾기' }));
  }

  it('대분류 9칸을 서버 응답 없이 바로 그린다', () => {
    const fetchProceduresSpy = vi.spyOn(procedureApi, 'fetchProcedures');

    const grid = renderHome();

    expect(grid.getAllByRole('button')).toHaveLength(CATEGORIES.length + 1); // + "전체보기"
    for (const category of CATEGORIES) {
      // 접근성 이름 규칙 = CategoryCard 와 동일: 서버 시술이 없는 대분류는 ' · 준비중' 이 붙는다.
      const accessibleName =
        getLegacyIdsOf(category.id).length === 0 ? `${category.name} · 준비중` : category.name;
      expect(grid.getByRole('button', { name: accessibleName })).toBeInTheDocument();
    }
    expect(fetchProceduresSpy).not.toHaveBeenCalled();
  });

  it('서버가 아는 시술이 하나도 없는 대분류는 "준비중" 으로 보인다', () => {
    const grid = renderHome();

    // 스케일링·예방은 세부 4개가 전부 준비중이다 — 격자에서 빼지 않고 표시만 남긴다.
    // 눈에 보이는 '준비중' 과 스크린리더가 듣는 이름 둘 다 확인한다 (QA 🟡 접근성 지적 반영).
    expect(grid.getByRole('button', { name: '스케일링·예방 · 준비중' })).toHaveTextContent('준비중');
    expect(grid.getByRole('button', { name: '임플란트' })).not.toHaveTextContent('준비중');
  });

  it('대분류 카드를 누르면 카테고리 화면으로 간다', async () => {
    const pushSpy = vi.spyOn(router, 'push').mockImplementation(() => {});

    const grid = renderHome();
    await userEvent.click(grid.getByRole('button', { name: '임플란트' }));

    expect(pushSpy).toHaveBeenCalledWith('/category/implant');
  });
});
