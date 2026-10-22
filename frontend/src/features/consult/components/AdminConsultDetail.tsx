import { Check, Phone } from 'lucide-react';

import { Badge } from '@/components/Badge';
import type { AdminConsultRequest, ConsultStatusUpdateInput } from '@/features/consult/api/consultApi';
import { AdminConsultHistory } from '@/features/consult/components/AdminConsultHistory';
import { ConsultDelayPill } from '@/features/consult/components/ConsultDelayPill';
import { AdminConsultMemos } from '@/features/consult/components/AdminConsultMemos';
import {
  AdminConsultStatusForm,
  type ConsultStatusDraft,
} from '@/features/consult/components/AdminConsultStatusForm';
import {
  CONSULT_STATUS_TONE,
  consultProcedureLabel,
  formatDateTimeShort,
  formatVisitAt,
  isConsultDelayed,
} from '@/features/consult/consultDisplay';
import { CONSULT_STATUS_LABEL } from '@/types/domain';

interface AdminConsultDetailProps {
  request: AdminConsultRequest;
  /** 담당 병원 관리자만 상태를 바꾸고 메모를 쓴다 (운영자는 `403`). */
  canEdit: boolean;
  draft: ConsultStatusDraft;
  onDraftChange: (draft: ConsultStatusDraft) => void;
  onSubmit: (input: ConsultStatusUpdateInput, context: { isReschedule: boolean }) => void;
  saving: boolean;
  saveError: string | null;
  savedMessage: string | null;
  memoDraft: string;
  onMemoDraftChange: (draft: string) => void;
  onAddMemo: () => void;
  addingMemo: boolean;
  memoError: string | null;
  now: Date;
}

function InfoRow({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className={emphasized ? 'font-semibold text-brand-700' : 'text-neutral-900'}>{value}</dd>
    </>
  );
}

/**
 * 상담 한 건의 상세. **전체 연락처가 있는 유일한 자리**이고, 그 판정 근거는 `piiMasked`
 * 하나다 — 화면이 역할로 다시 계산하지 않는다 (마스킹 정책이 바뀌면 서버만 고치게).
 */
export function AdminConsultDetail({
  request,
  canEdit,
  draft,
  onDraftChange,
  onSubmit,
  saving,
  saveError,
  savedMessage,
  memoDraft,
  onMemoDraftChange,
  onAddMemo,
  addingMemo,
  memoError,
  now,
}: AdminConsultDetailProps) {
  const delayed = isConsultDelayed(request, now.getTime());
  const visit = formatVisitAt(request.visitAt);
  const procedureLabel = consultProcedureLabel(request.procedureId);
  const message = request.message.trim();
  // 병원 이름은 **상세 응답에 들어 있다** (목록 카드와 같은 값, 요청서 15).
  // 환자 알림 문구의 병원 이름도 서버가 조인해 쓴다 — 화면이 넘겨주지 않는다.

  return (
    <div>
      {savedMessage ? (
        <div role="status" className="mb-4 flex flex-row items-center gap-2 rounded-xl bg-brand-50 px-4 py-3">
          <Check size={18} className="text-brand-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-brand-700">{savedMessage}</span>
        </div>
      ) : null}

      <p className="text-[13px] text-neutral-500">{formatDateTimeShort(request.createdAt)} 신청</p>
      <div className="mt-1 flex flex-row flex-wrap items-center gap-2">
        <h2 id="consult-detail-h" tabIndex={-1} className="min-w-0 text-xl font-bold text-neutral-900 outline-none">
          {request.name}
        </h2>
        <Badge label={CONSULT_STATUS_LABEL[request.status]} tone={CONSULT_STATUS_TONE[request.status]} />
        {delayed ? <ConsultDelayPill /> : null}
      </div>
      {delayed ? <p className="mt-1 text-[13px] text-rose-700">24시간 넘게 신규 상태예요. 먼저 연락해 주세요.</p> : null}

      <div className="mt-4 flex flex-row items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">연락처</p>
          <p className="text-[17px] font-bold tabular-nums text-neutral-900">{request.phone}</p>
        </div>
        {!request.piiMasked ? (
          <a
            href={`tel:${request.phone.replace(/-/g, '')}`}
            className="flex min-h-[44px] shrink-0 flex-row items-center gap-2 rounded-xl bg-brand-600 px-4 text-[15px] font-bold text-white active:bg-brand-700"
          >
            <Phone size={18} aria-hidden="true" />
            전화 걸기
          </a>
        ) : null}
      </div>
      {request.piiMasked ? (
        <p className="mt-2 text-[13px] text-neutral-500">연락처 전체와 전화 걸기는 담당 병원 관리자만 볼 수 있어요.</p>
      ) : null}

      <dl className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <InfoRow label="병원" value={request.hospitalName} />
        <InfoRow label="시술" value={procedureLabel ?? request.procedureId ?? '시술 미지정'} />
        <InfoRow label="희망 시간" value={request.preferredTime.trim() || '미지정'} />
        {visit ? <InfoRow label="확정 방문" value={visit} emphasized /> : null}
      </dl>

      <section aria-labelledby="consult-message-h" className="mt-4">
        <h3 id="consult-message-h" className="text-sm font-semibold text-neutral-700">
          환자가 남긴 말
        </h3>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {message.length > 0 ? message : '남긴 메시지가 없어요'}
        </p>
      </section>

      {canEdit ? (
        <AdminConsultStatusForm
          request={request}
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
          saving={saving}
          saveError={saveError}
          now={now}
        />
      ) : null}

      <AdminConsultMemos
        memos={request.memos}
        draft={memoDraft}
        onDraftChange={onMemoDraftChange}
        onSubmit={onAddMemo}
        submitting={addingMemo}
        error={memoError}
        canWrite={canEdit}
      />

      <AdminConsultHistory history={request.statusHistory} />
    </div>
  );
}
