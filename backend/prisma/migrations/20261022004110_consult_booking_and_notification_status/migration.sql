/*
  Warnings:

  - Added the required column `phone_digits` to the `consult_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "consult_status" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_consult_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "doctor_id" TEXT,
    "procedure_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_digits" TEXT NOT NULL,
    "preferred_time" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "visit_at" DATETIME,
    "third_party_consent_agreed_at" DATETIME,
    "third_party_consent_notice_version" TEXT,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "consult_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "consult_requests_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "consult_requests_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "consult_requests_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_consult_requests" ("created_at", "doctor_id", "hospital_id", "id", "message", "name", "phone", "preferred_time", "procedure_id", "status", "updated_at", "user_id") SELECT "created_at", "doctor_id", "hospital_id", "id", "message", "name", "phone", "preferred_time", "procedure_id", "status", "updated_at", "user_id" FROM "consult_requests";
DROP TABLE "consult_requests";
ALTER TABLE "new_consult_requests" RENAME TO "consult_requests";
CREATE INDEX "consult_requests_hospital_id_created_at_idx" ON "consult_requests"("hospital_id", "created_at");
CREATE INDEX "consult_requests_user_id_created_at_idx" ON "consult_requests"("user_id", "created_at");
CREATE INDEX "consult_requests_status_created_at_idx" ON "consult_requests"("status", "created_at");
CREATE INDEX "consult_requests_hospital_id_status_created_at_idx" ON "consult_requests"("hospital_id", "status", "created_at");
CREATE INDEX "consult_requests_hospital_id_visit_at_idx" ON "consult_requests"("hospital_id", "visit_at");
CREATE INDEX "consult_requests_created_at_idx" ON "consult_requests"("created_at");
CREATE INDEX "consult_requests_doctor_id_idx" ON "consult_requests"("doctor_id");
CREATE TABLE "new_consult_status_changes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consult_request_id" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT 'status_change',
    "status" TEXT NOT NULL,
    "changed_at" DATETIME NOT NULL,
    "changed_by_user_id" TEXT,
    "visit_at" DATETIME,
    "cancel_reason" TEXT,
    "notification_id" TEXT,
    CONSTRAINT "consult_status_changes_consult_request_id_fkey" FOREIGN KEY ("consult_request_id") REFERENCES "consult_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "consult_status_changes_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "consult_status_changes_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_consult_status_changes" ("changed_at", "changed_by_user_id", "consult_request_id", "id", "status") SELECT "changed_at", "changed_by_user_id", "consult_request_id", "id", "status" FROM "consult_status_changes";
DROP TABLE "consult_status_changes";
ALTER TABLE "new_consult_status_changes" RENAME TO "consult_status_changes";
CREATE INDEX "consult_status_changes_consult_request_id_changed_at_idx" ON "consult_status_changes"("consult_request_id", "changed_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
