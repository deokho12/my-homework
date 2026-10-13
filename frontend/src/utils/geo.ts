/**
 * 화면이 쓰는 거리 계산·표기.
 *
 * 이 파일의 `distanceKm` 은 `backend/src/hospital/distance.ts` 의 `haversineKm` 과
 * **같은 값을 내야 한다** — 목록 카드는 이 함수로 계산한 거리를, 지도 아래 카드는 서버가
 * 계산한 거리를 보여주기 때문이다. 서버가 반경 없이도 `distanceKm` 을 내려주게 되면
 * 화면 계산은 지운다 (`geo.test.ts` 가 두 구현의 일치를 고정한다).
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometers. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  // `Math.min(1, …)` 은 서버 `haversineKm` 과 **글자까지 같은 줄**이다. 대척점 근처에서 h 가
  // 1 을 넘어 `√h` 까지 1 을 넘기면 `asin` 이 NaN 을 내는데, 그 방어를 한쪽만 두면 두 구현이
  // 갈린다. (실제로는 `Math.sqrt` 가 1 로 내려 주는 경우가 대부분이라 평소엔 아무 일도 안 한다.)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 거리 표기의 유일한 출처 — 목록 카드와 지도 아래 카드가 함께 쓴다.
 *
 * `0.0km` 는 고장으로 보여서 100m 미만은 "0.1km 이내" 한 문구로 말하고,
 * 100km 이상에서 소수점 한 자리는 뜻 없는 정밀도라 버린다.
 */
export function formatDistance(km: number): string {
  if (km < 0.1) return '0.1km 이내';
  if (km < 100) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}
