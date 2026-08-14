import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from '@/primitives';

import { AddressSearchInput } from '@/components/admin/AddressSearchInput';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { containerClass } from '@/components/layout/Container';
import type { DoctorUpsertInput } from '@/features/doctor/api/doctorApi';
import type { HospitalWriteInput } from '@/features/hospital/api/hospitalApi';
import type { HospitalFieldErrors } from '@/features/hospital/lib/hospitalFieldErrors';
import { useProcedures } from '@/features/procedure';
import {
  DENTAL_SPECIALTIES,
  type BusinessHourEntry,
  type DentalSpecialty,
  type Doctor,
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

/**
 * 병원 폼이 화면에서 다루는 전문의 한 줄. 서버 계약과의 간극 두 가지를 그대로 반영한다:
 *
 * - `specialty: null` — 검수 대기 중인 전문의는 공개 `Doctor.specialty` 가 아예 없다
 *   (미승인 전공 주장을 감추는 서버 설계). `일반의` 로 기본값을 채우면 안 된다(함정2) —
 *   그건 실제로 없는 사실을 새로 만들어내는 것이다. `null` 로 두고 "확인할 수 없음"을 정직하게 보여준다.
 * - `certificateUrlTouched` — 기존 전문의의 자격증 URL 을 다시 읽을 GET 이 없다(함정1). 그래서
 *   이 칸은 항상 빈 값으로 시작하고, 관리자가 **실제로 입력했을 때만** true 가 된다. 저장 시
 *   `false` 인 항목은 `certificateUrl` 키 자체를 요청에서 뺀다 — 빈 문자열을 보내면 "지우겠다"로
 *   읽혀 재검수 규칙(자격증 변경 → `pending` 복귀)이 잘못 발동한다.
 */
export interface SpecialistFormEntry {
  id?: string;
  name: string;
  title: string;
  specialty: DentalSpecialty | null;
  certificateUrl: string;
  certificateUrlTouched: boolean;
}

function toFormEntry(doctor: Doctor): SpecialistFormEntry {
  return {
    id: doctor.id,
    name: doctor.name,
    title: doctor.title,
    // `doctor.specialty` 가 없으면(검수 대기 중 감춰짐) null 로 둔다 — 절대 '일반의' 로 덮지 않는다.
    specialty: doctor.specialty ?? null,
    // 자격증 URL 은 공개 응답에 없다 — 항상 빈 값에서 시작하고 `touched` 로 "안 건드림"을 구분한다.
    certificateUrl: '',
    certificateUrlTouched: false,
  };
}

interface HospitalFormProps {
  initial?: Hospital;
  /** 병원 소속 전문의. 신규 등록 화면은 항상 빈 배열(또는 생략)이다. */
  doctors?: Doctor[];
  /** `operator` 만 "추천 병원으로 노출"을 켜고 끌 수 있다 — false 면 체크박스를 아예 숨긴다. */
  canEditRecommended: boolean;
  /** 서버 `422` 를 필드별로 매핑한 결과. 해당 입력 칸 아래에 그대로 표시한다. */
  fieldErrors?: HospitalFieldErrors;
  submitLabel: string;
  onSubmit: (data: HospitalWriteInput, doctors: DoctorUpsertInput[]) => void;
}

function CheckboxRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mb-4 flex-row items-center gap-2.5">
      <Text className="text-lg">{checked ? '☑️' : '⬜️'}</Text>
      <Text className="text-sm font-medium text-neutral-700">{label}</Text>
    </Pressable>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="-mt-3 mb-4 text-xs text-rose-500">
      {message}
    </p>
  );
}

