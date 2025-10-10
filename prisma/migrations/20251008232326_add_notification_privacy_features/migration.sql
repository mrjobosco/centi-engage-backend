-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "retentionDate" TIMESTAMP(3),
ADD COLUMN     "sensitiveData" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "notification_audit_logs" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_audit_logs_notificationId_idx" ON "notification_audit_logs"("notificationId");

-- CreateIndex
CREATE INDEX "notification_audit_logs_userId_idx" ON "notification_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "notification_audit_logs_tenantId_idx" ON "notification_audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "notification_audit_logs_action_idx" ON "notification_audit_logs"("action");

-- CreateIndex
CREATE INDEX "notification_audit_logs_createdAt_idx" ON "notification_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_deletedAt_idx" ON "notifications"("deletedAt");

-- CreateIndex
CREATE INDEX "notifications_retentionDate_idx" ON "notifications"("retentionDate");

-- CreateIndex
CREATE INDEX "notifications_sensitiveData_idx" ON "notifications"("sensitiveData");

-- AddForeignKey
ALTER TABLE "notification_audit_logs" ADD CONSTRAINT "notification_audit_logs_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_audit_logs" ADD CONSTRAINT "notification_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_audit_logs" ADD CONSTRAINT "notification_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
