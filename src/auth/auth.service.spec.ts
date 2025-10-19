import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { EmailOTPService } from './services/email-otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let emailOTPService: jest.Mocked<EmailOTPService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    tenantId: null,
    authMethods: ['password'],
    email_verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    googleId: null,
    googleLinkedAt: null,
    verificationToken: null,
    verificationTokenSentAt: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockEmailOTPService = {
      generateOTP: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailOTPService, useValue: mockEmailOTPService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    emailOTPService = module.get(EmailOTPService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('registerTenantlessUser', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should register a new tenant-less user successfully', async () => {
      // Arrange
      prismaService.user.findFirst.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword');
      prismaService.user.create.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('jwt-token');
      emailOTPService.generateOTP.mockResolvedValue({
        success: true,
        message: 'OTP sent',
      });

      // Act
      const result = await service.registerTenantlessUser(registerDto);

      // Assert
      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          password: 'hashedPassword',
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          tenantId: null,
          authMethods: ['password'],
          email_verified: false,
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: mockUser.id,
        tenantId: null,
        roles: [],
      });
      expect(emailOTPService.generateOTP).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
      );
      expect(result).toEqual({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        }),
        accessToken: 'jwt-token',
        requiresVerification: true,
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw ConflictException if email already exists', async () => {
      // Arrange
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.registerTenantlessUser(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should handle email OTP generation failure gracefully', async () => {
      // Arrange
      prismaService.user.findFirst.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword');
      prismaService.user.create.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('jwt-token');
      emailOTPService.generateOTP.mockRejectedValue(new Error('Email failed'));

      // Act
      const result = await service.registerTenantlessUser(registerDto);

      // Assert
      expect(result.requiresVerification).toBe(false);
      expect(result.accessToken).toBe('jwt-token');
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUserWithRoles = {
      ...mockUser,
      roles: [
        {
          role: {
            id: 'role-1',
            name: 'Member',
          },
        },
      ],
    };

    describe('tenant-less login', () => {
      it('should login tenant-less user successfully', async () => {
        // Arrange
        prismaService.user.findFirst.mockResolvedValue(mockUserWithRoles);
        mockedBcrypt.compare.mockResolvedValue(true);
        jwtService.sign.mockReturnValue('jwt-token');

        // Act
        const result = await service.login(loginDto);

        // Assert
        expect(prismaService.user.findFirst).toHaveBeenCalledWith({
          where: {
            email: loginDto.email,
            tenantId: null,
          },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        });
        expect(mockedBcrypt.compare).toHaveBeenCalledWith(
          loginDto.password,
          mockUser.password,
        );
        expect(jwtService.sign).toHaveBeenCalledWith({
          userId: mockUser.id,
          tenantId: null,
          roles: ['role-1'],
        });
        expect(result).toEqual({
          accessToken: 'jwt-token',
          emailVerified: false,
          requiresVerification: true,
          hasTenant: false,
        });
      });

      it('should throw UnauthorizedException for invalid credentials', async () => {
        // Arrange
        prismaService.user.findFirst.mockResolvedValue(null);

        // Act & Assert
        await expect(service.login(loginDto)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw UnauthorizedException for invalid password', async () => {
        // Arrange
        prismaService.user.findFirst.mockResolvedValue(mockUserWithRoles);
        mockedBcrypt.compare.mockResolvedValue(false);

        // Act & Assert
        await expect(service.login(loginDto)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    describe('tenant-specific login', () => {
      const tenantId = 'tenant-1';
      const mockTenantUser = {
        ...mockUserWithRoles,
        tenantId,
      };

      it('should login tenant-specific user successfully', async () => {
        // Arrange
        prismaService.user.findUnique.mockResolvedValue(mockTenantUser);
        mockedBcrypt.compare.mockResolvedValue(true);
        jwtService.sign.mockReturnValue('jwt-token');

        // Act
        const result = await service.login(loginDto, tenantId);

        // Assert
        expect(prismaService.user.findUnique).toHaveBeenCalledWith({
          where: {
            email_tenantId: {
              email: loginDto.email,
              tenantId,
            },
          },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        });
        expect(result).toEqual({
          accessToken: 'jwt-token',
          emailVerified: false,
          requiresVerification: true,
          hasTenant: true,
        });
      });
    });
  });

  describe('findUserByEmailAndTenant', () => {
    it('should find user by email and tenant', async () => {
      // Arrange
      const email = 'test@example.com';
      const tenantId = 'tenant-1';
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findUserByEmailAndTenant(email, tenantId);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email_tenantId: {
            email,
            tenantId,
          },
        },
      });
      expect(result).toBe(mockUser);
    });
  });
});
