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
});
