import { PrimaryButton } from '@/components/PrimaryButton';
import { formatDateTimeShort } from '@/features/consult/consultDisplay';
import type { ConsultMemo } from '@/types/domain';

interface AdminConsultMemosProps {
  memos: ConsultMemo[];
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  /** 운영자는 읽기만 한다 (`POST .../memos` 는 담당 병원 관리자만). */
  canWrite: boolean;
}

/** 내부 공유용 메모. **신청자에게 절대 내려가지 않는다.** */
export function AdminConsultMemos({
  memos,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  error,
  canWrite,
}: AdminConsultMemosProps) {
  const latestFirst = [...memos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section aria-labelledby="consult-memo-h" className="mt-5 border-t border-neutral-100 pt-5">
      <h3 id="consult-memo-h" className="text-sm font-semibold text-neutral-700">
        메모
      </h3>
      <p className="mt-1 text-[13px] text-neutral-500">병원 안에서만 보여요. 환자에게는 보이지 않아요.</p>

      {latestFirst.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">아직 작성된 메모가 없어요</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {latestFirst.map((memo) => (
            <li key={memo.id} className="rounded-xl bg-neutral-50 px-4 py-3">
              <p className="whitespace-pre-wrap break-words text-sm text-neutral-800">{memo.content}</p>
              <p className="mt-1 text-[11px] text-neutral-400">{formatDateTimeShort(memo.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <div className="mt-4">
          <label htmlFor="consult-memo" className="text-xs text-neutral-500">
            메모 추가
          </label>
          <textarea
            id="consult-memo"
            rows={3}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="내부 공유용 메모를 남겨보세요"
            className="mt-1 min-h-[72px] w-full resize-y rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600"
          />
          {error ? (
            <p role="alert" className="mb-2 mt-1 text-sm text-rose-600">
              {error}
            </p>
          ) : null}
          <PrimaryButton
            label={submitting ? '추가 중' : '메모 추가'}
            onPress={onSubmit}
            disabled={draft.trim().length === 0 || submitting}
          />
        </div>
      ) : null}
    </section>
  );
}
