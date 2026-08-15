-- CreateTable
CREATE TABLE "procedures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "password_hash" TEXT,
    "password_salt" TEXT,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "hospital_admins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "hospital_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hospital_admins_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "specialty" TEXT,
    "region" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "introduction" TEXT NOT NULL DEFAULT '',
    "directions" TEXT NOT NULL DEFAULT '',
    "price_min" INTEGER NOT NULL,
    "price_max" INTEGER NOT NULL,
    "rating" REAL NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "consult_count" INTEGER NOT NULL DEFAULT 0,
    "consult_available" BOOLEAN NOT NULL DEFAULT true,
    "is_one_day" BOOLEAN NOT NULL DEFAULT false,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "feature_coordinator" BOOLEAN NOT NULL DEFAULT false,
    "feature_painless_anesthesia" BOOLEAN NOT NULL DEFAULT false,
    "feature_digital_care" BOOLEAN NOT NULL DEFAULT false,
    "feature_parking" BOOLEAN NOT NULL DEFAULT false,
    "feature_night_consult" BOOLEAN NOT NULL DEFAULT false,
    "feature_cctv" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "hospital_procedures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,
    CONSTRAINT "hospital_procedures_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hospital_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hospital_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "hospital_images_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hospital_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "tag_normalized" TEXT NOT NULL,
    CONSTRAINT "hospital_tags_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hospital_event_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "hospital_event_notes_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "hours" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "business_hours_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hospital_sponsorships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "hospital_sponsorships_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hospital_sponsorships_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '원장',
    "specialty" TEXT NOT NULL,
    "photo" TEXT NOT NULL DEFAULT '',
    "rating" REAL NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "consult_count" INTEGER NOT NULL DEFAULT 0,
    "years_of_experience" INTEGER NOT NULL DEFAULT 0,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "certificate_url" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "verified_specialty" TEXT,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "doctors_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "doctor_procedures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctor_id" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,
    CONSTRAINT "doctor_procedures_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doctor_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "doctor_careers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctor_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "doctor_careers_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "doctor_verifications" (
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
    CONSTRAINT "doctor_verifications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "consult_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "doctor_id" TEXT,
    "procedure_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferred_time" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "consult_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "consult_requests_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "consult_requests_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "consult_requests_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "consult_status_changes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consult_request_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "changed_at" DATETIME NOT NULL,
    "changed_by_user_id" TEXT,
    CONSTRAINT "consult_status_changes_consult_request_id_fkey" FOREIGN KEY ("consult_request_id") REFERENCES "consult_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "consult_status_changes_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "consult_memos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consult_request_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "author_user_id" TEXT,
    CONSTRAINT "consult_memos_consult_request_id_fkey" FOREIGN KEY ("consult_request_id") REFERENCES "consult_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "consult_memos_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "favorites_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "reviews_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reviews_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "review_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "review_photos_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospital_id" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "original_price" INTEGER NOT NULL,
    "sale_price" INTEGER NOT NULL,
    "badge" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "promotions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promotions_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "guides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "guides_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "guide_hospitals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guide_id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "guide_hospitals_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "guide_hospitals_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "qa_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "qa_posts_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "qa_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "qa_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "post_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_user_id" TEXT,
    "author_name" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "hospital_id" TEXT,
    "doctor_id" TEXT,
    "is_dentist" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "qa_answers_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "qa_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "qa_answers_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "qa_answers_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "qa_answers_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "audience" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "related_type" TEXT,
    "related_id" TEXT,
    "hospital_id" TEXT,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "notifications_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" DATETIME,
    CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notification_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "procedures_sort_order_idx" ON "procedures"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "hospital_admins_hospital_id_idx" ON "hospital_admins"("hospital_id");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_admins_user_id_hospital_id_key" ON "hospital_admins"("user_id", "hospital_id");

-- CreateIndex
CREATE INDEX "hospitals_name_normalized_idx" ON "hospitals"("name_normalized");

-- CreateIndex
CREATE INDEX "hospitals_rating_idx" ON "hospitals"("rating");

-- CreateIndex
CREATE INDEX "hospitals_review_count_idx" ON "hospitals"("review_count");

-- CreateIndex
CREATE INDEX "hospitals_consult_count_idx" ON "hospitals"("consult_count");

-- CreateIndex
CREATE INDEX "hospitals_deleted_at_idx" ON "hospitals"("deleted_at");

-- CreateIndex
CREATE INDEX "hospital_procedures_procedure_id_idx" ON "hospital_procedures"("procedure_id");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_procedures_hospital_id_procedure_id_key" ON "hospital_procedures"("hospital_id", "procedure_id");

-- CreateIndex
CREATE INDEX "hospital_images_hospital_id_sort_order_idx" ON "hospital_images"("hospital_id", "sort_order");

