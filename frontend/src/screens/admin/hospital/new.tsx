import { router, Stack } from '@/navigation';

import { HospitalForm } from '@/components/admin/HospitalForm';
import { useDoctorStore } from '@/store/useDoctorStore';
import { useHospitalStore } from '@/store/useHospitalStore';
import { getProceduresForSpecialty } from '@/utils/specialty';

export default function NewHospitalScreen() {
  const addHospital = useHospitalStore((state) => state.addHospital);
  const addDoctor = useDoctorStore((state) => state.addDoctor);

  return (
    <>
      <Stack.Screen options={{ title: '병원 등록' }} />
      <HospitalForm
        submitLabel="등록하기"
        onSubmit={(data, specialists) => {
          const hospitalId = `h-${Date.now()}`;
          addHospital({
            ...data,
            id: hospitalId,
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

          specialists.forEach((specialist, index) => {
            addDoctor({
              id: `d-${Date.now()}-${index}`,
              name: specialist.name.trim(),
              title: specialist.title.trim() || '원장',
              specialty: specialist.specialty,
              hospitalId,
              photo: 'https://picsum.photos/seed/molarmolar-new-doctor/300/300',
              procedureIds:
                specialist.specialty === '일반의' ? data.procedureIds : getProceduresForSpecialty(specialist.specialty),
              rating: 0,
              reviewCount: 0,
              consultCount: 0,
              certificateUrl: specialist.certificateUrl.trim() || null,
              verificationStatus: 'pending',
              rejectionReason: null,
              isRecommended: false,
              yearsOfExperience: 0,
              career: [],
            });
          });

          router.back();
        }}
      />
    </>
  );
}
