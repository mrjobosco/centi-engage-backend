-- CreateExtension
-- Add Google authentication fields to users table
ALTER TABLE "users" ADD COLUMN "google_id" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "google_linked_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "auth_methods" TEXT[] DEFAULT ARRAY['password'];

-- Add Google SSO configuration fields to tenants table
ALTER TABLE "tenants" ADD COLUMN "google_sso_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "google_auto_provision" BOOLEAN NOT NULL DEFAULT false;

-- Add auth_method field to notification_audit_logs table
ALTER TABLE "notification_audit_logs" ADD COLUMN "auth_method" VARCHAR(50);

-- Create indexes for performance
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE INDEX "users_auth_methods_idx" ON "users" USING GIN("auth_methods");
CREATE INDEX "tenants_google_sso_enabled_idx" ON "tenants"("google_sso_enabled");

-- Update existing users to have 'password' auth method if null
UPDATE "users" SET "auth_methods" = ARRAY['password'] WHERE "auth_methods" IS NULL;