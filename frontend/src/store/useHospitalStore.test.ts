import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from '@/app/providers';
import { fetchHospitalById } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';
import { mockDb } from '@/mocks/db';
import type { Hospital } from '@/types/domain';
import { getHospitalById, useHospitalStore } from '@/store/useHospitalStore';

function makeHospital(id: string, name: string): Hospital {
  return {
    id,
    name,
    specialty: '치과',
    region: '서울',
    latitude: 37.5,
    longitude: 127,
    thumbnail: 'https://example.test/thumb.jpg',
    images: ['https://example.test/thumb.jpg'],
    procedureIds: ['implant'],
    priceRange: { min: 100_000, max: 200_000 },
    rating: 0,
    reviewCount: 0,
    consultCount: 0,
    consultAvailable: true,
    businessHours: [],
    directions: '',
    features: {
      coordinator: false,
      painlessAnesthesia: false,
      digitalCare: false,
      parking: false,
      nightConsult: false,
      cctv: false,
    },
    isOneDay: false,
    isRecommended: false,
    isSponsored: false,
    sponsoredCategories: [],
    sponsoredRank: null,
    sponsoredStartDate: null,
    sponsoredEndDate: null,
    tags: [],
    address: '서울시 강남구',
    introduction: '',
    events: [],
  };
}

describe('useHospitalStore', () => {
  beforeEach(() => {
    // setup.ts 가 localStorage 를 비운다. 목 DB 의 메모리 캐시와 스토어 상태도
    // 같은 출처(seed)로 되돌려야 앞 테스트가 남긴 값이 새지 않는다.
    mockDb.reset();
    useHospitalStore.setState({ hospitals: mockDb.read('hospitals') });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updateHospital 이 mockDb 에 반영된다', () => {
    const target = mockDb.read('hospitals')[0];

    useHospitalStore.getState().updateHospital(target.id, { name: '이름바꾼치과' });

    const row = mockDb.read('hospitals').find((hospital) => hospital.id === target.id);
    expect(row?.name).toBe('이름바꾼치과');
  });

  it('updateHospital 뒤 fetchHospitalById 가 새 값을 돌려준다', async () => {
    const target = mockDb.read('hospitals')[0];

    useHospitalStore.getState().updateHospital(target.id, { name: '수정된치과' });

    await expect(fetchHospitalById(target.id)).resolves.toMatchObject({ name: '수정된치과' });
  });

  it('addHospital 뒤 fetchHospitalById 가 새 병원을 찾는다', async () => {
    useHospitalStore.getState().addHospital(makeHospital('h-new-1', '새로등록한치과'));

    await expect(fetchHospitalById('h-new-1')).resolves.toMatchObject({ name: '새로등록한치과' });
  });

  it('addHospital 이 스토어의 hospitals 에도 반영된다', () => {
    const before = useHospitalStore.getState().hospitals.length;

    useHospitalStore.getState().addHospital(makeHospital('h-new-2', '두번째치과'));

    expect(useHospitalStore.getState().hospitals).toHaveLength(before + 1);
    expect(getHospitalById('h-new-2')?.name).toBe('두번째치과');
  });

  it('updateHospital 이 스토어의 hospitals 에도 반영된다', () => {
    const target = useHospitalStore.getState().hospitals[0];

    useHospitalStore.getState().updateHospital(target.id, { name: '스토어도바뀐치과' });

    expect(getHospitalById(target.id)?.name).toBe('스토어도바뀐치과');
  });

  it('없는 id 로 updateHospital 하면 던지지 않고 목록이 그대로다', () => {
    const before = mockDb.read('hospitals');

    expect(() =>
      useHospitalStore.getState().updateHospital('no-such-id', { name: '유령치과' })
    ).not.toThrow();

    expect(mockDb.read('hospitals')).toHaveLength(before.length);
    expect(useHospitalStore.getState().hospitals).toHaveLength(before.length);
  });

  // 상세 화면은 useQuery 로 읽으므로, 캐시를 깨지 않으면 수정 결과가 화면에 나타나지 않는다.
  it('addHospital 이 병원 쿼리 캐시를 무효화한다', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    useHospitalStore.getState().addHospital(makeHospital('h-inv-1', '무효화치과'));

    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.hospitals.all });
  });

  it('updateHospital 이 병원 쿼리 캐시를 무효화한다', () => {
    const target = mockDb.read('hospitals')[0];
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    useHospitalStore.getState().updateHospital(target.id, { name: '무효화된치과' });

    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.hospitals.all });
  });

  it('없는 id 면 캐시를 무효화하지 않는다', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    useHospitalStore.getState().updateHospital('no-such-id', { name: '유령치과' });

    expect(spy).not.toHaveBeenCalled();
  });
});
