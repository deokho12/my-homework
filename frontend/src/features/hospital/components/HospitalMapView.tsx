import { router } from '@/navigation';
import { useState } from 'react';
import { Pressable, Text, View, cx } from '@/primitives';

import { Chip } from '@/components/Chip';
import { KakaoMap } from '@/components/map/KakaoMap';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { MAP_RADIUS_OPTIONS_KM } from '@/features/hospital/hooks/useExploreFilters';
import { useProcedureMap } from '@/features/procedure';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { LocationStatus } from '@/hooks/useUserLocation';
import type { Hospital } from '@/types/domain';
import { formatDistance } from '@/utils/geo';

function formatRadiusLabel(km: number): string {
  return km < 1 ? `${km * 1000}m` : `${km}km`;
}

interface HospitalMapViewProps {
  /**
   * 이미 서버가 반경(`radiusKm`)·다른 조건으로 걸러 정렬한 배열이다 — 여기서 다시
   * 거리로 거르거나 정렬하지 않는다. 각 항목의 `distanceKm` 도 서버가 채워 준다.
   */
  hospitals: Hospital[];
  location: { latitude: number; longitude: number };
  locationStatus: LocationStatus;
  radiusKm: number;
  onRadiusKmChange: (radiusKm: number) => void;
}

export function HospitalMapView({
  hospitals,
  location,
  locationStatus,
  radiusKm,
  onRadiusKmChange,
}: HospitalMapViewProps) {
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const requireAuth = useRequireAuth();
  const procedureMap = useProcedureMap();

  const selected = hospitals.find((hospital) => hospital.id === selectedHospitalId);

  return (
    <View className="flex-1">
      <View className={cx(CONTAINER_PADDING, 'border-b border-neutral-100 bg-white py-3')}>
        {locationStatus === 'denied' || locationStatus === 'error' ? (
          <Text className="mb-2 text-xs text-neutral-400">
            위치 권한을 확인할 수 없어 서울시청을 기준으로 보여드려요
          </Text>
        ) : null}
        <View className="flex-row flex-wrap">
          {MAP_RADIUS_OPTIONS_KM.map((km) => (
            <Chip
              key={km}
              label={formatRadiusLabel(km)}
              selected={radiusKm === km}
              onPress={() => onRadiusKmChange(km)}
            />
          ))}
        </View>
      </View>

      <View className="flex-1">
        <KakaoMap
          center={location}
          markers={hospitals.map((hospital) => ({
            id: hospital.id,
            latitude: hospital.latitude,
            longitude: hospital.longitude,
            label: hospital.name,
          }))}
          onMarkerPress={setSelectedHospitalId}
        />

        {hospitals.length === 0 ? (
          <View className="absolute inset-0 items-center justify-center px-8">
            <Text className="rounded-xl bg-white/95 px-4 py-3 text-center text-sm text-neutral-500">
              반경 {formatRadiusLabel(radiusKm)} 안에 병원이 없어요
            </Text>
          </View>
        ) : null}

        {selected ? (
          <Pressable
            onPress={() => router.push(`/hospital/${selected.id}`)}
            className="absolute inset-x-4 bottom-4 flex-row items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-4 shadow"
          >
            <View className="flex-1">
              <Text className="text-base font-bold text-neutral-900" numberOfLines={1}>
                {selected.name}
              </Text>
              <Text className="mb-1 text-xs text-neutral-500" numberOfLines={1}>
                {procedureMap.get(selected.procedureIds[0])?.name}
                {selected.distanceKm !== undefined ? ` · ${formatDistance(selected.distanceKm)}` : ''} · 후기{' '}
                {selected.reviewCount}
              </Text>
            </View>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                requireAuth(() => router.push(`/consult/${selected.id}`), `/consult/${selected.id}`);
              }}
              disabled={!selected.consultAvailable}
              className={`rounded-xl px-4 py-2.5 ${
                selected.consultAvailable ? 'bg-brand-600 active:bg-brand-700' : 'bg-neutral-200'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  selected.consultAvailable ? 'text-white' : 'text-neutral-400'
                }`}
              >
                상담신청
              </Text>
            </Pressable>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
