import { Stack, useLocalSearchParams } from '@/navigation';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QueryState } from '@/components/QueryState';
import { containerClass } from '@/components/layout/Container';
import { useSession } from '@/features/auth/hooks/useSession';
import { useAddConsultMemo, useConsultRequest, useUpdateConsultStatus } from '@/features/consult';
import { CONSULT_STATUS_LABEL, CONSULT_STATUSES, type ConsultRequest } from '@/types/domain';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row">
      <Text className="w-20 text-sm text-neutral-400">{label}</Text>
      <Text className="flex-1 text-sm font-semibold text-neutral-800">{value}</Text>
    </View>
  );
}

/**
 * 조회가 끝난 상담을 받아 렌더한다 — `QueryState` 의 children 은 콜백이라 그 안에서
 * 훅을 부를 수 없어 별도 컴포넌트로 뺐다.
 *
 * 병원 이름·시술 이름은 **서버 응답에 이미 있다** — 예전에는 화면이 병원을 따로 조회했다.
 */
function ConsultDetail({ request }: { request: ConsultRequest }) {
  // **`isHospitalAdmin` 이 아니다** — 그 값은 관리자 화면 *진입* 자격이라 운영자도 포함한다.
  // 상담 처리(상태·메모)는 계약상 `hospital_admin` 전용이고, 운영자에게는 이름·연락처가
  // 마스킹되어 나가므로 고객에게 연락해 처리할 수 있는 주체가 아니다.
  const canProcess = useSession().hasRole(['hospital_admin']);
  const { mutate: updateStatus, isPending: statusPending } = useUpdateConsultStatus();
  const { mutate: addMemo, isPending: memoPending } = useAddConsultMemo();
  const [memoText, setMemoText] = useState('');

  // 저장은 시간순, 표시는 최신순 (계약이 그렇게 나눴다).
  const sortedHistory = [...request.statusHistory].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );
  const sortedMemos = [...request.memos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleAddMemo = () => {
    const trimmed = memoText.trim();

    if (!trimmed) return;

    addMemo({ id: request.id, content: trimmed }, { onSuccess: () => setMemoText('') });
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 상세' }} />
      <ScrollView contentContainerClassName={containerClass('form', 'pb-10 pt-4')} keyboardShouldPersistTaps="handled">
        <View className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-3 text-base font-bold text-neutral-900">{request.hospitalName}</Text>
          <InfoRow label="이름" value={request.name} />
          <InfoRow label="연락처" value={request.phone} />
          {request.piiMasked ? (
            // 값만 보고는 `010-****-5678` 이 마스킹인지 잘못 저장된 값인지 알 수 없다.
            <Text className="mb-3 text-xs text-neutral-400">
              이름·연락처는 담당 병원에서만 전체를 확인할 수 있어요
            </Text>
          ) : null}
          {request.doctorName === null ? null : <InfoRow label="지목 전문의" value={request.doctorName} />}
          <InfoRow label="희망 시술" value={request.procedureName ?? '미지정'} />
          <InfoRow label="희망 시간" value={request.preferredTime || '미지정'} />
          <InfoRow label="신청일시" value={new Date(request.createdAt).toLocaleString('ko-KR')} />
        </View>

        <View className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-2 text-sm font-semibold text-neutral-700">문의 메시지</Text>
          <Text className="text-sm leading-5 text-neutral-600">
            {request.message.trim().length > 0 ? request.message : '남긴 메시지가 없어요'}
          </Text>
        </View>

        <View className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-neutral-700">상태 변경</Text>
          {canProcess ? (
            <View className="mb-1 flex-row flex-wrap">
              {CONSULT_STATUSES.map((status) => (
                <Chip
                  key={status}
                  label={CONSULT_STATUS_LABEL[status]}
                  selected={request.status === status}
                  // 저장 중 연타해도 같은 상태면 서버가 멱등이라 이력·알림이 쌓이지 않는다.
                  onPress={() => {
                    if (!statusPending) updateStatus({ id: request.id, status });
                  }}
                />
              ))}
            </View>
          ) : (
            <Text className="text-sm text-neutral-400">
              현재 상태는 {CONSULT_STATUS_LABEL[request.status]} 이에요. 상태 변경은 담당 병원에서 할 수 있어요
            </Text>
          )}
        </View>

        <View className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-neutral-700">상태 변경 이력</Text>
          {sortedHistory.length === 0 ? (
            <Text className="text-sm text-neutral-400">아직 상태 변경 이력이 없어요</Text>
          ) : (
            sortedHistory.map((change, index) => (
              <View
                key={`${change.status}-${change.changedAt}-${index}`}
                className="mb-2 flex-row items-center justify-between"
              >
                <Text className="text-sm font-medium text-neutral-800">
                  {CONSULT_STATUS_LABEL[change.status]}
                  {change.changedByName ? ` · ${change.changedByName}` : ''}
                </Text>
                <Text className="text-xs text-neutral-400">{new Date(change.changedAt).toLocaleString('ko-KR')}</Text>
              </View>
            ))
          )}
        </View>

        <View className="rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-neutral-700">메모</Text>

          {sortedMemos.length === 0 ? (
            <Text className="mb-3 text-sm text-neutral-400">아직 작성된 메모가 없어요</Text>
          ) : (
            <View className="mb-3">
              {sortedMemos.map((memo) => (
                <View key={memo.id} className="mb-2 rounded-xl bg-neutral-50 p-3">
                  <Text className="text-sm text-neutral-800">{memo.content}</Text>
                  <Text className="mt-1 text-[11px] text-neutral-400">
                    {memo.authorName ? `${memo.authorName} · ` : ''}
                    {new Date(memo.createdAt).toLocaleString('ko-KR')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {canProcess ? (
            <>
              <TextInput
                value={memoText}
                onChangeText={setMemoText}
                placeholder="내부 공유용 메모를 남겨보세요"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="mb-3 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                style={{ minHeight: 72 }}
              />
              <PrimaryButton
                label={memoPending ? '추가 중…' : '메모 추가'}
                onPress={handleAddMemo}
                disabled={memoText.trim().length === 0 || memoPending}
              />
            </>
          ) : (
            <Text className="text-sm text-neutral-400">메모는 담당 병원에서 남길 수 있어요</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AdminConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, isFetching, refetch } = useConsultRequest(id);

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      data={data}
      onRetry={() => {
        void refetch();
      }}
      isRetrying={isError && isFetching}
      // 담당 병원이 아니거나 없는 상담이면 서버가 같은 404 를 준다 — 상담 id 는 고객
      // 개인정보와 1:1 이라 둘을 구분하면 id 대입으로 건수가 새어 나간다.
      emptyState={{ title: '상담 정보를 찾을 수 없어요' }}
      className="flex-1 bg-white"
    >
      {(request) => <ConsultDetail request={request} />}
    </QueryState>
  );
}
