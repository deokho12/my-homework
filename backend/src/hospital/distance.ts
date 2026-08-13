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
 * 경도 1도의 거리는 위도에 따라 줄어들므로 `cos(latitude)` 로 나눈다. 극지방에서
 * `cos` 가 0에 가까워지는 것은 하한을 두어 막는다 (한국 위도에서는 발생하지 않지만,
 * 0으로 나누면 상자가 무한대가 되어 필터가 사라진다).
 */
export function boundingBox(center: Coordinate, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.max(0.01, Math.cos(toRadians(center.latitude)));
  const lonDelta = radiusKm / (111.32 * cosLat);

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLon: center.longitude - lonDelta,
    maxLon: center.longitude + lonDelta,
  };
}
