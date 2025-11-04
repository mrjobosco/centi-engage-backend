import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtService, JwtModule } from '@nestjs/jwt';
import { TenantModule } from '../src/tenant/tenant.module';
import { UserModule } from '../src/user/user.module';
import { ProjectModule } from '../src/project/project.module';
import { AuthService } from '../src/auth/auth.service';
import { GoogleAuthService } from '../src/auth/services/google-auth.service';
import { UserService } from '../src/user/user.service';
import { ProjectService } from '../src/project/project.service';
import { TenantManagementService } from '../src/tenant/tenant-management.service';
import { TenantContextService } from '../src/tenant/tenant-context.service';
import { EmailOTPService } from '../src/auth/services/email-otp.service';
import { PrismaService } from '../src/database/prisma.service';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { LoginDto } from '../src/auth/dto/login.dto';
import { CreateTenantForUserDto } from '../src/tenant/dto/create-tenant-for-user.dto';
import { GoogleProfile } from '../src/auth/interfaces/google-profile.interface';
import configuration from '../src/config/configuration';
import { prisma } from './integration-setup';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleAuthMetricsService } from '../src/auth/services/google-auth-metrics.service';
import { TenantManagementAuditService } from '../src/tenant/services/tenant-management-audit.service';
import { AuthAuditService } from '../src/auth/services/auth-audit.service';
import * as bcrypt from 'bcrypt';

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

