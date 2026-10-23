import { useState } from 'react';

import { QueryState } from '@/components/QueryState';
import { formatAppliedAt } from '@/features/consult';
import { usePublicHospitalInquiries } from '@/features/inquiry/hooks/usePublicHospitalInquiries';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { router } from '@/navigation';
import { Pressable, Text, View } from '@/primitives';

/** 처음 보여주는 Q/A 개수. 더 있으면 `문의 더보기 (n)` 로 받아온 목록을 펼치기만 한다. */
const PREVIEW_COUNT = 3;

/**
 * 병원 상세의 `문의` 섹션 — **공개 Q/A 만** 보여준다.
 *
 * 노출 판정은 api 레이어가 순수 함수 하나로 한다 (`isPubliclyVisible`): 환자가 공개로
 * 남겼고 + 병원이 공개를 허용했고 + 답변완료. 그래서 이 컴포넌트에는 공개 여부를 따지는
 * 분기가 **하나도 없다** — 목록에 있는 것이 곧 공개된 것이다.
 *
 * **작성자 이름을 그리지 않는다.** 응답에 자리 자체가 없다 (`docs/api/README.md` §4).
 */
export function HospitalInquirySection({ hospitalId }: { hospitalId: string }) {
  const query = usePublicHospitalInquiries(hospitalId);
  const requireAuth = useRequireAuth();
  const [expanded, setExpanded] = useState(false);

  // 아직 모르는 동안(로딩·실패)에는 숫자를 그리지 않는다 — 0 은 "없다" 는 사실 주장이다.
  const counts = query.data ? `${query.data.publicInquiryCount}건 · 답변 ${query.data.meta.totalItems}` : null;
  const items = query.data?.items ?? [];
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const remaining = items.length - visible.length;

  return (
    <>
      <div className="mb-3 flex flex-row items-center justify-between gap-2">
        <h2 id="hospital-inquiry-h" tabIndex={-1} className="text-lg font-extrabold text-neutral-900 outline-none">
          {/* 숫자 앞 공백은 **span 바깥**에 둔다 — 안에 두면 접근성 이름이 `문의0건…` 으로 붙는다. */}
          문의{counts ? ' ' : ''}
          {counts ? <span className="text-[13px] font-medium text-neutral-500">{counts}</span> : null}
        </h2>
        <Pressable
          onPress={() =>
            requireAuth(() => router.push(`/inquiry/${hospitalId}`), `/inquiry/${hospitalId}`)
          }
          className="rounded-lg border border-brand-600 px-3 py-2"
        >
          <Text className="text-[13px] font-bold text-brand-700">문의하기</Text>
        </Pressable>
      </div>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        data={query.data?.items}
        onRetry={() => {
          void query.refetch();
        }}
        isRetrying={query.isError && query.isFetching}
        emptyState={{
          title: '아직 공개된 문의가 없어요',
          description: '궁금한 점을 먼저 물어보세요',
          variant: 'inline',
        }}
        errorState={{ variant: 'inline' }}
        className="mb-4"
      >
        {() => (
          <View className="mb-4">
            {visible.map((inquiry) => (
              <View key={inquiry.id} className="mb-4">
                <Text className="mb-1.5 text-sm leading-relaxed text-neutral-900">
                  <Text className="font-bold text-brand-700">Q </Text>
                  {inquiry.content}
                </Text>
                <View className="rounded-xl bg-brand-50 px-3 py-2.5">
                  <Text className="text-sm leading-relaxed text-neutral-700">
                    <Text className="font-bold text-brand-700">A </Text>
                    {inquiry.answer.content}
                  </Text>
                </View>
                {formatAppliedAt(inquiry.answer.answeredAt) ? (
                  <Text className="mt-1 text-right text-[11px] text-neutral-500">
                    {formatAppliedAt(inquiry.answer.answeredAt)} 답변
                  </Text>
                ) : null}
              </View>
            ))}
            {remaining > 0 ? (
              <Pressable onPress={() => setExpanded(true)}>
                <Text className="text-sm font-semibold text-brand-700">문의 더보기 ({remaining})</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </QueryState>
    </>
  );
}
