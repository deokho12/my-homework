import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from '@/primitives';

import { AddressSearchInput } from '@/components/admin/AddressSearchInput';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { containerClass } from '@/components/layout/Container';
import { procedures } from '@/mocks/fixtures/procedures';
import { getDoctorsByHospital } from '@/store/useDoctorStore';
import {
  DENTAL_SPECIALTIES,
  type BusinessHourEntry,
  type DentalSpecialty,
  type GeocodeResult,
  type Hospital,
  type HospitalFeatures,
  type ProcedureId,
} from '@/types/domain';

// Sensible defaults for a hospital being registered for the first time — a typical weekday/Saturday
// schedule with Sunday closed. All editable afterward via the per-day text inputs below.
const DEFAULT_BUSINESS_HOURS: BusinessHourEntry[] = [
  { day: '월', hours: '09:30 - 18:30' },
  { day: '화', hours: '09:30 - 18:30' },
  { day: '수', hours: '09:30 - 18:30' },
  { day: '목', hours: '09:30 - 18:30' },
  { day: '금', hours: '09:30 - 18:30' },
  { day: '토', hours: '09:30 - 14:00' },
  { day: '일', hours: '휴진', isClosed: true },
];

const EMPTY_FEATURES: HospitalFeatures = {
  coordinator: false,
  painlessAnesthesia: false,
  digitalCare: false,
  parking: false,
  nightConsult: false,
  cctv: false,
};

const FEATURE_OPTIONS: { key: keyof HospitalFeatures; label: string }[] = [
  { key: 'coordinator', label: '전담코디네이터' },
  { key: 'painlessAnesthesia', label: '무통마취' },
  { key: 'digitalCare', label: '디지털진료' },
  { key: 'parking', label: '주차가능' },
  { key: 'nightConsult', label: '야간상담' },
  { key: 'cctv', label: 'CCTV설치' },
];

// Sponsorship fields are excluded on purpose — ad placement isn't self-serve yet (see admin/hospital/[id].tsx
// for the read-only "광고 현황" display), so editing a hospital here must never touch/clear those fields.
// `sponsorship`/`representativeSpecialty` are excluded for the same reason — both are server-computed
// (see backend/src/hospital/hospital.projection.ts), not admin-editable form fields.
export type HospitalFormData = Omit<
  Hospital,
  | 'id'
  | 'rating'
  | 'reviewCount'
  | 'consultCount'
  | 'events'
  | 'images'
  | 'isSponsored'
  | 'sponsoredCategories'
  | 'sponsoredRank'
  | 'sponsoredStartDate'
  | 'sponsoredEndDate'
  | 'sponsorship'
  | 'representativeSpecialty'
>;

export interface SpecialistEntry {
  /** Existing Doctor id, or null for a specialist being added in this session. */
  id: string | null;
  name: string;
  title: string;
  specialty: DentalSpecialty;
  certificateUrl: string;
}

interface HospitalFormProps {
  initial?: Hospital;
  submitLabel: string;
  onSubmit: (data: HospitalFormData, specialists: SpecialistEntry[]) => void;
}

function CheckboxRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mb-4 flex-row items-center gap-2.5">
      <Text className="text-lg">{checked ? '☑️' : '⬜️'}</Text>
      <Text className="text-sm font-medium text-neutral-700">{label}</Text>
    </Pressable>
  );
}

