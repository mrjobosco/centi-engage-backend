-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tenant_invitations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invitation_roles" (
    "invitationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "tenant_invitation_roles_pkey" PRIMARY KEY ("invitationId","roleId")
);

-- CreateTable
CREATE TABLE "invitation_audit_logs" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_token_key" ON "tenant_invitations"("token");

-- CreateIndex
CREATE INDEX "tenant_invitations_tenantId_idx" ON "tenant_invitations"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_invitations_token_idx" ON "tenant_invitations"("token");

-- CreateIndex
CREATE INDEX "tenant_invitations_email_idx" ON "tenant_invitations"("email");

-- CreateIndex
CREATE INDEX "tenant_invitations_status_idx" ON "tenant_invitations"("status");

-- CreateIndex
CREATE INDEX "tenant_invitations_expiresAt_idx" ON "tenant_invitations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_tenantId_email_status_key" ON "tenant_invitations"("tenantId", "email", "status");

-- CreateIndex
CREATE INDEX "tenant_invitation_roles_invitationId_idx" ON "tenant_invitation_roles"("invitationId");

-- CreateIndex
CREATE INDEX "tenant_invitation_roles_roleId_idx" ON "tenant_invitation_roles"("roleId");

-- CreateIndex
CREATE INDEX "invitation_audit_logs_invitationId_idx" ON "invitation_audit_logs"("invitationId");

-- CreateIndex
CREATE INDEX "invitation_audit_logs_action_idx" ON "invitation_audit_logs"("action");

-- CreateIndex
CREATE INDEX "invitation_audit_logs_createdAt_idx" ON "invitation_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitation_roles" ADD CONSTRAINT "tenant_invitation_roles_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "tenant_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitation_roles" ADD CONSTRAINT "tenant_invitation_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_audit_logs" ADD CONSTRAINT "invitation_audit_logs_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "tenant_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_audit_logs" ADD CONSTRAINT "invitation_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
