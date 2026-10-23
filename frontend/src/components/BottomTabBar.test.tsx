import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BottomTabBar } from '@/components/BottomTabBar';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * 네 칸의 아이콘이 이모지(🏠🦷💬👤)였다 — OS 마다 그림·크기가 달라 칸마다 무게가
 * 달라 보였고, 낭독기는 "집 모양" 을 읽었다. lucide 그림 + 글자 라벨로 바꿨다 (SYS-22).
 */
describe('BottomTabBar', () => {
  const LABELS = ['홈', '병원', '커뮤니티', '마이페이지'];

  it('네 칸 모두 이름이 있고, 그림은 이모지가 아니라 lucide svg 다', () => {
    const { container } = renderWithProviders(<BottomTabBar />);

    for (const label of LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(container.querySelectorAll('svg')).toHaveLength(LABELS.length);
    expect(container.textContent).toBe(LABELS.join(''));
  });

  it('지금 화면의 칸만 brand 색이고 나머지는 neutral-500 이다', () => {
    const { container } = renderWithProviders(<BottomTabBar />, { route: '/' });

    const icons = [...container.querySelectorAll('svg')];
    expect(icons.map((icon) => icon.getAttribute('stroke'))).toEqual([
      '#17847a',
      '#737373',
      '#737373',
      '#737373',
    ]);
  });
});
