import { router, Stack } from '@/navigation';
import { useState } from 'react';
import { FlatList, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { Chip } from '@/components/Chip';
import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useConsultRequests, useUpdateConsultStatus } from '@/features/consult';
import { CONSULT_STATUS_LABEL, CONSULT_STATUSES, type ConsultRequest, type ConsultStatus } from '@/types/domain';

type FilterKey = 'all' | ConsultStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  ...CONSULT_STATUSES.map((status) => ({ key: status, label: CONSULT_STATUS_LABEL[status] })),
];

// Small inline status buttons for changing status directly from the list card. Deliberately not
// the shared <Chip> here — it doesn't forward the press event, and we need stopPropagation so
// tapping a status doesn't also trigger the card's navigate-to-detail press.
function QuickStatusButton({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: (event: { stopPropagation: () => void }) => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={(event) => {
        event.stopPropagation();
        onPress(event);
      }}
      className={`mb-1 mr-1 rounded-full border px-2.5 py-1 ${
        selected ? 'border-brand-600 bg-brand-600' : 'border-neutral-200 bg-white'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`text-xs font-medium ${selected ? 'text-white' : 'text-neutral-500'}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * 상담 카드.
 *
 * 병원 이름·시술 이름을 **서버 응답에서 그대로 쓴다** — 예전에는 카드마다
 * `useHospital(request.hospitalId)` 를 불러 항목 수만큼 요청이 나갔다.
 *
 * 연락처는 운영자에게 마스킹된 값이 온다(`piiMasked`). 그 상태를 화면이 알려주지 않으면
 * `010-****-5678` 이 마스킹인지 잘못 저장된 값인지 구분할 수 없다.
 */
function ConsultCard({ request }: { request: ConsultRequest }) {
  const { mutate: updateStatus, isPending } = useUpdateConsultStatus();

  return (
    <Pressable
      onPress={() => router.push(`/admin/consultations/${request.id}`)}
      className="mb-3 rounded-2xl border border-neutral-100 bg-white p-4"
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-bold text-neutral-900">{request.name}</Text>
          <Text className="mt-0.5 text-xs text-neutral-500">
            {request.hospitalName} · {request.procedureName ?? '시술 미지정'}
          </Text>
        </View>
        <Badge
          label={CONSULT_STATUS_LABEL[request.status]}
          tone={request.status === 'booked' ? 'brand' : 'neutral'}
        />
      </View>

      <Text className="mb-0.5 text-xs text-neutral-400">
        신청일시 {new Date(request.createdAt).toLocaleString('ko-KR')}
      </Text>
      <Text className="mb-3 text-xs text-neutral-400">
        연락처 {request.phone}
        {request.piiMasked ? ' · 담당 병원에서만 전체 번호를 볼 수 있어요' : ''}
      </Text>

      <View className="flex-row flex-wrap">
        {CONSULT_STATUSES.map((status) => (
          <QuickStatusButton
            key={status}
            label={CONSULT_STATUS_LABEL[status]}
            selected={request.status === status}
            disabled={isPending}
            // 같은 상태를 다시 눌러도 서버가 아무 일도 하지 않는다(멱등) — 오탭이
            // 이력·알림을 쌓지 않는다.
            onPress={() => updateStatus({ id: request.id, status })}
          />
        ))}
      </View>
    </Pressable>
  );
}

export default function AdminConsultationsScreen() {
  const [filter, setFilter] = useState<FilterKey>('all');
  // 정렬(최신순)과 필터는 **서버가 한다.** 화면이 전체를 받아 정렬하면 페이지네이션과
  // 어긋난다 — 첫 페이지만 정렬한 목록이 된다.
  const { data, isLoading, isError, isFetching, refetch } = useConsultRequests(
    filter === 'all' ? { pageSize: 100 } : { status: filter, pageSize: 100 }
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 관리' }} />
      <View className={cx(CONTAINER_PADDING, 'pb-2 pt-4')}>
        <Text className="mb-1 text-lg font-bold text-neutral-900">상담 관리</Text>
        <Text className="mb-4 text-sm text-neutral-500">접수된 상담 신청을 확인하고 상태를 관리해요</Text>
        <View className="flex-row flex-wrap">
          {FILTERS.map((item) => (
            <Chip key={item.key} label={item.label} selected={filter === item.key} onPress={() => setFilter(item.key)} />
          ))}
        </View>
      </View>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        // 응답은 `{ items, meta, scope }` 객체라 절대 "비어" 있지 않다. 0건 안내는
        // 아래 FlatList 가 맡는다 — 담당 범위(`scope`)에 따라 문구가 달라야 하기 때문이다.
        emptyState={{ title: '접수된 상담 신청이 없어요' }}
        className="flex-1"
      >
        {(page) => (
          <FlatList
            data={page.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName={cx(CONTAINER_PADDING, 'py-2')}
            renderItem={({ item }) => <ConsultCard request={item} />}
            ListEmptyComponent={
              <View className="items-center px-8 py-16">
                <Text className="mb-2 text-4xl">📭</Text>
                <Text className="text-center text-sm text-neutral-500">
                  {filter !== 'all'
                    ? '해당 상태의 상담 신청이 없어요'
                    : page.scope === 'managed'
                      ? '담당 병원에 접수된 상담 신청이 없어요'
                      : '접수된 상담 신청이 없어요'}
                </Text>
              </View>
            }
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}
