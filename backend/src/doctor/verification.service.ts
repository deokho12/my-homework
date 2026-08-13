import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { ApiError } from '../common/errors/api-error';
import { buildPageMeta, paginate } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
import { GENERAL_PRACTITIONER, projectDoctorAdmin } from './doctor.projection';
import type { DoctorAdminResponse } from './doctor.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DoctorRepository } from './doctor.repository';
import type { DecideVerificationDto, VerificationQueueQuery } from './doctor.schemas';

export interface VerificationQueueResult {
  items: DoctorAdminResponse[];
  meta: PageMeta;
}

/**
 * 검수 큐 정렬 우선순위(계약: `대기 → 반려 → 승인`). 같은 순위 안에서는 `findVerificationQueue`
 * 가 이미 등록순(`createdAt asc`, `id` tiebreaker)으로 준 순서를 유지한다 — `Array.prototype.sort`
 * 는 안정 정렬이라, 순위만으로 비교해도 동순위 항목의 원래 순서가 바뀌지 않는다.
 */
const STATUS_RANK: Record<string, number> = { pending: 0, rejected: 1, approved: 2 };

/**
 * 전문의 인증 검수. `operator` 전용 — `/admin/specialists` 는 모든 병원의 전문의를 심사하는
 * 화면이라 병원 담당자에게 열면 남의 병원 전문의를 심사하거나 자기 병원 전문의를 스스로
 * 승인하게 된다 (역할 분리 결정 1, `doctor.controller.ts` 인가 참고).
 *
 * 큐 조회(`listQueue`)와 결정(`decide`)은 책임이 달라 한 파일에 두더라도 메서드를 나눈다.
 */
@Injectable()
export class VerificationService {
  constructor(private readonly doctors: DoctorRepository) {}

  /**
   * `GET /doctors/verification-queue`. 상태 우선순위 정렬이 컬럼 간 비교라 SQL `ORDER BY` 로
   * 표현할 수 없어, `verifiedSpecialist=true`(`DoctorService.list`)와 같은 방식으로 페이징
   * 없이 전부 읽고 앱에서 정렬·페이징한다 — 이 목록이 병원 전체 목록만큼 커지기 전까지는
   * 이 방식이 SQLite 이식성 규칙(raw SQL 금지)을 지키면서 가장 단순하다.
   */
  async listQueue(query: VerificationQueueQuery): Promise<VerificationQueueResult> {
    const where = buildQueueWhere(query);
    const rows = await this.doctors.findVerificationQueue(where);
    const sorted = [...rows].sort((a, b) => STATUS_RANK[a.verificationStatus] - STATUS_RANK[b.verificationStatus]);

    const page = paginate(sorted, { page: query.page, pageSize: query.pageSize });

    return {
      items: page.map((row) => projectDoctorAdmin(row, { hospitalName: row.hospital.name })),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems: sorted.length }),
    };
  }

  /**
   * `PUT /doctors/:doctorId/verification`. 존재 확인은 여기서 하고 `404 DOCTOR_NOT_FOUND` 를
   * 던진다 — `@HospitalScope` 를 쓰지 않는다(`operator` 전용이라 담당 범위 개념이 없다).
   * 트랜잭션 자체(스칼라 갱신·검수 이력·알림)는 `DoctorRepository.decide` 가 한다 — 이
   * 메서드는 파생값(`verifiedSpecialty`/`rejectionReason`/알림 문구)만 계산해 넘긴다.
   */
  async decide(doctorId: string, dto: DecideVerificationDto, reviewedByUserId: string): Promise<DoctorAdminResponse> {
    const doctor = await this.doctors.findById(doctorId);

    if (doctor === null) {
      throw new ApiError('DOCTOR_NOT_FOUND');
    }

    const { title: notificationTitle, message: notificationMessage } = buildNotificationText(dto, doctor.name);

    await this.doctors.decide({
      doctorId,
      status: dto.status,
      // approved 면 지금 specialty 를 새긴다 — 나중에 specialty 가 바뀌어 이 값과 갈리면
      // 배지 자격을 잃는 근거가 된다 (Task 7, `doctor.projection.ts` 의 `isVerifiedSpecialist`).
      verifiedSpecialty: dto.status === 'approved' ? doctor.specialty : null,
      rejectionReason: dto.status === 'rejected' ? dto.rejectionReason ?? null : null,
      submittedSpecialty: doctor.specialty,
      submittedCertificateUrl: doctor.certificateUrl,
      reviewedByUserId,
      hospitalId: doctor.hospitalId,
      notificationTitle,
      notificationMessage,
    });

    const updated = await this.doctors.findById(doctorId);

    if (updated === null) {
      throw new ApiError('DOCTOR_NOT_FOUND');
    }

    return projectDoctorAdmin(updated);
  }
}

function buildQueueWhere(query: VerificationQueueQuery): Prisma.DoctorWhereInput {
  const where: Prisma.DoctorWhereInput = { deletedAt: null };

  if (query.status !== undefined) where.verificationStatus = query.status;

  // `일반의` 는 자격증이 없고 승인/반려가 사용자 화면 표시를 바꾸지 않는다 — 기본 제외.
  if (query.includeGeneralPractitioners !== true) where.specialty = { not: GENERAL_PRACTITIONER };

  return where;
}

/** 알림 문구. 병원 담당자 화면에 그대로 보이는 사용자 문구다. */
function buildNotificationText(
  dto: DecideVerificationDto,
  doctorName: string
): { title: string; message: string } {
  if (dto.status === 'approved') {
    return {
      title: '전문의 인증이 승인되었어요',
      message: `${doctorName} 전문의의 인증이 승인되었어요.`,
    };
  }

  return {
    title: '전문의 인증이 반려되었어요',
    message: `${doctorName} 전문의의 인증이 반려되었어요. 사유: ${dto.rejectionReason ?? ''}`,
  };
}
