import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEventListener } from './notification-event.listener';
import { NotificationService } from '../services/notification.service';
import { NotificationType, NotificationPriority } from '../enums';
import {
  UserCreatedEvent,
  ProjectCreatedEvent,
  RoleAssignedEvent,
  SystemMaintenanceEvent,
  SecurityAlertEvent,
  InvoiceGeneratedEvent,
} from '../events';

describe('NotificationEventListener', () => {
  let listener: NotificationEventListener;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const mockNotificationService = {
      create: jest.fn(),
      sendToTenant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventListener,
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    listener = module.get<NotificationEventListener>(NotificationEventListener);
    notificationService = module.get(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleUserCreated', () => {
    it('should create a welcome notification for new user', async () => {
      const event: UserCreatedEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'test@example.com',
        userName: 'Test User',
        timestamp: new Date(),
      };

      await listener.handleUserCreated(event);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        category: 'user_management',
        type: NotificationType.SUCCESS,
        title: 'Welcome to the platform!',
        message:
          'Welcome Test User! Your account has been successfully created.',
        priority: NotificationPriority.MEDIUM,
        data: {
          userEmail: 'test@example.com',
          userName: 'Test User',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      const event: UserCreatedEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'test@example.com',
        userName: 'Test User',
        timestamp: new Date(),
      };

      notificationService.create.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(listener.handleUserCreated(event)).resolves.toBeUndefined();
    });
  });

  describe('handleProjectCreated', () => {
    it('should create a project creation notification', async () => {
      const event: ProjectCreatedEvent = {
        tenantId: 'tenant-1',
        projectId: 'project-1',
        projectName: 'Test Project',
        projectDescription: 'A test project',
        createdBy: 'user-1',
        timestamp: new Date(),
      };

      await listener.handleProjectCreated(event);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        category: 'project_management',
        type: NotificationType.SUCCESS,
        title: 'Project Created',
        message: 'Project "Test Project" has been successfully created.',
        priority: NotificationPriority.MEDIUM,
        data: {
          projectId: 'project-1',
          projectName: 'Test Project',
          projectDescription: 'A test project',
        },
      });
    });
  });

  describe('handleRoleAssigned', () => {
    it('should create a role assignment notification', async () => {
      const event: RoleAssignedEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        roleId: 'role-1',
        roleName: 'Admin',
        assignedBy: 'user-2',
        timestamp: new Date(),
      };

      await listener.handleRoleAssigned(event);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        category: 'access_management',
        type: NotificationType.INFO,
        title: 'Role Assigned',
        message: 'You have been assigned the role "Admin".',
        priority: NotificationPriority.MEDIUM,
        data: {
          roleId: 'role-1',
          roleName: 'Admin',
          assignedBy: 'user-2',
        },
      });
    });
  });

  describe('handleSystemMaintenance', () => {
    it('should create system maintenance notification for scheduled maintenance', async () => {
      const event: SystemMaintenanceEvent = {
        tenantId: 'tenant-1',
        maintenanceType: 'scheduled',
        startTime: new Date('2024-01-01T02:00:00Z'),
        endTime: new Date('2024-01-01T04:00:00Z'),
        description: 'Scheduled maintenance for system updates',
        timestamp: new Date(),
      };

      await listener.handleSystemMaintenance(event);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.sendToTenant).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        category: 'system',
        type: NotificationType.WARNING,
        title: 'Scheduled Maintenance',
        message: 'Scheduled maintenance for system updates',
        priority: NotificationPriority.HIGH,
        data: {
          maintenanceType: 'scheduled',
          startTime: event.startTime,
          endTime: event.endTime,
        },
      });
    });

    it('should create urgent notification for emergency maintenance', async () => {
      const event: SystemMaintenanceEvent = {
        tenantId: 'tenant-1',
        maintenanceType: 'emergency',
        startTime: new Date(),
        description: 'Emergency maintenance due to security issue',
        timestamp: new Date(),
      };

      await listener.handleSystemMaintenance(event);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.sendToTenant).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        category: 'system',
        type: NotificationType.WARNING,
        title: 'Emergency Maintenance',
        message: 'Emergency maintenance due to security issue',
        priority: NotificationPriority.URGENT,
        data: {
          maintenanceType: 'emergency',
          startTime: event.startTime,
          endTime: undefined,
        },
      });
    });
  });

  describe('handleSecurityAlert', () => {
    it('should create security alert notification for specific user', async () => {
      const event: SecurityAlertEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        alertType: 'login_attempt',
        severity: 'high',
        description: 'Suspicious login attempt detected',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        timestamp: new Date(),
      };

      await listener.handleSecurityAlert(event);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        category: 'security',
        type: NotificationType.ERROR,
        title: 'Security Alert',
        message: 'Suspicious login attempt detected',
        priority: NotificationPriority.HIGH,
        data: {
          alertType: 'login_attempt',
          severity: 'high',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
        },
      });
    });

    it('should send to all tenant users when no specific user', async () => {
      const event: SecurityAlertEvent = {
        tenantId: 'tenant-1',
        alertType: 'suspicious_activity',
        severity: 'critical',
        description: 'Critical security breach detected',
        timestamp: new Date(),
      };

      await listener.handleSecurityAlert(event);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.sendToTenant).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: undefined,
        category: 'security',
        type: NotificationType.ERROR,
        title: 'Security Alert',
        message: 'Critical security breach detected',
        priority: NotificationPriority.URGENT,
        data: {
          alertType: 'suspicious_activity',
          severity: 'critical',
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should map severity levels to correct priorities', async () => {
      const severityToPriority = [
        { severity: 'low', priority: NotificationPriority.LOW },
        { severity: 'medium', priority: NotificationPriority.MEDIUM },
        { severity: 'high', priority: NotificationPriority.HIGH },
        { severity: 'critical', priority: NotificationPriority.URGENT },
      ];

      for (const { severity, priority } of severityToPriority) {
        const event: SecurityAlertEvent = {
          tenantId: 'tenant-1',
          userId: 'user-1',
          alertType: 'login_attempt',
          severity: severity as 'low' | 'medium' | 'high' | 'critical',
          description: `${severity} security alert`,
          timestamp: new Date(),
        };

        await listener.handleSecurityAlert(event);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(notificationService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            priority,
          }),
        );
      }
    });
  });

  describe('handleInvoiceGenerated', () => {
    it('should create invoice generated notification', async () => {
      const event: InvoiceGeneratedEvent = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        invoiceId: 'invoice-1',
        invoiceNumber: 'INV-001',
        amount: 100.0,
        currency: 'USD',
        dueDate: new Date('2024-02-01'),
        customerId: 'customer-1',
        timestamp: new Date(),
      };

      await listener.handleInvoiceGenerated(event);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(notificationService.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        category: 'billing',
        type: NotificationType.INFO,
        title: 'New Invoice Generated',
        message: 'Invoice #INV-001 for 100 USD has been generated.',
        priority: NotificationPriority.MEDIUM,
        data: {
          invoiceId: 'invoice-1',
          invoiceNumber: 'INV-001',
          amount: 100.0,
          currency: 'USD',
          dueDate: event.dueDate,
          customerId: 'customer-1',
        },
      });
    });
  });
});
