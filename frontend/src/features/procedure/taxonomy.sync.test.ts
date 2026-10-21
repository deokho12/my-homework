import { describe, expect, it } from 'vitest';

// 백엔드의 **import 0 데이터 파일**을 상대 경로로 읽는다 (docs/database/README.md §17.8).
// 별칭(`@/…`)이 하나라도 있으면 프론트 쪽 해석기가 그것을 풀 수 없어서 그 파일들은
// 타입 선언과 배열 리터럴만 두기로 되어 있다. 앱 번들에는 들어가지 않는다 — 이 파일은
// 테스트 전용이고 `npm run build` 의 진입점에서 도달할 수 없다.
import { procedureCategories } from '../../../../backend/prisma/seed/data/procedure-categories';
import { procedures as serverProcedures } from '../../../../backend/prisma/seed/data/procedures';
import { PROCEDURE_SPECIALTIES } from '../../../../backend/src/doctor/specialty-procedures';

import {
  CATEGORIES,
  CATEGORY_IDS,
  SUB_PROCEDURES,
  SUB_PROCEDURE_IDS,
  getSubProceduresOf,
} from '@/features/procedure/taxonomy';
import { CATEGORY_SPECIALTIES } from '@/utils/specialty';

/**
 * **같은 표가 두 벌 있는 이유를 지키는 테스트다.**
 *
 * 분야 9개와 세부 시술 31개의 원본은 서버(`backend/prisma/seed/data/*`)에 있지만,
 * 화면도 같은 표를 번들 상수로 들고 있다 (`taxonomy.ts`). 홈 격자·탐색 분야 탭·관리자 폼
 * 섹션은 **첫 프레임**에 9개를 그려야 해서 네트워크를 기다릴 수 없고, 그래서 계약에는
 * 분야 엔드포인트를 만들지 않았다 (docs/api/README.md §22.4).
 *
 * 사본이 둘이면 언젠가 갈라진다. 그 갈라짐을 **런타임이 아니라 여기서** 멈춘다.
 */
describe('taxonomy ↔ 서버 시드 데이터', () => {
  it('분야 9개의 id·순서가 같다', () => {
    expect(procedureCategories.map((row) => row.id)).toEqual([...CATEGORY_IDS]);
  });

  it('분야의 이름과 설명이 같다', () => {
    for (const row of procedureCategories) {
      const category = CATEGORIES.find((item) => item.id === row.id);
      expect(category?.name).toBe(row.name);
      expect(category?.description).toBe(row.description);
    }
  });

  it('세부 시술 31개의 id·순서가 같다 — 응답 순서가 곧 화면 순서다', () => {
    expect(serverProcedures.map((row) => row.id)).toEqual([...SUB_PROCEDURE_IDS]);
  });

  it('세부 시술의 이름이 같다 (화면 이름 ≠ 서버 이름 문제의 재발 방지)', () => {
    for (const row of serverProcedures) {
      const sub = SUB_PROCEDURES.find((item) => item.id === row.id);
      expect(sub?.name).toBe(row.name);
    }
  });

  it('세부 시술이 같은 분야에 속한다', () => {
    for (const row of serverProcedures) {
      const sub = SUB_PROCEDURES.find((item) => item.id === row.id);
      expect(sub?.categoryId).toBe(row.categoryId);
    }
  });
});

/**
 * 전공 표도 사본이 둘이다 (docs/database/README.md §17.11). 원본은 서버의 **시술 → 전공**
 * 표이고, 화면의 분야 → 전공 표는 그 **합집합**이다. 배지는 병원 카드가 그려지는 첫
 * 프레임에 필요해서 네트워크를 기다릴 수 없고, 계약에 소비자 없는 필드를 더하는 대신
 * 사본 + 검사를 택했다.
 */
describe('CATEGORY_SPECIALTIES ↔ PROCEDURE_SPECIALTIES', () => {
  it('분야 표는 그 분야 시술들의 전공 합집합이다', () => {
    for (const categoryId of CATEGORY_IDS) {
      const union = new Set<string>();
      for (const sub of getSubProceduresOf(categoryId)) {
        for (const specialty of PROCEDURE_SPECIALTIES[sub.id] ?? []) union.add(specialty);
      }

      expect(new Set(CATEGORY_SPECIALTIES[categoryId])).toEqual(union);
    }
  });

  it('서버 표가 31개 시술을 모두 덮는다', () => {
    expect(new Set(Object.keys(PROCEDURE_SPECIALTIES))).toEqual(new Set(SUB_PROCEDURE_IDS));
  });
});
