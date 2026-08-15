import { Stack } from '@/navigation';
import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { QueryState } from '@/components/QueryState';
import { StockImage } from '@/components/StockImage';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useDecideVerification, useVerificationQueue } from '@/features/doctor';
import { isApiError } from '@/lib/apiClient';
import type { VerificationQueueItem, VerificationStatus } from '@/types/domain';
import { showAlert } from '@/utils/alert';

const STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
};

function SpecialistRow({ doctor }: { doctor: VerificationQueueItem }) {
  const decideVerification = useDecideVerification();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const isPending = decideVerification.isPending;

  const decide = (input: { status: 'approved' } | { status: 'rejected'; rejectionReason: string }) => {
    decideVerification.mutate(
      { id: doctor.id, decision: input },
      {
        onError: (error) => {
          showAlert(
            '검수 결과를 저장하지 못했어요',
            isApiError(error) ? error.message : '잠시 후 다시 시도해주세요'
          );
        },
      }
    );
  };

  return (
    <View className="mb-3 rounded-2xl border border-neutral-100 bg-white p-4">
      <View className="mb-3 flex-row items-center gap-3">
        {doctor.certificateUrl ? (
          <StockImage
            uri={doctor.certificateUrl}
            alt={`${doctor.name} 자격증 이미지`}
            style={{ width: 64, height: 84 }}
            borderRadius={8}
            contentFit="cover"
          />
        ) : (
          <View className="h-[84px] w-16 items-center justify-center rounded-lg bg-neutral-100">
            <Text className="text-center text-[11px] text-neutral-400">미제출</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-bold text-neutral-900">
            {doctor.name} · {doctor.title}
          </Text>
          <Text className="text-xs text-neutral-500">{doctor.specialty}</Text>
          <Text className="text-xs text-neutral-400">{doctor.hospitalName}</Text>
        </View>
        <Badge label={STATUS_LABEL[doctor.verificationStatus]} tone={doctor.verificationStatus === 'approved' ? 'brand' : 'neutral'} />
      </View>

      {doctor.verificationStatus === 'rejected' && doctor.rejectionReason ? (
        <Text className="mb-3 text-xs text-rose-500">반려 사유: {doctor.rejectionReason}</Text>
      ) : null}

      {rejecting ? (
        <View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="반려 사유를 입력해주세요"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="mb-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            style={{ minHeight: 64 }}
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setRejecting(false);
                setReason('');
              }}
              className="flex-1 items-center rounded-xl border border-neutral-200 py-2.5"
            >
              <Text className="text-sm font-semibold text-neutral-600">취소</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                // 반려 사유는 서버도 1자 이상을 요구한다 — 빈 값으로 보내지 않는다.
                decide({ status: 'rejected', rejectionReason: reason.trim() });
                setRejecting(false);
                setReason('');
              }}
              disabled={reason.trim().length === 0 || isPending}
              className={`flex-1 items-center rounded-xl py-2.5 ${
                reason.trim().length === 0 || isPending ? 'bg-neutral-200' : 'bg-rose-500'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  reason.trim().length === 0 || isPending ? 'text-neutral-400' : 'text-white'
                }`}
              >
                반려 확정
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => decide({ status: 'approved' })}
            disabled={isPending}
            className="flex-1 items-center rounded-xl bg-brand-600 py-2.5 active:bg-brand-700"
          >
            <Text className="text-sm font-semibold text-white">승인</Text>
          </Pressable>
          <Pressable
            onPress={() => setRejecting(true)}
            disabled={isPending}
            className="flex-1 items-center rounded-xl border border-neutral-200 py-2.5"
          >
            <Text className="text-sm font-semibold text-neutral-600">반려</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function AdminSpecialistsPage() {
  const { data, error, isLoading, isError, isFetching, refetch } = useVerificationQueue();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '전문의 인증 검수' }} />
      <View className={cx(CONTAINER_PADDING, 'pb-2 pt-4')}>
        <Text className="text-lg font-bold text-neutral-900">전문의 인증 검수</Text>
        <Text className="mt-1 text-sm text-neutral-500">
          업로드된 자격증을 확인하고 승인 또는 반려해주세요
        </Text>
      </View>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        data={data}
        errorState={{
          description: isApiError(error) ? error.message : undefined,
        }}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        isEmpty={(value) => value.items.length === 0}
        emptyState={{ title: '검수할 전문의가 없어요' }}
      >
        {(value) => (
          <FlatList
            data={value.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName={cx(CONTAINER_PADDING, 'py-4')}
            renderItem={({ item }) => <SpecialistRow doctor={item} />}
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}
