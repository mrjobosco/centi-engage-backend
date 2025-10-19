/*
  Warnings:

  - Made the column `isActive` on table `user_tenants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `joinedAt` on table `user_tenants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `user_tenants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `user_tenants` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "user_tenants" ALTER COLUMN "isActive" SET NOT NULL,
ALTER COLUMN "joinedAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "idx_user_tenants_isActive" RENAME TO "user_tenants_isActive_idx";

-- RenameIndex
ALTER INDEX "idx_user_tenants_roleId" RENAME TO "user_tenants_roleId_idx";

-- RenameIndex
ALTER INDEX "idx_user_tenants_tenantId" RENAME TO "user_tenants_tenantId_idx";

-- RenameIndex
ALTER INDEX "idx_user_tenants_userId" RENAME TO "user_tenants_userId_idx";
