import { describe, expect, it } from 'vitest';

import { distanceKm, formatDistance } from '@/utils/geo';

/**
 * 이 파일이 고정하는 것은 **두 구현의 일치**다.
 *
 * 기대값은 서버 `backend/src/hospital/distance.ts` 의 `haversineKm` 을 그대로 실행해 얻은
 * 숫자다 (Node 24, 2026-10-13). 패키지가 달라 서버 함수를 import 할 수 없으므로 값을
 * 옮겨 적는다 — 목록 카드의 거리(화면 계산)와 지도 카드의 거리(서버 계산)가 같은 병원에서
 * 다른 숫자를 말하면 사용자는 둘 중 어느 쪽도 믿지 않게 된다.
 *
 * 값을 다시 뽑으려면:
 *   node -e "const {haversineKm}=require('./dist/hospital/distance'); console.log(haversineKm(a,b))"
 */
describe('distanceKm — 서버 haversineKm 과 같은 값', () => {
  const SEOUL_CITY_HALL = { latitude: 37.5665, longitude: 126.978 };

  const cases: { name: string; a: typeof SEOUL_CITY_HALL; b: typeof SEOUL_CITY_HALL; expected: number }[] = [
    {
      name: '서울시청 → 강남역',
      a: SEOUL_CITY_HALL,
      b: { latitude: 37.4979, longitude: 127.0276 },
      expected: 8.792890880750395,
    },
    {
      name: '같은 점',
      a: SEOUL_CITY_HALL,
      b: SEOUL_CITY_HALL,
      expected: 0,
    },
    {
      name: '1km 남짓 (위도만 0.009도)',
      a: SEOUL_CITY_HALL,
      b: { latitude: 37.5755, longitude: 126.978 },
      expected: 1.0007543398010665,
    },
    {
      name: '서울시청 → 부산시청 (100km 이상)',
      a: SEOUL_CITY_HALL,
      b: { latitude: 35.1796, longitude: 129.0756 },
      expected: 325.1112588497622,
    },
    {
      // `h` 가 정확히 1 이 되는 지점 — 지구 둘레의 절반(약 20015km)이 나와야 한다.
      name: '지구 반대편',
      a: SEOUL_CITY_HALL,
      b: { latitude: -37.5665, longitude: -53.022 },
      expected: 20015.086796020572,
    },
  ];

  for (const { name, a, b, expected } of cases) {
    it(name, () => {
      expect(distanceKm(a, b)).toBeCloseTo(expected, 9);
    });
  }

  it('대척점 근처에서도 NaN 이 되지 않는다 (클램프)', () => {
    // 부동소수 오차로 `h` 가 1 을 넘는 좌표들(h = 1 + 1ulp). 이 값들은 `Math.sqrt` 가 다시
    // 1 로 내려 주어 클램프가 없어도 유한하지만, 서버와 **같은 식**이라는 사실을 함께 고정한다
    // — 클램프를 지우는 변경이 들어오면 두 구현이 조용히 갈린다.
    const pairs = [
      [
        { latitude: -80.48689905987531, longitude: -27.41528392743558 },
        { latitude: 80.48689905987531, longitude: 152.58471607256442 },
      ],
      [
        { latitude: 8.732710091999394, longitude: -174.9250517731265 },
        { latitude: -8.732710091999394, longitude: 5.074948226873488 },
      ],
    ] as const;

    for (const [a, b] of pairs) {
      expect(Number.isFinite(distanceKm(a, b))).toBe(true);
    }
  });
});

/**
 * 표기 규칙의 유일한 출처. 목록 카드(`HospitalExploreCard`)와 지도 아래 카드
 * (`HospitalMapView`)가 **같은 함수**를 쓰므로, 여기서 갈라지면 두 화면이 조용히 어긋난다.
 */
describe('formatDistance', () => {
  it('100m 미만은 "0.1km 이내" 다 — 0.0km 는 고장으로 보인다', () => {
    expect(formatDistance(0.04)).toBe('0.1km 이내');
    expect(formatDistance(0)).toBe('0.1km 이내');
  });

  it('1km 미만도 km 로 쓴다 (400m 가 아니라 0.4km)', () => {
    expect(formatDistance(0.4)).toBe('0.4km');
  });

  it('100km 미만은 소수점 한 자리다', () => {
    expect(formatDistance(2.34)).toBe('2.3km');
  });

  it('100km 이상은 소수점을 버린다 — 뜻 없는 정밀도다', () => {
    expect(formatDistance(123.4)).toBe('123km');
    expect(formatDistance(100)).toBe('100km');
  });
});
