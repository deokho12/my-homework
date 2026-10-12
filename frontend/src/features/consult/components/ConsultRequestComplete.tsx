import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Badge } from '@/components/Badge';
import { PrimaryButton } from '@/components/PrimaryButton';

export interface CompletedConsult {
  hospitalName: string;
  /** 제출 시점의 칩 라벨. 고르지 않았으면 `시술 미지정`. */
  procedureLabel: string;
  preferredTime: string;
  /** `CONSULT_STATUS_LABEL[created.status]` — 상태 문구를 여기서 다시 짓지 않는다. */
  statusLabel: string;
}

interface ConsultRequestCompleteProps {
  consult: CompletedConsult;
  onViewHistory: () => void;
}

/**
 * 접수 완료. **폼과 같은 URL 에서 폼을 대신한다** — 새 주소를 만들면 뒤로 가기가
 * "방금 보낸 폼" 으로 돌아와 다시 보낼 수 있게 된다.
 */
export function ConsultRequestComplete({ consult, onViewHistory }: ConsultRequestCompleteProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 폼이 사라지고 내용이 통째로 바뀌었는데 포커스가 제출 버튼 자리에 남아 있으면
  // 스크린 리더 사용자는 접수됐다는 사실을 듣지 못한다.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const rows = [
    { term: '병원', value: consult.hospitalName },
    { term: '시술', value: consult.procedureLabel },
    { term: '연락 시간', value: consult.preferredTime },
  ];

  return (
    <div className="pt-6">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        <Check size={32} className="text-brand-600" aria-hidden="true" />
      </div>
      <h2
        tabIndex={-1}
        ref={titleRef}
        className="mb-2 text-center text-xl font-extrabold text-neutral-900 outline-none"
      >
        상담 신청이 접수되었어요
      </h2>
      <p className="mb-1 text-center text-sm leading-relaxed text-neutral-500">
        {consult.hospitalName}에서 확인 후 {consult.preferredTime}에 연락드릴 예정이에요.
      </p>
      <p className="mb-6 text-center text-sm text-neutral-500">병원이 상태를 바꾸면 알림으로 알려드릴게요.</p>

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
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-3 last:border-b-0">
          <dt className="shrink-0 text-sm text-neutral-500">상태</dt>
          <dd className="flex min-w-0 flex-1 flex-row justify-end">
            <Badge tone="brand" label={consult.statusLabel} />
          </dd>
        </div>
      </dl>

      <PrimaryButton label="내 상담 내역 보기" onPress={onViewHistory} />
    </div>
  );
}
