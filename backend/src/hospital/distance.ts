/**
 * 지도 반경 필터의 거리 계산.
 *
 * **DB 함수를 쓰지 않는다.** SQLite 에는 PostGIS 대응물이 없고, `$queryRaw` 는 이식성
 * 규칙이 금지한다 (docs/database/README.md §3.8). 같은 문서가 "병원이 수천 곳이 되기
 * 전까지는 앱 계산을 유지하고 PostGIS 는 PostgreSQL 이전 이후에 도입한다" 고 못 박았다.
 * 현재 병원은 11곳이다.
 *
 * 순서: `boundingBox` 로 SQL 에서 후보를 좁히고(단순 부등호라 인덱스를 탄다),
 * 좁혀진 후보에만 `haversineKm` 을 적용한다.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;
/** 자오선 1도의 최단 길이(km, 적도). 분모를 최솟값으로 두면 latDelta 가 항상 필요분 이상이 된다. */
const MIN_KM_PER_DEGREE_LATITUDE = 110.574;
/** 적도에서 경도 1도의 길이(km). 실제 길이는 cos(위도)를 곱한 값이다. */
const KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.32;
/** 부동소수 오차와 근사식 오차를 흡수하는 여유. 상자는 크게 틀려도 안전하고 작게 틀리면 결과가 사라진다. */
const BOUNDING_BOX_SAFETY = 1.01;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 두 좌표 사이의 대권 거리(km). */
export function haversineKm(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * 반경을 감싸는 위경도 사각형. **반드시 상위집합이어야 한다** — 상자가 반경보다 작으면
 * 실제로 반경 안에 있는 병원이 SQL 단계에서 탈락해 영원히 보이지 않는다.
 *
 * 위도: 자오선 거리는 모든 위도에서 일정하므로 (111 km/도), 최솟값 분모(110.574)와
 * 안전계수를 쓰면 latDelta 가 항상 필요분 이상이 된다.
 *
 * 경도: 1도의 거리는 cos(latitude)에 비례해 줄어든다. 상자 안에서 극쪽 가장자리
 * (위도가 가장 높은 점)일 때가 가장 짧으므로, 그 위도를 기준으로 lonDelta 를 계산한다.
 * 극지방의 하한(0.01)은 0으로 나누기를 방지하지만, 그 한도에 도달하는 위도는
 * 한국 데이터셋에서 발생하지 않는다.
 */
export function boundingBox(center: Coordinate, radiusKm: number): BoundingBox {
  const latDelta = (BOUNDING_BOX_SAFETY * radiusKm) / MIN_KM_PER_DEGREE_LATITUDE;
  const worstCaseLat = Math.abs(center.latitude) + latDelta;
  const cosLat = Math.max(0.01, Math.cos(toRadians(worstCaseLat)));
  const lonDelta = (BOUNDING_BOX_SAFETY * radiusKm) / (KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * cosLat);

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLon: center.longitude - lonDelta,
    maxLon: center.longitude + lonDelta,
  };
}
