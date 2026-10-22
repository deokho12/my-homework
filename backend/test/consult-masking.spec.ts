import { describe, expect, it } from 'vitest';

import { applyPiiPolicy, maskName, maskPhone, normalizePhone, phoneDigits } from '../src/consult/masking';

/**
 * 상담 개인정보 마스킹.
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: 한 글자 이름·가운데 블록 길이·형식 밖 값의 기대값을 **프런트의 현행 규칙**
 *  (`frontend/src/utils/pii.ts`)에 맞췄다. 같은 이름이 화면과 응답에서 다르게 보이면 안 된다.
 *  그리고 정책에 **투영 축**(목록/상세)이 생겼다 — 2026-10-13 계약.)
 *
 * DB 도 요청도 모르는 순수 함수라서 경계값을 DB 없이 고정할 수 있다.
 */

describe('maskName', () => {
  it('세 글자는 가운데를 가린다', () => {
    expect(maskName('박서영')).toBe('박*영');
  });

  it('두 글자는 뒤를 가린다', () => {
    expect(maskName('박수')).toBe('박*');
  });

  it('네 글자 이상은 첫 글자와 마지막 글자만 남긴다', () => {
    expect(maskName('남궁민수')).toBe('남**수');
    expect(maskName('아무개이름')).toBe('아***름');
  });

  it('★ 한 글자는 그대로다 — 화면의 현행 규칙과 같아야 한다 (가릴 가운데가 없다)', () => {
    expect(maskName('박')).toBe('박');
  });

  it('빈 문자열은 빈 문자열이다 — 없는 이름을 지어내지 않는다', () => {
    expect(maskName('')).toBe('');
    expect(maskName('   ')).toBe('');
  });

  it('공백은 이름 글자로 세지 않는다', () => {
    expect(maskName('  박서영  ')).toBe('박*영');
  });
});

describe('maskPhone', () => {
  it('가운데 블록을 가리고 뒤 4자리를 남긴다', () => {
    expect(maskPhone('010-1234-4411')).toBe('010-****-4411');
  });

  it('★ 가운데가 세 자리여도 별은 네 개다 — 별 개수로 자릿수가 새지 않게', () => {
    expect(maskPhone('010-123-4567')).toBe('010-****-4567');
  });

  it('하이픈이 없는 과거 값도 원본이 그대로 새지 않는다', () => {
    expect(maskPhone('01012345678')).toBe('*******5678');
  });

  it('짧은 값은 가릴 것이 없다', () => {
    expect(maskPhone('')).toBe('');
    expect(maskPhone('1234')).toBe('1234');
  });
});

describe('normalizePhone / phoneDigits', () => {
  it('하이픈이 없어도 저장 형식으로 만든다', () => {
    expect(normalizePhone('01012345678')).toBe('010-1234-5678');
  });

  it('이미 하이픈이 있으면 그대로 둔다', () => {
    expect(normalizePhone('010-1234-5678')).toBe('010-1234-5678');
  });

  it('가운데가 세 자리인 번호와 011 등 다른 앞자리도 같은 규칙이다', () => {
    expect(normalizePhone('0101234567')).toBe('010-123-4567');
    expect(normalizePhone('01112345678')).toBe('011-1234-5678');
  });

  it('공백을 제거한다', () => {
    expect(normalizePhone(' 010 1234 5678 ')).toBe('010-1234-5678');
  });

  it('★ 형식을 벗어난 값은 고쳐 쓰지 않는다 — 형식 검사는 스키마의 몫이다', () => {
    expect(normalizePhone('없음')).toBe('없음');
  });

  it('phoneDigits 는 숫자만 남긴다 (검색이 거는 컬럼)', () => {
    expect(phoneDigits('010-1234-5678')).toBe('01012345678');
    expect(phoneDigits('010-****-5678')).toBe('0105678');
  });
});

describe('applyPiiPolicy — 역할 × 투영의 단일 판정 지점', () => {
  const raw = { name: '박서영', phone: '010-1234-4411' };

  it('★ 목록은 담당자에게도 번호를 가린다 (무기록 대량 반출 차단)', () => {
    expect(applyPiiPolicy(raw, 'hospital_admin', 'list')).toEqual({
      name: '박서영',
      phone: '010-****-4411',
      piiMasked: true,
    });
  });

  it('★ 전체 번호가 있는 자리는 담당자의 상세 하나뿐이다', () => {
    expect(applyPiiPolicy(raw, 'hospital_admin', 'detail')).toEqual({
      name: '박서영',
      phone: '010-1234-4411',
      piiMasked: false,
    });
  });

  it('운영자는 목록·상세 모두 이름까지 가려진다', () => {
    for (const view of ['list', 'detail'] as const) {
      expect(applyPiiPolicy(raw, 'operator', view)).toEqual({
        name: '박*영',
        phone: '010-****-4411',
        piiMasked: true,
      });
    }
  });

  it('★ 모르는 역할은 가린다 (fail closed)', () => {
    expect(applyPiiPolicy(raw, 'user', 'detail').piiMasked).toBe(true);
    expect(applyPiiPolicy(raw, '', 'detail').piiMasked).toBe(true);
  });
});