describe('Tenant-less Backward Compatibility Integration', () => {
  let module: TestingModule;
  let authService: AuthService;
  let googleAuthService: GoogleAuthService;
  let userService: UserService;
  let projectService: ProjectService;
  let tenantManagementService: TenantManagementService;
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
        TenantModule,
        UserModule,
        ProjectModule,
      ],
    })
      .overrideProvider(EmailOTPService)
      .useValue({
        generateOTP: jest.fn().mockResolvedValue(undefined),
        verifyOTP: jest.fn().mockResolvedValue(true),
      })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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
      .overrideProvider(TenantContextService)
      .useValue({
        getRequiredTenantId: jest.fn(),
        getTenantId: jest.fn(),
        setTenantId: jest.fn(),
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
    googleAuthService = module.get<GoogleAuthService>(GoogleAuthService);
    userService = module.get<UserService>(UserService);
    projectService = module.get<ProjectService>(ProjectService);
    tenantManagementService = module.get<TenantManagementService>(
      TenantManagementService,
    );
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Existing Tenant-bound User Flows', () => {
    it('should maintain existing tenant-specific registration flow', async () => {
      // Create a tenant first (simulating existing flow)
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Legacy Company',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      // Create default roles for the tenant
      const adminRole = await prisma.role.create({
        data: {
          name: 'Admin',
          tenantId: tenant.id,
        },
      });

      // Register user directly with tenant (legacy flow)
      const registerDto: RegisterDto = {
        email: 'legacy@company.com',
        password: 'password123',
        firstName: 'Legacy',
        lastName: 'User',
      };

      // Simulate legacy registration by creating user directly with tenant
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const legacyUser = await prisma.user.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          tenantId: tenant.id, // Direct tenant assignment
          authMethods: ['password'],
          emailVerified: false,
        },
      });

      // Assign admin role
      await prisma.userRole.create({
        data: {
          userId: legacyUser.id,
          roleId: adminRole.id,
        },
      });

      // Test login with tenant context
      const loginDto: LoginDto = {
        email: registerDto.email,
        password: registerDto.password,
      };

      const loginResult = await authService.login(loginDto, tenant.id);

      expect(loginResult).toBeDefined();
      expect(loginResult.accessToken).toBeDefined();
      expect(loginResult.hasTenant).toBe(true);

      // Verify JWT token has correct tenant context
      const payload = jwtService.decode(loginResult.accessToken);
      expect(payload.userId).toBe(legacyUser.id);
      expect(payload.tenantId).toBe(tenant.id);
      expect(payload.roles).toContain(adminRole.id);
    });

    it('should maintain existing Google OAuth with tenant flow', async () => {
      // Create tenant with Google SSO enabled
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Google SSO Company',
          googleSsoEnabled: true,
          googleAutoProvision: true,
        },
      });

      // Create default member role
      await prisma.role.create({
        data: {
          name: 'Member',
          tenantId: tenant.id,
        },
      });

      const googleProfile: GoogleProfile = {
        id: 'legacy-google-123',
        email: 'legacy-google@company.com',
        firstName: 'Legacy',
        lastName: 'Google',
        picture: 'https://example.com/picture.jpg',
      };

      // Test Google OAuth with tenant context (existing flow)
      const result = await googleAuthService.authenticateWithGoogle(
        googleProfile,
        tenant.id,
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();

      // Verify JWT token has tenant context
      const payload = jwtService.decode(result.accessToken);
      expect(payload.tenantId).toBe(tenant.id);
      expect(payload.roles).toHaveLength(1);

      // Verify user was created with tenant
      const dbUser = await prisma.user.findUnique({
        where: { googleId: googleProfile.id },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser!.tenantId).toBe(tenant.id);
      expect(dbUser!.googleId).toBe(googleProfile.id);
    });

    it('should maintain existing tenant-specific operations', async () => {
      // Create tenant and user (existing flow)
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Operations Company',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      const adminRole = await prisma.role.create({
        data: {
          name: 'Admin',
          tenantId: tenant.id,
        },
      });

      const user = await prisma.user.create({
        data: {
          email: 'operations@company.com',
          password: await bcrypt.hash('password123', 10),
          tenantId: tenant.id,
          authMethods: ['password'],
          emailVerified: true,
        },
      });

      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });

      // Mock tenant context for service calls
      const mockTenantContext =
        module.get<TenantContextService>(TenantContextService);
      (mockTenantContext.getRequiredTenantId as jest.Mock).mockReturnValue(
        tenant.id,
      );

      // Test existing tenant operations
      const users = await userService.findAll();
      expect(users).toBeDefined();
      expect(users.some((u) => u.id === user.id)).toBe(true);

      // Test project creation (tenant-specific)
      const project = await projectService.create(
        {
          name: 'Legacy Project',
          description: 'Test project for legacy flow',
        },
        user.id,
      );

      expect(project).toBeDefined();
      expect(project.tenantId).toBe(tenant.id);
    });
  });

  describe('Mixed Scenarios with Both User Types', () => {
    it('should handle both tenant-less and tenant-bound users in same system', async () => {
      // Create tenant-bound user (existing flow)
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Mixed Scenario Company',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      const tenantBoundUser = await prisma.user.create({
        data: {
          email: 'tenant-bound@company.com',
          password: await bcrypt.hash('password123', 10),
          tenantId: tenant.id,
          authMethods: ['password'],
          emailVerified: true,
        },
      });

      // Create tenant-less user (new flow)
      const tenantLessRegisterDto: RegisterDto = {
        email: 'tenant-less@example.com',
        password: 'password123',
        firstName: 'Tenant',
        lastName: 'Less',
      };

      const tenantLessUser = await authService.registerTenantlessUser(
        tenantLessRegisterDto,
      );

      // Verify both users exist with different tenant associations
      const dbTenantBoundUser = await prisma.user.findUnique({
        where: { id: tenantBoundUser.id },
      });

      const dbTenantLessUser = await prisma.user.findUnique({
        where: { id: tenantLessUser.user.id },
      });

      expect(dbTenantBoundUser!.tenantId).toBe(tenant.id);
      expect(dbTenantLessUser!.tenantId).toBeNull();

      // Test that both can authenticate appropriately
      const tenantBoundLogin = await authService.login(
        { email: 'tenant-bound@company.com', password: 'password123' },
        tenant.id,
      );

      const tenantLessLogin = await authService.login({
        email: 'tenant-less@example.com',
        password: 'password123',
      });

      expect(tenantBoundLogin.hasTenant).toBe(true);
      expect(tenantLessLogin.hasTenant).toBe(false);
    });

    it('should maintain tenant isolation between different user types', async () => {
      // Create two separate tenants
      const tenant1 = await prisma.tenant.create({
        data: {
          name: 'Isolation Company 1',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      const tenant2 = await prisma.tenant.create({
        data: {
          name: 'Isolation Company 2',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      // Create users in different tenants
      const user1 = await prisma.user.create({
        data: {
          email: 'user1@company1.com',
          password: await bcrypt.hash('password123', 10),
          tenantId: tenant1.id,
          authMethods: ['password'],
          emailVerified: true,
        },
      });

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@company2.com',
          password: await bcrypt.hash('password123', 10),
          tenantId: tenant2.id,
          authMethods: ['password'],
          emailVerified: true,
        },
      });

      // Create tenant-less user
      const tenantLessUser = await authService.registerTenantlessUser({
        email: 'tenant-less@example.com',
        password: 'password123',
      });

      // Mock tenant context for service calls
      const mockTenantContext =
        module.get<TenantContextService>(TenantContextService);

      // Test that users can only access their own tenant data
      (mockTenantContext.getRequiredTenantId as jest.Mock).mockReturnValue(
        tenant1.id,
      );
      const tenant1Users = await userService.findAll();

      (mockTenantContext.getRequiredTenantId as jest.Mock).mockReturnValue(
        tenant2.id,
      );
      const tenant2Users = await userService.findAll();

      expect(tenant1Users.some((u) => u.id === user1.id)).toBe(true);
      expect(tenant1Users.some((u) => u.id === user2.id)).toBe(false);
      expect(tenant1Users.some((u) => u.id === tenantLessUser.user.id)).toBe(
        false,
      );

      expect(tenant2Users.some((u) => u.id === user2.id)).toBe(true);
      expect(tenant2Users.some((u) => u.id === user1.id)).toBe(false);
      expect(tenant2Users.some((u) => u.id === tenantLessUser.user.id)).toBe(
        false,
      );
    });

    it('should handle tenant-less user transitioning to tenant-bound', async () => {
      // Start with tenant-less user
      const registerDto: RegisterDto = {
        email: 'transition@example.com',
        password: 'password123',
        firstName: 'Transition',
        lastName: 'User',
      };

      const tenantLessUser =
        await authService.registerTenantlessUser(registerDto);

      // Verify user is tenant-less
      let payload = jwtService.decode(tenantLessUser.accessToken);
      expect(payload.tenantId).toBeNull();

      // User creates tenant
      const createTenantDto: CreateTenantForUserDto = {
        tenantName: 'Transition Company',
      };

      const tenantResult = await tenantManagementService.createTenantForUser(
        tenantLessUser.user.id,
        createTenantDto,
      );

      // Verify user is now tenant-bound
      payload = jwtService.decode(tenantResult.accessToken);
      expect(payload.tenantId).toBe(tenantResult.tenant.id);
      expect(payload.roles).toHaveLength(1);

      // Test that user can now perform tenant-specific operations
      const mockTenantContext =
        module.get<TenantContextService>(TenantContextService);
      (mockTenantContext.getRequiredTenantId as jest.Mock).mockReturnValue(
        tenantResult.tenant.id,
      );

      const project = await projectService.create(
        {
          name: 'Transition Project',
          description: 'Project after tenant creation',
        },
        tenantLessUser.user.id,
      );

      expect(project).toBeDefined();
      expect(project.tenantId).toBe(tenantResult.tenant.id);

      // Verify user appears in tenant user list
      const tenantUsers = await userService.findAll();
      expect(tenantUsers.some((u) => u.id === tenantLessUser.user.id)).toBe(
        true,
      );
    });
  });

  describe('API Endpoint Compatibility', () => {
    it('should maintain existing login endpoint behavior with tenant header', async () => {
      // Create tenant and user (existing setup)
      const tenant = await prisma.tenant.create({
        data: {
          name: 'API Compatibility Company',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      await prisma.user.create({
        data: {
          email: 'api@company.com',
          password: await bcrypt.hash('password123', 10),
          tenantId: tenant.id,
          authMethods: ['password'],
          emailVerified: true,
        },
      });

      // Test existing login with tenant context
      const loginDto: LoginDto = {
        email: 'api@company.com',
        password: 'password123',
      };

      const result = await authService.login(loginDto, tenant.id);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.hasTenant).toBe(true);

      const payload = jwtService.decode(result.accessToken);
      expect(payload.tenantId).toBe(tenant.id);
    });

    it('should handle login attempts without tenant header for tenant-bound users', async () => {
      // Create tenant and user
      const tenant = await prisma.tenant.create({
        data: {
          name: 'No Header Company',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      await prisma.user.create({
        data: {
          email: 'no-header@company.com',
          password: await bcrypt.hash('password123', 10),
          tenantId: tenant.id,
          authMethods: ['password'],
          emailVerified: true,
        },
      });

      // Attempt login without tenant context should fail for tenant-bound user
      const loginDto: LoginDto = {
        email: 'no-header@company.com',
        password: 'password123',
      };

      await expect(
        authService.login(loginDto), // No tenant ID provided
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should maintain existing Google OAuth endpoint behavior with tenant context', async () => {
      // Create tenant with Google SSO
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Google OAuth Company',
          googleSsoEnabled: true,
          googleAutoProvision: true,
        },
      });

      await prisma.role.create({
        data: {
          name: 'Member',
          tenantId: tenant.id,
        },
      });

      const googleProfile: GoogleProfile = {
        id: 'oauth-compat-123',
        email: 'oauth@company.com',
        firstName: 'OAuth',
        lastName: 'User',
        picture: 'https://example.com/picture.jpg',
      };

      // Test existing Google OAuth with tenant
      const result = await googleAuthService.authenticateWithGoogle(
        googleProfile,
        tenant.id,
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();

      const payload = jwtService.decode(result.accessToken);
      expect(payload.tenantId).toBe(tenant.id);
    });
  });

  describe('Database Query Compatibility', () => {
    it('should handle queries with both null and non-null tenantId values', async () => {
      // Create tenant-bound user
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Query Compatibility Company',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      const tenantBoundUser = await prisma.user.create({
        data: {
          email: 'tenant-bound@query.com',
          password: await bcrypt.hash('password123', 10),
          tenantId: tenant.id,
          authMethods: ['password'],
          emailVerified: true,
        },
      });

      // Create tenant-less user
      const tenantLessUser = await authService.registerTenantlessUser({
        email: 'tenant-less@query.com',
        password: 'password123',
      });

      // Test queries that should work with both types
      const allUsers = await prisma.user.findMany();
      expect(allUsers.length).toBeGreaterThanOrEqual(2);

      const tenantBoundUsers = await prisma.user.findMany({
        where: { tenantId: tenant.id },
      });
      expect(tenantBoundUsers.some((u) => u.id === tenantBoundUser.id)).toBe(
        true,
      );
      expect(
        tenantBoundUsers.some((u) => u.id === tenantLessUser.user.id),
      ).toBe(false);

      const tenantLessUsers = await prisma.user.findMany({
        where: { tenantId: null },
      });
      expect(tenantLessUsers.some((u) => u.id === tenantLessUser.user.id)).toBe(
        true,
      );
      expect(tenantLessUsers.some((u) => u.id === tenantBoundUser.id)).toBe(
        false,
      );

      // Test email uniqueness constraints work correctly
      const userByEmail1 = await prisma.user.findFirst({
        where: { email: 'tenant-bound@query.com' },
      });
      expect(userByEmail1!.id).toBe(tenantBoundUser.id);

      const userByEmail2 = await prisma.user.findFirst({
        where: { email: 'tenant-less@query.com' },
      });
      expect(userByEmail2!.id).toBe(tenantLessUser.user.id);
    });

    it('should maintain referential integrity with nullable tenantId', async () => {
      // Create tenant-less user
      const tenantLessUser = await authService.registerTenantlessUser({
        email: 'integrity@example.com',
        password: 'password123',
      });

      // Verify user exists with null tenantId
      const dbUser = await prisma.user.findUnique({
        where: { id: tenantLessUser.user.id },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser!.tenantId).toBeNull();

      // User creates tenant
      const tenantResult = await tenantManagementService.createTenantForUser(
        tenantLessUser.user.id,
        { tenantName: 'Integrity Company' },
      );

      // Verify referential integrity is maintained
      const updatedUser = await prisma.user.findUnique({
        where: { id: tenantLessUser.user.id },
        include: {
          tenant: true,
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      expect(updatedUser!.tenantId).toBe(tenantResult.tenant.id);
      expect(updatedUser!.tenant).toBeDefined();
      expect(updatedUser!.tenant!.id).toBe(tenantResult.tenant.id);
      expect(updatedUser!.roles).toHaveLength(1);
    });
  });

  describe('JWT Token Compatibility', () => {
    it('should handle both null and non-null tenantId in JWT tokens', async () => {
      // Create tenant-bound user
      const tenant = await prisma.tenant.create({
        data: {
          name: 'JWT Compatibility Company',
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      const adminRole = await prisma.role.create({
        data: {
          name: 'Admin',
          tenantId: tenant.id,
        },
      });

      const tenantBoundUser = await prisma.user.create({
        data: {
          email: 'jwt-tenant@company.com',
          password: await bcrypt.hash('password123', 10),
          tenantId: tenant.id,
          authMethods: ['password'],
          emailVerified: true,
        },
      });

      await prisma.userRole.create({
        data: {
          userId: tenantBoundUser.id,
          roleId: adminRole.id,
        },
      });

      // Create tenant-less user
      await authService.registerTenantlessUser({
        email: 'jwt-tenantless@example.com',
        password: 'password123',
      });

      // Test JWT tokens for both user types
      const tenantBoundLogin = await authService.login(
        { email: 'jwt-tenant@company.com', password: 'password123' },
        tenant.id,
      );

      const tenantLessLogin = await authService.login({
        email: 'jwt-tenantless@example.com',
        password: 'password123',
      });

      // Verify token structures
      const tenantBoundPayload = jwtService.decode(
        tenantBoundLogin.accessToken,
      );
      const tenantLessPayload = jwtService.decode(tenantLessLogin.accessToken);

      expect(tenantBoundPayload.tenantId).toBe(tenant.id);
      expect(tenantBoundPayload.roles).toContain(adminRole.id);

      expect(tenantLessPayload.tenantId).toBeNull();
      expect(tenantLessPayload.roles).toEqual([]);

      // Verify both tokens are valid
      expect(() =>
        jwtService.verify(tenantBoundLogin.accessToken),
      ).not.toThrow();
      expect(() =>
        jwtService.verify(tenantLessLogin.accessToken),
      ).not.toThrow();
    });
  });
});
