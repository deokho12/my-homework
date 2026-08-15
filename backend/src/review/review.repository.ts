import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { REVIEW_INCLUDE } from './review.projection';
import type { ReviewRow } from './review.projection';

export interface FindManyOptions {
  skip: number;
  take: number;
}

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `Review` 에는 `deletedAt` 컬럼이 없다 (스키마 확인) — 병원 존재 확인은
   * 호출부(`HospitalController`)가 `HospitalRepository.findById` 로 먼저 한다.
   */
  async findMany(where: Prisma.ReviewWhereInput, options: FindManyOptions): Promise<ReviewRow[]> {
    return this.prisma.review.findMany({
      where,
      include: REVIEW_INCLUDE,
      // 최신순이 주 정렬. 같은 날짜가 가능하므로 id tiebreaker 를 더한다.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  async count(where: Prisma.ReviewWhereInput): Promise<number> {
    return this.prisma.review.count({ where });
  }
}
