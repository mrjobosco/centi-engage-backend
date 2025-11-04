import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtService, JwtModule } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { GoogleAuthService } from '../src/auth/services/google-auth.service';
import { TenantManagementService } from '../src/tenant/tenant-management.service';
import { EmailOTPService } from '../src/auth/services/email-otp.service';
import { PrismaService } from '../src/database/prisma.service';
import { TenantManagementAuditService } from '../src/tenant/services/tenant-management-audit.service';
import { AuthAuditService } from '../src/auth/services/auth-audit.service';
import { GoogleAuthMetricsService } from '../src/auth/services/google-auth-metrics.service';
import { TenantService } from '../src/tenant/tenant.service';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { CreateTenantForUserDto } from '../src/tenant/dto/create-tenant-for-user.dto';
import { GoogleProfile } from '../src/auth/interfaces/google-profile.interface';
import configuration from '../src/config/configuration';
import { prisma } from './integration-setup';
import { ConflictException } from '@nestjs/common';
import { UserAlreadyHasTenantException } from '../src/tenant/exceptions/user-already-has-tenant.exception';
import { TenantNameUnavailableException } from '../src/tenant/exceptions/tenant-name-unavailable.exception';

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

describe('Tenant-less Registration and Tenant Creation Integration', () => {
  let module: TestingModule;
  let authService: AuthService;
  let googleAuthService: GoogleAuthService;
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
      ],
      providers: [
        AuthService,
        GoogleAuthService,
        TenantManagementService,
        {
          provide: TenantService,
          useValue: {
            findById: jest.fn(),
            createTenant: jest.fn(),
            updateGoogleSettings: jest.fn(),
          },
        },
        {
          provide: EmailOTPService,
          useValue: {
            generateOTP: jest.fn().mockResolvedValue(undefined),
            verifyOTP: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: TenantManagementAuditService,
          useValue: {
            logTenantCreation: jest.fn(),
            logTenantJoin: jest.fn(),
          },
        },
        {
          provide: AuthAuditService,
          useValue: {
            logRegistration: jest.fn(),
            logLogin: jest.fn(),
            logGoogleAuthentication: jest.fn(),
            logGoogleSettingsUpdate: jest.fn(),
          },
        },
        {
          provide: GoogleAuthMetricsService,
          useValue: {
            recordAuthentication: jest.fn(),
            recordSignInAttempt: jest.fn(),
            recordTenantLookup: jest.fn(),
            recordUserLookup: jest.fn(),
            recordUserCreation: jest.fn(),
            recordSignInSuccess: jest.fn(),
            recordSignInFailure: jest.fn(),
            startTenantLookupTimer: jest
              .fn()
              .mockReturnValue({ stop: jest.fn() }),
            startUserLookupTimer: jest
              .fn()
              .mockReturnValue({ stop: jest.fn() }),
            startUserCreationTimer: jest
              .fn()
              .mockReturnValue({ stop: jest.fn() }),
          },
        },
        {
          provide: 'GoogleOAuthService',
          useValue: {
            exchangeCodeForTokens: jest.fn(),
            verifyIdToken: jest.fn(),
          },
        },
        {
          provide: 'OAuthStateService',
          useValue: {
            generateState: jest.fn(),
            validateState: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    googleAuthService = module.get<GoogleAuthService>(GoogleAuthService);
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

  describe('Tenant-less Email/Password Registration Flow', () => {
    it('should register a new tenant-less user with email/password', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await authService.registerTenantlessUser(registerDto);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.firstName).toBe(registerDto.firstName);
      expect(result.user.lastName).toBe(registerDto.lastName);
      expect(result.user).not.toHaveProperty('password');

      // Verify JWT token contains null tenantId
      const payload = jwtService.decode(result.accessToken);
      expect(payload.userId).toBe(result.user.id);
      expect(payload.tenantId).toBeNull();
      expect(payload.roles).toEqual([]);

      // Verify user in database
      const dbUser = await prisma.user.findUnique({
        where: { id: result.user.id },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser!.tenantId).toBeNull();
      expect(dbUser!.email).toBe(registerDto.email);
    });

    it('should prevent duplicate email registration', async () => {
      const registerDto: RegisterDto = {
        email: 'duplicate@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe',
      };

      // First registration should succeed
      await authService.registerTenantlessUser(registerDto);

      // Second registration with same email should fail
      await expect(
        authService.registerTenantlessUser(registerDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle registration with minimal data', async () => {
      const registerDto: RegisterDto = {
        email: 'minimal@example.com',
        password: 'password123',
      };

      const result = await authService.registerTenantlessUser(registerDto);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.firstName).toBeNull();
      expect(result.user.lastName).toBeNull();
    });
  });

  describe('Complete Registration to Tenant Creation Flow', () => {
    it('should complete full flow from registration to tenant creation', async () => {
      // Step 1: Register tenant-less user
      const registerDto: RegisterDto = {
        email: 'fullflow@example.com',
        password: 'password123',
        firstName: 'Full',
        lastName: 'Flow',
      };

      const registrationResult =
        await authService.registerTenantlessUser(registerDto);
      expect(registrationResult.user).toBeDefined();

      // Verify user is tenant-less
      const payload = jwtService.decode(registrationResult.accessToken);
      expect(payload.tenantId).toBeNull();

      // Step 2: Create tenant for user
      const createTenantDto: CreateTenantForUserDto = {
        tenantName: 'Full Flow Company',
        description: 'Test company for full flow',
      };

      const tenantResult = await tenantManagementService.createTenantForUser(
        registrationResult.user.id,
        createTenantDto,
      );

      expect(tenantResult).toBeDefined();
      expect(tenantResult.tenant).toBeDefined();
      expect(tenantResult.accessToken).toBeDefined();
      expect(tenantResult.tenant.name).toBe(createTenantDto.tenantName);

      // Verify new JWT token has tenant context
      const newPayload = jwtService.decode(tenantResult.accessToken);
      expect(newPayload.userId).toBe(registrationResult.user.id);
      expect(newPayload.tenantId).toBe(tenantResult.tenant.id);
      expect(newPayload.roles).toHaveLength(1); // Should have admin role

      // Verify user is now associated with tenant
      const updatedUser = await prisma.user.findUnique({
        where: { id: registrationResult.user.id },
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
      expect(updatedUser!.roles[0].role.name).toBe('Admin');
    });

    it('should prevent tenant creation for user who already has tenant', async () => {
      // Register user and create tenant
      const registerDto: RegisterDto = {
        email: 'hastenantuser@example.com',
        password: 'password123',
      };

      const registrationResult =
        await authService.registerTenantlessUser(registerDto);

      const createTenantDto: CreateTenantForUserDto = {
        tenantName: 'First Tenant',
      };

      await tenantManagementService.createTenantForUser(
        registrationResult.user.id,
        createTenantDto,
      );

      // Attempt to create second tenant should fail
      const secondTenantDto: CreateTenantForUserDto = {
        tenantName: 'Second Tenant',
      };

      await expect(
        tenantManagementService.createTenantForUser(
          registrationResult.user.id,
          secondTenantDto,
        ),
      ).rejects.toThrow(UserAlreadyHasTenantException);
    });

    it('should prevent duplicate tenant names', async () => {
      // Create first user and tenant
      const firstRegisterDto: RegisterDto = {
        email: 'first@example.com',
        password: 'password123',
      };

      const firstUser =
        await authService.registerTenantlessUser(firstRegisterDto);

      const tenantDto: CreateTenantForUserDto = {
        tenantName: 'Unique Company Name',
      };

      await tenantManagementService.createTenantForUser(
        firstUser.user.id,
        tenantDto,
      );

      // Create second user and attempt same tenant name
      const secondRegisterDto: RegisterDto = {
        email: 'second@example.com',
        password: 'password123',
      };

      const secondUser =
        await authService.registerTenantlessUser(secondRegisterDto);

      await expect(
        tenantManagementService.createTenantForUser(
          secondUser.user.id,
          tenantDto,
        ),
      ).rejects.toThrow(TenantNameUnavailableException);
    });
  });

  describe('Google OAuth Tenant-less Registration Flow', () => {
    it('should create tenant-less user from Google OAuth', async () => {
      const googleProfile: GoogleProfile = {
        id: 'google123',
        email: 'google@example.com',
        firstName: 'Google',
        lastName: 'User',
        picture: 'https://example.com/picture.jpg',
      };

      const result =
        await googleAuthService.authenticateWithGoogle(googleProfile);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();

      // Verify JWT token
      const payload = jwtService.decode(result.accessToken);
      expect(payload.tenantId).toBeNull();
      expect(payload.roles).toEqual([]);

      // Verify user in database
      const dbUser = await prisma.user.findUnique({
        where: { googleId: googleProfile.id },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser!.email).toBe(googleProfile.email);
      expect(dbUser!.tenantId).toBeNull();
      expect(dbUser!.googleId).toBe(googleProfile.id);
      expect(dbUser!.emailVerified).toBe(true);
    });

    it('should complete Google OAuth to tenant creation flow', async () => {
      // Step 1: Google OAuth registration
      const googleProfile: GoogleProfile = {
        id: 'google456',
        email: 'googleflow@example.com',
        firstName: 'Google',
        lastName: 'Flow',
        picture: 'https://example.com/picture.jpg',
      };

      const authResult =
        await googleAuthService.authenticateWithGoogle(googleProfile);

      // Get user ID from JWT
      const payload = jwtService.decode(authResult.accessToken);
      expect(payload.tenantId).toBeNull();

      // Step 2: Create tenant
      const createTenantDto: CreateTenantForUserDto = {
        tenantName: 'Google Flow Company',
      };

      const tenantResult = await tenantManagementService.createTenantForUser(
        payload.userId,
        createTenantDto,
      );

      expect(tenantResult.tenant.name).toBe(createTenantDto.tenantName);

      // Verify new token has tenant context
      const newPayload = jwtService.decode(tenantResult.accessToken);
      expect(newPayload.tenantId).toBe(tenantResult.tenant.id);
      expect(newPayload.roles).toHaveLength(1);
    });

    it('should handle existing Google user login', async () => {
      const googleProfile: GoogleProfile = {
        id: 'google789',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        picture: 'https://example.com/picture.jpg',
      };

      // First authentication - creates user
      const firstResult =
        await googleAuthService.authenticateWithGoogle(googleProfile);
      const firstPayload = jwtService.decode(firstResult.accessToken);

      // Second authentication - should return same user
      const secondResult =
        await googleAuthService.authenticateWithGoogle(googleProfile);
      const secondPayload = jwtService.decode(secondResult.accessToken);

      expect(firstPayload.userId).toBe(secondPayload.userId);
      expect(secondPayload.tenantId).toBeNull();
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle invalid user ID in tenant creation', async () => {
      const createTenantDto: CreateTenantForUserDto = {
        tenantName: 'Invalid User Tenant',
      };

      await expect(
        tenantManagementService.createTenantForUser(
          'invalid-user-id',
          createTenantDto,
        ),
      ).rejects.toThrow();
    });

    it('should validate tenant name format', async () => {
      const registerDto: RegisterDto = {
        email: 'validation@example.com',
        password: 'password123',
      };

      const user = await authService.registerTenantlessUser(registerDto);

      // Test valid short tenant name (should succeed)
      const shortResult = await tenantManagementService.createTenantForUser(
        user.user.id,
        {
          tenantName: 'AB',
        },
      );
      expect(shortResult).toBeDefined();
      expect(shortResult.tenant.name).toBe('AB');

      // Create another user for the long name test
      const user2 = await authService.registerTenantlessUser({
        email: 'validation2@example.com',
        password: 'password123',
      });

      // Test valid long tenant name (should succeed)
      const longName = 'A'.repeat(50); // Max length is 50
      const longResult = await tenantManagementService.createTenantForUser(
        user2.user.id,
        {
          tenantName: longName,
        },
      );
      expect(longResult).toBeDefined();
      expect(longResult.tenant.name).toBe(longName);
    });

    it('should handle Google OAuth with existing email but different provider', async () => {
      // First register with email/password
      const registerDto: RegisterDto = {
        email: 'conflict@example.com',
        password: 'password123',
      };

      await authService.registerTenantlessUser(registerDto);

      // Then try Google OAuth with same email
      const googleProfile: GoogleProfile = {
        id: 'google999',
        email: 'conflict@example.com',
        firstName: 'Google',
        lastName: 'Conflict',
        picture: 'https://example.com/picture.jpg',
      };

      // Should link Google account to existing user
      const result =
        await googleAuthService.authenticateWithGoogle(googleProfile);
      expect(result.accessToken).toBeDefined();

      // Verify user has both auth methods
      const dbUser = await prisma.user.findFirst({
        where: { email: 'conflict@example.com' },
      });

      expect(dbUser!.googleId).toBe(googleProfile.id);
      expect(dbUser!.password).toBeDefined(); // Should still have password
    });
  });
});
