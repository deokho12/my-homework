import { beforeEach, describe, expect, it } from 'vitest';

import {
  createHospital,
  fetchHospitalById,
  fetchHospitals,
  updateHospital,
} from '@/features/hospital/api/hospitalApi';
import { mockDb } from '@/mocks/db';
import type { Hospital } from '@/types/domain';

describe('hospitalApi', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it('fetchHospitals 는 목 DB 의 전체 목록을 준다', async () => {
    await expect(fetchHospitals()).resolves.toHaveLength(mockDb.read('hospitals').length);
  });

  it('updateHospital 이 쓴 값을 fetchHospitalById 가 읽는다', async () => {
    const target = mockDb.read('hospitals')[0];

    await updateHospital(target.id, { name: '수정된치과' });

    const reread = await fetchHospitalById(target.id);
    expect(reread?.name).toBe('수정된치과');
  });

  it('updateHospital 은 다른 병원을 건드리지 않는다', async () => {
    const [first, second] = mockDb.read('hospitals');

    await updateHospital(first.id, { name: '수정된치과' });

    const other = await fetchHospitalById(second.id);
    expect(other?.name).toBe(second.name);
  });

  it('없는 id 를 수정하면 던진다', async () => {
    await expect(updateHospital('no-such-id', { name: 'x' })).rejects.toThrow(
      '병원을 찾을 수 없어요: no-such-id'
    );
  });

  it('createHospital 이 목록 길이를 늘린다', async () => {
    const before = mockDb.read('hospitals').length;
    const seed = mockDb.read('hospitals')[0];

    await createHospital({ ...seed, id: 'new-hospital', name: '새로등록한치과' } as Hospital);

    const after = await fetchHospitals();
    expect(after).toHaveLength(before + 1);
    expect(after.find((hospital) => hospital.id === 'new-hospital')?.name).toBe('새로등록한치과');
  });
});
