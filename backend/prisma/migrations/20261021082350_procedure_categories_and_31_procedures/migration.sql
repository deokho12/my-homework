-- =============================================================================
-- 시술 분야 9개 + 세부 시술 31개 (요청 14 — docs/database/README.md §17.6)
-- =============================================================================
--
-- 원칙 두 개.
--  ① `procedures` 의 PK 를 UPDATE 하지 않는다. FK 8개가 `ON UPDATE CASCADE` 지만 그
--     동작은 `PRAGMA foreign_keys` 상태에 달려 있어, 마이그레이션 엔진이 어떤 상태로
--     돌리는지에 결과가 달라진다. **삽입 → 자식 재지정 → 삭제**는 pragma 와 무관하게
--     같은 결과를 낸다.
--  ② 이 파일은 **기존 행을 새 체계로 옮기는 데 필요한 것만** 한다. 새 18행과 모든
--     문구의 최종값은 시드가 넣는다(업서트라 몇 번 돌려도 같다). 그래서 빈 DB 에서는
--     3~7단계가 0행에 영향을 주고 끝난다.

-- 1) 분야 테이블 ---------------------------------------------------------------
CREATE TABLE "procedure_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL
);

-- 2) 분야 9행. FK 대상이라 4단계 백필보다 먼저 있어야 한다 (문구는 시드가 다시 덮는다)
INSERT INTO "procedure_categories" ("id","name","description","sort_order") VALUES
  ('implant','임플란트','상실된 치아를 인공 치근으로 대체해요',0),
  ('prevention','스케일링·예방','치석 제거부터 충치 예방까지',1),
  ('orthodontics','교정','치열과 교합을 가지런히',2),
  ('cavity','충치치료','초기 충치부터 신경치료·보철까지',3),
  ('aesthetic','심미','치아 색과 모양을 아름답게',4),
  ('gum','잇몸치료','잇몸 염증과 치주 질환 관리',5),
  ('tmj','턱관절·스플린트','턱 통증·이갈이·코골이 장치',6),
  ('botox','보톡스','이갈이 완화와 사각턱 개선',7),
  ('extraction','사랑니·발치','사랑니와 보존이 어려운 치아 발치',8);

-- 3) 컬럼을 먼저 nullable 로 붙인다 (8단계의 테이블 재작성이 NOT NULL 로 굳힌다)
ALTER TABLE "procedures" ADD COLUMN "category_id" TEXT;

-- 4) 기존 13행의 분야 백필 — 옛 id 기준
--    (스케일링·예방에 해당하는 옛 행은 없다 — 그래서 UPDATE 도 없다)
UPDATE "procedures" SET "category_id"='implant'      WHERE "id"='implant';
UPDATE "procedures" SET "category_id"='orthodontics' WHERE "id"='orthodontics';
UPDATE "procedures" SET "category_id"='cavity'       WHERE "id" IN ('cavity','inlay','crown');
UPDATE "procedures" SET "category_id"='aesthetic'    WHERE "id" IN ('laminate','whitening');
UPDATE "procedures" SET "category_id"='gum'          WHERE "id"='gum-disease';
UPDATE "procedures" SET "category_id"='tmj'          WHERE "id" IN ('tmj','splint','snoring-device');
UPDATE "procedures" SET "category_id"='botox'        WHERE "id"='botox';
UPDATE "procedures" SET "category_id"='extraction'   WHERE "id"='wisdom-tooth';

-- 5) id 가 바뀌는 6개: 새 행을 **기존 행에서 복제**한다.
--    INSERT ... SELECT 라서 빈 DB 에서는 0행이 들어간다 (= 새 DB 에 카탈로그를 심지 않는다).
--    이름·문구·sort_order 는 시드가 최종값으로 덮는다.
INSERT INTO "procedures" ("id","name","emoji","short_description","description","sort_order","category_id")
  SELECT 'implant-general',"name","emoji","short_description","description","sort_order","category_id" FROM "procedures" WHERE "id"='implant';
INSERT INTO "procedures" ("id","name","emoji","short_description","description","sort_order","category_id")
  SELECT 'bracket-braces',"name","emoji","short_description","description","sort_order","category_id" FROM "procedures" WHERE "id"='orthodontics';
