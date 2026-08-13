import { router, Stack, useLocalSearchParams } from '@/navigation';
import { Text, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { HospitalForm } from '@/components/admin/HospitalForm';
import { getProcedureById } from '@/mocks/fixtures/procedures';
import { getDoctorsByHospital, useDoctorStore } from '@/store/useDoctorStore';
import { useHospitalStore } from '@/store/useHospitalStore';
import type { Hospital } from '@/types/domain';
import { getProceduresForSpecialty } from '@/utils/specialty';
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
  const addDoctor = useDoctorStore((state) => state.addDoctor);
  const updateDoctor = useDoctorStore((state) => state.updateDoctor);
  const removeDoctor = useDoctorStore((state) => state.removeDoctor);

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
          onSubmit={(data, specialists) => {
            updateHospital(hospital.id, data);

            const keptIds = new Set(specialists.filter((entry) => entry.id).map((entry) => entry.id));
            for (const doctor of getDoctorsByHospital(hospital.id)) {
              if (!keptIds.has(doctor.id)) removeDoctor(doctor.id);
            }

            specialists.forEach((specialist, index) => {
              if (specialist.id) {
                updateDoctor(specialist.id, {
                  name: specialist.name.trim(),
                  title: specialist.title.trim() || '원장',
                  specialty: specialist.specialty,
                  certificateUrl: specialist.certificateUrl.trim() || null,
                });
                return;
              }

              addDoctor({
                id: `d-${Date.now()}-${index}`,
                name: specialist.name.trim(),
                title: specialist.title.trim() || '원장',
                specialty: specialist.specialty,
                hospitalId: hospital.id,
                photo: 'https://picsum.photos/seed/molarmolar-new-doctor/300/300',
                procedureIds:
                  specialist.specialty === '일반의'
                    ? data.procedureIds
                    : getProceduresForSpecialty(specialist.specialty),
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
      </View>
    </SafeAreaView>
  );
}
