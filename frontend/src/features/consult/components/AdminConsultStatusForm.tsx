import { useState } from 'react';

import type { AdminConsultRequest, ConsultStatusUpdateInput } from '@/features/consult/api/consultApi';
import { formatVisitAt, todayInSeoul, toVisitAtInputs, visitAtFromInputs } from '@/features/consult/consultDisplay';
import { truncateToMinute } from '@/features/consult/lib/transition';
import { cx } from '@/primitives';
import {
  CONSULT_CANCEL_REASONS,
  CONSULT_CANCEL_REASON_LABEL,
  CONSULT_STATUSES,
  CONSULT_STATUS_LABEL,
  isConsultCancelReason,
  type ConsultCancelReason,
  type ConsultStatus,
} from '@/types/domain';

/**
 * 아직 저장하지 않은 선택. **고르는 것과 바뀌는 것은 다르다** — 상태 변경은 환자에게 알림이
 * 나가 되돌릴 수 없어서, 다섯 상태 **모두** 명시적인 `저장`을 거친다.
 *
 * 상태가 `null` 이면 고른 것이 없다는 뜻이고, 그때는 저장 줄도 입력 칸도 없다.
 */
export interface ConsultStatusDraft {
  status: ConsultStatus | null;
  date: string;
  time: string;
  cancelReason: ConsultCancelReason | '';
}

export const EMPTY_CONSULT_DRAFT: ConsultStatusDraft = { status: null, date: '', time: '', cancelReason: '' };

/** 저장하지 않고 떠나면 사라지는 것이 있는가 (이탈 가드의 판정). */
export function isConsultDraftDirty(draft: ConsultStatusDraft): boolean {
  return draft.status !== null;
}

/**
 * 저장 버튼 문구. **상태마다 조사가 달라 표로 둔다** (`신규로` / `연락중으로`) —
 * 라벨에 접미사를 붙이는 식으로 만들면 `신규으로 저장` 이 된다.
 */
const SAVE_LABEL: Record<ConsultStatus, string> = {
  new: '신규로 저장',
  contacted: '연락중으로 저장',
  booked: '예약 확정하기',
  visited: '내원완료로 저장',
  cancelled: '취소로 저장',
};

/** 성공 줄 문구. 조사 때문에 `SAVE_LABEL` 과 같은 이유로 표다. */
export const SAVED_MESSAGE: Record<ConsultStatus, string> = {
  new: '신규로 저장했어요.',
  contacted: '연락중으로 저장했어요.',
  booked: '예약확정으로 저장했어요.',
  visited: '내원완료로 저장했어요.',
  cancelled: '취소로 저장했어요.',
};

const BOTH_REQUIRED = '날짜와 시간을 모두 넣어야 저장할 수 있어요';
const PAST_DATE = '지난 날짜는 고를 수 없어요';
const UNCHANGED = '일시가 그대로예요';
const REASON_REQUIRED = '취소 사유를 골라야 저장할 수 있어요';

interface Evaluation {
  canSave: boolean;
  /** 저장이 막힌 이유. 막히지 않았으면 `null`. */
  hint: string | null;
  saveLabel: string;
  /** 저장할 확정 일시 (예약확정·일시 변경일 때만). */
  visitAt: string | null;
  isReschedule: boolean;
}

/**
 * 고른 것이 저장 가능한가 — **순수 판정**이다. 서버(`api/consultApi.ts`)가 같은 규칙을
 * `422` 로 들고 있고, 둘이 갈리면 눌리는데 저장되지 않는 버튼이 생긴다.
 */
function evaluate(request: AdminConsultRequest, draft: ConsultStatusDraft): Evaluation | null {
  if (draft.status === null) return null;

  const isReschedule = draft.status === 'booked' && request.status === 'booked';
  const base = { saveLabel: isReschedule ? '일시 변경 저장' : SAVE_LABEL[draft.status], isReschedule };

  if (draft.status === 'booked') {
    const visitAt = visitAtFromInputs(draft.date, draft.time);

    if (!visitAt) return { ...base, canSave: false, hint: BOTH_REQUIRED, visitAt: null };
    // 같은 일시를 다시 저장하면 서버는 no-op 이지만, 화면이 "바꿨다" 고 말하게 두지 않는다.
    if (isReschedule && truncateToMinute(visitAt) === truncateToMinute(request.visitAt)) {
      return { ...base, canSave: false, hint: UNCHANGED, visitAt };
    }

    return { ...base, canSave: true, hint: null, visitAt };
  }

  if (draft.status === 'cancelled') {
    const hasReason = isConsultCancelReason(draft.cancelReason);
    return { ...base, canSave: hasReason, hint: hasReason ? null : REASON_REQUIRED, visitAt: null };
  }

  return { ...base, canSave: true, hint: null, visitAt: null };
}

