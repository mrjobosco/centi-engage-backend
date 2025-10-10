/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { NotificationLoggerService } from '../services/notification-logger.service';
import { Socket, Server } from 'socket.io';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let jwtService: jest.Mocked<JwtService>;

  let mockSocket: jest.Mocked<Socket>;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    const mockJwtService = {
      verifyAsync: jest.fn(),
    };

    const mockTenantContextService = {
      setTenantId: jest.fn(),
      getTenantId: jest.fn(),
    };

    const mockNotificationLoggerService = {
      logWebSocketEvent: jest.fn(),
      logNotificationCreated: jest.fn(),
      logDeliveryAttempt: jest.fn(),
      logDeliverySuccess: jest.fn(),
      logDeliveryFailure: jest.fn(),
    };

    mockSocket = {
      data: {},
      handshake: {
        headers: {},
        query: {},
        auth: {},
      },
      join: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      fetchSockets: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
        {
          provide: NotificationLoggerService,
          useValue: mockNotificationLoggerService,
        },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);
    jwtService = module.get(JwtService);

    // Set the server property
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should authenticate user and join rooms on valid token', async () => {
      const token = 'valid-token';
      const payload = { userId: 'user-1', tenantId: 'tenant-1' };

      mockSocket.handshake.headers.authorization = `Bearer ${token}`;
      jwtService.verifyAsync.mockResolvedValue(payload as any);

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token);
      expect(mockSocket.data.userId).toBe(payload.userId);
      expect(mockSocket.data.tenantId).toBe(payload.tenantId);
      expect(mockSocket.join).toHaveBeenCalledWith([
        'tenant:tenant-1',
        'user:user-1',
      ]);
    });

    it('should disconnect client when no token provided', async () => {
      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client when token is invalid', async () => {
      const token = 'invalid-token';
      mockSocket.handshake.headers.authorization = `Bearer ${token}`;
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should extract token from query parameters', async () => {
      const token = 'valid-token';
      const payload = { userId: 'user-1', tenantId: 'tenant-1' };

      mockSocket.handshake.query.token = token;
      jwtService.verifyAsync.mockResolvedValue(payload as any);

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token);
      expect(mockSocket.data.userId).toBe(payload.userId);
    });

    it('should extract token from auth object', async () => {
      const token = 'valid-token';
      const payload = { userId: 'user-1', tenantId: 'tenant-1' };

      mockSocket.handshake.auth.token = token;
      jwtService.verifyAsync.mockResolvedValue(payload as any);

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token);
      expect(mockSocket.data.userId).toBe(payload.userId);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove user from connected users map', () => {
      mockSocket.data = { userId: 'user-1' };

      gateway.handleDisconnect(mockSocket);

      expect(gateway.isUserConnected('user-1')).toBe(false);
    });

    it('should handle disconnect when no userId in socket data', () => {
      mockSocket.data = {};

      gateway.handleDisconnect(mockSocket);

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('emitNotification', () => {
    it('should emit notification to specific user room', () => {
      const userId = 'user-1';
      const notification = { id: '1', title: 'Test', message: 'Test message' };

      gateway.emitNotification(userId, notification);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'notification',
        notification,
      );
    });
  });

  describe('emitUnreadCount', () => {
    it('should emit unread count to specific user room', () => {
      const userId = 'user-1';
      const count = 5;

      gateway.emitUnreadCount(userId, count);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-1');
      expect(mockServer.emit).toHaveBeenCalledWith('unreadCount', { count });
    });
  });

  describe('emitToTenant', () => {
    it('should emit event to all users in tenant room', () => {
      const tenantId = 'tenant-1';
      const event = 'tenantNotification';
      const data = { message: 'Tenant-wide message' };

      gateway.emitToTenant(tenantId, event, data);

      expect(mockServer.to).toHaveBeenCalledWith('tenant:tenant-1');
      expect(mockServer.emit).toHaveBeenCalledWith(event, data);
    });
  });

  describe('getTenantConnectionCount', () => {
    it('should return count of connected users in tenant', async () => {
      const tenantId = 'tenant-1';
      const mockSockets = [mockSocket, mockSocket, mockSocket];
      mockServer.fetchSockets.mockResolvedValue(mockSockets as any);

      const count = await gateway.getTenantConnectionCount(tenantId);

      expect(mockServer.in).toHaveBeenCalledWith('tenant:tenant-1');
      expect(mockServer.fetchSockets).toHaveBeenCalled();
      expect(count).toBe(3);
    });
  });

  describe('isUserConnected', () => {
    it('should return true when user is connected', async () => {
      const userId = 'user-1';
      const payload = { userId: userId, tenantId: 'tenant-1' };

      mockSocket.handshake.headers.authorization = 'Bearer valid-token';
      jwtService.verifyAsync.mockResolvedValue(payload as any);

      await gateway.handleConnection(mockSocket);

      expect(gateway.isUserConnected(userId)).toBe(true);
    });

    it('should return false when user is not connected', () => {
      expect(gateway.isUserConnected('non-existent-user')).toBe(false);
    });
  });
});
