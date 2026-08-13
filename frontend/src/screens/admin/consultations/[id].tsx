import { Stack, useLocalSearchParams } from '@/navigation';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { containerClass } from '@/components/layout/Container';
import { getProcedureById } from '@/mocks/fixtures/procedures';
import { useConsultStore } from '@/store/useConsultStore';
import { getHospitalById } from '@/store/useHospitalStore';
import { CONSULT_STATUS_LABEL, CONSULT_STATUSES } from '@/types/domain';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row">
      <Text className="w-20 text-sm text-neutral-400">{label}</Text>
      <Text className="flex-1 text-sm font-semibold text-neutral-800">{value}</Text>
    </View>
  );
}

export default function AdminConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useConsultStore((state) => state.requests.find((item) => item.id === id));
  const updateStatus = useConsultStore((state) => state.updateStatus);
  const addMemo = useConsultStore((state) => state.addMemo);
  const [memoText, setMemoText] = useState('');

  if (!request) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: '상담 상세' }} />
        <Text className="text-sm text-neutral-500">상담 정보를 찾을 수 없어요</Text>
      </SafeAreaView>
    );
  }

  const hospital = getHospitalById(request.hospitalId);
  const procedure = request.procedureId ? getProcedureById(request.procedureId) : undefined;
  const sortedHistory = [...request.statusHistory].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );
  const sortedMemos = [...request.memos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleAddMemo = () => {
    const trimmed = memoText.trim();
    if (!trimmed) return;
    addMemo(request.id, trimmed);
    setMemoText('');
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 상세' }} />
      <ScrollView contentContainerClassName={containerClass('form', 'pb-10 pt-4')} keyboardShouldPersistTaps="handled">
        <View className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-3 text-base font-bold text-neutral-900">{hospital?.name ?? '알 수 없는 병원'}</Text>
          <InfoRow label="이름" value={request.name} />
          <InfoRow label="연락처" value={request.phone} />
          <InfoRow label="희망 시술" value={procedure?.name ?? '미지정'} />
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
          <View className="mb-1 flex-row flex-wrap">
            {CONSULT_STATUSES.map((status) => (
              <Chip
                key={status}
                label={CONSULT_STATUS_LABEL[status]}
                selected={request.status === status}
                onPress={() => updateStatus(request.id, status)}
              />
            ))}
          </View>
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
                <Text className="text-sm font-medium text-neutral-800">{CONSULT_STATUS_LABEL[change.status]}</Text>
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
                    {new Date(memo.createdAt).toLocaleString('ko-KR')}
                  </Text>
                </View>
              ))}
            </View>
          )}

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
          <PrimaryButton label="메모 추가" onPress={handleAddMemo} disabled={memoText.trim().length === 0} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
