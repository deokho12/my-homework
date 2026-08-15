import { Injectable } from '@nestjs/common';

import type { ApiErrorCode } from '../../common/errors/api-error';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../../prisma/prisma.service';
import type { HospitalScopeResource } from '../decorators/hospital-scope.decorator';

/** 자원 종류별 규칙 한 줄 요약. 가드가 이 표만 보고 응답 코드를 정한다. */
interface ResourceRule {
  /** 경로 파라미터 기본 이름 (openapi components.parameters 와 같은 이름) */
  param: string;
  /** 자원이 없을 때의 코드 */
  notFound: ApiErrorCode;
  /**
   * 담당 병원이 아닐 때의 코드.
   * 공개 자원은 `403 HOSPITAL_NOT_MANAGED`, 비공개 자원은 `404`(존재를 숨긴다).
   */
  notManaged: ApiErrorCode;
}

export const RESOURCE_RULES: Record<HospitalScopeResource, ResourceRule> = {
  hospital: {
    param: 'hospitalId',
    notFound: 'HOSPITAL_NOT_FOUND',
    notManaged: 'HOSPITAL_NOT_MANAGED',
  },
  doctor: {
    param: 'doctorId',
    notFound: 'DOCTOR_NOT_FOUND',
    notManaged: 'HOSPITAL_NOT_MANAGED',
  },
  consultRequest: {
    param: 'consultRequestId',
    // 없는 상담과 남의 병원 상담을 **같은 코드**로 낸다. 이 동치가 열거 방지의 핵심이다.
    notFound: 'CONSULT_REQUEST_NOT_FOUND',
    notManaged: 'CONSULT_REQUEST_NOT_FOUND',
  },
};

/**
 * "이 자원은 어느 병원의 것인가" 를 푸는 조회.
 *
 * 담당 범위 검사에는 자원 → 병원 매핑이 필요하고, 그 매핑은 자원마다 다르다
 * (병원은 자기 자신, 전문의는 `doctors.hospital_id`, 상담은 `consult_requests.hospital_id`).
 * 도메인 서비스가 각자 이 조회를 반복하면 한 곳만 빠뜨려도 인가가 뚫리므로 여기 모은다.
 *
 * soft delete 된 자원(`deleted_at`)은 **없는 것으로 본다.** 삭제된 병원을 담당자가
 * 계속 수정할 수 있으면 안 된다.
 */
@Injectable()
export class ResourceScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async findOwningHospitalId(resource: HospitalScopeResource, id: string): Promise<string | null> {
    switch (resource) {
      case 'hospital': {
        const row = await this.prisma.hospital.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        });

        return row?.id ?? null;
      }
      case 'doctor': {
        const row = await this.prisma.doctor.findFirst({
          where: { id, deletedAt: null },
          select: { hospitalId: true },
        });

        return row?.hospitalId ?? null;
      }
      case 'consultRequest': {
        // consult_requests 에는 soft delete 컬럼이 없다 (스키마 확인)
        const row = await this.prisma.consultRequest.findUnique({
          where: { id },
          select: { hospitalId: true },
        });

        return row?.hospitalId ?? null;
      }
    }
  }
}
