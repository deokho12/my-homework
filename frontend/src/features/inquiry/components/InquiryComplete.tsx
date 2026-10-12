import { MessageCircleQuestion } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { PrimaryButton } from '@/components/PrimaryButton';

export interface CompletedInquiry {
  hospitalName: string;
  /** 제출 시점의 칩 라벨 (`가격`). 코드가 아니라 사람이 읽는 말이다. */
  topicLabel: string;
  /** 환자가 고른 공개 여부. 공개는 **요청**일 뿐이라 문구도 `공개 요청함` 이다. */
  isPublic: boolean;
}

interface InquiryCompleteProps {
  inquiry: CompletedInquiry;
  onViewMyInquiries: () => void;
}

/**
 * 접수 완료. **폼과 같은 URL 에서 폼을 대신한다** — 새 주소를 만들면 뒤로 가기가
 * "방금 보낸 폼" 으로 돌아와 같은 문의를 또 보낼 수 있게 된다 (상담 완료 화면과 같은 판단).
 */
export function InquiryComplete({ inquiry, onViewMyInquiries }: InquiryCompleteProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 폼이 사라지고 내용이 통째로 바뀌었는데 포커스가 제출 버튼 자리에 남아 있으면
  // 스크린 리더 사용자는 접수됐다는 사실을 듣지 못한다.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const rows = [
    { term: '병원', value: inquiry.hospitalName },
    { term: '주제', value: inquiry.topicLabel },
    // 공개로 남겨도 병원이 공개로 답해야 실제로 공개된다 — 그래서 `공개` 가 아니라 `공개 요청함`.
    { term: '공개 여부', value: inquiry.isPublic ? '공개 요청함' : '비공개' },
  ];

  return (
    <div className="pt-6">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        <MessageCircleQuestion size={32} className="text-brand-600" aria-hidden="true" />
      </div>
      <h2
        tabIndex={-1}
        ref={titleRef}
        className="mb-2 text-center text-xl font-extrabold text-neutral-900 outline-none"
      >
        문의를 남겼어요
      </h2>
      <p className="mb-1 text-center text-sm leading-relaxed text-neutral-500">
        병원이 답하면 알림으로 알려드릴게요.
      </p>
      <p className="mb-6 text-center text-sm text-neutral-500">마이페이지 › 내 문의에서도 볼 수 있어요.</p>

      <dl className="mb-8 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-2">
        {rows.map((row) => (
          <div
            key={row.term}
            className="flex items-start justify-between gap-4 border-b border-neutral-100 py-3 last:border-b-0"
          >
            <dt className="shrink-0 text-sm text-neutral-500">{row.term}</dt>
            <dd className="min-w-0 flex-1 text-right text-sm font-semibold text-neutral-900">{row.value}</dd>
          </div>
        ))}
      </dl>

      <PrimaryButton label="내 문의 보기" onPress={onViewMyInquiries} />
    </div>
  );
}