INSERT INTO "procedures" ("id","name","emoji","short_description","description","sort_order","category_id")
  SELECT 'resin',"name","emoji","short_description","description","sort_order","category_id" FROM "procedures" WHERE "id"='cavity';
INSERT INTO "procedures" ("id","name","emoji","short_description","description","sort_order","category_id")
  SELECT 'gum-treatment',"name","emoji","short_description","description","sort_order","category_id" FROM "procedures" WHERE "id"='gum-disease';
INSERT INTO "procedures" ("id","name","emoji","short_description","description","sort_order","category_id")
  SELECT 'tmj-treatment',"name","emoji","short_description","description","sort_order","category_id" FROM "procedures" WHERE "id"='tmj';
INSERT INTO "procedures" ("id","name","emoji","short_description","description","sort_order","category_id")
  SELECT 'bruxism-botox',"name","emoji","short_description","description","sort_order","category_id" FROM "procedures" WHERE "id"='botox';

-- 6) 자식 재지정 — 8개 테이블. **삭제(7단계)보다 반드시 먼저.**
--    `consult_requests` 는 ON DELETE SET NULL 이라, 순서가 뒤집히면 '희망 시술' 이 조용히 비워진다.
--    ⓐ 결정적 id 를 쓰는 3개 테이블(`hp-`·`dp-`·`sp-`)은 id 도 함께 고친다 — 시드가 같은 규칙으로
--       id 를 다시 만들기 때문이다(§8.1 원칙 2). 안 고치면 재시드가 중복 행을 만든다
--    ⓑ 런타임에 만들어진 행(관리자 폼 저장 — id 가 cuid)은 procedure_id 만 고친다
-- implant → implant-general
UPDATE "hospital_procedures"   SET "procedure_id"='implant-general', "id"='hp-'||"hospital_id"||'-implant-general' WHERE "procedure_id"='implant' AND "id"='hp-'||"hospital_id"||'-implant';
UPDATE "hospital_procedures"   SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "doctor_procedures"     SET "procedure_id"='implant-general', "id"='dp-'||"doctor_id"||'-implant-general'   WHERE "procedure_id"='implant' AND "id"='dp-'||"doctor_id"||'-implant';
UPDATE "doctor_procedures"     SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "hospital_sponsorships" SET "procedure_id"='implant-general', "id"='sp-'||"hospital_id"||'-implant-general' WHERE "procedure_id"='implant' AND "id"='sp-'||"hospital_id"||'-implant';
UPDATE "hospital_sponsorships" SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "consult_requests"      SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "reviews"               SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "promotions"            SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "guides"                SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';
UPDATE "qa_posts"              SET "procedure_id"='implant-general' WHERE "procedure_id"='implant';

-- orthodontics → bracket-braces
UPDATE "hospital_procedures"   SET "procedure_id"='bracket-braces', "id"='hp-'||"hospital_id"||'-bracket-braces' WHERE "procedure_id"='orthodontics' AND "id"='hp-'||"hospital_id"||'-orthodontics';
UPDATE "hospital_procedures"   SET "procedure_id"='bracket-braces' WHERE "procedure_id"='orthodontics';
UPDATE "doctor_procedures"     SET "procedure_id"='bracket-braces', "id"='dp-'||"doctor_id"||'-bracket-braces'   WHERE "procedure_id"='orthodontics' AND "id"='dp-'||"doctor_id"||'-orthodontics';
UPDATE "doctor_procedures"     SET "procedure_id"='bracket-braces' WHERE "procedure_id"='orthodontics';
UPDATE "hospital_sponsorships" SET "procedure_id"='bracket-braces', "id"='sp-'||"hospital_id"||'-bracket-braces' WHERE "procedure_id"='orthodontics' AND "id"='sp-'||"hospital_id"||'-orthodontics';
UPDATE "hospital_sponsorships" SET "procedure_id"='bracket-braces' WHERE "procedure_id"='orthodontics';
UPDATE "consult_requests"      SET "procedure_id"='bracket-braces' WHERE "procedure_id"='orthodontics';
UPDATE "reviews"               SET "procedure_id"='bracket-braces' WHERE "procedure_id"='orthodontics';
UPDATE "promotions"            SET "procedure_id"='bracket-braces' WHERE "procedure_id"='orthodontics';
UPDATE "guides"                SET "procedure_id"='bracket-braces' WHERE "procedure_id"='orthodontics';
UPDATE "qa_posts"              SET "procedure_id"='bracket-braces' WHERE "procedure_id"='orthodontics';