export function HospitalForm({ initial, submitLabel, onSubmit }: HospitalFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  // Editing an existing hospital assumes its stored coordinates are already valid (no re-search
  // required). Registering a new hospital starts with no coordinates until AddressSearchInput
  // resolves one — canSubmit blocks submission until then.
  const [address, setAddress] = useState(initial?.address ?? '');
  const [latitude, setLatitude] = useState<number | null>(initial?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initial?.longitude ?? null);
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? '');
  const [introduction, setIntroduction] = useState(initial?.introduction ?? '');
  const [priceMin, setPriceMin] = useState(initial ? String(initial.priceRange.min) : '');
  const [priceMax, setPriceMax] = useState(initial ? String(initial.priceRange.max) : '');
  const [tagsText, setTagsText] = useState(initial?.tags.join(', ') ?? '');
  const [procedureIds, setProcedureIds] = useState<ProcedureId[]>(initial?.procedureIds ?? []);
  const [consultAvailable, setConsultAvailable] = useState(initial?.consultAvailable ?? true);
  const [isOneDay, setIsOneDay] = useState(initial?.isOneDay ?? false);
  const [isRecommended, setIsRecommended] = useState(initial?.isRecommended ?? false);
  const [businessHours, setBusinessHours] = useState<BusinessHourEntry[]>(
    initial?.businessHours && initial.businessHours.length > 0 ? initial.businessHours : DEFAULT_BUSINESS_HOURS
  );
  const [directions, setDirections] = useState(initial?.directions ?? '');
  const [features, setFeatures] = useState<HospitalFeatures>(initial?.features ?? EMPTY_FEATURES);
  const [specialists, setSpecialists] = useState<SpecialistEntry[]>(
    initial
      ? getDoctorsByHospital(initial.id).map((doctor) => ({
          id: doctor.id,
          name: doctor.name,
          title: doctor.title,
          // `Doctor.specialty` 는 미승인 전공 주장을 감추는 공개 API 계약 때문에 optional 이다.
          // 이 관리자 폼은 목 store 에서 직접 읽으므로 항상 값이 있다 — 여기의 폴백은
          // (있을 수 없는) 결측을 대비한 방어이지 정상 동작 경로가 아니다.
          specialty: doctor.specialty ?? '일반의',
          certificateUrl: doctor.certificateUrl ?? '',
        }))
      : []
  );

  const toggleProcedure = (id: ProcedureId) => {
    setProcedureIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const addSpecialist = () => {
    setSpecialists((prev) => [
      ...prev,
      { id: null, name: '', title: '원장', specialty: DENTAL_SPECIALTIES[0], certificateUrl: '' },
    ]);
  };

  const updateSpecialist = (index: number, patch: Partial<SpecialistEntry>) => {
    setSpecialists((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const removeSpecialist = (index: number) => {
    setSpecialists((prev) => prev.filter((_, i) => i !== index));
  };

  const updateBusinessHour = (index: number, patch: Partial<BusinessHourEntry>) => {
    setBusinessHours((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const toggleFeature = (key: keyof HospitalFeatures) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const canSubmit =
    name.trim().length > 0 &&
    region.trim().length > 0 &&
    procedureIds.length > 0 &&
    priceMin.length > 0 &&
    priceMax.length > 0 &&
    latitude !== null &&
    longitude !== null;

  const handleSubmit = () => {
    if (latitude === null || longitude === null) return;

    onSubmit(
      {
        name: name.trim(),
        specialty: specialty.trim(),
        region: region.trim(),
        address: address.trim(),
        latitude,
        longitude,
        thumbnail: thumbnail.trim() || 'https://picsum.photos/seed/molarmolar-new/800/500',
        introduction: introduction.trim(),
        priceRange: { min: Number(priceMin) || 0, max: Number(priceMax) || 0 },
        tags: tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        procedureIds,
        consultAvailable,
        isOneDay,
        isRecommended,
        businessHours,
        directions: directions.trim(),
        features,
      },
      specialists.filter((entry) => entry.name.trim().length > 0)
    );
  };

  return (
    <ScrollView contentContainerClassName={containerClass('form', 'pb-10 pt-4')} keyboardShouldPersistTaps="handled">
      <Text className="mb-2 text-sm font-semibold text-neutral-700">병원명</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="병원명을 입력해주세요"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">전문 분야 (예: 임플란트 전문의원)</Text>
      <TextInput
        value={specialty}
        onChangeText={setSpecialty}
        placeholder="전문 분야"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">지역</Text>
      <TextInput
        value={region}
        onChangeText={setRegion}
        placeholder="예: 서울 강남구"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">주소</Text>
      <AddressSearchInput
        initialAddress={initial?.address}
        onSelect={(result: GeocodeResult) => {
          setAddress(result.roadAddressName || result.addressName);
          setLatitude(result.latitude);
          setLongitude(result.longitude);
        }}
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">대표 이미지 URL (선택)</Text>
      <TextInput
        value={thumbnail}
        onChangeText={setThumbnail}
        placeholder="https://..."
        autoCapitalize="none"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">병원 소개</Text>
      <TextInput
        value={introduction}
        onChangeText={setIntroduction}
        placeholder="병원을 소개해주세요"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        style={{ minHeight: 96 }}
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">가격대 (원)</Text>
      <View className="mb-4 flex-row gap-2">
        <TextInput
          value={priceMin}
          onChangeText={setPriceMin}
          placeholder="최소"
          keyboardType="numeric"
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />
        <TextInput
          value={priceMax}
          onChangeText={setPriceMax}
          placeholder="최대"
          keyboardType="numeric"
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />
      </View>

      <Text className="mb-2 text-sm font-semibold text-neutral-700">태그 (쉼표로 구분)</Text>
      <TextInput
        value={tagsText}
        onChangeText={setTagsText}
        placeholder="예: 당일진료, 주차가능"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">취급 시술 (1개 이상 선택)</Text>
      <View className="mb-2 flex-row flex-wrap">
        {procedures.map((procedure) => (
          <Chip
            key={procedure.id}
            label={procedure.name}
            selected={procedureIds.includes(procedure.id)}
            onPress={() => toggleProcedure(procedure.id)}
          />
        ))}
      </View>

      <View className="mb-2 mt-4">
        <CheckboxRow
          label="실시간 상담 가능"
          checked={consultAvailable}
          onPress={() => setConsultAvailable((value) => !value)}
        />
        <CheckboxRow
          label="원데이 진료 가능 여부 (당일 보철 등)"
          checked={isOneDay}
          onPress={() => setIsOneDay((value) => !value)}
        />
        <CheckboxRow
          label="추천 병원으로 노출 (에디터 추천)"
          checked={isRecommended}
          onPress={() => setIsRecommended((value) => !value)}
        />
      </View>

      <Text className="mb-2 mt-2 text-sm font-semibold text-neutral-700">진료시간 (요일별)</Text>
      <View className="mb-4 rounded-xl border border-neutral-200 p-3">
        {businessHours.map((entry, index) => (
          <View key={entry.day} className="mb-2 flex-row items-center gap-2">
            <Text className="w-6 text-sm font-semibold text-neutral-700">{entry.day}</Text>
            <TextInput
              value={entry.hours}
              onChangeText={(text) => updateBusinessHour(index, { hours: text })}
              placeholder="예: 09:30 - 18:30"
              editable={!entry.isClosed}
              className={`flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm ${
                entry.isClosed ? 'text-neutral-300' : ''
              }`}
            />
            <Pressable
              onPress={() =>
                updateBusinessHour(index, {
                  isClosed: !entry.isClosed,
                  hours: !entry.isClosed ? '휴진' : '09:30 - 18:30',
                })
              }
              className={`rounded-xl px-3 py-2 ${entry.isClosed ? 'bg-neutral-900' : 'bg-neutral-100'}`}
            >
              <Text className={`text-xs font-semibold ${entry.isClosed ? 'text-white' : 'text-neutral-500'}`}>
                휴진
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text className="mb-2 text-sm font-semibold text-neutral-700">찾아오시는 길</Text>
      <TextInput
        value={directions}
        onChangeText={setDirections}
        placeholder="예: 강남역 11번 출구에서 도보 5분"
        multiline
        numberOfLines={2}
        textAlignVertical="top"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        style={{ minHeight: 64 }}
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">병원 특징</Text>
      <View className="mb-2">
        {FEATURE_OPTIONS.map((option) => (
          <CheckboxRow
            key={option.key}
            label={option.label}
            checked={features[option.key]}
            onPress={() => toggleFeature(option.key)}
          />
        ))}
      </View>

      <View className="mb-2 mt-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-neutral-700">전문의</Text>
        <Pressable onPress={addSpecialist}>
          <Text className="text-sm font-semibold text-brand-700">+ 전문의 추가</Text>
        </Pressable>
      </View>
      <Text className="mb-3 text-xs text-neutral-400">
        새로 추가한 전문의는 "대기" 상태로 등록되며, 운영자의 자격증 검수 후 배지가 노출돼요.
      </Text>

      {specialists.map((entry, index) => (
        <View key={index} className="mb-3 rounded-xl border border-neutral-200 p-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-neutral-500">전문의 {index + 1}</Text>
            <Pressable onPress={() => removeSpecialist(index)}>
              <Text className="text-xs font-semibold text-rose-500">삭제</Text>
            </Pressable>
          </View>

          <View className="mb-2 flex-row gap-2">
            <TextInput
              value={entry.name}
              onChangeText={(text) => updateSpecialist(index, { name: text })}
              placeholder="이름"
              className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
            />
            <TextInput
              value={entry.title}
              onChangeText={(text) => updateSpecialist(index, { title: text })}
              placeholder="직함 (예: 대표원장)"
              className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
            />
          </View>

          <View className="mb-2 flex-row flex-wrap">
            {DENTAL_SPECIALTIES.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={entry.specialty === option}
                onPress={() => updateSpecialist(index, { specialty: option })}
              />
            ))}
          </View>

          <TextInput
            value={entry.certificateUrl}
            onChangeText={(text) => updateSpecialist(index, { certificateUrl: text })}
            placeholder="자격증/인증서 이미지 URL"
            autoCapitalize="none"
            className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </View>
      ))}

      <View className="mt-2">
        <PrimaryButton label={submitLabel} onPress={handleSubmit} disabled={!canSubmit} />
      </View>
    </ScrollView>
  );
}
