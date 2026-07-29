import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { getProcedureById } from '@/data/procedures';
import { useAuthStore } from '@/store/useAuthStore';
import { useConsultStore } from '@/store/useConsultStore';
import { getHospitalById } from '@/store/useHospitalStore';
import type { ProcedureId } from '@/types/domain';
import { showAlert } from '@/utils/alert';

const TIME_SLOTS = ['평일 오전', '평일 오후', '주말'];

export default function ConsultRequestScreen() {
  const { hospitalId } = useLocalSearchParams<{ hospitalId: string }>();
  const hospital = getHospitalById(hospitalId);
  const addRequest = useConsultStore((state) => state.addRequest);
  const user = useAuthStore((state) => state.user);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [procedureId, setProcedureId] = useState<ProcedureId | null>(hospital?.procedureIds[0] ?? null);
  const [preferredTime, setPreferredTime] = useState(TIME_SLOTS[0]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Guards against direct navigation to this route on web without going through requireAuth.
    if (!user) {
      router.replace({ pathname: '/auth/login', params: { redirect: `/consult/${hospitalId}` } });
    }
  }, [user, hospitalId]);

  if (!hospital || !user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">
          {hospital ? '로그인이 필요해요' : '병원 정보를 찾을 수 없어요'}
        </Text>
      </SafeAreaView>
    );
  }

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0;

  const handleSubmit = () => {
    addRequest({ hospitalId: hospital.id, procedureId, name: name.trim(), phone: phone.trim(), preferredTime, message: message.trim() });
    showAlert('상담 신청이 접수되었어요', `${hospital.name}에서 확인 후 연락드릴게요.`, [
      { text: '확인', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 신청' }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="mb-1 text-lg font-bold text-neutral-900">{hospital.name}</Text>
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
            const procedure = getProcedureById(id);
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

        <PrimaryButton label="상담 신청하기" onPress={handleSubmit} disabled={!canSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}
