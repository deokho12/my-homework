import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/App';

/**
 * 관리자 라우트 배선은 `ROUTES` 표 한 곳에 있다. 한 줄이라도 빠지면 그 화면만 조용히 틀어진다 —
 * 가드가 빠지면 주소만 아는 누구나 고객 실명을 보고, 셸이 빠지면 그 화면만 메뉴 없이 뜬다.
 */
describe('관리자 라우트 배선', () => {
  const adminRoutes = ROUTES.filter((route) => route.path === '/admin' || route.path.startsWith('/admin/'));

  it('관리자 라우트가 표에 있다', () => {
    expect(adminRoutes.length).toBeGreaterThan(0);
  });

  it.each(adminRoutes.map((route) => [route.path, route] as const))('%s 는 관리자 가드와 셸을 둘 다 갖는다', (_, route) => {
    expect(['admin', 'operator']).toContain(route.guard);
    expect(route.shell).toBe('admin');
  });

  it('관리자 셸은 관리자 라우트에만 씌운다', () => {
    const outside = ROUTES.filter((route) => route.shell === 'admin' && !adminRoutes.includes(route));

    expect(outside.map((route) => route.path)).toEqual([]);
  });
});
