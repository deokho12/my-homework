import { router, Stack } from '@/navigation';
import { FlatList, Image, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useMyConsultRequests } from '@/features/consult';
import { CONSULT_STATUS_LABEL, type MyConsultRequest } from '@/types/domain';

/**
 * 내 상담 내역.
 *
 * 마이페이지와 로그인 화면이 "상담 신청 내역을 확인할 수 있어요" 라고 안내해 왔는데
 * **그 화면이 없었다** (`docs/features/known-issues.md` 🟠). `GET /me/consult-requests` 가
 * 생기면서 비로소 만들 수 있게 됐다.
 *
 * 새 시각 언어를 만들지 않고 관리자 상담 카드와 같은 형태를 쓴다 — 같은 데이터를 보는
 * 두 화면이 서로 다른 모양이면 배우는 것이 두 배가 된다.
 */
function ConsultHistoryCard({ request }: { request: MyConsultRequest }) {
  return (
    <Pressable
      onPress={() => router.push(`/me/consult-requests/${request.id}`)}
      className="mb-3 flex-row gap-3 rounded-2xl border border-neutral-100 bg-white p-4"
    >
      {request.hospitalThumbnail ? (
        <Image
          source={{ uri: request.hospitalThumbnail }}
          className="h-16 w-16 rounded-xl bg-neutral-100"
          resizeMode="cover"
        />
      ) : null}

      <View className="flex-1">
        <View className="mb-1 flex-row items-start justify-between">
          <Text className="flex-1 pr-2 text-base font-bold text-neutral-900" numberOfLines={1}>
            {request.hospitalName}
          </Text>
          <Badge
            label={CONSULT_STATUS_LABEL[request.status]}
            tone={request.status === 'booked' ? 'brand' : 'neutral'}
          />
        </View>

        <Text className="mb-1 text-xs text-neutral-500">
          {request.procedureName ?? '시술 미지정'}
          {request.doctorName === null ? '' : ` · ${request.doctorName}`}
        </Text>
        <Text className="text-[11px] text-neutral-400">
          신청일시 {new Date(request.createdAt).toLocaleString('ko-KR')}
        </Text>
      </View>
    </Pressable>
  );
}

export default function MyConsultRequestsScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useMyConsultRequests({ pageSize: 50 });

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 신청 내역' }} />
      <View className={cx(CONTAINER_PADDING, 'pb-2 pt-4')}>
        <Text className="mb-1 text-lg font-bold text-neutral-900">상담 신청 내역</Text>
        <Text className="text-sm text-neutral-500">신청한 상담의 진행 상태를 확인할 수 있어요</Text>
      </View>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        emptyState={{ title: '아직 신청한 상담이 없어요' }}
        className="flex-1"
      >
        {(page) => (
          <FlatList
            data={page.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName={cx(CONTAINER_PADDING, 'py-2 pb-8')}
            renderItem={({ item }) => <ConsultHistoryCard request={item} />}
            ListEmptyComponent={
              <View className="items-center px-8 py-16">
                <Text className="mb-2 text-4xl">📋</Text>
                <Text className="text-center text-sm text-neutral-500">
                  아직 신청한 상담이 없어요{'\n'}병원 상세에서 상담을 신청해보세요
                </Text>
              </View>
            }
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}
