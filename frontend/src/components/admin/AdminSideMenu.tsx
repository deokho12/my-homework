import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AdminHospitalPicker } from '@/components/admin/AdminHospitalPicker';
import { AdminMenuItem } from '@/components/admin/AdminMenuItem';
import type { AdminMenuGroup } from '@/components/admin/adminMenu';
import type { AdminHospitalOption } from '@/features/admin/hooks/useAdminHospital';
import { cx } from '@/primitives';

export interface AdminMenuContentProps {
  groups: AdminMenuGroup[];
  /** 선택기는 **담당 병원이 2곳 이상일 때만** 그린다. */
  showPicker: boolean;
  pickerId: string;
  hospitalId: string | null;
  hospitalOptions: AdminHospitalOption[];
  onSelectHospital: (hospitalId: string) => void;
  /** 하단 카드. 담당 병원이 없으면 `null` 이고 화면이 그렇게 말한다. */
  hospitalName: string | null;
  userName: string;
}

/**
 * 그룹 제목 + 항목. 세로 메뉴와 `더보기` 패널이 같은 조각을 쓴다.
 *
 * `idPrefix` 를 받는 이유: 두 메뉴가 **동시에 DOM 에 있다**(폭에 따라 한쪽만 보일 뿐이다).
 * 같은 id 를 두 번 쓰면 `aria-labelledby` 가 어느 제목을 가리키는지 모호해진다
 * (`AdminHospitalPicker` 의 `id` 와 같은 이유).
 */
export function AdminMenuGroupList({
  group,
  idPrefix = 'admin-menu',
}: {
  group: AdminMenuGroup;
  idPrefix?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p id={`${idPrefix}-${group.key}`} className="px-3 pb-1.5 text-xs font-semibold text-neutral-500">
        {group.title}
      </p>
      <ul aria-labelledby={`${idPrefix}-${group.key}`}>
        {group.items.map((item) => (
          <AdminMenuItem key={item.key} item={item} />
        ))}
      </ul>
    </div>
  );
}

/** 메뉴 하단 — 지금 어느 병원의, 누구로 일하고 있는지. */
export function AdminMenuFooter({ hospitalName, userName }: { hospitalName: string | null; userName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-neutral-200 p-3.5">
        <p className="text-sm font-bold text-neutral-900">{hospitalName ?? '담당 병원 없음'}</p>
        <p className="mt-0.5 text-[13px] text-neutral-500">{userName}</p>
      </div>
      {/* 관리자 화면에는 환자 앱의 상단바·하단탭이 없다 — 돌아갈 문이 여기 하나다. */}
      <Link
        to="/"
        className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
      >
        <ArrowLeft size={16} aria-hidden="true" /> 몰라몰라 앱으로
      </Link>
    </div>
  );
}

/**
 * 넓은 화면(lg 이상)의 세로 메뉴. 그 아래 폭에서는 `AdminNarrowNav` 가 같은 모델을 칩 줄 +
 * `더보기` 패널로 그린다 — 248px 메뉴를 md 에 세우면 상담·문의의 `목록 380 + 상세` 가 깨진다.
 */
export function AdminSideMenu({ className, ...content }: AdminMenuContentProps & { className?: string }) {
  return (
    <nav
      aria-label="관리자 메뉴"
      className={cx(
        'flex-col gap-5 border-r border-neutral-200 bg-white px-3 py-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto',
        className
      )}
    >
      <Link to="/admin" className="px-3 text-[19px] font-extrabold text-neutral-900">
        몰라몰라 <span className="font-semibold text-brand-700">파트너</span>
      </Link>

      {content.showPicker ? (
        <AdminHospitalPicker
          id={content.pickerId}
          value={content.hospitalId}
          options={content.hospitalOptions}
          onSelect={content.onSelectHospital}
        />
      ) : null}

      {content.groups.map((group) => (
        <AdminMenuGroupList key={group.key} group={group} />
      ))}

      <div className="mt-auto">
        <AdminMenuFooter hospitalName={content.hospitalName} userName={content.userName} />
      </div>
    </nav>
  );
}