interface AdminConsultStatusFormProps {
  request: AdminConsultRequest;
  draft: ConsultStatusDraft;
  onDraftChange: (draft: ConsultStatusDraft) => void;
  onSubmit: (input: ConsultStatusUpdateInput, context: { isReschedule: boolean }) => void;
  saving: boolean;
  /** 서버가 거절한 이유. 모달이 아니라 인라인이다 — 입력이 보여야 바로 다시 누른다. */
  saveError: string | null;
  now: Date;
}

const INPUT_CLASS = 'h-11 w-full rounded-xl border px-3 text-[15px] outline-none focus:border-brand-600';

export function AdminConsultStatusForm({
  request,
  draft,
  onDraftChange,
  onSubmit,
  saving,
  saveError,
  now,
}: AdminConsultStatusFormProps) {
  const [visitError, setVisitError] = useState<string | null>(null);
  const evaluation = evaluate(request, draft);
  const today = todayInSeoul(now);
  const currentVisit = formatVisitAt(request.visitAt);

  const select = (status: ConsultStatus) => {
    setVisitError(null);

    // 현재와 같은 상태를 다시 고르면 고른 것을 비운다 — 같은 상태로 알림이 또 나가지 않게.
    // 예외는 `예약확정` 이다: 그것은 "일시 변경" 을 뜻한다.
    if (status === request.status && status !== 'booked') {
      onDraftChange(EMPTY_CONSULT_DRAFT);
      return;
    }

    onDraftChange({
      ...EMPTY_CONSULT_DRAFT,
      status,
      // 새로 확정할 때는 **비운다** — 틀린 일시가 알림으로 나가지 않게. 일시 변경일 때만 채운다.
      ...(status === 'booked' && request.status === 'booked' ? toVisitAtInputs(request.visitAt) : {}),
    });
  };

  const submit = () => {
    if (!evaluation?.canSave || saving) return;

    // `min` 은 달력 UI 만 막는다. 직접 입력·붙여넣기가 있어 저장 직전에 한 번 더 본다.
    if (draft.status === 'booked' && draft.date < today) {
      setVisitError(PAST_DATE);
      return;
    }

    setVisitError(null);
    onSubmit(
      {
        status: draft.status as ConsultStatus,
        visitAt: evaluation.visitAt,
        cancelReason: draft.cancelReason === '' ? null : draft.cancelReason,
      },
      { isReschedule: evaluation.isReschedule }
    );
  };

  return (
    <section aria-labelledby="consult-status-h" className="mt-5 border-t border-neutral-100 pt-5">
      <h3 id="consult-status-h" tabIndex={-1} className="text-sm font-semibold text-neutral-700 outline-none">
        상태 바꾸기
      </h3>
      <p id="consult-status-note" className="mt-1 text-[13px] text-neutral-500">
        바꾸면 환자에게 알림이 가요
      </p>

      {request.status === 'booked' && draft.status === null ? (
        <div className="mt-3 flex flex-row items-center justify-between gap-2 rounded-xl bg-brand-50 px-4 py-3">
          {/* 계약 확장 이전에 예약확정이 된 건에는 일시가 없다 — 소급해 채우지 않았다. */}
          <p className="text-sm font-bold text-brand-700">{currentVisit ? `${currentVisit} 방문` : '일시 미입력'}</p>
          <button
            type="button"
            onClick={() => select('booked')}
            className="min-h-[36px] shrink-0 rounded-lg border border-brand-600 px-3 text-[13px] font-bold text-brand-700"
          >
            일시 변경
          </button>
        </div>
      ) : null}

      <div
        role="group"
        aria-labelledby="consult-status-h"
        aria-describedby="consult-status-note"
        className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-5"
      >
        {CONSULT_STATUSES.map((status) => {
          const picked = draft.status === status;
          const current = request.status === status;

          return (
            <button
              key={status}
              type="button"
              onClick={() => select(status)}
              aria-current={current ? 'true' : undefined}
              aria-pressed={picked}
              className={cx(
                'min-h-[44px] rounded-xl border px-2 text-sm font-semibold',
                picked
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : current
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-neutral-200 bg-white text-neutral-600'
              )}
            >
              {CONSULT_STATUS_LABEL[status]}
            </button>
          );
        })}
      </div>

      {draft.status === 'booked' ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label htmlFor="consult-visit-date" className="flex flex-col gap-1 text-xs text-neutral-500">
            확정 날짜 (필수)
            <input
              id="consult-visit-date"
              type="date"
              value={draft.date}
              min={today}
              aria-invalid={visitError !== null || undefined}
              aria-describedby={visitError ? 'consult-visit-error' : undefined}
              onChange={(event) => {
                setVisitError(null);
                onDraftChange({ ...draft, date: event.target.value });
              }}
              onBlur={() => {
                if (!draft.date) setVisitError(BOTH_REQUIRED);
              }}
              className={cx(INPUT_CLASS, visitError ? 'border-rose-400' : 'border-neutral-200')}
            />
          </label>
          <label htmlFor="consult-visit-time" className="flex flex-col gap-1 text-xs text-neutral-500">
            시간 (필수)
            <input
              id="consult-visit-time"
              type="time"
              value={draft.time}
              aria-invalid={visitError !== null || undefined}
              aria-describedby={visitError ? 'consult-visit-error' : undefined}
              onChange={(event) => {
                setVisitError(null);
                onDraftChange({ ...draft, time: event.target.value });
              }}
              onBlur={() => {
                if (!draft.time) setVisitError(BOTH_REQUIRED);
              }}
              className={cx(INPUT_CLASS, visitError ? 'border-rose-400' : 'border-neutral-200')}
            />
          </label>
          {visitError ? (
            <p id="consult-visit-error" role="alert" className="mt-1.5 text-sm text-rose-500 sm:col-span-2">
              {visitError}
            </p>
          ) : null}
        </div>
      ) : null}

      {draft.status === 'cancelled' ? (
        <div className="mt-4">
          <label htmlFor="consult-cancel-reason" className="flex flex-col gap-1 text-xs text-neutral-500">
            취소 사유 (필수)
            <select
              id="consult-cancel-reason"
              value={draft.cancelReason}
              onChange={(event) =>
                onDraftChange({ ...draft, cancelReason: event.target.value as ConsultCancelReason | '' })
              }
              className={cx(INPUT_CLASS, 'border-neutral-200 bg-white text-neutral-900')}
            >
              <option value="">사유를 골라주세요</option>
              {CONSULT_CANCEL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {CONSULT_CANCEL_REASON_LABEL[reason]}
                </option>
              ))}
            </select>
          </label>
          {request.status === 'booked' ? (
            <p className="mt-1.5 text-[13px] text-amber-700">저장하면 확정된 방문 일정이 취소돼요.</p>
          ) : null}
        </div>
      ) : null}

      {evaluation ? (
        <>
          <div className="mt-4 flex flex-row items-center gap-3">
            <button
              type="button"
              disabled={!evaluation.canSave || saving}
              onClick={submit}
              className="min-h-[48px] flex-1 rounded-xl bg-brand-600 px-5 text-[15px] font-bold text-white active:bg-brand-700 disabled:opacity-40"
            >
              {saving ? '저장 중' : evaluation.saveLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setVisitError(null);
                onDraftChange(EMPTY_CONSULT_DRAFT);
              }}
              className="min-h-[48px] shrink-0 px-3 text-sm font-semibold text-neutral-500"
            >
              되돌리기
            </button>
          </div>
          {!evaluation.canSave && evaluation.hint ? (
            <p className="mt-1.5 text-[13px] text-neutral-400">{evaluation.hint}</p>
          ) : null}
        </>
      ) : null}

      {saveError ? (
        <p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </p>
      ) : null}
    </section>
  );
}
