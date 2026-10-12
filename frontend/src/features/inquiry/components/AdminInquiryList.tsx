import { Badge } from '@/components/Badge';
import type { HospitalInquiry } from '@/features/inquiry/api/inquiryApi';
import { INQUIRY_STATUS_TONE, formatInquiryAt, inquiryTitle } from '@/features/inquiry/inquiryDisplay';
import { Pressable, Text, View, cx } from '@/primitives';
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
            <Pressable
              onPress={() => onSelect(inquiry.id)}
              aria-current={selected ? 'true' : undefined}
              className={cx(
                'mb-3 gap-2 rounded-2xl border bg-white p-4',
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
            </Pressable>
          </li>
        );
      })}
    </ul>
  );
}
