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

  /**
   * 주어진 id 중 실제로 존재하는 것만 돌려준다.
   *
   * 쓰기 경로가 FK 위반을 만나기 **전에** 거절하기 위한 것이다. Prisma 의 FK 오류는
   * 매핑되지 않으면 500 이 되고, 오타 난 시술 id 하나에 운영자가 원인 없는 "서버 오류" 를 받는다.
   * 병원·전문의 쓰기가 같은 검증을 필요로 하므로 여기 한 곳에 둔다.
   */
  async findExistingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();

    const rows = await this.prisma.procedure.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    return new Set(rows.map((row) => row.id));
  }
}
