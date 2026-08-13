import { describe, expect, it } from 'vitest';

import { buildPageMeta, paginate } from '../src/common/pagination';

describe('buildPageMeta', () => {
  it('나머지가 있으면 페이지 수를 올림한다', () => {
    expect(buildPageMeta({ page: 1, pageSize: 20, totalItems: 41 }).totalPages).toBe(3);
  });

  it('0건이면 totalPages 는 0 이다', () => {
    expect(buildPageMeta({ page: 1, pageSize: 20, totalItems: 0 })).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it('딱 나누어떨어지면 올림하지 않는다', () => {
    expect(buildPageMeta({ page: 1, pageSize: 20, totalItems: 40 }).totalPages).toBe(2);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, index) => index);

  it('1페이지는 앞에서 pageSize 만큼이다', () => {
    expect(paginate(items, { page: 1, pageSize: 10 })).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('마지막 페이지는 남은 만큼만 준다', () => {
    expect(paginate(items, { page: 3, pageSize: 10 })).toEqual([20, 21, 22, 23, 24]);
  });

  it('범위를 넘은 페이지는 빈 배열이다', () => {
    expect(paginate(items, { page: 9, pageSize: 10 })).toEqual([]);
  });
});
