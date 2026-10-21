import { describe, expect, it } from 'vitest';

import { consultRequestSchema } from '@/features/consult/schemas/consultRequestSchema';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: '홍길동',
    phone: '010-1234-5678',
    procedureId: null,
    preferredTime: '평일 오전',
    message: '',
    thirdPartyConsent: true,
    ...overrides,
  };
}

function firstMessage(input: Record<string, unknown>, field: string): string | undefined {
  const result = consultRequestSchema.safeParse(input);

  if (result.success) return undefined;

  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('consultRequestSchema — 연락처', () => {
  it.each(['010-1234-5678', '01012345678', '011-123-4567', '01987654321'])(
    '휴대폰 번호 형식 %s 는 통과한다',
    (phone) => {
      expect(consultRequestSchema.safeParse(valid({ phone })).success).toBe(true);
    }
  );

  it.each(['abc', '1', '02-123-4567', '010-12-5678'])('%s 는 형식 오류다', (phone) => {
    expect(firstMessage(valid({ phone }), 'phone')).toBe(
      '휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요'
    );
  });

  it('빈 값은 형식 오류가 아니라 "입력해주세요" 다 — 아직 쓰지 않은 칸과 틀리게 쓴 칸은 다른 안내가 필요하다', () => {
    expect(firstMessage(valid({ phone: '   ' }), 'phone')).toBe('연락처를 입력해주세요');
  });

  it('앞뒤 공백은 제거한 값으로 통과한다', () => {
    const result = consultRequestSchema.safeParse(valid({ phone: ' 010-1234-5678 ' }));

    expect(result.success && result.data.phone).toBe('010-1234-5678');
  });
});

describe('consultRequestSchema — 이름', () => {
  it('공백뿐이면 거절한다', () => {
    expect(firstMessage(valid({ name: '   ' }), 'name')).toBe('이름을 입력해주세요');
  });

  it('50자를 넘으면 거절한다', () => {
    expect(firstMessage(valid({ name: 'ㄱ'.repeat(51) }), 'name')).toBe('이름은 50자까지 입력할 수 있어요');
  });

  it('앞뒤 공백을 제거한 값으로 통과한다', () => {
    const result = consultRequestSchema.safeParse(valid({ name: ' 홍길동 ' }));

    expect(result.success && result.data.name).toBe('홍길동');
  });
});

describe('consultRequestSchema — 동의·시간·시술·메시지', () => {
  it('동의하지 않으면 거절한다 (계약의 THIRD_PARTY_CONSENT_REQUIRED 와 같은 판정)', () => {
    expect(consultRequestSchema.safeParse(valid({ thirdPartyConsent: false })).success).toBe(false);
  });

  it('평일 저녁을 받는다 (2026-10-12 요청서로 늘어난 값)', () => {
    expect(consultRequestSchema.safeParse(valid({ preferredTime: '평일 저녁' })).success).toBe(true);
  });

  it('목록에 없는 희망 시간은 거절한다', () => {
    expect(consultRequestSchema.safeParse(valid({ preferredTime: '새벽' })).success).toBe(false);
  });

  it('세부 시술 31개는 통과하고, 옛 id 와 모르는 id 는 거절한다', () => {
    expect(consultRequestSchema.safeParse(valid({ procedureId: 'resin' })).success).toBe(true);
    expect(consultRequestSchema.safeParse(valid({ procedureId: 'root-canal' })).success).toBe(true);
    // 요청 14 에서 사라진 옛 서버 id — 그대로 보내면 서버가 422 를 낸다.
    expect(consultRequestSchema.safeParse(valid({ procedureId: 'cavity' })).success).toBe(false);
    expect(consultRequestSchema.safeParse(valid({ procedureId: 'bogus' })).success).toBe(false);
  });

  it('메시지는 2000자까지다 (계약 maxLength)', () => {
    expect(consultRequestSchema.safeParse(valid({ message: 'ㄱ'.repeat(2000) })).success).toBe(true);
    expect(consultRequestSchema.safeParse(valid({ message: 'ㄱ'.repeat(2001) })).success).toBe(false);
  });
});
