import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ExtractionIcon,
  ImplantIcon,
  OrthodonticsIcon,
  ICON_STROKE_WIDTH,
} from '@/components/icons/DentalIcons';
import type { IconComponent } from '@/utils/procedureIcons';

/** 요청서 13 의 SVG 를 그대로 옮겼는지 고정한다 — 다시 그리면 이 문자열이 먼저 깨진다. */
const REQUEST_PATHS = {
  implant: [
    'M7.4 2.9c1.5-.8 3.1-.4 4.6.3 1.5-.7 3.1-1.1 4.6-.3 1.6.9 2 3 1.3 4.6L17.2 9H6.8l-.7-1.5c-.7-1.6-.3-3.7 1.3-4.6z',
    'M10.2 9v2.4h3.6V9',
    'M9.4 11.4h5.2l-1.1 8.4a1.5 1.5 0 0 1-3 0z',
    'M9.8 14.4l4.5-.9M10.2 17.3l3.8-.8',
  ],
  orthodontics: [
    'M7 3c1.7-.6 3.3-.2 5 .5 1.7-.7 3.3-1.1 5-.5 2 .8 2.6 3 2.2 5.5-.5 3-1.2 5.2-1.7 8-.4 2.3-.9 4.5-2.1 4.5-1.4 0-1.6-2.6-2-4.3-.3-1.3-.8-2.2-1.4-2.2s-1.1.9-1.4 2.2c-.4 1.7-.6 4.3-2 4.3-1.2 0-1.7-2.2-2.1-4.5-.5-2.8-1.2-5-1.7-8C4.4 6 5 3.8 7 3z',
    'M1.5 9.5H10M14 9.5h8.5',
  ],
  extraction: [
    'M12 1.5v5M9.5 4L12 1.5 14.5 4',
    'M8.3 9c1.2-.4 2.4-.1 3.7.4 1.3-.5 2.5-.8 3.7-.4 1.5.6 1.9 2.2 1.6 4-.4 2.2-.9 3.8-1.2 5.8-.3 1.7-.7 3.2-1.6 3.2-1 0-1.2-1.9-1.5-3.1-.2-.9-.6-1.6-1-1.6s-.8.7-1 1.6c-.3 1.2-.5 3.1-1.5 3.1-.9 0-1.3-1.5-1.6-3.2-.3-2-.8-3.6-1.2-5.8-.3-1.8.1-3.4 1.6-4z',
  ],
} as const;

const ICONS: Array<[string, IconComponent, readonly string[]]> = [
  ['ImplantIcon', ImplantIcon, REQUEST_PATHS.implant],
  ['OrthodonticsIcon', OrthodonticsIcon, REQUEST_PATHS.orthodontics],
  ['ExtractionIcon', ExtractionIcon, REQUEST_PATHS.extraction],
];

function renderSvg(Icon: IconComponent, props: { size?: number; color?: string } = {}) {
  const { container } = render(<Icon {...props} />);
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  return svg as SVGSVGElement;
}

describe('치아 글리프 3종', () => {
  it('선 굵기 상수는 1.75 다', () => {
    expect(ICON_STROKE_WIDTH).toBe(1.75);
  });

  it.each(ICONS)('%s 은 lucide 와 같은 svg 속성을 쓴다', (_name, Icon) => {
    const svg = renderSvg(Icon);

    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke-width')).toBe('1.75');
    expect(svg.getAttribute('stroke-linecap')).toBe('round');
    expect(svg.getAttribute('stroke-linejoin')).toBe('round');
  });

  it.each(ICONS)('%s 의 기본값은 24px / currentColor', (_name, Icon) => {
    const svg = renderSvg(Icon);

    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });

  it.each(ICONS)('%s 은 size 와 color 를 받는다', (_name, Icon) => {
    const svg = renderSvg(Icon, { size: 26, color: '#17847a' });

    expect(svg.getAttribute('width')).toBe('26');
    expect(svg.getAttribute('height')).toBe('26');
    expect(svg.getAttribute('stroke')).toBe('#17847a');
  });

  it.each(ICONS)('%s 은 요청서의 path 를 그대로 그린다', (_name, Icon, paths) => {
    const svg = renderSvg(Icon);
    const drawn = Array.from(svg.querySelectorAll('path')).map((path) => path.getAttribute('d'));

    expect(drawn).toEqual([...paths]);
  });

  it('교정 아이콘에는 브라켓 사각형이 있다', () => {
    const svg = renderSvg(OrthodonticsIcon);
    const rect = svg.querySelector('rect');

    expect(rect).not.toBeNull();
    expect(rect?.getAttribute('x')).toBe('10');
    expect(rect?.getAttribute('y')).toBe('7.5');
    expect(rect?.getAttribute('width')).toBe('4');
    expect(rect?.getAttribute('height')).toBe('4');
    expect(rect?.getAttribute('rx')).toBe('.8');
  });

  it('세 아이콘의 그림이 서로 다르다', () => {
    const markup = ICONS.map(([, Icon]) => renderSvg(Icon).innerHTML);

    expect(new Set(markup).size).toBe(3);
  });
});
