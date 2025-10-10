# Authentication Examples

## Overview

This document provides practical examples of using the authentication module, including code samples, API usage patterns, and integration examples.

## Basic Authentication Examples

### 1. Password-Based Authentication

#### Frontend Login Form

```typescript
// React/TypeScript example
import { useState } from 'react';

interface LoginForm {
  email: string;
  password: string;
}

const LoginComponent = () => {
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-123', // Get from context/config
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const { accessToken } = await response.json();
      
      // Store token (consider using secure storage)
      localStorage.setItem('accessToken', accessToken);
      
      // Redirect or update app state
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
};
```

#### Backend Service Integration

```typescript
// NestJS service example
import { Injectable } from '@nestjs/common';
import { AuthService } from '@/auth';

@Injectable()
export class UserAuthService {
  constructor(private readonly authService: AuthService) {}

  async authenticateUser(email: string, password: string, tenantId: string) {
    try {
      const result = await this.authService.login(
        { email, password },
        tenantId
      );
      
      return {
        success: true,
        token: result.accessToken,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

### 2. Google OAuth Authentication

#### Frontend OAuth Flow

```typescript
// React/TypeScript OAuth component
import { useState, useEffect } from 'react';

const GoogleAuthComponent = () => {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize OAuth flow
  const initiateGoogleAuth = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/auth/google', {
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }

      const { authUrl, state } = await response.json();
      
      // Store state for validation (optional, handled by backend)
      sessionStorage.setItem('oauth_state', state);
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('OAuth initiation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callback (typically in a separate component/page)
  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      const response = await fetch('/auth/google/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          tenantId: 'tenant-123',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'OAuth callback failed');
      }

      const { accessToken } = await response.json();
      
      // Store token and redirect
      localStorage.setItem('accessToken', accessToken);
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('OAuth callback failed:', error);
      // Handle error (show message, redirect to login, etc.)
    }
  };

  return (
    <div>
      <button onClick={initiateGoogleAuth} disabled={loading}>
        {loading ? 'Redirecting...' : 'Sign in with Google'}
      </button>
    </div>
  );
};

// OAuth callback page component
const OAuthCallbackPage = () => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      // Handle OAuth error
      return;
    }

    if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, []);

  return <div>Processing authentication...</div>;
};
```

#### Backend OAuth Service

```typescript
// Custom OAuth integration service
import { Injectable } from '@nestjs/common';
import { GoogleAuthService, GoogleOAuthService } from '@/auth/services';

@Injectable()
export class CustomOAuthService {
  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  async handleGoogleSignIn(tenantId: string) {
    // Validate tenant has Google SSO enabled
    await this.googleAuthService.validateTenantGoogleSSO(tenantId);
    
    // Generate OAuth URL with custom state
    const state = await this.generateCustomState(tenantId);
    const authUrl = this.googleOAuthService.generateAuthUrl(state);
    
    return { authUrl, state };
  }

  async processGoogleCallback(code: string, state: string, tenantId: string) {
    // Validate state
    const isValidState = await this.validateCustomState(state, tenantId);
    if (!isValidState) {
      throw new Error('Invalid state parameter');
    }

    // Exchange code for tokens
    const { idToken } = await this.googleOAuthService.exchangeCodeForTokens(code);
    
    // Verify token and get profile
    const profile = await this.googleOAuthService.verifyIdToken(idToken);
    
    // Authenticate or create user
    const result = await this.googleAuthService.authenticateWithGoogle(
      profile,
      tenantId
    );
    
    return result;
  }

  private async generateCustomState(tenantId: string): Promise<string> {
    // Custom state generation logic
    const state = `${tenantId}_${Date.now()}_${Math.random().toString(36)}`;
    // Store in Redis with TTL
    return state;
  }

  private async validateCustomState(state: string, tenantId: string): Promise<boolean> {
    // Custom state validation logic
    return state.startsWith(`${tenantId}_`);
  }
}
```

## Advanced Authentication Examples

### 1. Account Linking

#### Frontend Account Linking

```typescript
// Account linking component for authenticated users
import { useState } from 'react';

