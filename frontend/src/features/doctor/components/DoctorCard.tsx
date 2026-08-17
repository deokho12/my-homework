import { router } from '@/navigation';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from '@/primitives';

import { Badge } from '@/components/Badge';
import { StockImage } from '@/components/StockImage';
import { useProcedureMap } from '@/features/procedure';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { Doctor, Hospital } from '@/types/domain';

interface DoctorCardProps {
  doctor: Doctor;
  /**
   * 소속 병원. 상담 가능 여부·병원명 표시에 쓴다. 호출부가 이미 들고 있는 데이터를
   * 넘겨받는다(이 컴포넌트는 스스로 조회하지 않는다) — 없으면 그 부분만 비워 보여준다.
   */
  hospital?: Hospital | null;
  style?: StyleProp<ViewStyle>;
}

export function DoctorCard({ doctor, hospital, style }: DoctorCardProps) {
  const requireAuth = useRequireAuth();
  const procedureMap = useProcedureMap();

  return (
    <Pressable
      onPress={() => router.push(`/doctor/${doctor.id}`)}
      style={style}
      className="mb-4 rounded-2xl border border-neutral-100 bg-white p-4"
    >
      <View className="mb-3 flex-row items-center gap-3">
        <StockImage
          uri={doctor.photo}
          alt={`${doctor.name} ${doctor.title} 프로필 사진`}
          style={{ width: 64, height: 64 }}
          borderRadius={32}
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="text-base font-bold text-neutral-900" numberOfLines={1}>
            {doctor.name} {doctor.title}
          </Text>
          {doctor.visibleSpecialty ? (
            <Text className="text-[13px] text-neutral-500" numberOfLines={1}>
              {doctor.visibleSpecialty}
            </Text>
          ) : null}
          {hospital ? (
            <Text className="text-[13px] text-neutral-400" numberOfLines={1}>
              {hospital.name}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mb-3 flex-row flex-wrap gap-1.5">
        {doctor.isRecommended ? <Badge label="🌟 추천" tone="brand" /> : null}
        {doctor.isVerifiedSpecialist ? <Badge label="전문의" tone="brand" /> : null}
        {doctor.procedureIds.slice(0, 3).map((procedureId) => {
          const procedure = procedureMap.get(procedureId);
          return procedure ? <Badge key={procedureId} label={procedure.name} /> : null;
        })}
      </View>

      <View className="mb-3 flex-row items-center gap-3">
        <Text className="text-xs text-neutral-500">후기 {doctor.reviewCount}</Text>
        <Text className="text-xs text-neutral-500">상담 {doctor.consultCount}</Text>
        <Text className="text-xs text-neutral-500">
          ★ {doctor.rating === null ? '비공개' : doctor.rating.toFixed(1)}
        </Text>
      </View>

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          if (!hospital) return;

          // **어느 전문의를 지목했는지 실어 보낸다.** 예전에는 병원만 넘어가서 관리자가
          // 누구를 지목했는지 알 수 없었다 — 신청자가 메시지 칸에 직접 적어야 했다.
          const target = `/consult/${hospital.id}?doctorId=${encodeURIComponent(doctor.id)}`;

          requireAuth(() => router.push(target), target);
        }}
        disabled={!hospital?.consultAvailable}
        className={`items-center justify-center rounded-xl py-3 ${
          hospital?.consultAvailable ? 'bg-brand-600 active:bg-brand-700' : 'bg-neutral-200'
        }`}
      >
        <Text
          className={`text-sm font-semibold ${hospital?.consultAvailable ? 'text-white' : 'text-neutral-400'}`}
        >
          {hospital?.consultAvailable ? '상담신청' : '상담 마감'}
        </Text>
      </Pressable>
    </Pressable>
  );
}
