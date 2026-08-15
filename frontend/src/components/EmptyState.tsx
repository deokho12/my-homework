import type { LucideIcon } from 'lucide-react';
import { SearchX } from 'lucide-react';

export interface EmptyStateProps {
  /** `null` 을 넘기면 아이콘을 렌더하지 않는다. `variant='inline'` 은 항상 아이콘이 없다. */
  icon?: LucideIcon | null;
  /** 리소스명이 들어가야 문장이 자연스러워서 기본값을 두지 않는다. */
  title: string;
  description?: string;
  actionLabel?: string;
  /** `actionLabel` 과 함께 있을 때만 버튼을 렌더한다. */
  onAction?: () => void;
  /**
   * 'block' (기본) — 화면 전체를 차지하는 자리.
   * 'inline' — 스크롤 페이지 중간의 한 줄. 이 코드베이스가 이미 쓰던
   *   `text-sm text-neutral-400` 한 줄 표현을 그대로 재현한다. tailwind-merge 가 없어
   *   `className` 으로 block 스타일을 덮을 수 없으므로 variant 로 분기한다.
   */
  variant?: 'block' | 'inline';
  className?: string;
}

/**
 * "결과 0건"을 알리는 공용 상태 화면. 실패가 아니라 정상 결과이므로
 * `ErrorState` 와 달리 `role="alert"` 을 붙이지 않는다.
 */
export function EmptyState({
  icon = SearchX,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'block',
  className,
}: EmptyStateProps) {
  const isInline = variant === 'inline';
  const Icon = isInline ? null : icon;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        isInline ? 'gap-1 py-8' : 'gap-3 px-6 py-16'
      }${className ? ` ${className}` : ''}`}
    >
      {Icon ? <Icon size={40} className="text-neutral-300" aria-hidden="true" /> : null}
      <div className={isInline ? undefined : 'space-y-1'}>
        <p className={isInline ? 'text-sm text-neutral-400' : 'text-base font-bold text-neutral-900'}>
          {title}
        </p>
        {description ? (
          <p className={isInline ? 'text-xs text-neutral-400' : 'text-sm text-neutral-500'}>{description}</p>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={
            isInline
              ? 'mt-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 active:bg-neutral-50'
              : 'mt-2 rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 active:bg-neutral-50'
          }
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
