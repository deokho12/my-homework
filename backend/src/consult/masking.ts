/**
 * 상담의 이름·연락처 값 다루기 — 저장 형식(정규화)과 노출 형식(마스킹).
 *
 * 순수 함수다. DB 도 요청도 모르고 문자열과 역할만 받는다 — 경계값(두 글자 이름,
 * 세 자리 가운데 블록)을 DB 없이 고정할 수 있어야 하기 때문이다.
 *
 * **마스킹 판정은 여기 한 곳에서만 한다.** 계약(`openapi.yaml` 의 `ConsultRequest`)이
 * `piiMasked` 를 응답에 명시하라고 요구하는 이유가 그것이다 — 클라이언트가 역할로
 * 추론하면 인가 규칙이 클라이언트에 복제되고, 정책이 바뀔 때 두 곳을 고쳐야 한다.
 */

/** `010-1234-5678` 형태. 가운데는 3자리 또는 4자리다. */
const PHONE_SHAPE = /^(01[016789])-?(\d{3,4})-?(\d{4})$/;

/**
 * 저장 형식으로 정규화한다. 화면이 하이픈을 넣든 말든 DB 에는 한 형태로만 들어간다 —
 * 그래야 마스킹도 검색도 한 가지 모양만 다루면 된다.
 *
 * 형식을 벗어난 값은 **그대로 돌려준다.** 여기서 고쳐 쓰면 zod 검증이 통과한 것처럼
 * 보이게 된다 — 형식 검사는 스키마의 몫이고 이 함수는 모양을 바꿀 뿐이다.
 */
export function normalizePhone(value: string): string {
  const compact = value.replace(/\s/g, '');
  const match = PHONE_SHAPE.exec(compact);

  if (!match) return value;

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * 이름 마스킹. 첫 글자와 마지막 글자만 남기고 가운데를 `*` 로 채운다.
 *
 * | 입력 | 출력 |
 * |---|---|
 * | `박서영` | `박*영` |
 * | `박수` | `박*` |
 * | `남궁민수` | `남**수` |
 * | `박` | `*` |
 *
 * **한 글자는 통째로 가린다.** 첫 글자를 남기는 규칙을 그대로 적용하면 이름이 그대로
 * 드러난다 — 마스킹이 아무 일도 하지 않는 셈이 된다.
 */
export function maskName(value: string): string {
  const name = value.trim();

  if (name.length === 0) return '';
  if (name.length === 1) return '*';
  if (name.length === 2) return `${name[0]}*`;

  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
}

/**
 * 연락처 마스킹. 가운데 블록만 가리고 **뒤 4자리는 남긴다.**
 *
 * 뒤 4자리를 남기는 이유는 계약에 있다 — 운영자가 고객 문의를 받았을 때 어떤 상담
 * 건인지 대조할 수 있어야 하고, 그것만으로 연락은 불가능하다.
 *
 * 형식을 벗어난 값은 **통째로 가린다.** 정규화를 거치지 않은 값이 그대로 새어 나가는
 * 것보다 낫다.
 */
export function maskPhone(value: string): string {
  if (value.length === 0) return '';

  const match = PHONE_SHAPE.exec(value.replace(/\s/g, ''));

  if (!match) return '***';

  return `${match[1]}-${'*'.repeat(match[2].length)}-${match[3]}`;
}

export interface PiiFields {
  name: string;
  phone: string;
}

export interface PiiResult extends PiiFields {
  /** 위 두 값이 마스킹된 값인지. 화면이 전화 걸기·복사 버튼을 잠그는 근거다. */
  piiMasked: boolean;
}

/**
 * 역할에 따라 원본을 줄지 마스킹할지 정하는 **단일 판정 지점**.
 *
 * 담당 병원의 `hospital_admin` 만 원본을 본다. 그 외는 전부 마스킹한다 — 목록에
 * 없는 역할이 생기더라도 기본이 "가린다" 여야 한다(fail closed). `operator` 를
 * 명시적으로 나열하지 않고 반대로 쓴 이유가 그것이다.
 *
 * 담당 병원인지 자체는 `HospitalScopeGuard` 가 이미 판정했다. 여기 오는 `role` 은
 * 그 관문을 통과한 요청의 역할이다.
 */
export function applyPiiPolicy(fields: PiiFields, role: string): PiiResult {
  if (role === 'hospital_admin') {
    return { name: fields.name, phone: fields.phone, piiMasked: false };
  }

  return { name: maskName(fields.name), phone: maskPhone(fields.phone), piiMasked: true };
}
