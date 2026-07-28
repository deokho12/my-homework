import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HospitalForm } from '@/components/admin/HospitalForm';
import { useHospitalStore } from '@/store/useHospitalStore';

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
    <>
      <Stack.Screen options={{ title: '병원 정보 수정' }} />
      <HospitalForm
        initial={hospital}
        submitLabel="저장하기"
        onSubmit={(data) => {
          updateHospital(hospital.id, data);
          router.back();
        }}
      />
    </>
  );
}
