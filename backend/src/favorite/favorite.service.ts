import { Injectable } from '@nestjs/common';

import { ApiError } from '../common/errors/api-error';
import { projectHospital } from '../hospital/hospital.projection';
import type { HospitalResponse } from '../hospital/hospital.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from '../hospital/hospital.repository';
import { seoulToday } from '../hospital/sponsorship';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FavoriteRepository } from './favorite.repository';
import type { ListFavoritesQuery } from './favorite.schemas';

export interface FavoriteListResult {
  hospitalIds: string[];
  hospitals?: HospitalResponse[];
}

@Injectable()
export class FavoriteService {
  constructor(
    private readonly favorites: FavoriteRepository,
    private readonly hospitals: HospitalRepository,
  ) {}

  /**
   * 내 찜 목록.
   *
   * `expand=hospital` 이면 병원 본문도 싣되 **`hospitalIds` 와 같은 순서**여야 한다(계약).
   * DB 는 정렬을 보장하지 않으므로 조회 결과를 id 순서에 맞춰 다시 세운다.
   *
   * 삭제된 병원은 `hospitals` 에서 빠진다 — 그런 병원의 id 는 `hospitalIds` 에도 남기지
   * 않는다. 둘의 길이가 달라지면 화면이 두 배열을 인덱스로 짝지을 수 없다.
   */
  async list(userId: string, query: ListFavoritesQuery): Promise<FavoriteListResult> {
    const hospitalIds = await this.favorites.listHospitalIds(userId);

    if (hospitalIds.length === 0) {
      return query.expand === 'hospital' ? { hospitalIds: [], hospitals: [] } : { hospitalIds: [] };
    }

    const rows = await this.hospitals.findMany({ id: { in: hospitalIds }, deletedAt: null });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const liveIds = hospitalIds.filter((id) => byId.has(id));

    if (query.expand !== 'hospital') {
      return { hospitalIds: liveIds };
    }

    const today = seoulToday();

    return {
      hospitalIds: liveIds,
      hospitals: liveIds.map((id) => projectHospital(byId.get(id)!, { today })),
    };
  }

  /** 없는 병원을 찜하면 `404` 다 — FK 위반으로 원인 없는 500 이 나가는 것을 막는다. */
  async add(userId: string, hospitalId: string): Promise<void> {
    const hospital = await this.hospitals.findById(hospitalId);

    if (hospital === null) {
      throw new ApiError('HOSPITAL_NOT_FOUND');
    }

    await this.favorites.add(userId, hospitalId, new Date());
  }

  /**
   * 찜 해제. **없는 병원이어도 성공이다.**
   *
   * 존재를 확인하지 않는 이유: 해제의 목적은 "내 목록에서 빼기" 이고, 병원이 지워진
   * 뒤에도 그 찜은 빼낼 수 있어야 한다. 확인하면 삭제된 병원의 찜이 영원히 남는다.
   */
  async remove(userId: string, hospitalId: string): Promise<void> {
    await this.favorites.remove(userId, hospitalId);
  }
}
