import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class RefreshSessionService {
  constructor(private readonly prisma: PrismaService) {}

  private get refreshSessionModel() {
    return (this.prisma as any).refreshSession;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createSession(params: {
    userId: string;
    token: string;
    expiresAt: Date;
    familyId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.refreshSessionModel.create({
      data: {
        userId: params.userId,
        tokenHash: this.hashToken(params.token),
        expiresAt: params.expiresAt,
        familyId: params.familyId || randomUUID(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async getValidSession(sessionId: string, token: string) {
    const session = await this.refreshSessionModel.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    if (session.revokedAt) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const tokenHash = this.hashToken(token);
    if (session.tokenHash !== tokenHash) {
      return null;
    }

    return session;
  }

  async rotateSession(params: {
    currentSessionId: string;
    newToken: string;
    newExpiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const current = await this.refreshSessionModel.findUnique({
      where: { id: params.currentSessionId },
    });

    if (!current) {
      return null;
    }

    const newSession = await this.refreshSessionModel.create({
      data: {
        userId: current.userId,
        familyId: current.familyId,
        tokenHash: this.hashToken(params.newToken),
        expiresAt: params.newExpiresAt,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });

    await this.refreshSessionModel.update({
      where: { id: current.id },
      data: {
        revokedAt: new Date(),
        replacedById: newSession.id,
      },
    });

    return newSession;
  }

  async revokeSessionById(sessionId: string): Promise<void> {
    await this.refreshSessionModel.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.refreshSessionModel.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
