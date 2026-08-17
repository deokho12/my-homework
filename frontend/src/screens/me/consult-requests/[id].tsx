import { router, Stack, useLocalSearchParams } from '@/navigation';
import { Pressable, ScrollView, Text, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { QueryState } from '@/components/QueryState';
import { containerClass } from '@/components/layout/Container';
import { useMyConsultRequest } from '@/features/consult';
import { CONSULT_STATUS_LABEL, type MyConsultRequest } from '@/types/domain';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row">
      <Text className="w-20 text-sm text-neutral-400">{label}</Text>
      <Text className="flex-1 text-sm font-semibold text-neutral-800">{value}</Text>
    </View>
  );
}

/**
 * 내 상담 하나.
 *
 * **관리자 상세와 다른 화면이다** — 내부 공유용 메모와 처리자 이름이 없다. 서버가
 * 신청자 시야로 따로 투영해 보내므로 화면이 걸러낼 것이 없다.
 */
function ConsultHistoryDetail({ request }: { request: MyConsultRequest }) {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 상세' }} />
      <ScrollView contentContainerClassName={containerClass('form', 'pb-10 pt-4')}>
        <View className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4">
          <View className="mb-3 flex-row items-start justify-between">
            <Pressable className="flex-1 pr-2" onPress={() => router.push(`/hospital/${request.hospitalId}`)}>
              <Text className="text-base font-bold text-neutral-900">{request.hospitalName}</Text>
              <Text className="mt-0.5 text-xs text-brand-700">병원 정보 보기 ›</Text>
            </Pressable>
            <Badge
              label={CONSULT_STATUS_LABEL[request.status]}
              tone={request.status === 'booked' ? 'brand' : 'neutral'}
            />
          </View>

          {request.doctorName === null ? null : <InfoRow label="지목 전문의" value={request.doctorName} />}
          <InfoRow label="희망 시술" value={request.procedureName ?? '미지정'} />
          <InfoRow label="희망 시간" value={request.preferredTime || '미지정'} />
          <InfoRow label="신청자" value={request.name} />
          <InfoRow label="연락처" value={request.phone} />
          <InfoRow label="신청일시" value={new Date(request.createdAt).toLocaleString('ko-KR')} />
        </View>

        <View className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-2 text-sm font-semibold text-neutral-700">남긴 메시지</Text>
          <Text className="text-sm leading-5 text-neutral-600">
            {request.message.trim().length > 0 ? request.message : '남긴 메시지가 없어요'}
          </Text>
        </View>

        <View className="rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-neutral-700">진행 상태</Text>
          {request.statusHistory.length === 0 ? (
            <Text className="text-sm text-neutral-400">아직 진행 이력이 없어요</Text>
          ) : (
            // 저장은 시간순, 표시는 최신순.
            [...request.statusHistory]
              .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
              .map((change, index) => (
                <View
                  key={`${change.status}-${change.changedAt}-${index}`}
                  className="mb-2 flex-row items-center justify-between"
                >
                  <Text className="text-sm font-medium text-neutral-800">
                    {CONSULT_STATUS_LABEL[change.status]}
                  </Text>
                  <Text className="text-xs text-neutral-400">
                    {new Date(change.changedAt).toLocaleString('ko-KR')}
                  </Text>
                </View>
              ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function MyConsultRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, isFetching, refetch } = useMyConsultRequest(id);

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      data={data}
      onRetry={() => {
        void refetch();
      }}
      isRetrying={isError && isFetching}
      // 남의 상담과 없는 상담이 서버에서 같은 404 다 — 상담 id 가 고객 개인정보와 1:1 이라
      // 둘을 구분하면 id 대입으로 건수가 새어 나간다.
      emptyState={{ title: '상담 정보를 찾을 수 없어요' }}
      className="flex-1 bg-white"
    >
      {(request) => <ConsultHistoryDetail request={request} />}
    </QueryState>
  );
}
