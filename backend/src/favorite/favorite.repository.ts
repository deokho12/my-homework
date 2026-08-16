import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 최근에 찜한 것이 먼저. 같은 시각이 가능하므로 id tiebreaker 를 더한다. */
  async listHospitalIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      select: { hospitalId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return rows.map((row) => row.hospitalId);
  }

  /**
   * 멱등 추가. 이미 찜했으면 아무 일도 하지 않는다 — 하트를 두 번 눌렀다고 실패할
   * 이유가 없고, `@@unique([userId, hospitalId])` 가 두 행을 막는다.
   *
   * `upsert` 를 쓰는 이유는 "조회 후 없으면 생성" 이 동시 요청에서 unique 위반으로
   * 깨지기 때문이다. `update` 는 빈 객체다 — 이미 있으면 `createdAt` 을 갱신하지 않는다.
   * 갱신하면 하트를 다시 누른 것만으로 목록 맨 앞으로 올라온다.
   */
  async add(userId: string, hospitalId: string, now: Date): Promise<void> {
    await this.prisma.favorite.upsert({
      where: { userId_hospitalId: { userId, hospitalId } },
      create: { id: createId(), userId, hospitalId, createdAt: now },
      update: {},
    });
  }

  /** 멱등 삭제. 없으면 0건 삭제이고 그것도 성공이다. */
  async remove(userId: string, hospitalId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, hospitalId } });
  }
}
