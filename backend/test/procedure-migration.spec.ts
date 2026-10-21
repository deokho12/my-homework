import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BACKEND_DIR } from './support/test-database';

/**
 * =============================================================================
 * 이관 보존 단정 — 마이그레이션이 기존 등록을 지우지 않는다 (docs §17.6)
 * =============================================================================
 *
 * 요청서 14 의 "기존 병원 11곳의 시술 등록이 사라지면 안 됩니다" 가 이 파일이다.
 *
 * **왜 별도 DB 를 만드는가.** 테스트 DB(`prisma/test.db`)는 이미 새 마이그레이션까지
 * 적용된 상태라 "옛 id 가 들어 있는 DB 에 이 마이그레이션을 걸면 어떻게 되는가" 를
 * 거기서는 볼 수 없다. 그래서 임시 파일에 **직전 마이그레이션까지만** 적용하고,
 * 옛 id 를 쓰는 대표 행을 넣은 뒤, 새 마이그레이션을 적용해서 전후를 비교한다.
 * Prisma CLI 를 거치지 않고 SQL 파일을 그대로 실행한다 — 검증 대상이 바로 그 파일이다.
 *
 * `PRAGMA foreign_keys` 를 켠 채로 돌린다. 마이그레이션이 캐스케이드 동작에 기대지
 * 않는다는 것(§17.6 원칙 ①)이 여기서 실제로 확인된다 — 순서가 틀리면 FK 가 막거나
 * `consult_requests.procedure_id` 가 NULL 이 된다.
 */
const MIGRATIONS_DIR = path.join(BACKEND_DIR, 'prisma', 'migrations');

function migrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function migrationSql(name: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
}

