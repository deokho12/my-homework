import { describe, expect, it } from 'vitest';

import {
  adminBackTo,
  adminSection,
  buildAdminMenu,
  hospitalSwitchTarget,
  type AdminMenuInput,
} from '@/components/admin/adminMenu';

/**
 * 사이드 메뉴 모델. **세션·숫자·선택 병원만 받는 순수 함수**라 셸을 렌더하지 않고
 * 그룹 구성과 현재 항목 판정을 고정할 수 있다.
 */

const NO_COUNTS = { statusNew: null, unansweredInquiries: null };

function input(overrides: Partial<AdminMenuInput> = {}): AdminMenuInput {
  return {
    isOperator: false,
    selectedHospitalId: 'h1',
    pathname: '/admin',
    field: undefined,
    counts: NO_COUNTS,
    ...overrides,
  };
}

function groupKeys(menu: ReturnType<typeof buildAdminMenu>): string[] {
  return menu.map((group) => group.key);
}

function itemKeys(menu: ReturnType<typeof buildAdminMenu>, groupKey: string): string[] {
  return menu.find((group) => group.key === groupKey)?.items.map((item) => item.key) ?? [];
}

function find(menu: ReturnType<typeof buildAdminMenu>, key: string) {
  return menu.flatMap((group) => group.items).find((item) => item.key === key);
}

describe('adminSection', () => {
  it('상세 라우트는 그 목록 섹션으로 접힌다', () => {
    expect(adminSection('/admin/consultations/c1')).toBe('/admin/consultations');
    expect(adminSection('/admin/inquiries/hi3')).toBe('/admin/inquiries');
    expect(adminSection('/admin/hospital/h1')).toBe('/admin/hospital');
    expect(adminSection('/admin/hospital/new')).toBe('/admin/hospital');
  });

  it('목록 라우트와 홈은 그대로다', () => {
    expect(adminSection('/admin')).toBe('/admin');
    expect(adminSection('/admin/')).toBe('/admin');
    expect(adminSection('/admin/consultations')).toBe('/admin/consultations');
    expect(adminSection('/admin/notifications')).toBe('/admin/notifications');
  });
});

describe('adminBackTo', () => {
  it('상담·문의 상세는 그 목록으로, 병원 등록은 홈으로 돌아간다', () => {
    expect(adminBackTo('/admin/consultations/c1')).toBe('/admin/consultations');
    expect(adminBackTo('/admin/inquiries/hi3')).toBe('/admin/inquiries');
    expect(adminBackTo('/admin/hospital/new')).toBe('/admin');
  });

  it('목록·대시보드·병원 수정에는 뒤로가 없다', () => {
    expect(adminBackTo('/admin')).toBeNull();
    expect(adminBackTo('/admin/consultations')).toBeNull();
    expect(adminBackTo('/admin/hospital/h1')).toBeNull();
    expect(adminBackTo('/admin/notifications')).toBeNull();
  });
});

describe('hospitalSwitchTarget', () => {
  it('특정 레코드를 보고 있었으면 목록으로 돌아간다 — 방금 떠난 병원의 레코드다', () => {
    expect(hospitalSwitchTarget('/admin/consultations/c1', 'h3')).toBe('/admin/consultations');
    expect(hospitalSwitchTarget('/admin/inquiries/hi1', 'h3')).toBe('/admin/inquiries');
  });

  it('병원 수정 화면은 새 병원의 같은 화면으로 옮긴다', () => {
    expect(hospitalSwitchTarget('/admin/hospital/h1', 'h3')).toBe('/admin/hospital/h3');
  });

  it('목록·대시보드는 제자리다 — 숫자만 바뀐다', () => {
    expect(hospitalSwitchTarget('/admin', 'h3')).toBeNull();
    expect(hospitalSwitchTarget('/admin/consultations', 'h3')).toBeNull();
    expect(hospitalSwitchTarget('/admin/hospital/new', 'h3')).toBeNull();
  });
});

