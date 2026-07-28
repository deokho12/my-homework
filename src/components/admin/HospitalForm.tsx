import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { procedures } from '@/data/procedures';
import type { Hospital, ProcedureId } from '@/types/domain';

export type HospitalFormData = Omit<
  Hospital,
  'id' | 'rating' | 'reviewCount' | 'consultCount' | 'events' | 'images'
>;

interface HospitalFormProps {
  initial?: Hospital;
  submitLabel: string;
  onSubmit: (data: HospitalFormData) => void;
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
  const [address, setAddress] = useState(initial?.address ?? '');
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? '');
  const [introduction, setIntroduction] = useState(initial?.introduction ?? '');
  const [priceMin, setPriceMin] = useState(initial ? String(initial.priceRange.min) : '');
  const [priceMax, setPriceMax] = useState(initial ? String(initial.priceRange.max) : '');
  const [tagsText, setTagsText] = useState(initial?.tags.join(', ') ?? '');
  const [procedureIds, setProcedureIds] = useState<ProcedureId[]>(initial?.procedureIds ?? []);
  const [consultAvailable, setConsultAvailable] = useState(initial?.consultAvailable ?? true);
  const [isOneDay, setIsOneDay] = useState(initial?.isOneDay ?? false);
  const [isRecommended, setIsRecommended] = useState(initial?.isRecommended ?? false);

  const toggleProcedure = (id: ProcedureId) => {
    setProcedureIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const canSubmit =
    name.trim().length > 0 &&
    region.trim().length > 0 &&
    procedureIds.length > 0 &&
    priceMin.length > 0 &&
    priceMax.length > 0;

  const handleSubmit = () => {
    onSubmit({
      name: name.trim(),
      specialty: specialty.trim(),
      region: region.trim(),
      address: address.trim(),
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
    });
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

      <View className="mt-2">
        <PrimaryButton label={submitLabel} onPress={handleSubmit} disabled={!canSubmit} />
      </View>
    </ScrollView>
  );
}
