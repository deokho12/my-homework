import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

import { render } from '@testing-library/react';

import { CardGrid } from '@/components/layout/CardGrid';
import { CONTAINER_CLASS, Container } from '@/components/layout/Container';
import { Text } from '@/primitives';

/**
 * 반응형 기반 검증.
 *
 * jsdom 은 미디어쿼리를 평가하지도, 레이아웃을 계산하지도 않는다. 그래서 "1024px 에서
 * 6열로 보인다"는 여기서 증명할 수 없고, 브라우저에서 눈으로 봐야 한다.
 * 대신 눈으로는 놓치기 쉬운 두 가지를 잡는다 — 생성된 CSS 의 브레이크포인트 값과 순서,
 * 그리고 컴포넌트가 실제로 그 클래스를 붙이는지.
 */

const ROOT_DIR = resolve(__dirname, '../..');

let css = '';

beforeAll(async () => {
  const source = readFileSync(resolve(ROOT_DIR, 'src/global.css'), 'utf8');
  const result = await postcss([
    tailwindcss(resolve(ROOT_DIR, 'tailwind.config.js')),
    autoprefixer(),
  ]).process(source, { from: resolve(ROOT_DIR, 'src/global.css') });
  css = result.css;
}, 60_000);

describe('브레이크포인트', () => {
  it('xs/md/lg 가 480/768/1024 로 생성된다', () => {
    const widths = new Set([...css.matchAll(/min-width:\s*(\d+)px/g)].map((m) => Number(m[1])));

    expect(widths.has(480)).toBe(true);
    expect(widths.has(768)).toBe(true);
    expect(widths.has(1024)).toBe(true);
  });

  it('좁은 단계의 열 규칙이 넓은 단계보다 먼저 나온다', () => {
    /*
     * 폭 1000px 에서는 xs(480) 와 md(768) 미디어쿼리가 동시에 매치되므로, 뒤에 쓰인 쪽이
     * 이긴다. xs 규칙이 md 뒤로 가면 화면을 넓혔는데 6열이 3열로 줄어드는 일이 생긴다.
     * xs 는 Tailwind 기본값(640~)보다 작은 값을 나중에 얹은 것이라 이 순서가 실제로
     * 뒤집힐 수 있는 지점이다.
     *
     * 파일 전체의 min-width 를 정렬해 비교하지는 않는다. Tailwind 는 레이어마다 오름차순
     * 묶음을 따로 내보내서, 전체를 이어 붙이면 정상이어도 오름차순이 아니다.
     */
    const at = (cls: string) => css.indexOf(`.${cls}`);

    expect(at('xs\\:grid-cols-3')).toBeGreaterThan(-1);
    expect(at('xs\\:grid-cols-3')).toBeLessThan(at('md\\:grid-cols-4'));
    expect(at('md\\:grid-cols-4')).toBeLessThan(at('lg\\:grid-cols-6'));
  });

  it('본문 최대폭이 1200px 이다', () => {
    expect(css).toMatch(/\.max-w-content\s*\{\s*max-width:\s*1200px/);
  });
});

describe('레이아웃 컴포넌트', () => {
  it('Container 는 최대폭과 단계별 좌우 여백을 붙인다', () => {
    const { container } = render(
      <Container>
        <Text>본문</Text>
      </Container>
    );
    const el = container.firstElementChild as HTMLElement;

    expect(el.className).toContain('max-w-content');
    expect(el.className).toContain('mx-auto');
    // 여백이 단계별로 벌어지는지 — 한 값으로 고정돼 있으면 데스크톱에서 본문이 가장자리에 붙는다.
    expect(el.className).toContain('px-4');
    expect(el.className).toContain('md:px-6');
    expect(el.className).toContain('lg:px-8');
  });

  it('CardGrid compact 는 2→3→4→6 열로 늘어난다', () => {
    const { container } = render(
      <CardGrid columns="compact">
        <Text>카드</Text>
      </CardGrid>
    );
    const el = container.firstElementChild as HTMLElement;

    expect(el.className).toContain('grid');
    expect(el.className).toContain('grid-cols-2');
    expect(el.className).toContain('xs:grid-cols-3');
    expect(el.className).toContain('md:grid-cols-4');
    expect(el.className).toContain('lg:grid-cols-6');
  });

  it('CardGrid wide 는 1→2→3 열로 늘어난다', () => {
    const { container } = render(
      <CardGrid columns="wide">
        <Text>카드</Text>
      </CardGrid>
    );
    const el = container.firstElementChild as HTMLElement;

    expect(el.className).toContain('grid-cols-1');
    expect(el.className).toContain('md:grid-cols-2');
    expect(el.className).toContain('lg:grid-cols-3');
  });

  it('CardGrid 가 붙이는 열 클래스가 실제로 CSS 에 존재한다', () => {
    // Tailwind JIT 은 소스에 문자열로 등장하는 클래스만 만든다. 프리셋을 템플릿으로
    // 조립하도록 바꾸면 클래스명은 그대로인데 CSS 가 사라져서 조용히 1열이 된다.
    for (const cls of ['xs\\:grid-cols-3', 'md\\:grid-cols-4', 'lg\\:grid-cols-6', 'lg\\:grid-cols-3']) {
      expect(css).toContain(`.${cls}`);
    }
  });

  it('CONTAINER_CLASS 와 Container 가 같은 값을 쓴다', () => {
    const { container } = render(<Container />);
    const el = container.firstElementChild as HTMLElement;

    // ScrollView 화면들은 Container 대신 이 상수를 직접 붙인다. 둘이 갈라지면
    // 화면마다 좌우 여백이 어긋난다.
    for (const cls of CONTAINER_CLASS.split(' ')) {
      expect(el.className).toContain(cls);
    }
  });
});