describe('buildAdminMenu — 병원 담당자', () => {
  it('업무 · 병원 정보 · 홍보 · 확장 세 그룹이다', () => {
    const menu = buildAdminMenu(input());

    expect(groupKeys(menu)).toEqual(['work', 'hospital', 'growth']);
    expect(itemKeys(menu, 'work')).toEqual(['dashboard', 'consultations', 'inquiries']);
    expect(itemKeys(menu, 'hospital')).toEqual(['hospital-info', 'hospital-doctors']);
  });

  it('담당 병원이 없으면 병원 정보 그룹을 렌더하지 않는다 — 갈 주소가 없다', () => {
    const menu = buildAdminMenu(input({ selectedHospitalId: null }));

    expect(groupKeys(menu)).toEqual(['work', 'growth']);
  });

  it('병원 정보 두 항목은 선택한 병원의 수정 화면으로 간다', () => {
    const menu = buildAdminMenu(input({ selectedHospitalId: 'h3' }));

    expect(find(menu, 'hospital-info')).toMatchObject({ to: '/admin/hospital/h3' });
    expect(find(menu, 'hospital-doctors')).toMatchObject({ to: '/admin/hospital/h3?field=doctors' });
  });

  it('운영 전용 항목은 보이지 않는다', () => {
    const menu = buildAdminMenu(input());

    expect(find(menu, 'specialists')).toBeUndefined();
    expect(find(menu, 'hospital-new')).toBeUndefined();
    expect(find(menu, 'hospital-list')).toBeUndefined();
  });

  it('홍보 · 확장 네 항목은 전부 준비중이다 (링크가 아니다)', () => {
    const menu = buildAdminMenu(input());
    const growth = menu.find((group) => group.key === 'growth');

    expect(growth?.title).toBe('홍보 · 확장');
    expect(growth?.items.map((item) => [item.kind, item.label])).toEqual([
      ['soon', '이벤트'],
      ['soon', '후기'],
      ['soon', '광고 현황'],
      ['soon', '기공소 연계'],
    ]);
  });

  describe('배지', () => {
    it('대시보드 응답의 숫자를 그대로 싣는다 — 셸이 다시 세지 않는다', () => {
      const menu = buildAdminMenu(input({ counts: { statusNew: 8, unansweredInquiries: 2 } }));

      expect(find(menu, 'consultations')).toMatchObject({ count: 8 });
      expect(find(menu, 'inquiries')).toMatchObject({ count: 2 });
    });

    it('아직 모르는 동안(로딩·실패)에는 null 이다 — 0 은 사실 주장이다', () => {
      const menu = buildAdminMenu(input());

      expect(find(menu, 'consultations')).toMatchObject({ count: null });
      expect(find(menu, 'inquiries')).toMatchObject({ count: null });
    });

    it('읽어 주는 문장이 숫자마다 다르다', () => {
      const menu = buildAdminMenu(input({ counts: { statusNew: 8, unansweredInquiries: 2 } }));
      const consultations = find(menu, 'consultations');
      const inquiries = find(menu, 'inquiries');

      expect(consultations?.kind === 'link' && consultations.countLabel?.(8)).toBe('신규 8건');
      expect(inquiries?.kind === 'link' && inquiries.countLabel?.(2)).toBe('미답변 2건');
    });
  });

  describe('현재 항목', () => {
    it('대시보드는 `/admin` 일 때만이다 — 하위 라우트가 아니다', () => {
      expect(find(buildAdminMenu(input({ pathname: '/admin' })), 'dashboard')).toMatchObject({ current: true });
      expect(
        find(buildAdminMenu(input({ pathname: '/admin/consultations' })), 'dashboard')
      ).toMatchObject({ current: false });
    });

    it('상담 예약은 상세 라우트에서도 현재다', () => {
      const menu = buildAdminMenu(input({ pathname: '/admin/consultations/c1' }));

      expect(find(menu, 'consultations')).toMatchObject({ current: true });
      expect(find(menu, 'inquiries')).toMatchObject({ current: false });
    });

    it('병원 정보 화면에서 `?field=doctors` 면 의료진이, 아니면 기본 정보가 현재다', () => {
      const basic = buildAdminMenu(input({ pathname: '/admin/hospital/h1' }));
      expect(find(basic, 'hospital-info')).toMatchObject({ current: true });
      expect(find(basic, 'hospital-doctors')).toMatchObject({ current: false });

      const doctors = buildAdminMenu(input({ pathname: '/admin/hospital/h1', field: 'doctors' }));
      expect(find(doctors, 'hospital-info')).toMatchObject({ current: false });
      expect(find(doctors, 'hospital-doctors')).toMatchObject({ current: true });
    });

    it('알림함에는 대응하는 메뉴가 없다 — 어느 항목도 현재가 아니다', () => {
      const menu = buildAdminMenu(input({ pathname: '/admin/notifications' }));

      expect(menu.flatMap((group) => group.items).some((item) => item.kind === 'link' && item.current)).toBe(false);
    });
  });
});

