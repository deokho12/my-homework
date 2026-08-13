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
            // 서버 계산 필드. 새로 등록하는 병원은 광고도 상주 전문의도 아직 없다.
            sponsorship: { isActive: false, isPlacementEligible: false },
            representativeSpecialty: null,
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
              // 서버 계산 필드. 등록 직후는 항상 검수 대기라 아직 공개할 전공이 없다
              // (일반의는 예외 — 검수 없이 항상 노출된다. src/utils/specialty.ts 규칙과 같다).
              visibleSpecialty: specialist.specialty === '일반의' ? '일반의' : null,
              isVerifiedSpecialist: false,
            });
          });

          router.back();
        }}
      />
    </>
  );
}
