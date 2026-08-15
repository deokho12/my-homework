import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** 없으면 재시도 버튼을 렌더하지 않는다. */
  onRetry?: () => void;
  /**
   * 재조회가 진행 중임을 알린다. TanStack Query 는 재시도 중에도 `status` 가
   * `'error'` 로 남고 `fetchStatus` 만 바뀌므로, 이 플래그 없이는 버튼을 눌러도
   * 화면이 전혀 변하지 않아 사용자가 반복 클릭한다.
   */
  isRetrying?: boolean;
  /**
   * 'block' (기본) — 화면 전체를 차지하는 자리.
   * 'inline' — 스크롤 페이지 중간의 한 줄. `EmptyState` 와 같은 규칙이다.
   */
  variant?: 'block' | 'inline';
  className?: string;
}

/**
 * 조회 실패를 알리는 공용 상태 화면. 화면마다 문구를 다시 짜지 않도록 기본값을 갖는다.
 * primitives 의 View/Text 대신 순수 HTML 을 쓴다 — 삽입 위치와 무관하게
 * 레이아웃을 명시적 flex 클래스로 선언하므로 `.rnw-view` 의 암묵적 기본값이 필요 없다.
 */
export function ErrorState({
  title = '정보를 불러오지 못했어요',
  description = '잠시 후 다시 시도해주세요',
  onRetry,
  isRetrying = false,
  variant = 'block',
  className,
}: ErrorStateProps) {
  const isInline = variant === 'inline';

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center ${
        isInline ? 'gap-1 py-8' : 'gap-3 px-6 py-16'
      }${className ? ` ${className}` : ''}`}
    >
      {isInline ? null : <AlertTriangle size={40} className="text-neutral-300" aria-hidden="true" />}
      <div className={isInline ? undefined : 'space-y-1'}>
        <p className={isInline ? 'text-sm text-neutral-400' : 'text-base font-bold text-neutral-900'}>
          {title}
        </p>
        <p className={isInline ? 'text-xs text-neutral-400' : 'text-sm text-neutral-500'}>{description}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className={
            isInline
              ? 'mt-1 flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-brand-700 disabled:opacity-60'
              : 'mt-2 flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white active:bg-brand-700 disabled:opacity-60'
          }
        >
          <RefreshCw size={isInline ? 13 : 15} className={isRetrying ? 'animate-spin' : undefined} aria-hidden="true" />
          {isRetrying ? '다시 시도 중' : '다시 시도'}
        </button>
      ) : null}
    </div>
  );
}
