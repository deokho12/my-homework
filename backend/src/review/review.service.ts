import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { buildPageMeta } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
import { projectReview } from './review.projection';
import type { ReviewResponse } from './review.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewRepository } from './review.repository';
import type { ListReviewsQuery } from './review.schemas';

export interface ReviewListResult {
  items: ReviewResponse[];
  meta: PageMeta;
}

@Injectable()
export class ReviewService {
  constructor(private readonly reviews: ReviewRepository) {}

  /**
   * 병원 소속 후기 목록. 병원 존재 확인은 호출부(`HospitalController`)가 한다 —
   * 여기서 하면 `ReviewModule` 이 `HospitalModule` 을 import 해야 해서 순환 참조가 된다
   * (`doctor.service.ts` 의 `listByHospital` 과 같은 이유).
   */
  async listByHospital(hospitalId: string, query: ListReviewsQuery): Promise<ReviewListResult> {
    const where: Prisma.ReviewWhereInput = { hospitalId };

    if (query.procedureId !== undefined) {
      where.procedureId = query.procedureId;
    }

    const [rows, totalItems] = await Promise.all([
      this.reviews.findMany(where, {
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.reviews.count(where),
    ]);

    return {
      items: rows.map((row) => projectReview(row)),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
    };
  }
}
