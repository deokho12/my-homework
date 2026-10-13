import {
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarCheck,
  LayoutDashboard,
  List,
  Megaphone,
  MessageCircleQuestion,
  PlusCircle,
  Star,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * 사이드 메뉴의 **모델**. 세션·숫자·선택 병원만 받는 순수 함수라, 셸을 렌더하지 않고
 * 그룹 구성과 `현재 항목` 판정을 테스트할 수 있다 (`adminMenu.test.ts`).
 *
 * 세로 메뉴와 좁은 화면의 칩 줄이 **같은 모델**을 그린다 — 두 벌로 두면 한쪽에만 항목이
 * 생기거나 배지가 갈린다.
 */

/** `/admin/consultations/c1` → `/admin/consultations`. 상세는 그 목록 섹션에 속한다. */
export function adminSection(pathname: string): string {
  const [root, second] = pathname.split('/').filter(Boolean);

  if (root !== 'admin') return pathname;

  return second ? `/admin/${second}` : '/admin';
}

/**
 * 상단바의 뒤로 가기. **좁은 화면에서만 보인다** — 넓은 화면은 목록과 상세가 나란히 서서
 * 돌아갈 곳이 이미 보인다.
 *
 * 상담·문의의 상세는 목록으로, 병원 등록은 홈으로 간다. 그 밖에는 `null`(뒤로가 없다).
 */
export function adminBackTo(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length !== 3 || segments[0] !== 'admin') return null;

  const [, section, last] = segments;

  if (section === 'consultations' || section === 'inquiries') return `/admin/${section}`;
  if (section === 'hospital' && last === 'new') return '/admin';

  return null;
}

/**
 * 병원을 바꿨을 때 **지금 화면이 그대로 있어도 되는가.**
 *
 * 특정 레코드를 보고 있었다면 그 레코드는 **방금 떠난 병원의 것**이라 목록으로 돌아간다
 * (그대로 두면 담당하지 않는 병원의 상담 상세가 열려 있고, 조회는 `404` 로 비워진다).
 * 목록·대시보드는 제자리에서 숫자만 바뀐다 (`null`).
 */
export function hospitalSwitchTarget(pathname: string, nextHospitalId: string): string | null {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length !== 3 || segments[0] !== 'admin') return null;

  const [, section] = segments;

  if (section === 'consultations' || section === 'inquiries') return `/admin/${section}`;
  // 병원 수정 화면은 "다른 병원의 같은 화면" 이 있다 — 목록이 아니라 그쪽으로 옮긴다.
  if (section === 'hospital' && segments[2] !== 'new') return `/admin/hospital/${nextHospitalId}`;

  return null;
}

export interface AdminMenuLink {
  kind: 'link';
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  /** 배지 숫자. **`null` 은 "아직 모름"** 이고 `0` 은 "없음" 이다 — 둘 다 그리지 않는다. */
  count: number | null;
  /** 스크린리더에 읽어 줄 문장 (`신규 8건`). 숫자마다 뜻이 달라 항목이 들고 있다. */
  countLabel?: (count: number) => string;
  current: boolean;
}

/** 아직 화면이 없는 항목. 링크가 아니라 **회색 글자 + `준비중` 배지**다 (포커스를 받지 않는다). */
export interface AdminMenuSoon {
  kind: 'soon';
  key: string;
  label: string;
  icon: LucideIcon;
}

export type AdminMenuEntry = AdminMenuLink | AdminMenuSoon;

export interface AdminMenuGroup {
  key: string;
  title: string;
  items: AdminMenuEntry[];
}

export interface AdminMenuInput {
  isOperator: boolean;
  /** 지금 보고 있는 병원. 담당 병원이 없으면 `null` — `병원 정보` 그룹이 통째로 빠진다. */
  selectedHospitalId: string | null;
  pathname: string;
  /** 주소의 `?field=`. 병원 정보 화면 안에서 `기본 정보`와 `의료진` 을 가른다. */
  field?: string;
  /**
   * 배지 숫자. **대시보드 응답과 같은 출처**여야 한다 — 셸이 따로 세면 같은 화면의 카드와
   * 배지가 다른 숫자를 말한다 (`docs/database/README.md` §13.8).
   */
  counts: {
    statusNew: number | null;
    unansweredInquiries: number | null;
  };
}

