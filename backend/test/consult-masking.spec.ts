import { describe, expect, it } from 'vitest';

import { applyPiiPolicy, maskName, maskPhone, normalizePhone } from '../src/consult/masking';

/**
 * 상담 개인정보 마스킹.
 *
 * 계약(`openapi.yaml` 의 `ConsultRequest`)이 표로 못 박은 규칙이다:
 * `hospital_admin`(담당 병원)은 원본, `operator` 는 마스킹, 그리고 어느 쪽인지
 * `piiMasked` 로 응답에 명시한다.
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

  it('★ 한 글자는 통째로 가린다 — 남기면 이름이 그대로 드러난다', () => {
    expect(maskName('박')).toBe('*');
  });

  it('빈 문자열은 빈 문자열이다', () => {
    expect(maskName('')).toBe('');
  });

  it('공백은 이름 글자로 세지 않는다', () => {
    expect(maskName('  박서영  ')).toBe('박*영');
  });
});

describe('maskPhone', () => {
  it('가운데 블록을 가리고 뒤 4자리를 남긴다', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
  });

  it('가운데가 세 자리면 별도 세 개다 (자릿수를 보존한다)', () => {
    expect(maskPhone('010-123-4567')).toBe('010-***-4567');
  });

  it('★ 뒤 4자리를 남기는 것이 규칙이다 — 그것만으로는 연락할 수 없다', () => {
    expect(maskPhone('010-1234-5678').endsWith('5678')).toBe(true);
  });

  it('형식을 벗어난 값은 통째로 가린다 (조용히 흘리지 않는다)', () => {
    expect(maskPhone('없음')).toBe('***');
    expect(maskPhone('')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('하이픈이 없어도 저장 형식으로 만든다', () => {
    expect(normalizePhone('01012345678')).toBe('010-1234-5678');
  });

  it('이미 하이픈이 있으면 그대로 둔다', () => {
    expect(normalizePhone('010-1234-5678')).toBe('010-1234-5678');
  });

  it('가운데가 세 자리인 번호도 처리한다', () => {
    expect(normalizePhone('0101234567')).toBe('010-123-4567');
  });

  it('공백을 제거한다', () => {
    expect(normalizePhone(' 010 1234 5678 ')).toBe('010-1234-5678');
  });

  it('011 등 다른 앞자리도 같은 규칙이다', () => {
    expect(normalizePhone('01112345678')).toBe('011-1234-5678');
  });
});

describe('applyPiiPolicy — 역할에 따른 단일 판정 지점', () => {
  const raw = { name: '박서영', phone: '010-1234-5678' };

  it('담당 병원 담당자는 원본을 본다', () => {
    expect(applyPiiPolicy(raw, 'hospital_admin')).toEqual({
      name: '박서영',
      phone: '010-1234-5678',
      piiMasked: false,
    });
  });

  it('★ 운영자는 마스킹된 값을 보고 piiMasked 가 true 다', () => {
    expect(applyPiiPolicy(raw, 'operator')).toEqual({
      name: '박*영',
      phone: '010-****-5678',
      piiMasked: true,
    });
  });

  it('★ 모르는 역할은 마스킹한다 (fail closed)', () => {
    expect(applyPiiPolicy(raw, 'user').piiMasked).toBe(true);
    expect(applyPiiPolicy(raw, '').piiMasked).toBe(true);
  });
});
