import type { ConsultStatusChangeView } from '@/features/consult/api/consultApi';
import { consultHistoryLine } from '@/features/consult/consultDisplay';

/**
 * 처리 이력. 저장·응답은 시간순이고 **표시만 최신순**이다 (정렬은 클라이언트 표현).
 * 한 줄의 문구는 `consultHistoryLine` 하나가 만든다.
 */
export function AdminConsultHistory({ history }: { history: ConsultStatusChangeView[] }) {
  const latestFirst = [...history].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

  return (
    <section aria-labelledby="consult-history-h" className="mt-5 border-t border-neutral-100 pt-5">
      <h3 id="consult-history-h" className="text-sm font-semibold text-neutral-700">
        처리 이력
      </h3>
      {latestFirst.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">아직 처리 이력이 없어요</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {latestFirst.map((change, index) => (
            <li key={`${change.event}-${change.changedAt}-${index}`} className="flex flex-row items-start gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
              <span className="text-[13px] leading-relaxed text-neutral-700">{consultHistoryLine(change)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
