/**
 * 상담의 이름·연락처 값 다루기 — 저장 형식(정규화)과 노출 형식(마스킹).
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: ① 마스킹 알고리즘을 프런트의 현행 규칙 `frontend/src/utils/pii.ts` 에 맞췄다 —
 *  한 글자 이름과 가운데 블록 길이에서 갈렸다. ② 정책에 **투영 축**(목록/상세)을 더했다 —
 *  2026-10-13 계약이 "목록은 담당자에게도 번호를 가린다" 로 바뀌었다.)
 *
 * 순수 함수다. DB 도 요청도 모르고 문자열과 역할만 받는다 — 경계값(두 글자 이름, 세 자리
 * 가운데 블록)을 DB 없이 고정할 수 있어야 하기 때문이다.
 *
 * **마스킹 판정은 여기 한 곳에서만 한다.** 계약(`ConsultRequest`)이 `piiMasked` 를 응답에
 * 명시하라고 요구하는 이유가 그것이다 — 클라이언트가 역할로 추론하면 인가 규칙이 복제되고,
 * 정책이 바뀔 때 두 곳을 고쳐야 한다. **역할과 투영 두 축이 생긴 지금은 추론이 더 틀리기 쉽다.**
 */

/** `010-1234-5678` 형태. 가운데는 3자리 또는 4자리다 (계약 `ConsultRequestCreateRequest.phone`). */
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

/** 번호 검색이 거는 정규화 컬럼 값 — 숫자만 남긴다 (`consult_requests.phone_digits`). */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * 이름 가운데를 `*` 로 가린다. **프런트 `utils/pii.ts` 의 `maskPersonName` 과 같은 규칙이다.**
 *
 * | 입력 | 출력 | |
 * |---|---|---|
 * | `박서영` | `박*영` | |
 * | `박수` | `박*` | 두 글자는 끝 글자를 가린다 |
 * | `남궁민수` | `남**수` | 네 글자 이상은 첫·끝만 남긴다 |
 * | `박` | `박` | **가릴 가운데가 없다** |
 *
 * 한 글자를 `*` 로 통째로 가리지 **않는다.** 브랜치 원본은 그렇게 했지만, 화면의 현행 규칙이
 * 원문 그대로이고 **두 곳이 갈리면 같은 이름이 화면과 응답에서 다르게 보인다.** 한 글자
 * 이름에서 얻는 보호는 "이미 한 글자" 라 크지 않다.
 */
export function maskName(value: string): string {
  const name = value.trim();

  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;

  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
}

/**
 * 연락처 가운데 블록을 가린다 — `010-1234-4411` → `010-****-4411`.
 * **프런트 `utils/pii.ts` 의 `maskPhoneMiddle` 과 같은 규칙이다.**
 *
 * 별은 **항상 4개**다(가운데가 3자리여도 `****`). 계약의 예시가 그 모양이고, 별 개수로
 * 가운데 자릿수가 새는 것도 막는다.
 *
 * 뒤 4자리를 남기는 이유는 계약에 있다 — 운영자가 고객 문의를 받았을 때 어떤 상담 건인지
 * 대조할 수 있어야 하고, 그것만으로 연락은 불가능하다.
 *
 * 하이픈이 없는 과거 값이 들어와도 **원본이 그대로 새 나가지 않게** 숫자열에서 다시 만든다.
 */
export function maskPhone(value: string): string {
  const blocks = value.split('-');

  if (blocks.length === 3) return `${blocks[0]}-****-${blocks[2]}`;

  const digits = phoneDigits(value);

  return digits.length > 4
    ? `${digits.slice(0, digits.length - 4).replace(/./g, '*')}${digits.slice(-4)}`
    : value;
}

/** 어느 응답인가. **역할만으로는 정책이 정해지지 않는다** (2026-10-13 계약). */
export type ConsultProjectionView = 'list' | 'detail';

export interface PiiFields {
  name: string;
  phone: string;
}

export interface PiiResult extends PiiFields {
  /** 이 응답에 **마스킹된 개인정보 필드가 있는가**. 화면이 전화 걸기·복사를 잠그는 근거다. */
  piiMasked: boolean;
}

/**
 * 역할 × 투영 → 무엇을 가릴지. **단일 판정 지점**이다 (계약 `ConsultRequest` 의 표).
 *
 * | 투영 | 역할 | `name` | `phone` | `piiMasked` |
 * |---|---|---|---|---|
 * | 목록 | `hospital_admin` | 원본 | **마스킹** | **`true`** |
 * | 목록 | `operator` | 마스킹 | 마스킹 | `true` |
 * | 상세 | `hospital_admin` (담당 병원) | 원본 | 원본 | `false` |
 * | 상세 | `operator` | 마스킹 | 마스킹 | `true` |
 *
 * **쓰기 응답(`PATCH …/status` · `POST …/memos`)도 `'list'` 로 부른다** (계약 표의 마지막 줄,
 * 2026-10-22). 그래서 전체 번호가 나가는 경로는 `GET /consult-requests/{id}` 하나뿐이고,
 * 그 하나는 감사 행을 남긴다 — 예외가 없는 것이 이 투영 축의 요점이다.
 *
 * **목록이 담당자에게도 번호를 가리는 이유**: 목록은 건별 열람 기록을 남기지 않는 자원이라
 * 전체 번호가 실리면 `pageSize` 넘김으로 **무기록 대량 반출**이 성립한다. 전체 번호를 보는
 * 경로를 기록이 남는 상세 한 곳으로 모은 것이다.
 *
 * 담당 병원인지 자체는 `HospitalScopeGuard` 가 이미 판정했다 — 여기 오는 `role` 은 그 관문을
 * 통과한 요청의 역할이다. `hospital_admin` 이 아닌 모든 역할은 가린다 (fail closed).
 */
export function applyPiiPolicy(fields: PiiFields, role: string, view: ConsultProjectionView): PiiResult {
  const maskTheName = role !== 'hospital_admin';
  const maskThePhone = maskTheName || view === 'list';

  return {
    name: maskTheName ? maskName(fields.name) : fields.name,
    phone: maskThePhone ? maskPhone(fields.phone) : fields.phone,
    piiMasked: maskTheName || maskThePhone,
  };
}