export function HospitalForm({
  initial,
  doctors = [],
  canEditRecommended,
  fieldErrors,
  submitLabel,
  onSubmit,
}: HospitalFormProps) {
  const { data: procedures = [] } = useProcedures();
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
  const [specialists, setSpecialists] = useState<SpecialistFormEntry[]>(() => doctors.map(toFormEntry));

  const toggleProcedure = (id: ProcedureId) => {
    setProcedureIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const addSpecialist = () => {
    setSpecialists((prev) => [
      ...prev,
      { name: '', title: '원장', specialty: DENTAL_SPECIALTIES[0], certificateUrl: '', certificateUrlTouched: true },
    ]);
  };

  const updateSpecialist = (index: number, patch: Partial<SpecialistFormEntry>) => {
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

  // 이름을 적어 저장 대상이 될 전문의 중 전공을 아직 확인할 수 없는 항목이 있으면 막는다 —
  // 무엇을 보낼지 모르는 채로 '일반의' 등 임의 값을 조용히 지어내지 않는다(함정2).
  const hasUnresolvedSpecialty = specialists.some(
    (entry) => entry.name.trim().length > 0 && entry.specialty === null
  );

  const canSubmit =
    name.trim().length > 0 &&
    region.trim().length > 0 &&
    procedureIds.length > 0 &&
    priceMin.length > 0 &&
    priceMax.length > 0 &&
    latitude !== null &&
    longitude !== null &&
    !hasUnresolvedSpecialty;

  const handleSubmit = () => {
    if (latitude === null || longitude === null) return;

    const doctorsPayload: DoctorUpsertInput[] = [];

    for (const entry of specialists) {
      const trimmedName = entry.name.trim();
      if (trimmedName.length === 0) continue;
      if (entry.specialty === null) continue; // canSubmit 이 막지만, 방어적으로도 지어내지 않는다.

      const upsert: DoctorUpsertInput = {
        name: trimmedName,
        title: entry.title.trim() || '원장',
        specialty: entry.specialty,
      };

      if (entry.id) upsert.id = entry.id;
      // ★ 함정1 — 실제로 입력한 경우에만 키를 넣는다. 건드리지 않았으면 아예 생략해
      // 서버가 기존 자격증을 유지하게 한다 (보내면 "지우겠다"/"바꾸겠다"로 읽힌다).
      if (entry.certificateUrlTouched) upsert.certificateUrl = entry.certificateUrl.trim() || null;

      doctorsPayload.push(upsert);
    }

    const data: HospitalWriteInput = {
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
      businessHours,
      directions: directions.trim(),
      features,
    };

    // `hospital_admin` 은 이 키를 아예 보내면 안 된다 (`operator` 전용, 아니면 422 FIELD_NOT_WRITABLE).
    if (canEditRecommended) data.isRecommended = isRecommended;

    onSubmit(data, doctorsPayload);
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
      <FieldError message={fieldErrors?.name} />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">전문 분야 (예: 임플란트 전문의원)</Text>
      <TextInput
        value={specialty}
        onChangeText={setSpecialty}
        placeholder="전문 분야"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />
      <FieldError message={fieldErrors?.specialty} />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">지역</Text>
      <TextInput
        value={region}
        onChangeText={setRegion}
        placeholder="예: 서울 강남구"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />
      <FieldError message={fieldErrors?.region} />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">주소</Text>
      <AddressSearchInput
        initialAddress={initial?.address}
        onSelect={(result: GeocodeResult) => {
          setAddress(result.roadAddressName || result.addressName);
          setLatitude(result.latitude);
          setLongitude(result.longitude);
        }}
      />
      <FieldError message={fieldErrors?.address} />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">대표 이미지 URL (선택)</Text>
      <TextInput
        value={thumbnail}
        onChangeText={setThumbnail}
        placeholder="https://..."
        autoCapitalize="none"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />
      <FieldError message={fieldErrors?.thumbnail} />

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
      <FieldError message={fieldErrors?.introduction} />

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
      <FieldError message={fieldErrors?.priceRange} />

      <Text className="mb-2 text-sm font-semibold text-neutral-700">태그 (쉼표로 구분)</Text>
      <TextInput
        value={tagsText}
        onChangeText={setTagsText}
        placeholder="예: 당일진료, 주차가능"
        className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />
      <FieldError message={fieldErrors?.tags} />

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
      <FieldError message={fieldErrors?.procedureIds} />

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
        {canEditRecommended ? (
          <CheckboxRow
            label="추천 병원으로 노출 (에디터 추천)"
            checked={isRecommended}
            onPress={() => setIsRecommended((value) => !value)}
          />
        ) : initial ? (
          // hospital_admin 은 이 값을 바꿀 수 없다 — 하지만 현재 상태 자체를 감추면 안 된다.
          <Text className="mb-4 text-xs text-neutral-400">
            추천 병원 노출: {initial.isRecommended ? '예' : '아니오'} · 운영자만 변경할 수 있어요
          </Text>
        ) : null}
      </View>
      <FieldError message={fieldErrors?.isRecommended} />

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
      <FieldError message={fieldErrors?.businessHours} />

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
      <FieldError message={fieldErrors?.directions} />

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
      <FieldError message={fieldErrors?.features} />

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
        <View key={entry.id ?? `new-${index}`} className="mb-3 rounded-xl border border-neutral-200 p-3">
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

          {entry.specialty === null ? (
            <Text className="mb-2 text-xs text-amber-600">
              검수 대기 중이라 전공을 확인할 수 없어요. 저장하려면 전공을 다시 선택해주세요.
            </Text>
          ) : null}
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
            onChangeText={(text) => updateSpecialist(index, { certificateUrl: text, certificateUrlTouched: true })}
            placeholder="자격증/인증서 이미지 URL"
            autoCapitalize="none"
            className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
          <Text className="mt-1 text-[11px] text-neutral-400">
            입력하면 자격증이 교체돼요. 비워 두면 기존 자격증이 그대로 유지돼요.
          </Text>
        </View>
      ))}

      <View className="mt-2">
        <PrimaryButton label={submitLabel} onPress={handleSubmit} disabled={!canSubmit} />
      </View>
    </ScrollView>
  );
}
