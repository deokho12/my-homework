import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/Badge';
import type { HospitalInquiry, HospitalInquiryAnswerInput } from '@/features/inquiry/api/inquiryApi';
import { ANSWER_TEMPLATES, MEDICAL_AD_WARNING } from '@/features/inquiry/content/answerTemplates';
import { formatInquiryAt, inquiryTitle } from '@/features/inquiry/inquiryDisplay';
import { isPubliclyVisible } from '@/features/inquiry/inquiryVisibility';
import {
  inquiryAnswerSchema,
  remainingPlaceholder,
} from '@/features/inquiry/schemas/inquiryAnswerSchema';
import { inquiryTopicLabel } from '@/types/domain';
import { showAlert } from '@/utils/alert';

interface AdminInquiryDetailProps {
  inquiry: HospitalInquiry;
  /** `operator` 는 조회만 된다 — 답변은 그 병원이 하지 않은 말을 병원 이름으로 남기는 일이다. */
  canAnswer: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  submitting: boolean;
  onSubmit: (input: HospitalInquiryAnswerInput) => void;
  /** 방금 이 화면에서 등록했는지. 등록 직후에만 `role="status"` 한 줄을 띄운다. */
  justAnswered: boolean;
}

/**
 * 관리자 문의 상세 + 답변 작성.
 *
 * 공개 여부 표기는 **공개 판정 함수 하나**(`isPubliclyVisible`)로 가른다 — 병원 상세의
 * 공개 Q/A 에 실제로 올라가는 조건과 같은 말이어야 한다.
 *
 * 선택이 바뀌면 이 컴포넌트는 `key` 로 다시 마운트된다 (`AdminInquiriesPage`) — 공개
 * 체크박스 기본값이 새 문의 기준으로 다시 잡힌다.
 */
export function AdminInquiryDetail({
  inquiry,
  canAnswer,
  draft,
  onDraftChange,
  submitting,
  onSubmit,
  justAnswered,
}: AdminInquiryDetailProps) {
  // 환자가 공개를 원한 문의면 켜 둔다. 환자가 비공개면 체크박스 자체가 없다.
  const [answerPublic, setAnswerPublic] = useState(inquiry.isPublic);
  const answerHeadingRef = useRef<HTMLHeadingElement>(null);

  // 답변 블록 제목은 다시 불러온 상세가 도착해야 생긴다. 로컬 구현은 같은 렌더에 오지만 서버로 바뀌면
  // 한 박자 늦으므로 `inquiry.answer` 도 의존성에 둔다 — 그래야 늦게 도착해도 포커스가 옮겨진다.
  useEffect(() => {
    if (justAnswered) answerHeadingRef.current?.focus();
  }, [justAnswered, inquiry.answer]);

  const placeholder = remainingPlaceholder(draft);
  const canSubmit = !submitting && inquiryAnswerSchema.safeParse({ content: draft, isPublic: answerPublic }).success;

  const applyTemplate = (content: string) => {
    if (draft.trim().length === 0) {
      onDraftChange(content);
      return;
    }

    showAlert('작성 중인 답변이 있어요', '지금 쓴 내용을 템플릿으로 바꿀까요?', [
      { text: '취소', style: 'cancel' },
      { text: '바꾸기', onPress: () => onDraftChange(content) },
    ]);
  };

  const submit = () => {
    if (!canSubmit) return;

    const send = () => onSubmit({ content: draft.trim(), isPublic: answerPublic });

    // 대괄호는 **차단이 아니라 확인**이다 — `[본원 2층]` 처럼 정상인 문장도 있다.
    if (placeholder) {
      showAlert('대괄호가 그대로예요', `${placeholder} 부분이 남아 있어요. 이대로 등록할까요?`, [
        { text: '취소', style: 'cancel' },
        { text: '등록', onPress: send },
      ]);
      return;
    }

    send();
  };

  return (
    <>
      {justAnswered ? (
        <div role="status" className="mb-4 flex flex-row items-center gap-2 rounded-xl bg-brand-50 px-4 py-3">
          <Check size={18} className="text-brand-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-brand-700">
            답변을 등록했어요. 환자에게 알림이 갔어요.
          </span>
        </div>
      ) : null}

      <p className="text-[13px] text-neutral-500">
        {inquiry.askerName} · {inquiryTopicLabel(inquiry.topic)} · {formatInquiryAt(inquiry.createdAt)}
      </p>
      <h2 id="inq-detail-h" tabIndex={-1} className="mt-2 text-xl font-bold leading-snug text-neutral-900">
        {inquiryTitle(inquiry.content)}
      </h2>
      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-neutral-700">
        {inquiry.content}
      </p>
      {!inquiry.isPublic ? (
        <div className="mt-3 flex flex-row">
          <Badge label="환자가 비공개로 요청함" />
        </div>
      ) : null}

      {inquiry.answer ? (
        <div className="mt-5 rounded-xl bg-brand-50 p-4">
          <h3
            ref={answerHeadingRef}
            tabIndex={-1}
            className="text-[13px] font-semibold text-brand-700 outline-none"
          >
            {inquiry.hospitalName ?? '병원'} 답변 ·{' '}
            {isPubliclyVisible({ isPublic: inquiry.isPublic, answer: inquiry.answer }) ? '공개' : '비공개'}
          </h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-neutral-700">
            {inquiry.answer.content}
          </p>
          <p className="mt-2 text-[11px] text-neutral-400">{formatInquiryAt(inquiry.answer.answeredAt)}</p>
        </div>
      ) : canAnswer ? (
        <form
          className="mt-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p className="mb-2 text-sm font-semibold text-neutral-700">자주 쓰는 답변</p>
          <div className="mb-2 flex flex-row flex-wrap">
            {ANSWER_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.content)}
                className="mb-2 mr-2 min-h-[36px] rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[13px] text-neutral-600"
              >
                {template.label}
              </button>
            ))}
          </div>

          <label htmlFor="inq-answer" className="mb-2 block text-sm font-semibold text-neutral-700">
            답변
          </label>
          <textarea
            id="inq-answer"
            rows={6}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="환자에게 보일 답변을 적어 주세요"
            aria-describedby="inq-answer-hint inq-ad-warning"
            className="min-h-[150px] w-full resize-y rounded-xl border border-neutral-200 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-brand-600"
          />
          {placeholder ? (
            <p id="inq-answer-hint" className="mt-1.5 text-[13px] text-amber-700">
              {placeholder} 처럼 대괄호로 남은 부분을 실제 정보로 바꿔주세요
            </p>
          ) : null}

          <p
            id="inq-ad-warning"
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800"
          >
            {MEDICAL_AD_WARNING}
          </p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {inquiry.isPublic ? (
              <div className="flex flex-row items-center gap-2">
                <input
                  id="inq-public"
                  type="checkbox"
                  checked={answerPublic}
                  onChange={(event) => setAnswerPublic(event.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                <label htmlFor="inq-public" className="text-sm text-neutral-700">
                  다른 환자에게도 공개 (병원 상세 문의)
                </label>
              </div>
            ) : (
              // 환자가 비공개로 물었으면 병원의 선택이 결과를 바꾸지 못한다 (노출은 AND 다).
              <p className="text-[13px] text-neutral-500">
                환자가 비공개로 남긴 문의예요. 답변도 환자에게만 보여요.
              </p>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-[48px] rounded-xl bg-brand-600 px-6 text-[15px] font-bold text-white active:bg-brand-700 disabled:opacity-40"
            >
              {submitting ? '등록 중' : '답변 등록'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-5 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          답변은 병원 담당자만 할 수 있어요
        </p>
      )}
    </>
  );
}
