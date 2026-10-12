/**
 * 개인정보 표시 규칙. **마스킹 알고리즘은 이 파일 하나다** (`docs/api/README.md` §4).
 *
 * 서버가 생기면 마스킹은 서버가 한다 — 그때 이 함수는 로컬 api 구현
 * (`features/inquiry/api/inquiryApi.ts`)과 함께 사라진다. 그 전까지 **같은 판정을 두 곳에
 * 두지 않기 위해** 여기 둔다: 병원 문의의 문의자 이름(누구에게나 마스킹)과 상담의
 * `operator` 시야(로컬에는 아직 없다)가 같은 규칙을 쓴다.
 */

/**
 * 이름 가운데를 `*` 로 가린다.
 *
 * - `김민준` → `김*준`
 * - `박민` → `박*` (두 글자는 끝 글자를 가린다)
 * - `남궁민수` → `남**수` (네 글자 이상은 첫·끝만 남긴다)
 * - `김` → `김` (가릴 가운데가 없다)
 *
 * 빈 값은 빈 값이다 — 없는 이름을 `익명` 같은 말로 **지어내지 않는다**. 무엇을 보여줄지는
 * 부르는 쪽이 정한다.
 */
export function maskPersonName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;

  return `${trimmed[0]}${'*'.repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}