const AccountLinkingComponent = () => {
  const [authMethods, setAuthMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Get current authentication methods
  const fetchAuthMethods = async () => {
    try {
      const response = await fetch('/auth/me/auth-methods', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const { authMethods } = await response.json();
        setAuthMethods(authMethods);
      }
    } catch (error) {
      console.error('Failed to fetch auth methods:', error);
    }
  };

  // Link Google account
  const linkGoogleAccount = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/auth/google/link', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to initiate account linking');
      }

      const { authUrl } = await response.json();
      
      // Redirect to Google OAuth for linking
      window.location.href = authUrl;
    } catch (error) {
      console.error('Account linking failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Unlink Google account
  const unlinkGoogleAccount = async () => {
    if (!confirm('Are you sure you want to unlink your Google account?')) {
      return;
    }

    try {
      const response = await fetch('/auth/google/unlink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        await fetchAuthMethods(); // Refresh auth methods
        alert('Google account unlinked successfully');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }
    } catch (error) {
      console.error('Account unlinking failed:', error);
      alert('Failed to unlink Google account');
    }
  };

  return (
    <div>
      <h3>Authentication Methods</h3>
      <ul>
        {authMethods.map(method => (
          <li key={method}>{method}</li>
        ))}
      </ul>
      
      {!authMethods.includes('google') ? (
        <button onClick={linkGoogleAccount} disabled={loading}>
          {loading ? 'Linking...' : 'Link Google Account'}
        </button>
      ) : (
        <button onClick={unlinkGoogleAccount}>
          Unlink Google Account
        </button>
      )}
    </div>
  );
};
```

### 2. Protected Routes and Guards

#### Using JWT Auth Guard

```typescript
// Protected controller example
import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards';
import { CurrentUser } from '@/auth/decorators';
import { User } from '@prisma/client';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
    };
  }

  @Post('update')
  updateProfile(
    @CurrentUser() user: User,
    @Body() updateData: { firstName?: string; lastName?: string }
  ) {
    // Update user profile logic
    return { message: 'Profile updated successfully' };
  }
}
```

#### Using Permission Guards

```typescript
// Permission-protected controller
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards';
import { PermissionsGuard } from '@/common/guards';
import { Permissions } from '@/common/decorators';

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  @Get('users')
  @Permissions('read:users')
  getUsers() {
    // Only accessible with 'read:users' permission
    return { users: [] };
  }

  @Post('users')
  @Permissions('create:users')
  createUser() {
    // Only accessible with 'create:users' permission
    return { message: 'User created' };
  }

  @Get('reports')
  @Permissions('read:reports', 'read:analytics')
  getReports() {
    // Requires both 'read:reports' AND 'read:analytics' permissions
    return { reports: [] };
  }
}
```

### 3. Custom Authentication Strategies

#### Custom JWT Strategy

```typescript
// Custom JWT strategy with additional validation
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database';
import { JwtPayload } from '@/auth/interfaces';

@Injectable()
export class CustomJwtStrategy extends PassportStrategy(Strategy, 'custom-jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Custom validation logic
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException();
    }

    // Add custom properties
    return {
      ...user,
      permissions: this.extractPermissions(user.roles),
    };
  }

  private extractPermissions(roles: any[]): string[] {
    const permissions = new Set<string>();
    
    roles.forEach(userRole => {
      userRole.role.permissions.forEach(rolePermission => {
        const permission = rolePermission.permission;
        permissions.add(`${permission.action}:${permission.subject}`);
      });
    });

    return Array.from(permissions);
  }
}
```

## Integration Examples

### 1. Frontend Authentication Hook

```typescript
// React authentication hook
import { useState, useEffect, useContext, createContext } from 'react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const savedToken = localStorage.getItem('accessToken');
    if (savedToken) {
      setToken(savedToken);
      fetchUserProfile(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (authToken: string) => {
    try {
      const response = await fetch('/profile', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token might be invalid
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-123', // Get from config
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const { accessToken } = await response.json();
      
      localStorage.setItem('accessToken', accessToken);
      setToken(accessToken);
      
      await fetchUserProfile(accessToken);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    // Redirect to Google OAuth
    const response = await fetch('/auth/google', {
      headers: {
        'x-tenant-id': 'tenant-123',
      },
    });

    if (response.ok) {
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      loginWithGoogle,
      logout,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 2. API Client with Authentication

```typescript
// API client with automatic token handling
class ApiClient {
  private baseUrl: string;
  private tenantId: string;

  constructor(baseUrl: string, tenantId: string) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': this.tenantId,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Request failed');
    }

    return response.json();
  }

  async get(endpoint: string) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async post(endpoint: string, data: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async put(endpoint: string, data: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async delete(endpoint: string) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Authentication methods
  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.tenantId,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await this.handleResponse(response);
    
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }

    return data;
  }

  async logout() {
    localStorage.removeItem('accessToken');
  }
}

// Usage
const apiClient = new ApiClient('http://localhost:3000', 'tenant-123');

// Login
await apiClient.login('user@example.com', 'password');

// Make authenticated requests
const profile = await apiClient.get('/profile');
const users = await apiClient.get('/admin/users');
```

### 3. Testing Authentication

#### Unit Tests

```typescript
// Auth service unit tests
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '@/database';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('login', () => {
    it('should return access token for valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: await bcrypt.hash('password', 12),
        tenantId: 'tenant-123',
        roles: [{ role: { id: 'role-123' } }],
      };

      const mockToken = 'jwt-token';

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken);

      const result = await service.login(
        { email: 'test@example.com', password: 'password' },
        'tenant-123'
      );

      expect(result).toEqual({ accessToken: mockToken });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email_tenantId: {
            email: 'test@example.com',
            tenantId: 'tenant-123',
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
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.login(
          { email: 'test@example.com', password: 'password' },
          'tenant-123'
        )
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

#### Integration Tests

```typescript
// Auth controller integration tests
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/auth/login (POST)', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('x-tenant-id', 'tenant-123')
        .send({
          email: 'test@example.com',
          password: 'password',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(typeof res.body.accessToken).toBe('string');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('x-tenant-id', 'tenant-123')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should return 400 for missing tenant ID', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password',
        })
        .expect(400);
    });
  });

  describe('/profile (GET)', () => {
    it('should return user profile with valid token', async () => {
      // First login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-tenant-id', 'tenant-123')
        .send({
          email: 'test@example.com',
          password: 'password',
        });

      const { accessToken } = loginResponse.body;

      // Then access protected route
      return request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('tenantId');
        });
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/profile')
        .expect(401);
    });
  });
});
```

These examples provide comprehensive coverage of authentication patterns, from basic login flows to advanced integration scenarios, helping developers implement secure authentication in their applications.