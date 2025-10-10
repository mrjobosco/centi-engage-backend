import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const tenantId = 'tenant-123';

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password: '$2b$10$hashedpassword',
      tenantId: 'tenant-123',
      firstName: 'John',
      lastName: 'Doe',
      roles: [
        {
          userId: 'user-123',
          roleId: 'role-1',
          role: {
            id: 'role-1',
            name: 'Admin',
            tenantId: 'tenant-123',
          },
        },
        {
          userId: 'user-123',
          roleId: 'role-2',
          role: {
            id: 'role-2',
            name: 'Member',
            tenantId: 'tenant-123',
          },
        },
      ],
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      const result = await service.login(loginDto, tenantId);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
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

      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        userId: mockUser.id,
        tenantId: mockUser.tenantId,
        roles: ['role-1', 'role-2'],
      });

      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        UnauthorizedException,
      );

      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
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

      // Password comparison should not be called if user doesn't exist
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        UnauthorizedException,
      );

      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );

      // JWT should not be generated if password is invalid
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should correctly structure JWT payload with userId, tenantId, and role IDs', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      await service.login(loginDto, tenantId);

      // Assert - Verify JWT payload structure
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        userId: 'user-123',
        tenantId: 'tenant-123',
        roles: ['role-1', 'role-2'],
      });
    });

    it('should handle user with no roles', async () => {
      // Arrange
      const userWithNoRoles = {
        ...mockUser,
        roles: [],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithNoRoles);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      const result = await service.login(loginDto, tenantId);

      // Assert
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        userId: mockUser.id,
        tenantId: mockUser.tenantId,
        roles: [],
      });

      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
      });
    });

    it('should use bcrypt.compare for password verification', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      await service.login(loginDto, tenantId);

      // Assert - Verify bcrypt.compare is called with correct arguments
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password123!',
        '$2b$10$hashedpassword',
      );
    });
  });
});