-- cavity → resin
UPDATE "hospital_procedures"   SET "procedure_id"='resin', "id"='hp-'||"hospital_id"||'-resin' WHERE "procedure_id"='cavity' AND "id"='hp-'||"hospital_id"||'-cavity';
UPDATE "hospital_procedures"   SET "procedure_id"='resin' WHERE "procedure_id"='cavity';
UPDATE "doctor_procedures"     SET "procedure_id"='resin', "id"='dp-'||"doctor_id"||'-resin'   WHERE "procedure_id"='cavity' AND "id"='dp-'||"doctor_id"||'-cavity';
UPDATE "doctor_procedures"     SET "procedure_id"='resin' WHERE "procedure_id"='cavity';
UPDATE "hospital_sponsorships" SET "procedure_id"='resin', "id"='sp-'||"hospital_id"||'-resin' WHERE "procedure_id"='cavity' AND "id"='sp-'||"hospital_id"||'-cavity';
UPDATE "hospital_sponsorships" SET "procedure_id"='resin' WHERE "procedure_id"='cavity';
UPDATE "consult_requests"      SET "procedure_id"='resin' WHERE "procedure_id"='cavity';
UPDATE "reviews"               SET "procedure_id"='resin' WHERE "procedure_id"='cavity';
UPDATE "promotions"            SET "procedure_id"='resin' WHERE "procedure_id"='cavity';
UPDATE "guides"                SET "procedure_id"='resin' WHERE "procedure_id"='cavity';
UPDATE "qa_posts"              SET "procedure_id"='resin' WHERE "procedure_id"='cavity';

-- gum-disease → gum-treatment
UPDATE "hospital_procedures"   SET "procedure_id"='gum-treatment', "id"='hp-'||"hospital_id"||'-gum-treatment' WHERE "procedure_id"='gum-disease' AND "id"='hp-'||"hospital_id"||'-gum-disease';
UPDATE "hospital_procedures"   SET "procedure_id"='gum-treatment' WHERE "procedure_id"='gum-disease';
UPDATE "doctor_procedures"     SET "procedure_id"='gum-treatment', "id"='dp-'||"doctor_id"||'-gum-treatment'   WHERE "procedure_id"='gum-disease' AND "id"='dp-'||"doctor_id"||'-gum-disease';
UPDATE "doctor_procedures"     SET "procedure_id"='gum-treatment' WHERE "procedure_id"='gum-disease';
UPDATE "hospital_sponsorships" SET "procedure_id"='gum-treatment', "id"='sp-'||"hospital_id"||'-gum-treatment' WHERE "procedure_id"='gum-disease' AND "id"='sp-'||"hospital_id"||'-gum-disease';
UPDATE "hospital_sponsorships" SET "procedure_id"='gum-treatment' WHERE "procedure_id"='gum-disease';
UPDATE "consult_requests"      SET "procedure_id"='gum-treatment' WHERE "procedure_id"='gum-disease';
UPDATE "reviews"               SET "procedure_id"='gum-treatment' WHERE "procedure_id"='gum-disease';
UPDATE "promotions"            SET "procedure_id"='gum-treatment' WHERE "procedure_id"='gum-disease';
UPDATE "guides"                SET "procedure_id"='gum-treatment' WHERE "procedure_id"='gum-disease';
UPDATE "qa_posts"              SET "procedure_id"='gum-treatment' WHERE "procedure_id"='gum-disease';