describe('마이그레이션 — 옛 시술 id 가 든 DB 를 옮긴다', () => {
  let directory: string;
  let db: DatabaseSync;
  let before: Record<string, number>;

  const counts = (): Record<string, number> => ({
    procedures: count('SELECT COUNT(*) AS c FROM procedures'),
    hospital_procedures: count('SELECT COUNT(*) AS c FROM hospital_procedures'),
    hospital_sponsorships: count('SELECT COUNT(*) AS c FROM hospital_sponsorships'),
    doctor_procedures: count('SELECT COUNT(*) AS c FROM doctor_procedures'),
    consult_requests: count('SELECT COUNT(*) AS c FROM consult_requests'),
    consult_requests_null_procedure: count('SELECT COUNT(*) AS c FROM consult_requests WHERE procedure_id IS NULL'),
    reviews: count('SELECT COUNT(*) AS c FROM reviews'),
    guides: count('SELECT COUNT(*) AS c FROM guides'),
    promotions: count('SELECT COUNT(*) AS c FROM promotions'),
    qa_posts: count('SELECT COUNT(*) AS c FROM qa_posts'),
  });

  function count(sql: string): number {
    return (db.prepare(sql).get() as { c: number }).c;
  }

  function ids(sql: string): string[] {
    return (db.prepare(sql).all() as { id: string }[]).map((row) => row.id);
  }

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'molamola-migration-'));
    db = new DatabaseSync(path.join(directory, 'migration-test.db'));
    db.exec('PRAGMA foreign_keys = ON;');

    const names = migrationNames();
    const target = names.at(-1)!;

    expect(target).toMatch(/procedure_categories_and_31_procedures$/);

    // 직전 마이그레이션까지 적용 = 요청 14 이전의 운영/개발 DB 와 같은 스키마
    for (const name of names.slice(0, -1)) db.exec(migrationSql(name));

    seedLegacyRows(db);
    before = counts();

    // ★ 검증 대상
    db.exec(migrationSql(target));
  });

  afterAll(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('옛 13행이 7행으로 줄고(6개는 새 id 로 이사), 분야 9행이 생긴다', () => {
    expect(count('SELECT COUNT(*) AS c FROM procedure_categories')).toBe(9);
    // 마이그레이션은 카탈로그를 심지 않는다 — 새 18행은 시드의 몫이다 (§17.6 원칙 ②)
    expect(count('SELECT COUNT(*) AS c FROM procedures')).toBe(before.procedures);
    expect(ids("SELECT id FROM procedures WHERE id IN ('implant','orthodontics','cavity','gum-disease','tmj','botox')")).toEqual([]);
    expect(ids('SELECT id FROM procedures ORDER BY id').sort()).toEqual(
      [
        'bracket-braces',
        'bruxism-botox',
        'crown',
        'gum-treatment',
        'implant-general',
        'inlay',
        'laminate',
        'resin',
        'snoring-device',
        'splint',
        'tmj-treatment',
        'whitening',
        'wisdom-tooth',
      ].sort(),
    );
  });

  it('모든 시술에 분야가 있다 (NOT NULL + FK 로 굳었다)', () => {
    expect(count('SELECT COUNT(*) AS c FROM procedures WHERE category_id IS NULL')).toBe(0);
    expect(
      count('SELECT COUNT(*) AS c FROM procedures p LEFT JOIN procedure_categories c ON c.id = p.category_id WHERE c.id IS NULL'),
    ).toBe(0);
    expect(
      (db.prepare("SELECT category_id AS id FROM procedures WHERE id = 'resin'").get() as { id: string }).id,
    ).toBe('cavity');
  });

  it('자식 행이 하나도 사라지지 않는다 — 요청서의 "시술 등록이 사라지면 안 됩니다"', () => {
    const after = counts();

    expect(after).toEqual(before);
  });

  it('상담의 희망 시술이 NULL 로 비워지지 않는다 (ON DELETE SET NULL 의 함정)', () => {
    expect(counts().consult_requests_null_procedure).toBe(before.consult_requests_null_procedure);
    expect(
      (db.prepare("SELECT procedure_id AS id FROM consult_requests WHERE id = 'cr-legacy'").get() as { id: string }).id,
    ).toBe('implant-general');
  });

  it('자식 행이 전부 새 id 를 가리킨다', () => {
    for (const table of [
      'hospital_procedures',
      'doctor_procedures',
      'hospital_sponsorships',
      'consult_requests',
      'reviews',
      'guides',
      'promotions',
      'qa_posts',
    ]) {
      expect(
        count(
          `SELECT COUNT(*) AS c FROM ${table} WHERE procedure_id IN ('implant','orthodontics','cavity','gum-disease','tmj','botox')`,
        ),
      ).toBe(0);
    }
  });

  it('결정적 id 3종이 새 규칙으로 바뀐다 — 재시드가 중복 행을 만들지 않는다', () => {
    expect(ids('SELECT id FROM hospital_procedures ORDER BY id')).toEqual([
      'hp-h1-bruxism-botox',
      'hp-h1-implant-general',
      'hp-h1-laminate',
      'hp-h1-resin',
      'hp-h1-tmj-treatment',
      // 런타임에 만들어진 cuid 행은 id 를 건드리지 않는다 (procedure_id 만 바뀐다)
      'runtime-cuid-row',
    ]);
    expect(ids('SELECT id FROM doctor_procedures ORDER BY id')).toEqual([
      'dp-d1-bruxism-botox',
      'dp-d1-implant-general',
      'dp-d1-resin',
      'dp-d1-tmj-treatment',
    ]);
    expect(ids('SELECT id FROM hospital_sponsorships ORDER BY id')).toEqual([
      'sp-h1-bruxism-botox',
      'sp-h1-implant-general',
      'sp-h1-resin',
      'sp-h1-tmj-treatment',
    ]);
  });

  it('cuid 행도 새 시술을 가리킨다', () => {
    expect(
      (db.prepare("SELECT procedure_id AS id FROM hospital_procedures WHERE id = 'runtime-cuid-row'").get() as {
        id: string;
      }).id,
    ).toBe('gum-treatment');
  });

  it('빈 DB 에도 그대로 적용된다 (테스트·CI 경로)', () => {
    const emptyDb = new DatabaseSync(path.join(directory, 'empty.db'));

    try {
      emptyDb.exec('PRAGMA foreign_keys = ON;');
      for (const name of migrationNames()) emptyDb.exec(migrationSql(name));

      expect((emptyDb.prepare('SELECT COUNT(*) AS c FROM procedures').get() as { c: number }).c).toBe(0);
      expect((emptyDb.prepare('SELECT COUNT(*) AS c FROM procedure_categories').get() as { c: number }).c).toBe(9);
    } finally {
      emptyDb.close();
    }
  });
});

/**
 * 요청 14 이전의 DB 를 대표하는 최소 행들. **옛 id 6개를 모두** 쓰고(id 가 바뀌는 블록이
 * 6개라 하나라도 빠지면 그 블록의 오타를 아무도 못 잡는다), 자식 8개 테이블과
 * **결정적 id / cuid id 두 종류**를 모두 덮는다.
 */
