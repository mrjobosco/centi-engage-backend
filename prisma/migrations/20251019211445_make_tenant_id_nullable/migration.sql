-- AlterTable
ALTER TABLE "users" ALTER COLUMN "tenantId" DROP NOT NULL;

-- Update unique constraints to handle null tenantId properly
-- Drop existing unique constraint
DROP INDEX IF EXISTS "users_email_tenantId_key";

-- Create separate unique indexes for tenant-bound and tenant-less users
-- For users with tenants: email + tenantId must be unique
CREATE UNIQUE INDEX "users_email_tenant_unique" 
ON "users" (email, "tenantId") 
WHERE "tenantId" IS NOT NULL;

-- For tenant-less users: only email must be unique (allows one tenant-less user per email)
CREATE UNIQUE INDEX "users_email_null_tenant_unique" 
ON "users" (email) 
WHERE "tenantId" IS NULL;

-- Create user_tenants junction table for future multi-tenant support
CREATE TABLE "user_tenants" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "joinedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "user_tenants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_tenants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_tenants_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique constraint for user-tenant combination
CREATE UNIQUE INDEX "user_tenants_userId_tenantId_key" ON "user_tenants"("userId", "tenantId");

-- Add indexes for performance optimization
CREATE INDEX "idx_user_tenants_userId" ON "user_tenants"("userId");
CREATE INDEX "idx_user_tenants_tenantId" ON "user_tenants"("tenantId");
CREATE INDEX "idx_user_tenants_roleId" ON "user_tenants"("roleId");
CREATE INDEX "idx_user_tenants_isActive" ON "user_tenants"("isActive");
