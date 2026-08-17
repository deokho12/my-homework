import { Stack, router, useLocalSearchParams } from '@/navigation';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QueryState } from '@/components/QueryState';
import { containerClass } from '@/components/layout/Container';
import { useCreateConsultRequest } from '@/features/consult';
import { useDoctor } from '@/features/doctor';
import { useHospital } from '@/features/hospital';
import { useProcedureMap } from '@/features/procedure';
import { isApiError } from '@/lib/apiClient';
import type { Hospital, ProcedureId } from '@/types/domain';
import { showAlert } from '@/utils/alert';

const TIME_SLOTS = ['평일 오전', '평일 오후', '주말'];

/** 조회가 끝난 병원을 받아 폼 상태(이름·전화번호·시술 등)를 갖는다 — `QueryState` 의 children 은
 * 콜백이라 그 안에서 훅을 호출할 수 없어 별도 컴포넌트로 뺐다 (`HospitalDetailPage` 와 같은 이유). */
function ConsultRequestForm({ hospital, doctorId }: { hospital: Hospital; doctorId?: string }) {
  const procedureMap = useProcedureMap();
  const { mutate: submitRequest, isPending, error } = useCreateConsultRequest();
  // 지목한 전문의의 이름을 보여주기 위한 조회다. 저장에 필요한 것은 id 뿐이므로
  // 이 조회가 실패해도 신청은 그대로 진행된다.
  const { data: doctor } = useDoctor(doctorId);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [procedureId, setProcedureId] = useState<ProcedureId | null>(hospital.procedureIds[0] ?? null);
  const [preferredTime, setPreferredTime] = useState(TIME_SLOTS[0]);
  const [message, setMessage] = useState('');

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !isPending;

  /**
   * 서버가 상담 마감·전문의 소속·취급 시술·연락처 형식을 검사한다. 실패 문구는 서버가
   * 내려준 한국어를 그대로 쓴다 — 화면이 코드별 문구 사전을 다시 만들지 않는다.
   */
  const handleSubmit = () => {
    submitRequest(
      {
        hospitalId: hospital.id,
        // **지목한 전문의를 함께 보낸다.** 없으면 키를 아예 넣지 않는다 — 서버가
        // 소속을 검사하므로 빈 값을 지어내면 422 가 된다.
        ...(doctorId === undefined ? {} : { doctorId }),
        procedureId,
        name: name.trim(),
        phone: phone.trim(),
        preferredTime,
        message: message.trim(),
      },
      {
        onSuccess: () => {
          showAlert('상담 신청이 접수되었어요', `${hospital.name}에서 확인 후 연락드릴게요.`, [
            { text: '확인', onPress: () => router.back() },
          ]);
        },
      }
    );
  };

  const errorMessage = error === null ? null : isApiError(error) ? error.message : '잠시 후 다시 시도해주세요';

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 신청' }} />
      <ScrollView
        contentContainerClassName={containerClass('form', 'pb-8 pt-4')}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-1 text-lg font-bold text-neutral-900">{hospital.name}</Text>
        {doctorId === undefined ? null : (
          <Text className="mb-1 text-sm font-semibold text-brand-700">
            지목 전문의 {doctor ? `· ${doctor.name}` : ''}
          </Text>
        )}
        <Text className="mb-6 text-sm text-neutral-500">상담 정보를 남겨주시면 병원에서 연락드려요</Text>

        <Text className="mb-2 text-sm font-semibold text-neutral-700">이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="이름을 입력해주세요"
          className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />

        <Text className="mb-2 text-sm font-semibold text-neutral-700">연락처</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="010-0000-0000"
          keyboardType="phone-pad"
          className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />

        <Text className="mb-2 text-sm font-semibold text-neutral-700">희망 시술</Text>
        <View className="mb-4 flex-row flex-wrap">
          {hospital.procedureIds.map((id) => {
            const procedure = procedureMap.get(id);
            if (!procedure) return null;
            return (
              <Chip
                key={id}
                label={procedure.name}
                selected={procedureId === id}
                onPress={() => setProcedureId(id)}
              />
            );
          })}
        </View>

        <Text className="mb-2 text-sm font-semibold text-neutral-700">희망 상담 시간</Text>
        <View className="mb-4 flex-row flex-wrap">
          {TIME_SLOTS.map((slot) => (
            <Chip
              key={slot}
              label={slot}
              selected={preferredTime === slot}
              onPress={() => setPreferredTime(slot)}
            />
          ))}
        </View>

        <Text className="mb-2 text-sm font-semibold text-neutral-700">남기고 싶은 말 (선택)</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="궁금한 점이나 요청사항을 적어주세요"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="mb-6 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
          style={{ minHeight: 96 }}
        />

        {errorMessage === null ? null : (
          <Text className="mb-3 text-sm text-rose-600">{errorMessage}</Text>
        )}

        <PrimaryButton
          label={isPending ? '접수 중…' : '상담 신청하기'}
          onPress={handleSubmit}
          disabled={!canSubmit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ConsultRequestScreen() {
  // `doctorId` 는 쿼리로 온다 (`/consult/:hospitalId?doctorId=d1`) — 전문의 카드·상세의
  // `전문의 상담신청` 이 채운다. 병원의 `병원 상담신청` 으로 들어오면 없다.
  const { hospitalId, doctorId } = useLocalSearchParams<{ hospitalId: string; doctorId?: string }>();
  // 로그인 검사는 라우트 가드가 한다 (`src/App.tsx` 의 `guard: 'auth'`). 화면 안에서
  // 다시 검사하면 규칙이 두 곳으로 갈린다.
  const { data: hospital, error, isLoading, isError, isFetching, refetch } = useHospital(hospitalId);

  // 없는 병원은 서버가 404 HOSPITAL_NOT_FOUND 를 준다 — "다시 시도" 를 권할 에러가 아니라
  // 빈 상태다. 그 외 에러(네트워크 오류 등)는 재시도 가능한 에러로 둔다.
  const notFound = isError && isApiError(error) && error.code === 'HOSPITAL_NOT_FOUND';

  return (
    <QueryState
      isLoading={isLoading}
      isError={notFound ? false : isError}
      data={notFound ? null : hospital}
      onRetry={() => {
        void refetch();
      }}
      isRetrying={isError && isFetching}
      emptyState={{ title: '병원 정보를 찾을 수 없어요' }}
      className="flex-1 bg-white"
    >
      {(hospital) => <ConsultRequestForm hospital={hospital} doctorId={doctorId} />}
    </QueryState>
  );
}
