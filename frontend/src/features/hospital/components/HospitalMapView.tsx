import { router } from '@/navigation';
import { useMemo, useState } from 'react';
import { Pressable, Text, View, cx } from '@/primitives';

import { Chip } from '@/components/Chip';
import { KakaoMap } from '@/components/map/KakaoMap';
// 정적 마스터 데이터. features/procedure(또는 content) 가 생기면 그쪽으로 옮긴다 (Task 11).
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { getProcedureById } from '@/mocks/fixtures/procedures';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useUserLocation } from '@/hooks/useUserLocation';
import type { Hospital } from '@/types/domain';
import { distanceKm, formatDistance } from '@/utils/geo';

const RADIUS_OPTIONS_KM = [0.5, 1, 3, 5];

function formatRadiusLabel(km: number): string {
  return km < 1 ? `${km * 1000}m` : `${km}km`;
}

interface HospitalMapViewProps {
  hospitals: Hospital[];
}

export function HospitalMapView({ hospitals }: HospitalMapViewProps) {
  const { location, status } = useUserLocation();
  const [radiusKm, setRadiusKm] = useState(3);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const requireAuth = useRequireAuth();

  const nearbyHospitals = useMemo(() => {
    return hospitals
      .map((hospital) => ({
        hospital,
        distance: distanceKm(location, { latitude: hospital.latitude, longitude: hospital.longitude }),
      }))
      .filter((item) => item.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [hospitals, location, radiusKm]);

  const selected = nearbyHospitals.find((item) => item.hospital.id === selectedHospitalId);

  return (
    <View className="flex-1">
      <View className={cx(CONTAINER_PADDING, 'border-b border-neutral-100 bg-white py-3')}>
        {status === 'denied' || status === 'error' ? (
          <Text className="mb-2 text-xs text-neutral-400">
            위치 권한을 확인할 수 없어 서울시청을 기준으로 보여드려요
          </Text>
        ) : null}
        <View className="flex-row flex-wrap">
          {RADIUS_OPTIONS_KM.map((km) => (
            <Chip
              key={km}
              label={formatRadiusLabel(km)}
              selected={radiusKm === km}
              onPress={() => setRadiusKm(km)}
            />
          ))}
        </View>
      </View>

      <View className="flex-1">
        <KakaoMap
          center={location}
          markers={nearbyHospitals.map(({ hospital }) => ({
            id: hospital.id,
            latitude: hospital.latitude,
            longitude: hospital.longitude,
            label: hospital.name,
          }))}
          onMarkerPress={setSelectedHospitalId}
        />

        {nearbyHospitals.length === 0 ? (
          <View className="absolute inset-0 items-center justify-center px-8">
            <Text className="rounded-xl bg-white/95 px-4 py-3 text-center text-sm text-neutral-500">
              반경 {formatRadiusLabel(radiusKm)} 안에 병원이 없어요
            </Text>
          </View>
        ) : null}

        {selected ? (
          <Pressable
            onPress={() => router.push(`/hospital/${selected.hospital.id}`)}
            className="absolute inset-x-4 bottom-4 flex-row items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-4 shadow"
          >
            <View className="flex-1">
              <Text className="text-base font-bold text-neutral-900" numberOfLines={1}>
                {selected.hospital.name}
              </Text>
              <Text className="mb-1 text-xs text-neutral-500" numberOfLines={1}>
                {getProcedureById(selected.hospital.procedureIds[0])?.name} · {formatDistance(selected.distance)} ·
                후기 {selected.hospital.reviewCount}
              </Text>
            </View>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                requireAuth(
                  () => router.push(`/consult/${selected.hospital.id}`),
                  `/consult/${selected.hospital.id}`
                );
              }}
              disabled={!selected.hospital.consultAvailable}
              className={`rounded-xl px-4 py-2.5 ${
                selected.hospital.consultAvailable ? 'bg-brand-600 active:bg-brand-700' : 'bg-neutral-200'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  selected.hospital.consultAvailable ? 'text-white' : 'text-neutral-400'
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
