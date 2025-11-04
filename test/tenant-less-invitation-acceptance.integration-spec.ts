import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtService, JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../src/auth/auth.module';
import { TenantModule } from '../src/tenant/tenant.module';
import { InvitationModule } from '../src/invitation/invitation.module';
import { AuthService } from '../src/auth/auth.service';
import { GoogleAuthService } from '../src/auth/services/google-auth.service';
import { TenantManagementService } from '../src/tenant/tenant-management.service';
import { InvitationService } from '../src/invitation/services/invitation.service';
import { InvitationAcceptanceService } from '../src/invitation/services/invitation-acceptance.service';
import { EmailOTPService } from '../src/auth/services/email-otp.service';
import { PrismaService } from '../src/database/prisma.service';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { CreateTenantForUserDto } from '../src/tenant/dto/create-tenant-for-user.dto';
import { CreateInvitationDto } from '../src/invitation/dto/create-invitation.dto';
import configuration from '../src/config/configuration';
import { prisma } from './integration-setup';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvitationStatus } from '../src/invitation/enums/invitation-status.enum';
import { GoogleAuthMetricsService } from '../src/auth/services/google-auth-metrics.service';
import { TenantManagementAuditService } from '../src/tenant/services/tenant-management-audit.service';
import { AuthAuditService } from '../src/auth/services/auth-audit.service';
import { InvitationAuditService } from '../src/invitation/services/invitation-audit.service';

// Mock Redis for BullMQ and other Redis dependencies
jest.mock('ioredis', () => {
  const mockRedis: any = {
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    duplicate: jest.fn(() => mockRedis),
    status: 'ready',
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn(),
    keys: jest.fn(() => []),
    pipeline: jest.fn(() => ({
      exec: jest.fn(() => Promise.resolve([])),
    })),
  };

  const MockRedis = jest.fn(() => mockRedis);
  (MockRedis as any).default = MockRedis;
  return MockRedis;
});

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    process: jest.fn(),
    close: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
  })),
}));

