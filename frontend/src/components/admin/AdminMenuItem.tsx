import { Link } from 'react-router-dom';

import { Badge } from '@/components/Badge';
import type { AdminMenuEntry } from '@/components/admin/adminMenu';
import { cx } from '@/primitives';

/**
 * 메뉴 한 줄. 세로 메뉴(`row`)와 좁은 화면의 칩 줄(`chip`)이 **같은 모델**을 그린다.
 *
 * 배지는 **숫자를 아는 동안에만** 붙는다 — `null`(로딩·실패)도 `0`(없음)도 그리지 않는다.
 * 숫자 자체는 `aria-hidden` 이고 옆에 문장(`신규 8건`)을 숨겨 둔다: `상담 예약 8` 은
 * 스크린리더에서 "상담 예약 팔" 로 읽혀 8이 무엇의 수인지 알 수 없다.
 */
export function AdminMenuItem({ item, variant = 'row' }: { item: AdminMenuEntry; variant?: 'row' | 'chip' }) {
  if (item.kind === 'soon') {
    const Icon = item.icon;

    // 링크가 아니므로 포커스를 받지 않는다 (마이페이지의 준비중 줄과 같은 규칙).
    // 회색 글자만으로는 대비가 모자라 `준비중` 배지가 뜻을 전한다.
    return (
      <li>
        <div className="flex min-h-[40px] items-center gap-2.5 px-3 text-[15px] text-neutral-300">
          <Icon size={18} aria-hidden="true" />
          <span>{item.label}</span>
          <Badge label="준비중" />
        </div>
      </li>
    );
  }

  const Icon = item.icon;
  const showCount = item.count !== null && item.count > 0;
  const countLabel = showCount ? (item.countLabel?.(item.count as number) ?? String(item.count)) : null;

  if (variant === 'chip') {
    return (
      <Link
        to={item.to}
        aria-current={item.current ? 'page' : undefined}
        className={cx(
          'flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-medium',
          item.current ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-200 bg-white text-neutral-600'
        )}
      >
        <Icon size={15} aria-hidden="true" />
        <span>
          {item.label}
          {showCount ? ` ${item.count}` : ''}
        </span>
        {countLabel ? <span className="sr-only">, {countLabel}</span> : null}
      </Link>
    );
  }

  return (
    <li>
      <Link
        to={item.to}
        aria-current={item.current ? 'page' : undefined}
        className={cx(
          'flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 text-[15px]',
          item.current ? 'bg-brand-50 font-bold text-brand-700' : 'font-medium text-neutral-700 hover:bg-neutral-50'
        )}
      >
        <Icon size={18} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {showCount ? (
          <>
            <span aria-hidden="true">
              <Badge label={String(item.count)} tone="brand" />
            </span>
            <span className="sr-only">, {countLabel}</span>
          </>
        ) : null}
      </Link>
    </li>
  );
}