-- CreateIndex
CREATE INDEX "hospital_tags_tag_normalized_idx" ON "hospital_tags"("tag_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_tags_hospital_id_tag_normalized_key" ON "hospital_tags"("hospital_id", "tag_normalized");

-- CreateIndex
CREATE INDEX "hospital_event_notes_hospital_id_sort_order_idx" ON "hospital_event_notes"("hospital_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_hospital_id_day_of_week_key" ON "business_hours"("hospital_id", "day_of_week");

-- CreateIndex
CREATE INDEX "hospital_sponsorships_procedure_id_start_date_end_date_idx" ON "hospital_sponsorships"("procedure_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "hospital_sponsorships_hospital_id_end_date_idx" ON "hospital_sponsorships"("hospital_id", "end_date");

-- CreateIndex
CREATE INDEX "doctors_hospital_id_idx" ON "doctors"("hospital_id");

-- CreateIndex
CREATE INDEX "doctors_name_normalized_idx" ON "doctors"("name_normalized");

-- CreateIndex
CREATE INDEX "doctors_verification_status_idx" ON "doctors"("verification_status");

-- CreateIndex
CREATE INDEX "doctors_rating_idx" ON "doctors"("rating");

-- CreateIndex
CREATE INDEX "doctors_review_count_idx" ON "doctors"("review_count");

-- CreateIndex
CREATE INDEX "doctors_consult_count_idx" ON "doctors"("consult_count");

-- CreateIndex
CREATE INDEX "doctors_years_of_experience_idx" ON "doctors"("years_of_experience");

-- CreateIndex
CREATE INDEX "doctors_deleted_at_idx" ON "doctors"("deleted_at");

-- CreateIndex
CREATE INDEX "doctor_procedures_procedure_id_idx" ON "doctor_procedures"("procedure_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_procedures_doctor_id_procedure_id_key" ON "doctor_procedures"("doctor_id", "procedure_id");

-- CreateIndex
CREATE INDEX "doctor_careers_doctor_id_sort_order_idx" ON "doctor_careers"("doctor_id", "sort_order");

-- CreateIndex
CREATE INDEX "doctor_verifications_doctor_id_created_at_idx" ON "doctor_verifications"("doctor_id", "created_at");

-- CreateIndex
CREATE INDEX "doctor_verifications_status_created_at_idx" ON "doctor_verifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "consult_requests_hospital_id_created_at_idx" ON "consult_requests"("hospital_id", "created_at");

-- CreateIndex
CREATE INDEX "consult_requests_user_id_created_at_idx" ON "consult_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "consult_requests_status_created_at_idx" ON "consult_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "consult_requests_created_at_idx" ON "consult_requests"("created_at");

-- CreateIndex
CREATE INDEX "consult_requests_doctor_id_idx" ON "consult_requests"("doctor_id");

-- CreateIndex
CREATE INDEX "consult_status_changes_consult_request_id_changed_at_idx" ON "consult_status_changes"("consult_request_id", "changed_at");

-- CreateIndex
CREATE INDEX "consult_memos_consult_request_id_created_at_idx" ON "consult_memos"("consult_request_id", "created_at");

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "favorites_hospital_id_idx" ON "favorites"("hospital_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_hospital_id_key" ON "favorites"("user_id", "hospital_id");

-- CreateIndex
CREATE INDEX "reviews_hospital_id_created_at_idx" ON "reviews"("hospital_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_procedure_id_idx" ON "reviews"("procedure_id");

-- CreateIndex
CREATE INDEX "review_photos_review_id_sort_order_idx" ON "review_photos"("review_id", "sort_order");

-- CreateIndex
CREATE INDEX "promotions_hospital_id_start_date_end_date_idx" ON "promotions"("hospital_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "promotions_procedure_id_start_date_end_date_idx" ON "promotions"("procedure_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "guides_procedure_id_idx" ON "guides"("procedure_id");

-- CreateIndex
CREATE INDEX "guides_created_at_idx" ON "guides"("created_at");

-- CreateIndex
CREATE INDEX "guide_hospitals_hospital_id_idx" ON "guide_hospitals"("hospital_id");

-- CreateIndex
CREATE UNIQUE INDEX "guide_hospitals_guide_id_hospital_id_key" ON "guide_hospitals"("guide_id", "hospital_id");

-- CreateIndex
CREATE INDEX "qa_posts_created_at_idx" ON "qa_posts"("created_at");

-- CreateIndex
CREATE INDEX "qa_posts_procedure_id_idx" ON "qa_posts"("procedure_id");

-- CreateIndex
CREATE INDEX "qa_posts_author_user_id_idx" ON "qa_posts"("author_user_id");

-- CreateIndex
CREATE INDEX "qa_posts_deleted_at_idx" ON "qa_posts"("deleted_at");

-- CreateIndex
CREATE INDEX "qa_answers_post_id_created_at_idx" ON "qa_answers"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "qa_answers_author_user_id_idx" ON "qa_answers"("author_user_id");

-- CreateIndex
CREATE INDEX "qa_answers_doctor_id_idx" ON "qa_answers"("doctor_id");

-- CreateIndex
CREATE INDEX "qa_answers_hospital_id_idx" ON "qa_answers"("hospital_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_audience_created_at_idx" ON "notifications"("audience", "created_at");

-- CreateIndex
CREATE INDEX "notifications_related_type_related_id_idx" ON "notifications"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "notifications_hospital_id_created_at_idx" ON "notifications"("hospital_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_recipients_user_id_read_at_idx" ON "notification_recipients"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipients_notification_id_user_id_key" ON "notification_recipients"("notification_id", "user_id");
