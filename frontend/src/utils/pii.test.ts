import { describe, expect, it } from 'vitest';

import { maskPersonName } from '@/utils/pii';

/**
 * 마스킹 규칙은 계약 한 곳에서 온다 (`docs/api/README.md` §4) — 상담의 `operator` 시야와
 * 병원 문의의 문의자 이름이 **같은 함수**를 쓴다. 두 벌로 갈리면 한쪽만 고쳐도 아무도 모른다.
 */
describe('maskPersonName', () => {
  it.each([
    ['김민준', '김*준'],
    ['박민', '박*'],
    ['남궁민수', '남**수'],
    ['김', '김'],
  ])('%s → %s', (input, expected) => {
    expect(maskPersonName(input)).toBe(expected);
  });

  it('다섯 글자 이상도 첫·끝만 남긴다', () => {
    expect(maskPersonName('동방불패해')).toBe('동***해');
  });

  it('앞뒤 공백은 마스킹 전에 떼어낸다 (공백이 글자 수에 끼면 규칙이 어긋난다)', () => {
    expect(maskPersonName('  김민준 ')).toBe('김*준');
  });

  it('빈 문자열은 빈 문자열이다 — 없는 이름을 지어내지 않는다', () => {
    expect(maskPersonName('   ')).toBe('');
  });
});
