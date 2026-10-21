import { render } from '@testing-library/react';
import { Bolt, Braces, Moon, Scissors, Shield } from 'lucide-react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';

import { CATEGORY_IDS, type CategoryId } from '@/features/procedure/taxonomy';
import { CATEGORY_ICONS, type IconComponent } from '@/utils/procedureIcons';

type AnyIcon = ComponentType<{ size?: number; color?: string }>;

function renderSvg(Icon: AnyIcon, props: { size?: number; color?: string } = {}) {
  const { container } = render(<Icon {...props} />);
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  return svg as SVGSVGElement;
}

const ENTRIES = CATEGORY_IDS.map(
  (id) => [id, CATEGORY_ICONS[id]] as [CategoryId, IconComponent]
);

describe('CATEGORY_ICONS', () => {
  it.each(ENTRIES)('%s 아이콘은 svg 하나를 그리고 선 굵기가 1.75 다', (_id, Icon) => {
    const { container } = render(<Icon />);
    const svgs = container.querySelectorAll('svg');

    expect(svgs).toHaveLength(1);
    expect(svgs[0].getAttribute('stroke-width')).toBe('1.75');
  });

  it.each(ENTRIES)('%s 아이콘은 size 와 color 를 그대로 반영한다', (_id, Icon) => {
    const svg = renderSvg(Icon, { size: 26, color: '#17847a' });

    expect(svg.getAttribute('width')).toBe('26');
    expect(svg.getAttribute('height')).toBe('26');
    expect(svg.getAttribute('stroke')).toBe('#17847a');
  });

  it.each(ENTRIES)('%s 아이콘의 기본값은 24px / currentColor', (_id, Icon) => {
    const svg = renderSvg(Icon);

    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });

  it('9칸이 서로 다른 컴포넌트다', () => {
    const components = Object.values(CATEGORY_ICONS);

    expect(components).toHaveLength(9);
    expect(new Set(components).size).toBe(9);
  });

  it('9칸이 서로 다른 그림을 그린다 — 격자에서 두 칸이 같아 보이면 안 된다', () => {
    const markup = Object.values(CATEGORY_ICONS).map((Icon) => renderSvg(Icon).innerHTML);

    expect(new Set(markup).size).toBe(9);
  });
});

describe('요청서 13 — 치과처럼 보이는 아이콘으로 교체', () => {
  it('임플란트는 더 이상 볼트가 아니다', () => {
    expect(renderSvg(CATEGORY_ICONS.implant).innerHTML).not.toBe(renderSvg(Bolt).innerHTML);
  });

  it('교정은 더 이상 중괄호가 아니다', () => {
    expect(renderSvg(CATEGORY_ICONS.orthodontics).innerHTML).not.toBe(renderSvg(Braces).innerHTML);
  });

  it('사랑니·발치는 더 이상 가위가 아니다', () => {
    expect(renderSvg(CATEGORY_ICONS.extraction).innerHTML).not.toBe(renderSvg(Scissors).innerHTML);
  });

  it('턱관절·스플린트는 방패가 아니라 달이다', () => {
    const tmj = renderSvg(CATEGORY_ICONS.tmj).innerHTML;

    expect(tmj).not.toBe(renderSvg(Shield).innerHTML);
    expect(tmj).toBe(renderSvg(Moon).innerHTML);
  });

  it('턱관절(달)과 충치치료(방패+체크)는 서로 다르게 보인다', () => {
    expect(renderSvg(CATEGORY_ICONS.tmj).innerHTML).not.toBe(
      renderSvg(CATEGORY_ICONS.cavity).innerHTML
    );
  });

  it('임플란트에는 크라운·어버트먼트·픽스처가 다 있다', () => {
    const drawn = Array.from(renderSvg(CATEGORY_ICONS.implant).querySelectorAll('path')).map(
      (path) => path.getAttribute('d')
    );

    expect(drawn).toHaveLength(4);
    expect(drawn[1]).toBe('M10.2 9v2.4h3.6V9');
    expect(drawn[3]).toBe('M9.8 14.4l4.5-.9M10.2 17.3l3.8-.8');
  });

  it('교정에는 브라켓 사각형과 와이어가 있다', () => {
    const svg = renderSvg(CATEGORY_ICONS.orthodontics);

    expect(svg.querySelector('rect')).not.toBeNull();
    expect(
      Array.from(svg.querySelectorAll('path')).map((path) => path.getAttribute('d'))
    ).toContain('M1.5 9.5H10M14 9.5h8.5');
  });

  it('발치에는 빼는 화살표가 있다', () => {
    const drawn = Array.from(renderSvg(CATEGORY_ICONS.extraction).querySelectorAll('path')).map(
      (path) => path.getAttribute('d')
    );

    expect(drawn[0]).toBe('M12 1.5v5M9.5 4L12 1.5 14.5 4');
  });
});
