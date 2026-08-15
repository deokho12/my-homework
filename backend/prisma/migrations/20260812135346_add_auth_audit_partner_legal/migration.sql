-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jti" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "used_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor_user_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "hospital_id" TEXT,
    "pii_masked" BOOLEAN,
    "request_id" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "before_value" TEXT,
    "after_value" TEXT,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "partner_inquiries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "region" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "review_note" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" DATETIME,
    "linked_hospital_id" TEXT,
    "received_at" DATETIME NOT NULL,
    "pii_purged_at" DATETIME,
    CONSTRAINT "partner_inquiries_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "partner_inquiries_linked_hospital_id_fkey" FOREIGN KEY ("linked_hospital_id") REFERENCES "hospitals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requires_agreement" BOOLEAN NOT NULL DEFAULT true,
    "effective_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_agreements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "legal_document_id" TEXT NOT NULL,
    "agreed_at" DATETIME NOT NULL,
    CONSTRAINT "user_agreements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_agreements_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "legal_documents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_doctor_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctor_id" TEXT NOT NULL,
    "submitted_specialty" TEXT NOT NULL,
    "submitted_certificate_url" TEXT,
    "status" TEXT NOT NULL,
    "rejection_reason" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "doctor_verifications_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doctor_verifications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_doctor_verifications" ("created_at", "doctor_id", "id", "rejection_reason", "reviewed_at", "reviewed_by_user_id", "status", "submitted_certificate_url", "submitted_specialty") SELECT "created_at", "doctor_id", "id", "rejection_reason", "reviewed_at", "reviewed_by_user_id", "status", "submitted_certificate_url", "submitted_specialty" FROM "doctor_verifications";
DROP TABLE "doctor_verifications";
ALTER TABLE "new_doctor_verifications" RENAME TO "doctor_verifications";
CREATE INDEX "doctor_verifications_doctor_id_created_at_idx" ON "doctor_verifications"("doctor_id", "created_at");
CREATE INDEX "doctor_verifications_status_created_at_idx" ON "doctor_verifications"("status", "created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_expires_at_idx" ON "refresh_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_hospital_id_created_at_idx" ON "audit_logs"("hospital_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "partner_inquiries_status_received_at_idx" ON "partner_inquiries"("status", "received_at");

-- CreateIndex
CREATE INDEX "partner_inquiries_received_at_idx" ON "partner_inquiries"("received_at");

-- CreateIndex
CREATE INDEX "legal_documents_slug_effective_at_idx" ON "legal_documents"("slug", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_slug_version_key" ON "legal_documents"("slug", "version");

-- CreateIndex
CREATE INDEX "user_agreements_legal_document_id_idx" ON "user_agreements"("legal_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_agreements_user_id_legal_document_id_key" ON "user_agreements"("user_id", "legal_document_id");
