import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { DOCTOR_INCLUDE } from './doctor.projection';
import type { DoctorRow } from './doctor.projection';
import type { SortField } from '../hospital/hospital.schemas';

export interface FindManyOptions {
  sort: SortField;
  skip: number;
  take: number;
}

@Injectable()
export class DoctorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `GET /doctors` 는 스폰서 정렬이 없어 Prisma `skip`/`take` 를 그대로 쓴다
   * (병원 목록과 의도적으로 다르다 — `hospital.repository.ts` 주석 참고).
   */
  async findMany(where: Prisma.DoctorWhereInput, options: FindManyOptions): Promise<DoctorRow[]> {
    return this.prisma.doctor.findMany({
      where,
      include: DOCTOR_INCLUDE,
      orderBy: [{ [options.sort]: 'desc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  /**
   * 페이징 없이 전부 읽는다. `verifiedSpecialist=true` 일 때만 쓴다 — 앱에서
   * `isVerifiedSpecialist` 로 정제하면 `count(where)` 가 틀리므로, 병원 목록과 같은 방식으로
   * 전부 읽고 앱에서 정제·페이징한다 (서비스 주석 참고).
   */
  async findAllSorted(where: Prisma.DoctorWhereInput, sort: SortField): Promise<DoctorRow[]> {
    return this.prisma.doctor.findMany({
      where,
      include: DOCTOR_INCLUDE,
      orderBy: [{ [sort]: 'desc' }, { id: 'asc' }],
    });
  }

  async count(where: Prisma.DoctorWhereInput): Promise<number> {
    return this.prisma.doctor.count({ where });
  }

  async findById(id: string): Promise<DoctorRow | null> {
    return this.prisma.doctor.findFirst({
      where: { id, deletedAt: null },
      include: DOCTOR_INCLUDE,
    });
  }

  async findByHospital(hospitalId: string): Promise<DoctorRow[]> {
    return this.prisma.doctor.findMany({
      where: { hospitalId, deletedAt: null },
      include: DOCTOR_INCLUDE,
      orderBy: { id: 'asc' },
    });
  }
}
