import { Injectable } from '@nestjs/common';

import { computeProcedureAvailability } from './availability';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProcedureRepository } from './procedure.repository';

/** 계약 `Procedure` 스키마 (2026-10-21 요청 14 — `categoryId`·`isAvailable` 추가). */
export interface ProcedureResponse {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  /** `준비중` 의 반대. 저장된 컬럼이 아니라 요청 시점에 세는 파생값이다 (docs §17.7). */
  isAvailable: boolean;
}

@Injectable()
export class ProcedureService {
  constructor(private readonly procedures: ProcedureRepository) {}

  /**
   * `GET /procedures` 의 본문. **질의 두 번**(카탈로그 31행 + 가용성 집계 1회)이고
   * 판정은 순수 함수가 한다 (`availability.ts`).
   *
   * 분야의 가용성은 만들지 않는다 — "분야 준비중 = 그 분야의 세부 시술이 전부
   * `isAvailable=false`" 이고, 그 유도는 화면 함수 하나가 한다 (계약 §22.4).
   */
  async list(): Promise<ProcedureResponse[]> {
    const [rows, hospitalCountById] = await Promise.all([
      this.procedures.findAll(),
      this.procedures.countPublicHospitalsByProcedure(),
    ]);

    const availability = computeProcedureAvailability(
      rows.map((row) => row.id),
      hospitalCountById,
    );

    return rows.map((row) => ({ ...row, isAvailable: availability.get(row.id) ?? false }));
  }
}
