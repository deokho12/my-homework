import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { LIST_PAGE_SIZE } from '@/lib/pagination';

export interface ListMoreFooterProps {
  /** 지금 그려진 카드 수. */
  loadedCount: number;
  /** 서버가 준 전체 개수(`meta.totalItems`). 헤더의 `총 N곳` 과 같은 값이어야 한다. */
  totalCount: number;
  /** `곳`(병원) 또는 `명`(의사). */
  unit: '곳' | '명';
  /** 버튼 라벨의 명사 — `병원 20곳 더 보기` / `의사 20명 더 보기`. */
  noun: '병원' | '의사';
  isLoadingMore: boolean;
  /** **`isError` 가 아니라 `isFetchNextPageError`** — 첫 페이지 실패는 ErrorState 의 몫이다. */
  isError: boolean;
  onLoadMore: () => void;
}

/**
 * 목록 맨 아래의 「더 보기」 한 벌 — 진행 줄 + 버튼. 탐색(병원·의사)과 카테고리 화면이
 * 같이 쓴다 (설계: `design-req14-load-more.md`).
 *
 * 총 개수가 한 묶음 이하면 **아무것도 그리지 않는다** (지금과 같은 화면).
 *
 * 외곽선 버튼인 이유: 카드마다 채움 `상담신청` CTA 가 있어 경쟁하지 않게 한다. `hover:` 를
 * 쓰지 않는 것은 EmptyState·ErrorState 와 같은 규칙이다(터치 기기에서 hover 가 붙어 남는다).
 *
 * 불러오는 동안 버튼을 잠그는 방법은 `aria-disabled` 다. 네이티브 `disabled` 를 쓰면 Chrome 이
 * 포커스된 버튼을 body 로 흘려보내, Enter 로 누른 사람이 제자리를 잃는다 (설계 §7).
 */
export function ListMoreFooter({
  loadedCount,
  totalCount,
  unit,
  noun,
  isLoadingMore,
  isError,
  onLoadMore,
}: ListMoreFooterProps) {
  const hasMore = loadedCount < totalCount;
  /** 버튼을 **눌러서** 끝에 도달했을 때만 끝 줄로 포커스를 옮긴다 (설계 §7). */
  const requestedRef = useRef(false);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (hasMore || !requestedRef.current) return;
    requestedRef.current = false;
    doneRef.current?.focus();
  }, [hasMore]);

  if (totalCount <= LIST_PAGE_SIZE) return null;

  if (!hasMore) {
    return (
      <div className="mt-2 flex flex-col items-center gap-2">
        <p
          ref={doneRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="text-xs text-neutral-500 outline-none"
        >
          {`${totalCount}${unit}을 모두 봤어요`}
        </p>
      </div>
    );
  }

  const remaining = totalCount - loadedCount;
  const nextCount = Math.min(remaining, LIST_PAGE_SIZE);

  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      <p role="status" aria-live="polite" className="text-xs text-neutral-500">
        {`${totalCount}${unit} 중 ${loadedCount}${unit} 보는 중`}
      </p>
      {isError ? (
        <p role="alert" className="text-sm text-rose-600">
          더 불러오지 못했어요
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          // 네이티브 `disabled` 가 아니라 여기서 막는다 — 같은 묶음을 두 번 받지 않게.
          if (isLoadingMore) return;
          requestedRef.current = true;
          onLoadMore();
        }}
        aria-disabled={isLoadingMore}
        aria-busy={isLoadingMore}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-600 bg-white px-5 py-3 text-sm font-semibold text-brand-700 active:bg-brand-50 aria-disabled:opacity-60 md:w-auto md:min-w-[240px]"
      >
        {isLoadingMore ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
        {isLoadingMore ? '불러오는 중' : isError ? '다시 시도' : `${noun} ${nextCount}${unit} 더 보기`}
      </button>
    </div>
  );
}
