import { router, Stack } from '@/navigation';
import { useState } from 'react';
import { FlatList, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { Chip } from '@/components/Chip';
import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useConsultRequests, useUpdateConsultStatus } from '@/features/consult';
import { useHospital } from '@/features/hospital';
import { useProcedureMap, useProcedures } from '@/features/procedure';
import { CONSULT_STATUS_LABEL, CONSULT_STATUSES, type ConsultRequest, type ConsultStatus } from '@/types/domain';

type FilterKey = 'all' | ConsultStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  ...CONSULT_STATUSES.map((status) => ({ key: status, label: CONSULT_STATUS_LABEL[status] })),
];

/**
 * 이 화면에는 페이지네이션 UI 가 없다. 계약이 허용하는 상한(`pageSize` 최대 100)까지
 * 한 번에 받아 예전처럼 전부 그린다. 페이지 이동 UI 가 생기면 이 상수는 사라진다.
 */
const LIST_PAGE_SIZE = 100;

/** 빈 목록 문구. 아래 두 곳(QueryState 설정과 FlatList 의 빈 상태)이 같은 값을 쓰게 한 곳에 둔다. */
function emptyMessage(filter: FilterKey): string {
  return filter === 'all' ? '접수된 상담 신청이 없어요' : '해당 상태의 상담 신청이 없어요';
}

// Small inline status buttons for changing status directly from the list card. Deliberately not
// the shared <Chip> here — it doesn't forward the press event, and we need stopPropagation so
// tapping a status doesn't also trigger the card's navigate-to-detail press.
function QuickStatusButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: (event: { stopPropagation: () => void }) => void;
}) {
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress(event);
      }}
      className={`mb-1 mr-1 rounded-full border px-2.5 py-1 ${
        selected ? 'border-brand-600 bg-brand-600' : 'border-neutral-200 bg-white'
      }`}
    >
      <Text className={`text-xs font-medium ${selected ? 'text-white' : 'text-neutral-500'}`}>{label}</Text>
    </Pressable>
  );
}

function ConsultCard({ request }: { request: ConsultRequest }) {
  const updateStatus = useUpdateConsultStatus();
  const procedureMap = useProcedureMap();
  const { isPending: proceduresPending } = useProcedures();
  const { data: hospital, isLoading: isHospitalLoading } = useHospital(request.hospitalId);
  const procedure = request.procedureId ? procedureMap.get(request.procedureId) : undefined;
  // "시술 미지정" 은 `request.procedureId` 가 정말 `null` 일 때만 맞는 말이다. id 는
  // 있는데 맵에 아직 없는 것은 시술 목록이 로딩 중이라는 뜻일 수 있어, "지정 안 됨" 이라고
  // 잘못 단정하지 않고 중립 표시(—)를 쓴다.
  const procedureLabel = procedure ? procedure.name : request.procedureId && proceduresPending ? '—' : '시술 미지정';
  // 병원 이름도 같은 규칙이다 — 조회가 끝나기 전의 "없음"은 "아직 모름"이지 "알 수 없는 병원"이 아니다.
  const hospitalLabel = isHospitalLoading ? '—' : (hospital?.name ?? '알 수 없는 병원');

  return (
    <Pressable
      onPress={() => router.push(`/admin/consultations/${request.id}`)}
      className="mb-3 rounded-2xl border border-neutral-100 bg-white p-4"
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-bold text-neutral-900">{request.name}</Text>
          <Text className="mt-0.5 text-xs text-neutral-500">
            {hospitalLabel} · {procedureLabel}
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
      <Text className="mb-3 text-xs text-neutral-400">연락처 {request.phone}</Text>

      <View className="flex-row flex-wrap">
        {CONSULT_STATUSES.map((status) => (
          <QuickStatusButton
            key={status}
            label={CONSULT_STATUS_LABEL[status]}
            selected={request.status === status}
            // 같은 상태를 다시 눌러도 서버가 no-op 으로 처리한다(이력·알림이 늘지 않는다).
            // 그래서 화면에서 따로 막지 않는다 — 같은 판정을 두 곳에 두지 않기 위해서다.
            onPress={() => updateStatus.mutate({ id: request.id, status })}
          />
        ))}
      </View>
    </Pressable>
  );
}

export default function AdminConsultationsScreen() {
  const [filter, setFilter] = useState<FilterKey>('all');
  // 상태 칩은 서버 필터다 — 전체를 받아 화면에서 거르면 페이지네이션과 어긋난다.
  const { data, isLoading, isError, isFetching, refetch } = useConsultRequests({
    pageSize: LIST_PAGE_SIZE,
    status: filter === 'all' ? undefined : filter,
  });

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
        // 0건은 아래 FlatList 의 기존 빈 상태(📭)가 그대로 맡는다. 여기서 가로채면
        // 이 화면이 원래 쓰던 모양과 문구가 공용 EmptyState 로 바뀌어 버린다.
        isEmpty={() => false}
        emptyState={{ title: emptyMessage(filter) }}
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
                <Text className="text-center text-sm text-neutral-500">{emptyMessage(filter)}</Text>
              </View>
            }
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}