function seedLegacyRows(db: DatabaseSync): void {
  const now = '2026-10-01T00:00:00.000Z';

  db.exec(`
    INSERT INTO procedures (id,name,emoji,short_description,description,sort_order) VALUES
      ('implant','임플란트','🦷','자연치아처럼','설명',0),
      ('orthodontics','교정','😁','가지런한','설명',1),
      ('laminate','라미네이트','✨','앞면 코팅','설명',2),
      ('inlay','인레이','🧩','정밀하게','설명',3),
      ('crown','크라운','👑','감싸기','설명',4),
      ('whitening','치아미백','🌟','밝게','설명',5),
      ('wisdom-tooth','사랑니','😬','미리 발치','설명',6),
      ('cavity','충치치료','🩹','치아색으로','설명',7),
      ('gum-disease','잇몸치료','🌿','염증을','설명',8),
      ('splint','스플린트','🛡️','힘을 분산','설명',9),
      ('snoring-device','코골이장치','😴','코골이 완화','설명',10),
      ('tmj','턱관절','🦴','통증 개선','설명',11),
      ('botox','보톡스','💉','근육을','설명',12);

    INSERT INTO hospitals
      (id,name,name_normalized,region,address,latitude,longitude,thumbnail,introduction,directions,
       price_min,price_max,rating,review_count,consult_count,consult_available,is_one_day,is_recommended,
       feature_coordinator,feature_painless_anesthesia,feature_digital_care,feature_parking,
       feature_night_consult,feature_cctv,created_at,updated_at)
    VALUES ('h1','강남 치과','강남 치과','서울 강남구','주소',37.5,127.0,'t.jpg','소개','길',
            100000,200000,4.8,10,5,1,0,0,0,0,0,0,0,0,'${now}','${now}');

    INSERT INTO hospital_procedures (id,hospital_id,procedure_id) VALUES
      ('hp-h1-implant','h1','implant'),
      ('hp-h1-laminate','h1','laminate'),
      ('hp-h1-cavity','h1','cavity'),
      ('hp-h1-tmj','h1','tmj'),
      ('hp-h1-botox','h1','botox'),
      ('runtime-cuid-row','h1','gum-disease');

    INSERT INTO hospital_sponsorships (id,hospital_id,procedure_id,rank,start_date,end_date,created_at) VALUES
      ('sp-h1-implant','h1','implant',1,'2026-09-01','2026-12-01','${now}'),
      ('sp-h1-cavity','h1','cavity',1,'2026-09-01','2026-12-01','${now}'),
      ('sp-h1-tmj','h1','tmj',1,'2026-09-01','2026-12-01','${now}'),
      ('sp-h1-botox','h1','botox',1,'2026-09-01','2026-12-01','${now}');

    INSERT INTO doctors
      (id,hospital_id,name,name_normalized,title,specialty,photo,years_of_experience,
       verification_status,is_recommended,created_at,updated_at)
    VALUES ('d1','h1','김민준','김민준','원장','치과보철전문의','p.jpg',10,'approved',0,'${now}','${now}');

    INSERT INTO doctor_procedures (id,doctor_id,procedure_id) VALUES
      ('dp-d1-implant','d1','implant'),
      ('dp-d1-cavity','d1','cavity'),
      ('dp-d1-tmj','d1','tmj'),
      ('dp-d1-botox','d1','botox');

    INSERT INTO users (id,email,name,provider,role,created_at,updated_at)
      VALUES ('u1','a@b.example','사용자','email','user','${now}','${now}');

    INSERT INTO consult_requests
      (id,user_id,hospital_id,procedure_id,name,phone,preferred_time,status,created_at,updated_at)
    VALUES ('cr-legacy','u1','h1','implant','홍길동','010-0000-0000','오전','new','${now}','${now}'),
           ('cr-tmj','u1','h1','tmj','홍길동','010-0000-0000','오전','new','${now}','${now}');

    INSERT INTO reviews (id,hospital_id,procedure_id,author_name,rating,content,created_at) VALUES
      ('r1','h1','implant','홍길동',5,'좋아요','${now}'),
      ('r2','h1','cavity','홍길동',4,'좋아요','${now}');

    INSERT INTO guides (id,title,summary,thumbnail,procedure_id,content,author,created_at) VALUES
      ('g1','교정 가이드','요약','g.jpg','orthodontics','본문','편집팀','${now}'),
      ('g2','보톡스 가이드','요약','g.jpg','botox','본문','편집팀','${now}');

    INSERT INTO promotions
      (id,hospital_id,procedure_id,title,original_price,sale_price,badge,start_date,end_date,created_at)
    VALUES ('p1','h1','gum-disease','잇몸 이벤트',200000,100000,'50%','2026-09-01','2026-12-01','${now}'),
           ('p2','h1','cavity','충치 이벤트',100000,50000,'50%','2026-09-01','2026-12-01','${now}');

    INSERT INTO qa_posts (id,title,content,procedure_id,author_user_id,view_count,created_at,updated_at) VALUES
      ('q1','질문','본문','implant','u1',0,'${now}','${now}'),
      ('q2','질문','본문','tmj','u1',0,'${now}','${now}');
  `);
}
