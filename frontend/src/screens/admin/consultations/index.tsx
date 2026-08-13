import { router, Stack } from '@/navigation';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { Chip } from '@/components/Chip';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useProcedureMap, useProcedures } from '@/features/procedure';
import { useConsultStore } from '@/store/useConsultStore';
import { getHospitalById } from '@/store/useHospitalStore';
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
  const updateStatus = useConsultStore((state) => state.updateStatus);
  const procedureMap = useProcedureMap();
  const { isPending: proceduresPending } = useProcedures();
  const hospital = getHospitalById(request.hospitalId);
  const procedure = request.procedureId ? procedureMap.get(request.procedureId) : undefined;
  // "시술 미지정" 은 `request.procedureId` 가 정말 `null` 일 때만 맞는 말이다. id 는
  // 있는데 맵에 아직 없는 것은 시술 목록이 로딩 중이라는 뜻일 수 있어, "지정 안 됨" 이라고
  // 잘못 단정하지 않고 중립 표시(—)를 쓴다.
  const procedureLabel = procedure ? procedure.name : request.procedureId && proceduresPending ? '—' : '시술 미지정';

  return (
    <Pressable
      onPress={() => router.push(`/admin/consultations/${request.id}`)}
      className="mb-3 rounded-2xl border border-neutral-100 bg-white p-4"
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-bold text-neutral-900">{request.name}</Text>
          <Text className="mt-0.5 text-xs text-neutral-500">
            {hospital?.name ?? '알 수 없는 병원'} · {procedureLabel}
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
            onPress={() => updateStatus(request.id, status)}
          />
        ))}
      </View>
    </Pressable>
  );
}

export default function AdminConsultationsScreen() {
  const requests = useConsultStore((state) => state.requests);
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    const sorted = [...requests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (filter === 'all') return sorted;
    return sorted.filter((request) => request.status === filter);
  }, [requests, filter]);

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

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName={cx(CONTAINER_PADDING, 'py-2')}
        renderItem={({ item }) => <ConsultCard request={item} />}
        ListEmptyComponent={
          <View className="items-center px-8 py-16">
            <Text className="mb-2 text-4xl">📭</Text>
            <Text className="text-center text-sm text-neutral-500">
              {filter === 'all' ? '접수된 상담 신청이 없어요' : '해당 상태의 상담 신청이 없어요'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
