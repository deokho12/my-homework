import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HospitalForm } from '@/components/admin/HospitalForm';
import { getProcedureById } from '@/data/procedures';
import { useHospitalStore } from '@/store/useHospitalStore';
import type { Hospital } from '@/types/domain';
import { isSponsorshipActive } from '@/utils/sponsorship';

function getSponsorshipStatusText(hospital: Hospital): string {
  if (!hospital.isSponsored) return '현재 진행중인 광고가 없어요';

  const categoryNames = hospital.sponsoredCategories
    .map((procedureId) => getProcedureById(procedureId)?.name)
    .filter(Boolean)
    .join(', ');

  if (isSponsorshipActive(hospital)) {
    return `${categoryNames} 카테고리 광고 중 · ${hospital.sponsoredEndDate}까지`;
  }
  return `${categoryNames} 카테고리 광고 (기간 종료: ${hospital.sponsoredEndDate})`;
}

export default function EditHospitalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hospital = useHospitalStore((state) => state.hospitals.find((item) => item.id === id));
  const updateHospital = useHospitalStore((state) => state.updateHospital);

  if (!hospital) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">병원 정보를 찾을 수 없어요</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '병원 정보 수정' }} />

      <View className="mx-5 mt-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
        <Text className="mb-1 text-sm font-semibold text-neutral-500">광고 현황 (읽기 전용)</Text>
        <Text className="text-sm text-neutral-800">{getSponsorshipStatusText(hospital)}</Text>
        <Text className="mt-1 text-xs text-neutral-400">
          광고 신청·결제 기능은 아직 준비중이에요. 변경이 필요하면 담당팀에 문의해주세요.
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <HospitalForm
          initial={hospital}
          submitLabel="저장하기"
          onSubmit={(data) => {
            updateHospital(hospital.id, data);
            router.back();
          }}
        />
      </View>
    </SafeAreaView>
  );
}
