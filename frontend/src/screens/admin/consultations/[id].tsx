import { Stack, useLocalSearchParams } from '@/navigation';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QueryState } from '@/components/QueryState';
import { containerClass } from '@/components/layout/Container';
import { useAddConsultMemo, useConsultRequest, useUpdateConsultStatus } from '@/features/consult';
import { useHospital } from '@/features/hospital';
import { useProcedureMap, useProcedures } from '@/features/procedure';
import { isApiError } from '@/lib/apiClient';
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
 * 조회가 끝난 상담 하나를 렌더한다 — `QueryState` 의 children 은 콜백이라 그 안에서 훅을
 * 호출할 수 없어 별도 컴포넌트로 뺐다 (`HospitalDetailView` 와 같은 이유).
 */
function ConsultationDetailView({ request }: { request: ConsultRequest }) {
  const updateStatus = useUpdateConsultStatus();
  const addMemo = useAddConsultMemo();
  const [memoText, setMemoText] = useState('');
  const procedureMap = useProcedureMap();
  const { isPending: proceduresPending } = useProcedures();
  const { data: hospital, isLoading: isHospitalLoading } = useHospital(request.hospitalId);

  const procedure = request.procedureId ? procedureMap.get(request.procedureId) : undefined;
  // "미지정" 은 `request.procedureId` 가 정말 `null` 일 때만 맞는 말이다. id 는 있는데
  // 맵에 아직 없는 것은 시술 목록이 로딩 중이라는 뜻일 수 있어, 중립 표시(—)를 대신 쓴다.
  const procedureLabel = procedure ? procedure.name : request.procedureId && proceduresPending ? '—' : '미지정';
  // 병원 이름도 같은 규칙 — 조회가 끝나기 전의 "없음"은 "아직 모름"이지 "알 수 없는 병원"이 아니다.
  const hospitalLabel = isHospitalLoading ? '—' : (hospital?.name ?? '알 수 없는 병원');
  const sortedHistory = [...request.statusHistory].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );
  const sortedMemos = [...request.memos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleAddMemo = () => {
    const trimmed = memoText.trim();
    if (!trimmed) return;
    // 입력칸은 저장 성공을 확인하고 비운다 — 실패했는데 비우면 쓴 내용이 사라진다.
    addMemo.mutate({ id: request.id, content: trimmed }, { onSuccess: () => setMemoText('') });
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <ScrollView contentContainerClassName={containerClass('form', 'pb-10 pt-4')} keyboardShouldPersistTaps="handled">
        <View className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4">
          <Text className="mb-3 text-base font-bold text-neutral-900">{hospitalLabel}</Text>
          <InfoRow label="이름" value={request.name} />
          <InfoRow label="연락처" value={request.phone} />
          <InfoRow label="희망 시술" value={procedureLabel} />
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
                // 같은 상태를 다시 눌러도 서버가 no-op 으로 받는다 — 화면에서 따로 막지 않는다.
                onPress={() => updateStatus.mutate({ id: request.id, status })}
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
          <PrimaryButton
            label="메모 추가"
            onPress={handleAddMemo}
            disabled={memoText.trim().length === 0 || addMemo.isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AdminConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: request, error, isLoading, isError, isFetching, refetch } = useConsultRequest(id);

  // 없는 상담(또는 담당 병원 밖의 상담)은 서버가 404 CONSULT_REQUEST_NOT_FOUND 를 준다 —
  // "다시 시도" 를 권할 에러가 아니라 빈 상태다. 그 외 에러(네트워크 오류 등)는 재시도 대상이다.
  const notFound = isError && isApiError(error) && error.code === 'CONSULT_REQUEST_NOT_FOUND';

  return (
    <>
      <Stack.Screen options={{ title: '상담 상세' }} />
      <QueryState
        isLoading={isLoading}
        isError={notFound ? false : isError}
        data={notFound ? null : request}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        emptyState={{ title: '상담 정보를 찾을 수 없어요' }}
        className="flex-1 bg-white"
      >
        {(loaded) => <ConsultationDetailView request={loaded} />}
      </QueryState>
    </>
  );
}
