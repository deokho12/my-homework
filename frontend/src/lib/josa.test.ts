import { describe, expect, it } from 'vitest';

import { withSubjectParticle } from '@/lib/josa';

describe('withSubjectParticle — 받침으로 이/가를 가른다', () => {
  it('끝 글자에 받침이 있으면 `이`', () => {
    expect(withSubjectParticle('○○치과의원')).toBe('○○치과의원이');
    expect(withSubjectParticle('병원')).toBe('병원이');
    // 받침 ㅅ — `(code - 0xAC00) % 28` 이 0 이 아닌 쪽.
    expect(withSubjectParticle('연세웃음')).toBe('연세웃음이');
  });

  it('끝 글자에 받침이 없으면 `가`', () => {
    expect(withSubjectParticle('강남 스마일 치과')).toBe('강남 스마일 치과가');
    expect(withSubjectParticle('서울예치과')).toBe('서울예치과가');
  });

  it('끝 글자가 한글이 아니면 `이(가)` — 영문·숫자는 읽는 법이 사람마다 갈린다', () => {
    expect(withSubjectParticle('Smile Dental')).toBe('Smile Dental이(가)');
    expect(withSubjectParticle('강남치과 101')).toBe('강남치과 101이(가)');
    expect(withSubjectParticle('치과 ♥')).toBe('치과 ♥이(가)');
  });

  it('자모 하나(`ㄱ`)와 완성형 밖의 글자도 한글 음절로 치지 않는다', () => {
    // `ㄱ`(U+3131)은 음절(U+AC00..U+D7A3)이 아니라 호환 자모다 — 받침을 셀 수 없다.
    expect(withSubjectParticle('ㄱ')).toBe('ㄱ이(가)');
  });

  it('앞뒤 공백은 버리고 붙인다 — `치과 가` 처럼 띄어 쓰지 않는다', () => {
    expect(withSubjectParticle('  강남 스마일 치과  ')).toBe('강남 스마일 치과가');
  });

  it('빈 문자열이면 조사를 붙이지 않는다 — 붙일 이름이 없다', () => {
    expect(withSubjectParticle('')).toBe('');
    expect(withSubjectParticle('   ')).toBe('');
  });
});
