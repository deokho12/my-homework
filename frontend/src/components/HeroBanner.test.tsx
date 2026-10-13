import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeroBanner } from '@/components/HeroBanner';
import * as navigation from '@/navigation';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 배너는 "넘기기"와 "누르기"가 같은 손짓에서 갈린다 — 그 경계를 고정한다.
 *
 * jsdom 은 레이아웃이 없어 `onLayout`(ResizeObserver + getBoundingClientRect)이 0 을 돌려준다.
 * 폭이 0 이면 배너가 측정 전 한 장짜리 fallback 으로 떨어지므로, 슬라이드 3개를 보려면
 * 폭을 흉내 내야 한다.
 */
const SLIDE_WIDTH = 360;

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

// `restoreAllMocks` 가 매 테스트 뒤에 스파이를 되돌리므로 폭 흉내는 테스트마다 다시 건다.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: SLIDE_WIDTH,
    height: 125,
    top: 0,
    left: 0,
    right: SLIDE_WIDTH,
    bottom: 125,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

describe('HeroBanner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('슬라이드 3장이 각자의 도착지로 가는 링크다', () => {
    renderWithProviders(<HeroBanner />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/explore',
      '/explore?specialist=1',
      '/community',
    ]);
  });

  it('링크 이름이 도착지를 말한다 (낭독기 링크 목록)', () => {
    renderWithProviders(<HeroBanner />);

    expect(
      screen.getByRole('link', { name: '전문의가 검증된 병원만 모았어요 — 전문의가 있는 병원 목록으로 이동' })
    ).toHaveAttribute('href', '/explore?specialist=1');
  });

  it('제자리에서 누르면 이동한다', async () => {
    const pushSpy = vi.spyOn(navigation.router, 'push').mockImplementation(() => {});

    renderWithProviders(<HeroBanner />);
    await userEvent.click(screen.getAllByRole('link')[1]);

    expect(pushSpy).toHaveBeenCalledWith('/explore?specialist=1');
  });

  it('옆으로 끌어 넘긴 뒤 손을 떼면 이동하지 않는다', async () => {
    const pushSpy = vi.spyOn(navigation.router, 'push').mockImplementation(() => {});

    renderWithProviders(<HeroBanner />);
    const slide = screen.getAllByRole('link')[0];

    // 40px 끌기: pointerdown → click 사이의 이동 거리가 임계값(8px)을 넘는다.
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: slide, coords: { clientX: 200, clientY: 100 } },
      { target: slide, coords: { clientX: 160, clientY: 100 } },
      { keys: '[/MouseLeft]', target: slide, coords: { clientX: 160, clientY: 100 } },
    ]);

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('손가락이 2px 떨린 누르기는 살아남는다', async () => {
    const pushSpy = vi.spyOn(navigation.router, 'push').mockImplementation(() => {});

    renderWithProviders(<HeroBanner />);
    const slide = screen.getAllByRole('link')[2];

    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: slide, coords: { clientX: 200, clientY: 100 } },
      { target: slide, coords: { clientX: 202, clientY: 100 } },
      { keys: '[/MouseLeft]', target: slide, coords: { clientX: 202, clientY: 100 } },
    ]);

    expect(pushSpy).toHaveBeenCalledWith('/community');
  });

  it('Ctrl+클릭은 가로채지 않는다 — 브라우저가 새 탭으로 연다', () => {
    const pushSpy = vi.spyOn(navigation.router, 'push').mockImplementation(() => {});

    renderWithProviders(<HeroBanner />);
    const slide = screen.getAllByRole('link')[0];

    // `preventDefault` 가 불리면 브라우저는 새 탭을 열지 못하고 같은 탭에 머문다.
    const prevented = !fireEvent.click(slide, { ctrlKey: true });

    expect(prevented).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('"1/3" 표시는 클릭을 가로채지 않고 낭독기에서도 숨겨진다', () => {
    renderWithProviders(<HeroBanner />);

    const indicator = screen.getByText('1/3').parentElement;
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).toHaveClass('pointer-events-none');
  });
});
