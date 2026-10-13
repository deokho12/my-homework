import { describe, expect, it } from 'vitest';

import {
  COMPLETENESS_ITEMS,
  DEFAULT_THUMBNAIL_URL,
  completenessOf,
  completenessPercent,
  type CompletenessInput,
} from '@/features/hospital/lib/completeness';

/**
 * 병원 정보 완성도 (`docs/database/README.md` §13.7, 계약 `HospitalCompleteness`).
 *
 * 항목 7개의 충족 조건·고정 순서·99 상한·`noProcedures` 분리를 고정한다.
 */

const FULL_HOURS = [
  { day: '월', hours: '09:30 - 18:30' },
  { day: '화', hours: '09:30 - 18:30' },
  { day: '수', hours: '09:30 - 18:30' },
  { day: '목', hours: '09:30 - 18:30' },
  { day: '금', hours: '09:30 - 18:30' },
  { day: '토', hours: '09:30 - 14:00' },
  { day: '일', hours: '휴진', isClosed: true },
];

function complete(overrides: Partial<CompletenessInput> = {}): CompletenessInput {
  return {
    name: '강남 스마일 치과',
    region: '서울 강남구',
    address: '서울 강남구 테헤란로 1',
    latitude: 37.5,
    longitude: 127.03,
    specialty: '임플란트 전문의원',
    businessHours: FULL_HOURS,
    procedureIds: ['implant'],
    thumbnail: 'https://cdn.example.com/h1.jpg',
    introduction: '가'.repeat(30),
    directions: '강남역 11번 출구 도보 5분',
    doctorCount: 1,
    ...overrides,
  };
}

function doneOf(input: CompletenessInput): Record<string, boolean> {
  return Object.fromEntries(completenessOf(input).items.map((item) => [item.key, item.done]));
}

describe('completenessPercent', () => {
  it('전부 충족이면 100 이다', () => {
    expect(completenessPercent(7, 7)).toBe(100);
  });

  it('동일 가중치로 반올림한다', () => {
    expect(completenessPercent(6, 7)).toBe(86);
    expect(completenessPercent(0, 7)).toBe(0);
  });

  /**
   * 항목이 07 에서 늘어나면 반올림이 100% 를 만들어 `남은 항목: 시술 가격` 과 `100%` 가
   * 나란히 보이는 날이 온다. 지금 항목 수(7)로는 그 상황을 만들 수 없어 함수를 직접 본다.
   */
  it('전부 충족이 아니면 99 를 넘기지 않는다', () => {
    expect(completenessPercent(199, 200)).toBe(99);
  });
});

describe('completenessOf', () => {
  it('항목은 충족한 것까지 전부, 계약이 정한 고정 순서로 내려간다', () => {
    const { items } = completenessOf(complete());

    expect(items.map((item) => item.key)).toEqual([...COMPLETENESS_ITEMS]);
    expect(items.map((item) => item.label)).toEqual([
      '기본 정보',
      '진료시간',
      '진료 시술',
      '대표 이미지',
      '병원 소개',
      '찾아오시는 길',
      '의료진',
    ]);
  });

  it('`target` 은 수정 화면의 입력 칸 어휘 그대로다', () => {
    const targets = Object.fromEntries(completenessOf(complete()).items.map((item) => [item.key, item.target]));

    expect(targets).toEqual({
      basicInfo: 'name',
      businessHours: 'businessHours',
      procedures: 'procedureIds',
      thumbnail: 'thumbnail',
      introduction: 'introduction',
      directions: 'directions',
      doctors: 'doctors',
    });
  });

  it('전부 채우면 100% 다', () => {
    const result = completenessOf(complete());

    expect(result.percent).toBe(100);
    expect(result.items.every((item) => item.done)).toBe(true);
    expect(result.noProcedures).toBe(false);
  });

  describe('기본 정보', () => {
    it('이름·지역·주소가 trim 후 비면 거짓이다', () => {
      expect(doneOf(complete({ name: '  ' })).basicInfo).toBe(false);
      expect(doneOf(complete({ region: '' })).basicInfo).toBe(false);
      expect(doneOf(complete({ address: ' ' })).basicInfo).toBe(false);
    });

    it('좌표가 하나라도 0 이면 거짓이다', () => {
      expect(doneOf(complete({ latitude: 0 })).basicInfo).toBe(false);
      expect(doneOf(complete({ longitude: 0 })).basicInfo).toBe(false);
    });

    it('전문 분야가 비면 거짓이다 — 등록 필수가 아니라 실제로 거짓이 될 수 있는 자리다', () => {
      expect(doneOf(complete({ specialty: '' })).basicInfo).toBe(false);
    });
  });

  describe('진료시간', () => {
    it('7요일이 모두 있어야 한다', () => {
      expect(doneOf(complete({ businessHours: FULL_HOURS.slice(0, 6) })).businessHours).toBe(false);
    });

    it('휴진이 아닌 요일의 시간이 공백이면 거짓이다', () => {
      const hours = FULL_HOURS.map((entry) => (entry.day === '수' ? { ...entry, hours: '  ' } : entry));

      expect(doneOf(complete({ businessHours: hours })).businessHours).toBe(false);
    });

    it('휴진인 요일의 시간은 비어 있어도 된다', () => {
      const hours = FULL_HOURS.map((entry) => (entry.day === '일' ? { day: '일', hours: '', isClosed: true } : entry));

      expect(doneOf(complete({ businessHours: hours })).businessHours).toBe(true);
    });
  });

  it('진료 시술은 1개 이상이면 충족이다', () => {
    expect(doneOf(complete({ procedureIds: [] })).procedures).toBe(false);
    expect(doneOf(complete({ procedureIds: ['implant', 'cavity'] })).procedures).toBe(true);
  });

  it('대표 이미지는 비어 있거나 기본 이미지면 거짓이다', () => {
    expect(doneOf(complete({ thumbnail: '' })).thumbnail).toBe(false);
    expect(doneOf(complete({ thumbnail: DEFAULT_THUMBNAIL_URL })).thumbnail).toBe(false);
  });

  it('병원 소개는 trim 후 30자 이상이어야 한다', () => {
    expect(doneOf(complete({ introduction: '가'.repeat(29) })).introduction).toBe(false);
    expect(doneOf(complete({ introduction: `  ${'가'.repeat(30)}  ` })).introduction).toBe(true);
  });

  it('찾아오시는 길은 trim 후 10자 이상이어야 한다', () => {
    expect(doneOf(complete({ directions: '가'.repeat(9) })).directions).toBe(false);
    expect(doneOf(complete({ directions: '가'.repeat(10) })).directions).toBe(true);
  });

  it('의료진은 1명 이상이면 충족이다 — 검수 상태를 묻지 않는다', () => {
    expect(doneOf(complete({ doctorCount: 0 })).doctors).toBe(false);
    expect(doneOf(complete({ doctorCount: 1 })).doctors).toBe(true);
  });

  it('한 항목만 비면 86% 이고 그 항목만 `done: false` 다', () => {
    const result = completenessOf(complete({ directions: '' }));

    expect(result.percent).toBe(86);
    expect(result.items.filter((item) => !item.done).map((item) => item.key)).toEqual(['directions']);
  });

  it('시술 0개 경고는 백분율과 별개 값이다', () => {
    const result = completenessOf(complete({ procedureIds: [] }));

    expect(result.noProcedures).toBe(true);
    // 7분의 1만 비어 "거의 다 됐다" 로 보이지만, 환자는 시술로 이 병원을 찾을 수 없다.
    expect(result.percent).toBe(86);
  });
});