describe('Tenant-less Invitation Acceptance Integration', () => {
  let module: TestingModule;
  let authService: AuthService;
  let tenantManagementService: TenantManagementService;
  let invitationService: InvitationService;

  let jwtService: JwtService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          envFilePath: ['.env.test'],
        }),
        JwtModule.register({
          secret: 'your-secret-key-change-in-production',
          signOptions: { expiresIn: '1h' },
        }),
        AuthModule,
        TenantModule,
        InvitationModule,
      ],
    })
      .overrideProvider(EmailOTPService)
      .useValue({
        generateOTP: jest.fn().mockResolvedValue(undefined),
        verifyOTP: jest.fn().mockResolvedValue(true),
      })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(InvitationAuditService)
      .useValue({
        logInvitationCreated: jest.fn(),
        logInvitationAccepted: jest.fn(),
        logInvitationRejected: jest.fn(),
        logInvitationExpired: jest.fn(),
        logInvitationCancelled: jest.fn(),
      })
      .overrideProvider(AuthAuditService)
      .useValue({
        logRegistration: jest.fn(),
        logLogin: jest.fn(),
        logGoogleAuthentication: jest.fn(),
        logGoogleSettingsUpdate: jest.fn(),
      })
      .overrideProvider(TenantManagementAuditService)
      .useValue({
        logTenantCreation: jest.fn(),
        logTenantJoin: jest.fn(),
      })
      .overrideProvider(GoogleAuthMetricsService)
      .useValue({
        recordAuthentication: jest.fn(),
        recordSignInAttempt: jest.fn(),
        recordTenantLookup: jest.fn(),
        recordUserLookup: jest.fn(),
        recordUserCreation: jest.fn(),
        recordSignInSuccess: jest.fn(),
        recordSignInFailure: jest.fn(),
        startTenantLookupTimer: jest.fn().mockReturnValue({ stop: jest.fn() }),
        startUserLookupTimer: jest.fn().mockReturnValue({ stop: jest.fn() }),
        startUserCreationTimer: jest.fn().mockReturnValue({ stop: jest.fn() }),
      })
      .overrideProvider(AuthService)
      .useClass(AuthService)
      .overrideProvider(GoogleAuthService)
      .useClass(GoogleAuthService)
      .overrideProvider('GoogleOAuthService')
      .useValue({
        exchangeCodeForTokens: jest.fn(),
        verifyIdToken: jest.fn(),
      })
      .overrideProvider('OAuthStateService')
      .useValue({
        generateState: jest.fn(),
        validateState: jest.fn(),
      })
      .overrideProvider(JwtService)
      .useValue({
        sign: jest.fn().mockImplementation((payload) => {
          // Create a mock token that encodes the payload
          return `mock-token-${JSON.stringify(payload)}`;
        }),
        verify: jest.fn().mockImplementation((token) => {
          // Extract payload from mock token
          if (token.startsWith('mock-token-')) {
            return JSON.parse(token.replace('mock-token-', ''));
          }
          return { userId: 'test-user', tenantId: null, roles: [] };
        }),
        decode: jest.fn().mockImplementation((token) => {
          // Extract payload from mock token
          if (token.startsWith('mock-token-')) {
            return JSON.parse(token.replace('mock-token-', ''));
          }
          return { userId: 'test-user', tenantId: null, roles: [] };
        }),
      })
      .compile();

    authService = module.get<AuthService>(AuthService);
    tenantManagementService = module.get<TenantManagementService>(
      TenantManagementService,
    );
    invitationService = module.get<InvitationService>(InvitationService);
    module.get<InvitationAcceptanceService>(InvitationAcceptanceService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Complete Invitation Flow', () => {
    it('should complete full flow from tenant-less user to invitation acceptance', async () => {
      // Step 1: Create tenant admin user
      const adminRegisterDto: RegisterDto = {
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
      };

      const adminUser =
        await authService.registerTenantlessUser(adminRegisterDto);

      // Step 2: Admin creates tenant
      const createTenantDto: CreateTenantForUserDto = {
        tenantName: 'Invitation Test Company',
        description: 'Company for testing invitations',
      };

      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        createTenantDto,
      );

      // Step 3: Register tenant-less user who will receive invitation
      const inviteeRegisterDto: RegisterDto = {
        email: 'invitee@example.com',
        password: 'password123',
        firstName: 'Invitee',
        lastName: 'User',
      };

      const inviteeUser =
        await authService.registerTenantlessUser(inviteeRegisterDto);

      // Verify invitee is tenant-less
      const inviteePayload = jwtService.decode(inviteeUser.accessToken);
      expect(inviteePayload.tenantId).toBeNull();

      // Step 4: Admin creates invitation
      const createInvitationDto: CreateInvitationDto = {
        email: inviteeRegisterDto.email,
        roleIds: [], // Will be assigned default member role
        message: 'Welcome to our company!',
      };

      // Get admin's JWT payload for tenant context
      const adminPayload = jwtService.decode(tenantResult.accessToken);

      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        createInvitationDto,
      );

      expect(invitation).toBeDefined();
      expect(invitation.email).toBe(inviteeRegisterDto.email);
      expect(invitation.status).toBe(InvitationStatus.PENDING);

      // Step 5: Tenant-less user accepts invitation
      const acceptanceResult = await tenantManagementService.joinTenantForUser(
        inviteeUser.user.id,
        invitation.token,
      );

      expect(acceptanceResult).toBeDefined();
      expect(acceptanceResult.tenant.id).toBe(tenantResult.tenant.id);
      expect(acceptanceResult.accessToken).toBeDefined();

      // Verify new JWT token has tenant context
      const newPayload = jwtService.decode(acceptanceResult.accessToken);
      expect(newPayload.userId).toBe(inviteeUser.user.id);
      expect(newPayload.tenantId).toBe(tenantResult.tenant.id);
      expect(newPayload.roles).toHaveLength(1); // Should have member role

      // Verify user is now associated with tenant
      const updatedUser = await prisma.user.findUnique({
        where: { id: inviteeUser.user.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      expect(updatedUser!.tenantId).toBe(tenantResult.tenant.id);
      expect(updatedUser!.roles).toHaveLength(1);

      // Verify invitation is marked as accepted
      const updatedInvitation = await prisma.tenantInvitation.findUnique({
        where: { id: invitation.id },
      });

      expect(updatedInvitation!.status).toBe(InvitationStatus.ACCEPTED);
      expect(updatedInvitation!.acceptedAt).toBeDefined();
    });

    it('should get user tenant status with available invitations', async () => {
      // Create tenant and admin
      const adminRegisterDto: RegisterDto = {
        email: 'status-admin@company.com',
        password: 'password123',
      };

      const adminUser =
        await authService.registerTenantlessUser(adminRegisterDto);
      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Status Test Company' },
      );

      // Create tenant-less user
      const userRegisterDto: RegisterDto = {
        email: 'status-user@example.com',
        password: 'password123',
      };

      const user = await authService.registerTenantlessUser(userRegisterDto);

      // Create invitation for user
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: userRegisterDto.email,
          roleIds: [],
          message: 'Join our team!',
        },
      );

      // Get user tenant status
      const status = await tenantManagementService.getUserTenantStatus(
        user.user.id,
      );

      expect(status).toBeDefined();
      expect(status.hasTenant).toBe(false);
      expect(status.tenant).toBeUndefined();
      expect(status.availableInvitations).toHaveLength(1);
      expect(status.availableInvitations[0].id).toBe(invitation.id);
      expect(status.availableInvitations[0].email).toBe(userRegisterDto.email);
    });
  });

  describe('Invitation Validation and Error Scenarios', () => {
    it('should reject invalid invitation token', async () => {
      const registerDto: RegisterDto = {
        email: 'invalid-token@example.com',
        password: 'password123',
      };

      const user = await authService.registerTenantlessUser(registerDto);

      await expect(
        tenantManagementService.joinTenantForUser(
          user.user.id,
          'invalid-token',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject expired invitation', async () => {
      // Create tenant and admin
      const adminRegisterDto: RegisterDto = {
        email: 'expired-admin@company.com',
        password: 'password123',
      };

      const adminUser =
        await authService.registerTenantlessUser(adminRegisterDto);
      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Expired Test Company' },
      );

      // Create tenant-less user
      const userRegisterDto: RegisterDto = {
        email: 'expired-user@example.com',
        password: 'password123',
      };

      const user = await authService.registerTenantlessUser(userRegisterDto);

      // Create invitation
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: userRegisterDto.email,
          roleIds: [],
        },
      );

      // Manually expire the invitation
      await prisma.tenantInvitation.update({
        where: { id: invitation.id },
        data: { expiresAt: new Date(Date.now() - 1000) }, // 1 second ago
      });

      await expect(
        tenantManagementService.joinTenantForUser(
          user.user.id,
          invitation.token,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invitation for user who already has tenant', async () => {
      // Create first tenant and admin
      const admin1RegisterDto: RegisterDto = {
        email: 'admin1@company.com',
        password: 'password123',
      };

      const admin1User =
        await authService.registerTenantlessUser(admin1RegisterDto);
      const tenant1Result = await tenantManagementService.createTenantForUser(
        admin1User.user.id,
        { tenantName: 'First Company' },
      );

      // Create second tenant and admin
      const admin2RegisterDto: RegisterDto = {
        email: 'admin2@company.com',
        password: 'password123',
      };

      const admin2User =
        await authService.registerTenantlessUser(admin2RegisterDto);
      const tenant2Result = await tenantManagementService.createTenantForUser(
        admin2User.user.id,
        { tenantName: 'Second Company' },
      );

      // Create user and join first tenant
      const userRegisterDto: RegisterDto = {
        email: 'multi-tenant-user@example.com',
        password: 'password123',
      };

      const user = await authService.registerTenantlessUser(userRegisterDto);

      // Create invitation from first tenant
      const admin1Payload = jwtService.decode(tenant1Result.accessToken);
      const invitation1 = await invitationService.createInvitation(
        admin1Payload.userId,
        admin1Payload.tenantId,
        {
          email: userRegisterDto.email,
          roleIds: [],
        },
      );

      // User joins first tenant
      await tenantManagementService.joinTenantForUser(
        user.user.id,
        invitation1.token,
      );

      // Create invitation from second tenant
      const admin2Payload = jwtService.decode(tenant2Result.accessToken);
      const invitation2 = await invitationService.createInvitation(
        admin2Payload.userId,
        admin2Payload.tenantId,
        {
          email: userRegisterDto.email,
          roleIds: [],
        },
      );

      // Attempt to join second tenant should fail
      await expect(
        tenantManagementService.joinTenantForUser(
          user.user.id,
          invitation2.token,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invitation with mismatched email', async () => {
      // Create tenant and admin
      const adminRegisterDto: RegisterDto = {
        email: 'mismatch-admin@company.com',
        password: 'password123',
      };

      const adminUser =
        await authService.registerTenantlessUser(adminRegisterDto);
      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Mismatch Test Company' },
      );

      // Create invitation for different email
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'invited@example.com',
          roleIds: [],
        },
      );

      // Create user with different email
      const userRegisterDto: RegisterDto = {
        email: 'different@example.com',
        password: 'password123',
      };

      const user = await authService.registerTenantlessUser(userRegisterDto);

      // Attempt to accept invitation should fail
      await expect(
        tenantManagementService.joinTenantForUser(
          user.user.id,
          invitation.token,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject already accepted invitation', async () => {
      // Create tenant and admin
      const adminRegisterDto: RegisterDto = {
        email: 'accepted-admin@company.com',
        password: 'password123',
      };

      const adminUser =
        await authService.registerTenantlessUser(adminRegisterDto);
      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Accepted Test Company' },
      );

      // Create first user and invitation
      const user1RegisterDto: RegisterDto = {
        email: 'accepted-user1@example.com',
        password: 'password123',
      };

      const user1 = await authService.registerTenantlessUser(user1RegisterDto);

      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: user1RegisterDto.email,
          roleIds: [],
        },
      );

      // First user accepts invitation
      await tenantManagementService.joinTenantForUser(
        user1.user.id,
        invitation.token,
      );

      // Create second user with same email (different tenant-less user)
      const user2RegisterDto: RegisterDto = {
        email: 'accepted-user2@example.com',
        password: 'password123',
      };

      const user2 = await authService.registerTenantlessUser(user2RegisterDto);

      // Manually update invitation email to match second user
      await prisma.tenantInvitation.update({
        where: { id: invitation.id },
        data: { email: user2RegisterDto.email },
      });

      // Second user attempts to accept already accepted invitation
      await expect(
        tenantManagementService.joinTenantForUser(
          user2.user.id,
          invitation.token,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Multi-Invitation Scenarios', () => {
    it('should handle multiple pending invitations for same user', async () => {
      // Create multiple tenants with admins
      const tenant1Admin = await authService.registerTenantlessUser({
        email: 'admin1@multi.com',
        password: 'password123',
      });

      const tenant1 = await tenantManagementService.createTenantForUser(
        tenant1Admin.user.id,
        { tenantName: 'Multi Company 1' },
      );

      const tenant2Admin = await authService.registerTenantlessUser({
        email: 'admin2@multi.com',
        password: 'password123',
      });

      const tenant2 = await tenantManagementService.createTenantForUser(
        tenant2Admin.user.id,
        { tenantName: 'Multi Company 2' },
      );

      // Create tenant-less user
      const userRegisterDto: RegisterDto = {
        email: 'multi-invite@example.com',
        password: 'password123',
      };

      const user = await authService.registerTenantlessUser(userRegisterDto);

      // Create invitations from both tenants
      const admin1Payload = jwtService.decode(tenant1.accessToken);
      const invitation1 = await invitationService.createInvitation(
        admin1Payload.userId,
        admin1Payload.tenantId,
        {
          email: userRegisterDto.email,
          roleIds: [],
          message: 'Join Company 1',
        },
      );

      const admin2Payload = jwtService.decode(tenant2.accessToken);
      const invitation2 = await invitationService.createInvitation(
        admin2Payload.userId,
        admin2Payload.tenantId,
        {
          email: userRegisterDto.email,
          roleIds: [],
          message: 'Join Company 2',
        },
      );

      // Check user has multiple available invitations
      const status = await tenantManagementService.getUserTenantStatus(
        user.user.id,
      );
      expect(status.availableInvitations).toHaveLength(2);

      const invitationIds = status.availableInvitations.map((inv) => inv.id);
      expect(invitationIds).toContain(invitation1.id);
      expect(invitationIds).toContain(invitation2.id);

      // User accepts first invitation
      const acceptanceResult = await tenantManagementService.joinTenantForUser(
        user.user.id,
        invitation1.token,
      );

      expect(acceptanceResult.tenant.id).toBe(tenant1.tenant.id);

      // Verify user can no longer accept second invitation (already has tenant)
      await expect(
        tenantManagementService.joinTenantForUser(
          user.user.id,
          invitation2.token,
        ),
      ).rejects.toThrow(BadRequestException);

      // Verify second invitation is still pending (not automatically cancelled)
      const remainingInvitation = await prisma.tenantInvitation.findUnique({
        where: { id: invitation2.id },
      });

      expect(remainingInvitation!.status).toBe(InvitationStatus.PENDING);
    });

    it('should handle invitation acceptance with specific roles assignment', async () => {
      // Create tenant and admin
      const adminUser = await authService.registerTenantlessUser({
        email: 'roles-admin@company.com',
        password: 'password123',
      });

      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Roles Test Company' },
      );

      // Get member role ID from the created tenant
      const memberRole = await prisma.role.findFirst({
        where: {
          tenantId: tenantResult.tenant.id,
          name: 'Member',
        },
      });

      expect(memberRole).toBeDefined();

      // Create tenant-less user
      const user = await authService.registerTenantlessUser({
        email: 'roles-user@example.com',
        password: 'password123',
      });

      // Create invitation with specific role
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'roles-user@example.com',
          roleIds: [memberRole!.id],
          message: 'Join as member',
        },
      );

      // Accept invitation
      const acceptanceResult = await tenantManagementService.joinTenantForUser(
        user.user.id,
        invitation.token,
      );

      // Verify role assignment
      const newPayload = jwtService.decode(acceptanceResult.accessToken);
      expect(newPayload.roles).toContain(memberRole!.id);

      // Verify user has correct role in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.user.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      expect(updatedUser!.roles).toHaveLength(1);
      expect(updatedUser!.roles[0].role.id).toBe(memberRole!.id);
      expect(updatedUser!.roles[0].role.name).toBe('Member');
    });

    it('should properly handle invitation validation during acceptance', async () => {
      // Create tenant and admin
      const adminUser = await authService.registerTenantlessUser({
        email: 'validation-admin@company.com',
        password: 'password123',
      });

      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Validation Test Company' },
      );

      // Create tenant-less user
      const user = await authService.registerTenantlessUser({
        email: 'validation-user@example.com',
        password: 'password123',
      });

      // Create invitation
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'validation-user@example.com',
          roleIds: [],
          message: 'Test validation',
        },
      );

      // Verify invitation is valid before acceptance
      expect(invitation.status).toBe(InvitationStatus.PENDING);
      expect(invitation.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Accept invitation
      const acceptanceResult = await tenantManagementService.joinTenantForUser(
        user.user.id,
        invitation.token,
      );

      expect(acceptanceResult).toBeDefined();
      expect(acceptanceResult.tenant.id).toBe(tenantResult.tenant.id);

      // Verify invitation is marked as accepted with timestamp
      const updatedInvitation = await prisma.tenantInvitation.findUnique({
        where: { id: invitation.id },
      });

      expect(updatedInvitation!.status).toBe(InvitationStatus.ACCEPTED);
      expect(updatedInvitation!.acceptedAt).toBeDefined();
      expect(updatedInvitation!.acceptedAt!.getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });

    it('should filter out expired invitations from available invitations', async () => {
      // Create tenant and admin
      const adminUser = await authService.registerTenantlessUser({
        email: 'filter-admin@company.com',
        password: 'password123',
      });

      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Filter Test Company' },
      );

      // Create tenant-less user
      const user = await authService.registerTenantlessUser({
        email: 'filter-user@example.com',
        password: 'password123',
      });

      // Create valid invitation
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const validInvitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'filter-user@example.com',
          roleIds: [],
          message: 'Valid invitation',
        },
      );

      // Create expired invitation
      const expiredInvitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'filter-user@example.com',
          roleIds: [],
          message: 'Expired invitation',
        },
      );

      // Manually expire the second invitation
      await prisma.tenantInvitation.update({
        where: { id: expiredInvitation.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      // Get user status - should only show valid invitation
      const status = await tenantManagementService.getUserTenantStatus(
        user.user.id,
      );
      expect(status.availableInvitations).toHaveLength(1);
      expect(status.availableInvitations[0].id).toBe(validInvitation.id);
    });

    it('should handle concurrent invitation acceptance attempts', async () => {
      // Create tenant and admin
      const adminUser = await authService.registerTenantlessUser({
        email: 'concurrent-admin@company.com',
        password: 'password123',
      });

      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Concurrent Test Company' },
      );

      // Create two tenant-less users with same email pattern
      const user1 = await authService.registerTenantlessUser({
        email: 'concurrent-user1@example.com',
        password: 'password123',
      });

      const user2 = await authService.registerTenantlessUser({
        email: 'concurrent-user2@example.com',
        password: 'password123',
      });

      // Create invitations for both users
      const adminPayload = jwtService.decode(tenantResult.accessToken);

      const invitation1 = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'concurrent-user1@example.com',
          roleIds: [],
          message: 'Invitation for user 1',
        },
      );

      const invitation2 = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'concurrent-user2@example.com',
          roleIds: [],
          message: 'Invitation for user 2',
        },
      );

      // Both users should be able to accept their respective invitations
      const [result1, result2] = await Promise.all([
        tenantManagementService.joinTenantForUser(
          user1.user.id,
          invitation1.token,
        ),
        tenantManagementService.joinTenantForUser(
          user2.user.id,
          invitation2.token,
        ),
      ]);

      expect(result1.tenant.id).toBe(tenantResult.tenant.id);
      expect(result2.tenant.id).toBe(tenantResult.tenant.id);

      // Verify both users are now part of the tenant
      const [updatedUser1, updatedUser2] = await Promise.all([
        prisma.user.findUnique({ where: { id: user1.user.id } }),
        prisma.user.findUnique({ where: { id: user2.user.id } }),
      ]);

      expect(updatedUser1!.tenantId).toBe(tenantResult.tenant.id);
      expect(updatedUser2!.tenantId).toBe(tenantResult.tenant.id);
    });

    it('should handle invitation acceptance with database transaction integrity', async () => {
      // Create tenant and admin
      const adminUser = await authService.registerTenantlessUser({
        email: 'transaction-admin@company.com',
        password: 'password123',
      });

      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Transaction Test Company' },
      );

      // Create tenant-less user
      const user = await authService.registerTenantlessUser({
        email: 'transaction-user@example.com',
        password: 'password123',
      });

      // Create invitation
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'transaction-user@example.com',
          roleIds: [],
          message: 'Transaction test',
        },
      );

      // Accept invitation
      const acceptanceResult = await tenantManagementService.joinTenantForUser(
        user.user.id,
        invitation.token,
      );

      // Verify all database changes were committed atomically
      const [updatedUser, updatedInvitation, userRoles] = await Promise.all([
        prisma.user.findUnique({
          where: { id: user.user.id },
        }),
        prisma.tenantInvitation.findUnique({
          where: { id: invitation.id },
        }),
        prisma.userRole.findMany({
          where: { userId: user.user.id },
        }),
      ]);

      // All changes should be consistent
      expect(updatedUser!.tenantId).toBe(tenantResult.tenant.id);
      expect(updatedInvitation!.status).toBe(InvitationStatus.ACCEPTED);
      expect(updatedInvitation!.acceptedAt).toBeDefined();
      expect(userRoles).toHaveLength(1); // Should have member role
      expect(acceptanceResult.tenant.id).toBe(tenantResult.tenant.id);
    });
  });

  describe('JWT Token Transition Tests', () => {
    it('should generate new JWT token with tenant context after invitation acceptance', async () => {
      // Create tenant and admin
      const adminUser = await authService.registerTenantlessUser({
        email: 'jwt-admin@company.com',
        password: 'password123',
      });

      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'JWT Test Company' },
      );

      // Create tenant-less user
      const user = await authService.registerTenantlessUser({
        email: 'jwt-user@example.com',
        password: 'password123',
      });

      // Verify initial token has null tenantId
      const initialPayload = jwtService.decode(user.accessToken);
      expect(initialPayload.tenantId).toBeNull();
      expect(initialPayload.roles).toEqual([]);

      // Create and accept invitation
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: 'jwt-user@example.com',
          roleIds: [],
        },
      );

      const acceptanceResult = await tenantManagementService.joinTenantForUser(
        user.user.id,
        invitation.token,
      );

      // Verify new token has tenant context
      const newPayload = jwtService.decode(acceptanceResult.accessToken);
      expect(newPayload.userId).toBe(user.user.id);
      expect(newPayload.tenantId).toBe(tenantResult.tenant.id);
      expect(newPayload.roles).toHaveLength(1); // Should have member role

      // Verify tokens are different
      expect(acceptanceResult.accessToken).not.toBe(user.accessToken);
    });

    it('should maintain user identity across tenant transition', async () => {
      // Create tenant and admin
      const adminUser = await authService.registerTenantlessUser({
        email: 'identity-admin@company.com',
        password: 'password123',
      });

      const tenantResult = await tenantManagementService.createTenantForUser(
        adminUser.user.id,
        { tenantName: 'Identity Test Company' },
      );

      // Create tenant-less user with specific details
      const userRegisterDto: RegisterDto = {
        email: 'identity-user@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const user = await authService.registerTenantlessUser(userRegisterDto);

      // Accept invitation
      const adminPayload = jwtService.decode(tenantResult.accessToken);
      const invitation = await invitationService.createInvitation(
        adminPayload.userId,
        adminPayload.tenantId,
        {
          email: userRegisterDto.email,
          roleIds: [],
        },
      );

      await tenantManagementService.joinTenantForUser(
        user.user.id,
        invitation.token,
      );

      // Verify user identity is preserved
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.user.id },
      });

      expect(updatedUser!.id).toBe(user.user.id);
      expect(updatedUser!.email).toBe(userRegisterDto.email);
      expect(updatedUser!.firstName).toBe(userRegisterDto.firstName);
      expect(updatedUser!.lastName).toBe(userRegisterDto.lastName);
      expect(updatedUser!.tenantId).toBe(tenantResult.tenant.id);
    });
  });
});
