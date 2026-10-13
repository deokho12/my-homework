import { Badge } from '@/components/Badge';
import type { HospitalInquiry } from '@/features/inquiry/api/inquiryApi';
import { INQUIRY_STATUS_TONE, formatInquiryAt, inquiryTitle } from '@/features/inquiry/inquiryDisplay';
import { Text, View, cx } from '@/primitives';
import { ADMIN_INQUIRY_STATUS_LABEL, inquiryTopicLabel } from '@/types/domain';

interface AdminInquiryListProps {
  items: HospitalInquiry[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

/**
 * 관리자 문의 화면의 왼쪽 목록. 접수 최신순은 api 가 이미 맞춰 준다 — 화면에서 다시 정렬하지
 * 않는다.
 *
 * 이름은 **api 가 마스킹해서 준다** (`김*준`). 여기서 가리지 않는다 — 원본이 화면까지 오는
 * 경로를 만들지 않기 위해서다.
 */
export function AdminInquiryList({ items, selectedId, onSelect }: AdminInquiryListProps) {
  return (
    <ul>
      {items.map((inquiry) => {
        const selected = inquiry.id === selectedId;

        return (
          <li key={inquiry.id}>
            {/*
              `Pressable` 이 아니라 `<button>` 인 이유: primitive 는 받은 `aria-current` 를
              그대로 버린다(`PressableProps` 에 그 자리가 없다). 지금 고른 카드가 보조기기에
              전달되지 않으면 색만으로 선택을 말하게 된다 — 상담 예약 목록도 같은 이유로
              `<button>` 이다. `rnw-view` 의 기본값(세로 flex)은 클래스로 되살린다.
            */}
            <button
              type="button"
              onClick={() => onSelect(inquiry.id)}
              aria-current={selected ? 'true' : undefined}
              className={cx(
                'mb-3 flex w-full flex-col gap-2 rounded-2xl border bg-white p-4 text-left',
                selected ? 'border-brand-600 ring-2 ring-brand-600' : 'border-neutral-100'
              )}
            >
              <View className="flex-row items-center justify-between gap-2">
                <Badge
                  label={ADMIN_INQUIRY_STATUS_LABEL[inquiry.status]}
                  tone={INQUIRY_STATUS_TONE[inquiry.status]}
                />
                {/* 상대 표기(`3시간 전`)가 아니라 절대 시각이다 — 언제 들어왔는지로 답변 순서를 정한다. */}
                <Text className="text-xs text-neutral-400">{formatInquiryAt(inquiry.createdAt)}</Text>
              </View>
              <Text className="text-[15px] font-bold leading-snug text-neutral-900" numberOfLines={2}>
                {inquiryTitle(inquiry.content)}
              </Text>
              <Text className="text-[13px] text-neutral-500">
                {inquiry.askerName} · {inquiryTopicLabel(inquiry.topic)}
              </Text>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
