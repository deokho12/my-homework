import { mockDb } from '@/mocks/db';
import { delay } from '@/mocks/latency';
import type { Hospital } from '@/types/domain';

// 실제 백엔드가 생기면 이 파일 내부만 HTTP 호출로 바꾼다.
// 시그니처는 유지되므로 훅과 페이지는 손대지 않는다.

export async function fetchHospitals(): Promise<Hospital[]> {
  await delay();
  return mockDb.read('hospitals');
}

export async function fetchHospitalById(id: string): Promise<Hospital | null> {
  await delay();
  return mockDb.read('hospitals').find((hospital) => hospital.id === id) ?? null;
}

export async function createHospital(hospital: Hospital): Promise<Hospital> {
  await delay();
  mockDb.write('hospitals', [...mockDb.read('hospitals'), hospital]);
  return hospital;
}

export async function updateHospital(id: string, patch: Partial<Hospital>): Promise<Hospital> {
  await delay();

  const rows = mockDb.read('hospitals');
  const index = rows.findIndex((hospital) => hospital.id === id);

  if (index === -1) throw new Error(`병원을 찾을 수 없어요: ${id}`);

  const updated = { ...rows[index], ...patch };
  // Array.prototype.with 은 ES2023 이고 이 프로젝트의 tsconfig lib 은 ES2022 다 — 쓰지 않는다.
  const next = [...rows];
  next[index] = updated;
  mockDb.write('hospitals', next);

  return updated;
}
