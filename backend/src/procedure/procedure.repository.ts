import { Injectable } from '@nestjs/common';

import { publicHospitalWhere } from '../hospital/public-visibility';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';

/** 시술 카탈로그 행. 응답 투영(`ProcedureResponse`)은 여기에 `isAvailable` 을 더한 것이다. */
export interface ProcedureRow {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  description: string;
  categoryId: string;
}

/**
 * 시술 마스터 31종 + 분야 9개 (2026-10-21 요청 14).
 *
 * **정렬을 이름이나 id 에 의존하지 않는다.** 계약이 순서를 고정했고(분야 순서 ×
 * 분야 안 순서), 그 순서는 사전순이 아닌 편집상의 순서다. 시드가 넣은 `sortOrder` 를 쓴다.
 */
@Injectable()
export class ProcedureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ProcedureRow[]> {
    return this.prisma.procedure.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        emoji: true,
        shortDescription: true,
        description: true,
        categoryId: true,
      },
    });
  }

  /**
   * "공개 병원이 1곳 이상 등록한 시술 id → 그 병원 수" (docs §17.7).
   *
   * 조건은 `publicHospitalWhere()` — `GET /hospitals` 의 공개 목록과 **같은 함수**다.
   * 집계는 요청당 **한 번**이고, 0/1 판정은 `availability.ts` 의 순수 함수가 한다.
   */
  async countPublicHospitalsByProcedure(): Promise<Map<string, number>> {
    const rows = await this.prisma.hospitalProcedure.groupBy({
      by: ['procedureId'],
      where: { hospital: publicHospitalWhere() },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.procedureId, row._count._all]));
  }

  /**
   * 한 분야에 속한 시술 id (화면 순서). 분야 필터의 **광고 자격 판정**에 쓴다 —
   * 광고 행에 `category_id` 를 복제해 두지 않는 이유는 그것이 같은 사실의 두 번째
   * 사본이기 때문이다(시술이 분야를 옮기면 광고 행이 옛 분야에 남는다). 31행
   * 테이블이라 요청당 한 번 읽는 비용이 없다 (docs §17.9).
   *
   * 없는 분야면 빈 배열이다 — 목록 필터가 0건인 것과 같은 정상 상태다.
   */
  async findIdsByCategory(categoryId: string): Promise<string[]> {
    const rows = await this.prisma.procedure.findMany({
      where: { categoryId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    return rows.map((row) => row.id);
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
