/**
 * 조사 붙이기. **DB 도 화면도 요청도 모르는 순수 함수다.**
 *
 * 환자에게 가는 문장에 병원 이름을 넣을 때 `○○치과의원이` / `강남 스마일 치과가` 가
 * 갈린다. `이(가)` 로 고정하면 모든 이름에서 조금씩 어색해지므로 **끝 글자의 받침으로**
 * 판정한다 — 한글 음절 영역의 코드포인트 하나로 알 수 있는 사실이다.
 */

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 초성 19 × 중성 21 × 종성 28 로 짜인 완성형이라, 종성은 28 로 나눈 나머지다. */
const JONGSEONG_COUNT = 28;

/**
 * 이름 + 주격 조사. 받침이 있으면 `이`, 없으면 `가`.
 *
 * **끝 글자가 한글 음절이 아니면 `이(가)`** 다 (`Smile Dental이(가)`). 영문·숫자는 읽는
 * 법이 사람마다 갈려서(`101`→`백한`/`일공일`) 한쪽을 고르면 틀리는 쪽이 생긴다.
 * 빈 문자열이면 그대로 돌려준다 — 붙일 이름이 없다 (폴백 `병원` 은 호출부가 정한다).
 */
export function withSubjectParticle(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';

  // 서러게이트 쌍(이모지 등)이 끝에 와도 반쪽만 보지 않도록 코드포인트로 쪼갠다.
  const last = [...trimmed].at(-1) as string;
  const code = last.codePointAt(0) as number;

  if (code < HANGUL_FIRST || code > HANGUL_LAST) return `${trimmed}이(가)`;

  return `${trimmed}${(code - HANGUL_FIRST) % JONGSEONG_COUNT === 0 ? '가' : '이'}`;
}
