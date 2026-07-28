import { router, Stack } from 'expo-router';

import { HospitalForm } from '@/components/admin/HospitalForm';
import { useHospitalStore } from '@/store/useHospitalStore';

export default function NewHospitalScreen() {
  const addHospital = useHospitalStore((state) => state.addHospital);

  return (
    <>
      <Stack.Screen options={{ title: '병원 등록' }} />
      <HospitalForm
        submitLabel="등록하기"
        onSubmit={(data) => {
          addHospital({
            ...data,
            id: `h-${Date.now()}`,
            rating: 0,
            reviewCount: 0,
            consultCount: 0,
            events: [],
            images: [data.thumbnail],
            isSponsored: false,
            sponsoredCategories: [],
            sponsoredRank: null,
            sponsoredStartDate: null,
            sponsoredEndDate: null,
          });
          router.back();
        }}
      />
    </>
  );
}
