ALTER TABLE "users" ADD COLUMN "google_subject" TEXT;
CREATE UNIQUE INDEX "users_tenant_id_google_subject_key" ON "users"("tenant_id", "google_subject");
