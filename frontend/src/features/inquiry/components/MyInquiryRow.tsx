import { ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';

import { Badge } from '@/components/Badge';
import { formatAppliedAt } from '@/features/consult';
import { INQUIRY_STATUS_TONE, inquiryTitle } from '@/features/inquiry/inquiryDisplay';
import { isPubliclyVisible } from '@/features/inquiry/inquiryVisibility';
import type { MyHospitalInquiry } from '@/features/inquiry/api/inquiryApi';
import { router } from '@/navigation';
import { INQUIRY_STATUS_LABEL } from '@/types/domain';

interface MyInquiryRowProps {
  inquiry: MyHospitalInquiry;
  isLast: boolean;
  open: boolean;
  onToggle: () => void;
}

/**
 * 마이페이지 `내 문의` 한 줄. **행을 펼쳐 답변을 읽는다** — 상세 화면을 따로 두지 않은
 * 이유는 계약에 단건 조회 경로가 없기 때문이다 (목록에 본문과 답변이 전문으로 실린다).
 *
 * `공개`/`비공개` 는 답이 오기 전에는 **내가 고른 값**, 답이 온 뒤에는 **실제 노출 여부**다 —
 * 병원도 공개에 동의해야 공개 Q/A 에 올라가므로 같은 순수 함수(`isPubliclyVisible`)로 판정한다.
 */
export const MyInquiryRow = forwardRef<HTMLButtonElement, MyInquiryRowProps>(function MyInquiryRow(
  { inquiry, isLast, open, onToggle },
  ref
) {
  const panelId = `my-inquiry-panel-${inquiry.id}`;
  const askedAt = formatAppliedAt(inquiry.createdAt);
  const answeredAt = formatAppliedAt(inquiry.answer?.answeredAt);
  const hospitalName = inquiry.hospitalName ?? '알 수 없는 병원';
  const isVisible = isPubliclyVisible(inquiry);
  // 답이 오기 전에는 실제 노출을 아직 모른다 — 그때는 내가 고른 값을 보여준다.
  const shownAsPublic = inquiry.answer ? isVisible : inquiry.isPublic;

  return (
    <>
      <button
        type="button"
        ref={ref}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={`w-full gap-1.5 py-4 text-left ${isLast ? '' : 'border-b border-neutral-100'}`}
      >
        <span className="flex flex-row items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-900">
            {inquiryTitle(inquiry.content)}
          </span>
          <span className="shrink-0">
            <Badge label={INQUIRY_STATUS_LABEL[inquiry.status]} tone={INQUIRY_STATUS_TONE[inquiry.status]} />
          </span>
        </span>
        <span className="block text-[13px] text-neutral-600">
          {hospitalName} · {shownAsPublic ? '공개' : '비공개'}
        </span>
        <span className="flex flex-row items-center justify-between gap-2">
          <span className="text-[13px] text-neutral-500">{askedAt ? `${askedAt} 문의` : ''}</span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`text-neutral-300 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* `hidden` 속성이다 — 접힌 내용이 읽기 도구에도 보이지 않아야 한다. */}
      <div id={panelId} hidden={!open} className="pb-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{inquiry.content}</p>
        {inquiry.answer ? (
          <>
            <div className="mt-2 rounded-xl bg-brand-50 px-3 py-2.5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {inquiry.answer.content}
              </p>
            </div>
            <p className="text-[11px] text-neutral-400">
              {answeredAt ? `${answeredAt} 답변` : '답변'}
              {isVisible ? ' · 공개' : ' · 비공개 · 나만 볼 수 있어요'}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">아직 답변을 기다리는 중이에요</p>
        )}
        <button
          type="button"
          onClick={() =>
            router.push(
              // 공개 Q/A 에 실제로 올라간 건만 병원 상세의 문의 섹션으로 바로 보낸다.
              isVisible
                ? `/hospital/${inquiry.hospitalId}?section=inquiry`
                : `/hospital/${inquiry.hospitalId}`
            )
          }
          className="mt-3 block text-[13px] font-semibold text-brand-700"
        >
          병원 상세 보기 ›
        </button>
      </div>
    </>
  );
});