const GROWTH_ITEMS: AdminMenuSoon[] = [
  { kind: 'soon', key: 'events', label: '이벤트', icon: Megaphone },
  { kind: 'soon', key: 'reviews', label: '후기', icon: Star },
  { kind: 'soon', key: 'ads', label: '광고 현황', icon: BarChart3 },
  { kind: 'soon', key: 'lab', label: '기공소 연계', icon: Wrench },
];

export function buildAdminMenu({
  isOperator,
  selectedHospitalId,
  pathname,
  field,
  counts,
}: AdminMenuInput): AdminMenuGroup[] {
  const section = adminSection(pathname);
  // 운영자에게는 숫자를 하나도 붙이지 않는다 — 답할 수도 연락할 수도 없는 역할에게
  // `미답변 2건` 은 할 일이 아니다 (설계 D9).
  const countOf = (value: number | null): number | null => (isOperator ? null : value);

  const work: AdminMenuGroup = {
    key: 'work',
    title: '업무',
    items: [
      ...(isOperator
        ? []
        : [
            {
              kind: 'link' as const,
              key: 'dashboard',
              label: '대시보드',
              icon: LayoutDashboard,
              to: '/admin',
              count: null,
              current: section === '/admin',
            },
          ]),
      {
        kind: 'link',
        key: 'consultations',
        label: '상담 예약',
        icon: CalendarCheck,
        to: '/admin/consultations',
        count: countOf(counts.statusNew),
        countLabel: (count: number) => `신규 ${count}건`,
        current: section === '/admin/consultations',
      },
      {
        kind: 'link',
        key: 'inquiries',
        label: '문의',
        icon: MessageCircleQuestion,
        to: '/admin/inquiries',
        count: countOf(counts.unansweredInquiries),
        countLabel: (count: number) => `미답변 ${count}건`,
        current: section === '/admin/inquiries',
      },
    ],
  };

  const groups: AdminMenuGroup[] = [work];

  // 담당 병원이 없으면 갈 주소 자체가 없다 — 빈 그룹을 그리면 "여기 뭔가 있다" 는 거짓말이다.
  if (!isOperator && selectedHospitalId) {
    const onHospital = section === '/admin/hospital' && pathname !== '/admin/hospital/new';

    groups.push({
      key: 'hospital',
      title: '병원 정보',
      items: [
        {
          kind: 'link',
          key: 'hospital-info',
          label: '기본 정보 · 시술',
          icon: Building2,
          to: `/admin/hospital/${selectedHospitalId}`,
          count: null,
          current: onHospital && field !== 'doctors',
        },
        {
          kind: 'link',
          key: 'hospital-doctors',
          label: '의료진',
          icon: Users,
          // 화면 분리는 요청 07 이다 — 지금은 수정 화면의 의료진 영역으로 점프한다.
          to: `/admin/hospital/${selectedHospitalId}?field=doctors`,
          count: null,
          current: onHospital && field === 'doctors',
        },
      ],
    });
  }

  if (isOperator) {
    groups.push({
      key: 'ops',
      title: '운영',
      items: [
        {
          kind: 'link',
          key: 'hospital-list',
          label: '병원 목록',
          icon: List,
          to: '/admin',
          count: null,
          current: section === '/admin',
        },
        {
          kind: 'link',
          key: 'specialists',
          label: '전문의 인증 검수',
          icon: BadgeCheck,
          to: '/admin/specialists',
          count: null,
          current: section === '/admin/specialists',
        },
        {
          kind: 'link',
          key: 'hospital-new',
          label: '새 병원 등록',
          icon: PlusCircle,
          to: '/admin/hospital/new',
          count: null,
          current: pathname === '/admin/hospital/new',
        },
      ],
    });
  }

  // 홍보·확장은 **병원이 자기 병원을 알리는 기능**이다 (이벤트·후기·광고·기공소 연계).
  // 운영자에게는 알릴 병원이 없으므로, 영영 쓰지 않을 `준비중` 네 줄을 보여주지 않는다
  // (배지 숫자를 붙이지 않는 것과 같은 판단 — 할 수 없는 일을 메뉴에 두지 않는다).
  if (!isOperator) {
    groups.push({ key: 'growth', title: '홍보 · 확장', items: [...GROWTH_ITEMS] });
  }

  return groups;
}
