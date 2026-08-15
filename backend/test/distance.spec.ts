import { describe, expect, it } from 'vitest';

import { boundingBox, haversineKm } from '../src/hospital/distance';

const GANGNAM = { latitude: 37.4979, longitude: 127.0276 };
const SEOUL_STATION = { latitude: 37.5547, longitude: 126.9707 };

describe('haversineKm', () => {
  it('같은 좌표는 0 이다', () => {
    expect(haversineKm(GANGNAM, GANGNAM)).toBe(0);
  });

  it('강남역 ↔ 서울역은 약 8.2km 다', () => {
    expect(haversineKm(GANGNAM, SEOUL_STATION)).toBeCloseTo(8.2, 0);
  });

  it('대칭이다', () => {
    expect(haversineKm(GANGNAM, SEOUL_STATION)).toBeCloseTo(haversineKm(SEOUL_STATION, GANGNAM), 6);
  });
});

describe('boundingBox', () => {
  it('반경 안의 점을 반드시 포함한다 (상위집합이어야 한다)', () => {
    const box = boundingBox(GANGNAM, 10);

    expect(SEOUL_STATION.latitude).toBeGreaterThanOrEqual(box.minLat);
    expect(SEOUL_STATION.latitude).toBeLessThanOrEqual(box.maxLat);
    expect(SEOUL_STATION.longitude).toBeGreaterThanOrEqual(box.minLon);
    expect(SEOUL_STATION.longitude).toBeLessThanOrEqual(box.maxLon);
  });

  it('반경이 커지면 상자도 커진다', () => {
    const small = boundingBox(GANGNAM, 0.5);
    const large = boundingBox(GANGNAM, 5);

    expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat);
  });

  it('중심을 포함한다', () => {
    const box = boundingBox(GANGNAM, 0.5);

    expect(GANGNAM.latitude).toBeGreaterThanOrEqual(box.minLat);
    expect(GANGNAM.latitude).toBeLessThanOrEqual(box.maxLat);
  });

  it('반경 경계에 정확히 걸친 정북 지점을 상자가 포함한다', () => {
    const center = { latitude: 37.4979, longitude: 127.0276 };
    const radiusKm = 10;
    const box = boundingBox(center, radiusKm);

    // 정북으로 정확히 radiusKm 떨어진 점을 이분법으로 찾는다
    let lo = center.latitude;
    let hi = center.latitude + 1;
    for (let i = 0; i < 60; i += 1) {
      const mid = (lo + hi) / 2;
      if (haversineKm(center, { latitude: mid, longitude: center.longitude }) < radiusKm) lo = mid;
      else hi = mid;
    }
    const dueNorth = { latitude: lo, longitude: center.longitude };

    expect(haversineKm(center, dueNorth)).toBeCloseTo(radiusKm, 3);
    expect(dueNorth.latitude).toBeLessThanOrEqual(box.maxLat);
  });

  it('반경 경계에 정확히 걸친 정동 지점을 상자가 포함한다', () => {
    const center = { latitude: 37.4979, longitude: 127.0276 };
    const radiusKm = 10;
    const box = boundingBox(center, radiusKm);

    let lo = center.longitude;
    let hi = center.longitude + 1;
    for (let i = 0; i < 60; i += 1) {
      const mid = (lo + hi) / 2;
      if (haversineKm(center, { latitude: center.latitude, longitude: mid }) < radiusKm) lo = mid;
      else hi = mid;
    }
    const dueEast = { latitude: center.latitude, longitude: lo };

    expect(haversineKm(center, dueEast)).toBeCloseTo(radiusKm, 3);
    expect(dueEast.longitude).toBeLessThanOrEqual(box.maxLon);
  });
});
