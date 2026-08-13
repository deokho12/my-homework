import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { HOSPITAL_INCLUDE } from './hospital.projection';
import type { HospitalRow } from './hospital.projection';

@Injectable()
export class HospitalRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 필터에 맞는 병원을 **전부** 읽는다. `skip`/`take` 를 쓰지 않는 이유는
   * 광고 우선 노출이 전역 재정렬이라 페이징 후에 적용할 수 없기 때문이다
   * (계획 Task 6 의 판단 절 참고). 병원 수가 수천이 되면 이 구조를 바꿔야 한다.
   */
  async findMany(where: Prisma.HospitalWhereInput): Promise<HospitalRow[]> {
    return this.prisma.hospital.findMany({
      where,
      include: HOSPITAL_INCLUDE,
      orderBy: { id: 'asc' },
    }) as unknown as Promise<HospitalRow[]>;
  }

  async findById(id: string): Promise<HospitalRow | null> {
    return this.prisma.hospital.findFirst({
      where: { id, deletedAt: null },
      include: HOSPITAL_INCLUDE,
    }) as unknown as Promise<HospitalRow | null>;
  }
}