describe('buildAdminMenu — 운영자', () => {
  const operator = input({ isOperator: true, selectedHospitalId: null });

  it('대시보드 대신 병원 목록이고, 운영 그룹이 따로 있다', () => {
    const menu = buildAdminMenu(operator);

    expect(groupKeys(menu)).toEqual(['work', 'ops']);
    expect(itemKeys(menu, 'work')).toEqual(['consultations', 'inquiries']);
    expect(itemKeys(menu, 'ops')).toEqual(['hospital-list', 'specialists', 'hospital-new']);
    expect(find(menu, 'dashboard')).toBeUndefined();
    expect(find(menu, 'hospital-list')).toMatchObject({ to: '/admin' });
  });

  it('병원 정보 그룹이 없다 — 운영자는 선택한 병원이 없다', () => {
    expect(groupKeys(buildAdminMenu(operator))).not.toContain('hospital');
  });

  /**
   * 홍보·확장(이벤트·후기·광고 현황·기공소 연계)은 **병원이 자기 병원을 알리는 기능**이다.
   * 운영자에게는 알릴 병원이 없어 영영 쓰지 않을 `준비중` 네 줄이 된다.
   */
  it('홍보 · 확장 그룹이 없다 — 병원 홍보 기능이라 운영자의 일이 아니다', () => {
    const menu = buildAdminMenu(operator);

    expect(groupKeys(menu)).not.toContain('growth');
    expect(menu.flatMap((group) => group.items).some((item) => item.kind === 'soon')).toBe(false);
    // 병원 담당자에게는 그대로 남는다.
    expect(groupKeys(buildAdminMenu(input()))).toContain('growth');
  });

  /**
   * 운영자는 상담에 연락할 수도 문의에 답할 수도 없다 — 할 수 없는 일의 숫자를 붙이지 않는다
   * (설계 D9, 덮어쓰기 8).
   */
  it('배지 숫자를 하나도 붙이지 않는다 — 숫자를 알고 있어도', () => {
    const menu = buildAdminMenu(input({ isOperator: true, selectedHospitalId: null, counts: { statusNew: 8, unansweredInquiries: 2 } }));

    expect(menu.flatMap((group) => group.items).every((item) => item.kind !== 'link' || item.count === null)).toBe(true);
  });

  it('병원 목록은 `/admin` 일 때 현재이고, 검수는 섹션으로 판정한다', () => {
    expect(find(buildAdminMenu({ ...operator, pathname: '/admin' }), 'hospital-list')).toMatchObject({
      current: true,
    });
    expect(find(buildAdminMenu({ ...operator, pathname: '/admin/specialists' }), 'specialists')).toMatchObject({
      current: true,
    });
    expect(find(buildAdminMenu({ ...operator, pathname: '/admin/hospital/new' }), 'hospital-new')).toMatchObject({
      current: true,
    });
  });
});
