import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { beforeAll, describe, expect, it } from 'vitest';

import { ScrollView, View } from '@/primitives';

import { render } from '@testing-library/react';

/**
 * 스크롤 회귀 방지 테스트.
 *
 * 이 앱은 RNW 방식(문서 전체가 아니라 ScrollView 안쪽이 스크롤되는 고정 뷰포트)이라,
 * `#root` 부터 ScrollView 까지 flex 높이 사슬이 한 칸이라도 끊기면 스크롤이 통째로 죽는다.
 * jsdom 은 레이아웃 계산은 못 하지만 cascade 는 하므로, 사슬을 이루는 계산값들을 검증한다.
 */

const ROOT_DIR = resolve(__dirname, '../..');

async function buildGlobalCss(): Promise<string> {
  const source = readFileSync(resolve(ROOT_DIR, 'src/global.css'), 'utf8');
  const result = await postcss([
    tailwindcss(resolve(ROOT_DIR, 'tailwind.config.js')),
    autoprefixer(),
  ]).process(source, { from: resolve(ROOT_DIR, 'src/global.css') });

  return result.css;
}

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = await buildGlobalCss();
  document.head.appendChild(style);
}, 60_000);

describe('앱 셸 높이 사슬', () => {
  it('#root 가 flex 컬럼이라 자식의 flex:1 이 뷰포트에 고정된다', () => {
    // #root 는 index.html 이 만들고 main.tsx 가 마운트하는 실제 컨테이너다.
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    const computed = getComputedStyle(root);

    // 이게 block 이면 자식 View 의 flex:1 이 무시되고 높이가 콘텐츠만큼 늘어난다.
    // 그러면 ScrollView 가 넘칠 일이 없어져서 스크롤이 사라진다.
    expect(computed.display).toBe('flex');
    expect(computed.flexDirection).toBe('column');
    expect(computed.height).toBe('100%');

    root.remove();
  });

  it('body 가 문서 스크롤을 막으므로 스크롤은 ScrollView 안에서만 일어난다', () => {
    expect(getComputedStyle(document.body).overflow).toBe('hidden');
  });

  it('세로 ScrollView 는 부모에 맞춰 줄어들고(overflow-y auto) 평범한 View 는 아니다', () => {
    const { container } = render(
      <View style={{ flex: 1 }}>
        <ScrollView>
          <View className="tall-content" style={{ height: 4000 }} />
        </ScrollView>
      </View>
    );

    const scroller = container.querySelector('.rnw-scroll-view') as HTMLElement;
    const scrollerStyle = getComputedStyle(scroller);

    // flex-shrink 가 0 이면(.rnw-view 기본값) 스크롤 박스가 콘텐츠만큼 커져서 넘치지 않는다.
    expect(scrollerStyle.flexGrow).toBe('1');
    expect(scrollerStyle.flexShrink).toBe('1');
    expect(scrollerStyle.minHeight).toBe('0px');
    expect(scrollerStyle.overflowY).toBe('auto');

    // 대조군: 평범한 View 는 RNW 기본값대로 안 줄어든다. 위 grow/shrink 가
    // .rnw-view 가 아니라 .rnw-scroll-view 에서 온 값임을 확인해 준다.
    const plainView = container.querySelector('.tall-content') as HTMLElement;
    expect(getComputedStyle(plainView).flexShrink).toBe('0');
  });
});
