import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';

/** 계약 `Procedure` 스키마. 프론트 `types/domain.ts` 의 `Procedure` 와 같은 모양이다. */
export interface ProcedureResponse {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  description: string;
}

/**
 * 시술 마스터 13종.
 *
 * **정렬을 DB 컬럼에 의존하지 않는다.** 계약이 순서를 고정했고(`implant` → … → `botox`),
 * 그 순서는 이름순도 id순도 아닌 편집상의 순서다. 시드가 넣은 `sortOrder` 를 쓴다.
 */
@Injectable()
export class ProcedureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ProcedureResponse[]> {
    return this.prisma.procedure.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, emoji: true, shortDescription: true, description: true },
    });
  }
}