-- tmj → tmj-treatment
UPDATE "hospital_procedures"   SET "procedure_id"='tmj-treatment', "id"='hp-'||"hospital_id"||'-tmj-treatment' WHERE "procedure_id"='tmj' AND "id"='hp-'||"hospital_id"||'-tmj';
UPDATE "hospital_procedures"   SET "procedure_id"='tmj-treatment' WHERE "procedure_id"='tmj';
UPDATE "doctor_procedures"     SET "procedure_id"='tmj-treatment', "id"='dp-'||"doctor_id"||'-tmj-treatment'   WHERE "procedure_id"='tmj' AND "id"='dp-'||"doctor_id"||'-tmj';
UPDATE "doctor_procedures"     SET "procedure_id"='tmj-treatment' WHERE "procedure_id"='tmj';
UPDATE "hospital_sponsorships" SET "procedure_id"='tmj-treatment', "id"='sp-'||"hospital_id"||'-tmj-treatment' WHERE "procedure_id"='tmj' AND "id"='sp-'||"hospital_id"||'-tmj';
UPDATE "hospital_sponsorships" SET "procedure_id"='tmj-treatment' WHERE "procedure_id"='tmj';
UPDATE "consult_requests"      SET "procedure_id"='tmj-treatment' WHERE "procedure_id"='tmj';
UPDATE "reviews"               SET "procedure_id"='tmj-treatment' WHERE "procedure_id"='tmj';
UPDATE "promotions"            SET "procedure_id"='tmj-treatment' WHERE "procedure_id"='tmj';
UPDATE "guides"                SET "procedure_id"='tmj-treatment' WHERE "procedure_id"='tmj';
UPDATE "qa_posts"              SET "procedure_id"='tmj-treatment' WHERE "procedure_id"='tmj';

-- botox → bruxism-botox
UPDATE "hospital_procedures"   SET "procedure_id"='bruxism-botox', "id"='hp-'||"hospital_id"||'-bruxism-botox' WHERE "procedure_id"='botox' AND "id"='hp-'||"hospital_id"||'-botox';
UPDATE "hospital_procedures"   SET "procedure_id"='bruxism-botox' WHERE "procedure_id"='botox';
UPDATE "doctor_procedures"     SET "procedure_id"='bruxism-botox', "id"='dp-'||"doctor_id"||'-bruxism-botox'   WHERE "procedure_id"='botox' AND "id"='dp-'||"doctor_id"||'-botox';
UPDATE "doctor_procedures"     SET "procedure_id"='bruxism-botox' WHERE "procedure_id"='botox';
UPDATE "hospital_sponsorships" SET "procedure_id"='bruxism-botox', "id"='sp-'||"hospital_id"||'-bruxism-botox' WHERE "procedure_id"='botox' AND "id"='sp-'||"hospital_id"||'-botox';
UPDATE "hospital_sponsorships" SET "procedure_id"='bruxism-botox' WHERE "procedure_id"='botox';
UPDATE "consult_requests"      SET "procedure_id"='bruxism-botox' WHERE "procedure_id"='botox';
UPDATE "reviews"               SET "procedure_id"='bruxism-botox' WHERE "procedure_id"='botox';
UPDATE "promotions"            SET "procedure_id"='bruxism-botox' WHERE "procedure_id"='botox';
UPDATE "guides"                SET "procedure_id"='bruxism-botox' WHERE "procedure_id"='botox';
UPDATE "qa_posts"              SET "procedure_id"='bruxism-botox' WHERE "procedure_id"='botox';

-- 7) 옛 6행 삭제. 자식이 하나도 안 남아 있어야 하므로 RESTRICT 가 안전망이 된다
DELETE FROM "procedures" WHERE "id" IN ('implant','orthodontics','cavity','gum-disease','tmj','botox');

-- 8) category_id 를 NOT NULL + FK 로 굳힌다 (SQLite 는 테이블 재작성이다).
--    Prisma 가 만든 블록 그대로이고, INSERT ... SELECT 에 "category_id" 를 더한 것만 다르다
--    (4·5단계가 모든 행에 값을 채워 두었다).
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_procedures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "category_id" TEXT NOT NULL,
    CONSTRAINT "procedures_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "procedure_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_procedures" ("description", "emoji", "id", "name", "short_description", "sort_order", "category_id") SELECT "description", "emoji", "id", "name", "short_description", "sort_order", "category_id" FROM "procedures";
DROP TABLE "procedures";
ALTER TABLE "new_procedures" RENAME TO "procedures";
CREATE INDEX "procedures_sort_order_idx" ON "procedures"("sort_order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
