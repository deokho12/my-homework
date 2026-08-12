import { Stack } from '@/navigation';
import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { StockImage } from '@/components/StockImage';
import { useDoctorStore } from '@/store/useDoctorStore';
import { getHospitalById } from '@/store/useHospitalStore';
import type { Doctor, VerificationStatus } from '@/types/domain';

const STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
};

const STATUS_ORDER: Record<VerificationStatus, number> = {
  pending: 0,
  rejected: 1,
  approved: 2,
};

function SpecialistRow({ doctor }: { doctor: Doctor }) {
  const setVerification = useDoctorStore((state) => state.setVerification);
  const hospital = getHospitalById(doctor.hospitalId);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

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
          <Text className="text-xs text-neutral-400">{hospital?.name ?? '알 수 없는 병원'}</Text>
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
                setVerification(doctor.id, 'rejected', reason.trim() || '사유 미입력');
                setRejecting(false);
                setReason('');
              }}
              disabled={reason.trim().length === 0}
              className={`flex-1 items-center rounded-xl py-2.5 ${
                reason.trim().length === 0 ? 'bg-neutral-200' : 'bg-rose-500'
              }`}
            >
              <Text className={`text-sm font-semibold ${reason.trim().length === 0 ? 'text-neutral-400' : 'text-white'}`}>
                반려 확정
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setVerification(doctor.id, 'approved')}
            className="flex-1 items-center rounded-xl bg-brand-600 py-2.5 active:bg-brand-700"
          >
            <Text className="text-sm font-semibold text-white">승인</Text>
          </Pressable>
          <Pressable
            onPress={() => setRejecting(true)}
            className="flex-1 items-center rounded-xl border border-neutral-200 py-2.5"
          >
            <Text className="text-sm font-semibold text-neutral-600">반려</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function SpecialistVerificationScreen() {
  const doctors = useDoctorStore((state) => state.doctors);
  const sorted = [...doctors].sort(
    (a, b) => STATUS_ORDER[a.verificationStatus] - STATUS_ORDER[b.verificationStatus]
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '전문의 인증 검수' }} />
      <View className="px-5 pb-2 pt-4">
        <Text className="text-lg font-bold text-neutral-900">전문의 인증 검수</Text>
        <Text className="mt-1 text-sm text-neutral-500">
          업로드된 자격증을 확인하고 승인 또는 반려해주세요
        </Text>
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 py-4"
        renderItem={({ item }) => <SpecialistRow doctor={item} />}
      />
    </SafeAreaView>
  );
}
