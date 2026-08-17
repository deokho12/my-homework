import type { AdminConsultListResponse } from '@/features/consult/api/consultApi';
import type { ConsultRequest, MyConsultRequest, Paged } from '@/types/domain';

/**
 * 상담 테스트 fixture.
 *
 * 관리자 시야와 신청자 시야가 **다른 타입**이라 만드는 함수도 둘이다 — 하나로 두면
 * "신청자 응답에 memos 가 없다" 를 테스트가 표현할 수 없다.
 */

export function baseConsultRequest(overrides: Partial<ConsultRequest> = {}): ConsultRequest {
  return {
    id: 'cr1',
    hospitalId: 'h1',
    hospitalName: '강남 스마일 치과',
    doctorId: null,
    doctorName: null,
    procedureId: null,
    procedureName: null,
    name: '홍길동',
    phone: '010-1234-5678',
    piiMasked: false,
    preferredTime: '평일 오전',
    message: '',
    createdAt: '2026-08-16T00:00:00.000Z',
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: '2026-08-16T00:00:00.000Z' }],
    memos: [],
    ...overrides,
  };
}

export function baseMyConsultRequest(overrides: Partial<MyConsultRequest> = {}): MyConsultRequest {
  return {
    id: 'cr1',
    hospitalId: 'h1',
    hospitalName: '강남 스마일 치과',
    hospitalThumbnail: '',
    doctorId: null,
    doctorName: null,
    procedureId: null,
    procedureName: null,
    name: '홍길동',
    phone: '010-1234-5678',
    preferredTime: '평일 오전',
    message: '',
    createdAt: '2026-08-16T00:00:00.000Z',
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: '2026-08-16T00:00:00.000Z' }],
    ...overrides,
  };
}

export function consultPage(
  items: ConsultRequest[],
  scope: 'managed' | 'all' = 'managed'
): AdminConsultListResponse {
  return {
    items,
    meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: items.length === 0 ? 0 : 1 },
    scope,
  };
}

export function myConsultPage(items: MyConsultRequest[]): Paged<MyConsultRequest> {
  return {
    items,
    meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: items.length === 0 ? 0 : 1 },
  };
}
