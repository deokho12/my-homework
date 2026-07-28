import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { procedures } from '@/data/procedures';
import { getDoctorsByHospital } from '@/store/useDoctorStore';
import { DENTAL_SPECIALTIES, type DentalSpecialty, type Hospital, type ProcedureId } from '@/types/domain';

// Sponsorship fields are excluded on purpose — ad placement isn't self-serve yet (see admin/hospital/[id].tsx
// for the read-only "광고 현황" display), so editing a hospital here must never touch/clear those fields.
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

// Seoul City Hall — sensible default center for a new hospital until the admin sets real coordinates.
const DEFAULT_LATITUDE = 37.5665;
const DEFAULT_LONGITUDE = 126.978;

export function HospitalForm({ initial, submitLabel, onSubmit }: HospitalFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [latitude, setLatitude] = useState(String(initial?.latitude ?? DEFAULT_LATITUDE));
  const [longitude, setLongitude] = useState(String(initial?.longitude ?? DEFAULT_LONGITUDE));
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? '');
  const [introduction, setIntroduction] = useState(initial?.introduction ?? '');
  const [priceMin, setPriceMin] = useState(initial ? String(initial.priceRange.min) : '');
  const [priceMax, setPriceMax] = useState(initial ? String(initial.priceRange.max) : '');
  const [tagsText, setTagsText] = useState(initial?.tags.join(', ') ?? '');
  const [procedureIds, setProcedureIds] = useState<ProcedureId[]>(initial?.procedureIds ?? []);
  const [consultAvailable, setConsultAvailable] = useState(initial?.consultAvailable ?? true);
  const [isOneDay, setIsOneDay] = useState(initial?.isOneDay ?? false);
  const [isRecommended, setIsRecommended] = useState(initial?.isRecommended ?? false);
  const [specialists, setSpecialists] = useState<SpecialistEntry[]>(
    initial
      ? getDoctorsByHospital(initial.id).map((doctor) => ({
          id: doctor.id,
          name: doctor.name,
          title: doctor.title,
          specialty: doctor.specialty,
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

  const canSubmit =
    name.trim().length > 0 &&
    region.trim().length > 0 &&
    procedureIds.length > 0 &&
    priceMin.length > 0 &&
    priceMax.length > 0 &&
    latitude.length > 0 &&
    longitude.length > 0;

  const handleSubmit = () => {
    onSubmit(
      {
        name: name.trim(),
        specialty: specialty.trim(),
        region: region.trim(),
        address: address.trim(),
        latitude: Number(latitude) || DEFAULT_LATITUDE,
        longitude: Number(longitude) || DEFAULT_LONGITUDE,
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
      },
      specialists.filter((entry) => entry.name.trim().length > 0)
    );
  };

  return (
    <ScrollView contentContainerClassName="px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
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
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="상세 주소"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">지도 좌표 (위도 / 경도)</Text>
      <View className="mb-4 flex-row gap-2">
        <TextInput
          value={latitude}
          onChangeText={setLatitude}
          placeholder="위도"
          keyboardType="numeric"
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />
        <TextInput
          value={longitude}
          onChangeText={setLongitude}
          placeholder="경도"
          keyboardType="numeric"
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />
      </View>

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
