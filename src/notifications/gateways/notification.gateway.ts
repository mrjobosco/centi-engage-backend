import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { NotificationLoggerService } from '../services/notification-logger.service';

@WebSocketGateway({
  cors: {
    origin: process.env.WEBSOCKET_CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly connectedUsers = new Map<string, Socket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly tenantContextService: TenantContextService,
    private readonly notificationLogger: NotificationLoggerService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = await this.validateToken(token);
      if (!payload) {
        this.logger.warn(`Connection rejected: Invalid token`);
        client.disconnect();
        return;
      }

      // Store user information in socket
      client.data.userId = payload.userId;
      client.data.tenantId = payload.tenantId;

      // Join tenant-specific room
      const tenantRoom = `tenant:${payload.tenantId}`;
      const userRoom = `user:${payload.userId}`;

      await client.join([tenantRoom, userRoom]);

      // Store connection for direct messaging
      this.connectedUsers.set(payload.userId, client);

      // Log structured connection event
      this.notificationLogger.logWebSocketEvent(
        'connection',
        payload.tenantId,
        payload.userId,
        client.id,
        undefined,
        {
          tenant_room: tenantRoom,
          user_room: userRoom,
        },
      );

      this.logger.log(
        `User ${payload.userId} connected to tenant ${payload.tenantId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log structured error event
      this.notificationLogger.logWebSocketEvent(
        'error',
        'unknown',
        undefined,
        client.id,
        errorMessage,
      );

      this.logger.error(`Connection error: ${errorMessage}`);
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const userId = client.data?.userId;
    const tenantId = client.data?.tenantId;

    if (userId) {
      this.connectedUsers.delete(userId);

      // Log structured disconnection event
      this.notificationLogger.logWebSocketEvent(
        'disconnection',
        tenantId || 'unknown',
        userId,
        client.id,
      );

      this.logger.log(`User ${userId} disconnected`);
    }
  }

  /**
   * Emit notification to a specific user
   */
  emitNotification(userId: string, notification: any): void {
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit('notification', notification);

    // Log structured notification push event
    this.notificationLogger.logWebSocketEvent(
      'notification_pushed',
      notification.tenantId || 'unknown',
      userId,
      undefined,
      undefined,
      {
        notification_id: notification.id,
        category: notification.category,
        type: notification.type,
      },
    );

    this.logger.debug(`Notification emitted to user ${userId}`);
  }

  /**
   * Emit unread count update to a specific user
   */
  emitUnreadCount(userId: string, count: number): void {
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit('unreadCount', { count });
    this.logger.debug(`Unread count ${count} emitted to user ${userId}`);
  }

  /**
   * Emit notification to all users in a tenant
   */
  emitToTenant(tenantId: string, event: string, data: any): void {
    const tenantRoom = `tenant:${tenantId}`;
    this.server.to(tenantRoom).emit(event, data);
    this.logger.debug(`Event ${event} emitted to tenant ${tenantId}`);
  }

  /**
   * Get count of connected users for a tenant
   */
  async getTenantConnectionCount(tenantId: string): Promise<number> {
    const tenantRoom = `tenant:${tenantId}`;
    const sockets = await this.server.in(tenantRoom).fetchSockets();
    return sockets.length;
  }

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  private extractTokenFromSocket(client: Socket): string | null {
    // Try to get token from auth header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to get token from query parameters
    const token = client.handshake.query.token;
    if (typeof token === 'string') {
      return token;
    }

    // Try to get token from auth object (for some client implementations)
    const auth = client.handshake.auth;
    if (auth && typeof auth.token === 'string') {
      return auth.token;
    }

    return null;
  }

  private async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      return payload;
    } catch (error) {
      this.logger.warn(
        `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }
}
