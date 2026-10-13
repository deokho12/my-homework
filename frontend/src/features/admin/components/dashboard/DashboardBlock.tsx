import type { ReactNode } from 'react';

/**
 * 대시보드 블록 한 장의 껍데기.
 *
 * **블록마다 자기 상태를 그린다** — 응답 하나가 실패해도 화면 전체를 비우지 않고, 각 블록이
 * 같은 inline 오류와 재시도를 보여준다 (설계 D7). 집계가 한 응답이라 지금은 전부 같이
 * 실패하지만, 블록이 각자 상태를 그리는 구조는 그대로 둔다.
 */
export function DashboardBlock({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-neutral-100 bg-white p-4 md:p-5">
      <div className="mb-3 flex flex-row items-center justify-between gap-2">
        <h2 id={id} className="text-[17px] font-bold text-neutral-900">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** 블록 안의 실패 줄. 재시도는 같은 쿼리 하나를 다시 부른다. */
export function BlockError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-neutral-500">{label}을 불러오지 못했어요</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[36px] rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
      >
        다시 시도
      </button>
    </div>
  );
}

/** 0건은 실패가 아니라 정상 결과다 — 경고하지 않고 한 줄로 적는다. */
export function BlockEmpty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-neutral-400">{children}</p>;
}
