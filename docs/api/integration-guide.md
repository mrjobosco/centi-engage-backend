# API Integration Guide

This guide provides comprehensive examples and best practices for integrating with the Multi-Tenant NestJS API.

## Quick Start

### 1. Authentication Setup

First, authenticate to get a JWT token:

```javascript
// Login with email/password
async function login(email, password, tenantId) {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const { accessToken } = await response.json();
  return accessToken;
}

// Usage
const token = await login('user@example.com', 'password123', 'tenant_123');
```

### 2. Making Authenticated Requests

Use the token for subsequent API calls:

```javascript
async function makeAuthenticatedRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': 'tenant_123',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
}

// Get users
const users = await makeAuthenticatedRequest('http://localhost:3000/api/users');
```

## Complete Integration Examples

### JavaScript/Node.js Client

```javascript
class MultiTenantApiClient {
  constructor(baseUrl, tenantId) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
    this.token = null;
  }
  
  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.tenantId
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      throw new Error('Authentication failed');
    }
    
    const { accessToken } = await response.json();
    this.token = accessToken;
    return accessToken;
  }
  
  async request(endpoint, options = {}) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'x-tenant-id': this.tenantId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (response.status === 401) {
      this.token = null;
      throw new Error('Token expired. Please login again.');
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    return response.json();
  }
  
  // User management
  async getUsers() {
    return this.request('/users');
  }
  
  async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }
  
  async updateUser(userId, userData) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }
  
  // Notification management
  async getNotifications(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/notifications?${params}`);
  }
  
  async createNotification(notificationData) {
    return this.request('/notifications', {
      method: 'POST',
      body: JSON.stringify(notificationData)
    });
  }
  
  async markNotificationAsRead(notificationId) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH'
    });
  }
  
  // Project management
  async getProjects() {
    return this.request('/projects');
  }
  
  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
  }
}

// Usage
const client = new MultiTenantApiClient('http://localhost:3000/api', 'tenant_123');

async function example() {
  try {
    // Login
    await client.login('user@example.com', 'password123');
    
    // Get users
    const users = await client.getUsers();
    console.log('Users:', users);
    
    // Create notification
    const notification = await client.createNotification({
      userId: 'user_123',
      category: 'system',
      type: 'INFO',
      title: 'Welcome!',
      message: 'Welcome to our platform!'
    });
    console.log('Notification created:', notification);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### Python Client

```python
import requests
import json
from typing import Optional, Dict, Any

class MultiTenantApiClient:
    def __init__(self, base_url: str, tenant_id: str):
        self.base_url = base_url.rstrip('/')
        self.tenant_id = tenant_id
        self.token: Optional[str] = None
        self.session = requests.Session()
    
    def login(self, email: str, password: str) -> str:
        """Authenticate and get access token"""
        response = self.session.post(
            f"{self.base_url}/auth/login",
            headers={
                'Content-Type': 'application/json',
                'x-tenant-id': self.tenant_id
            },
            json={'email': email, 'password': password}
        )
        
        if not response.ok:
            raise Exception(f"Authentication failed: {response.text}")
        
        data = response.json()
        self.token = data['accessToken']
        return self.token
    
    def request(self, endpoint: str, method: str = 'GET', data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make authenticated request"""
        if not self.token:
            raise Exception("Not authenticated. Call login() first.")
        
        headers = {
            'Authorization': f'Bearer {self.token}',
            'x-tenant-id': self.tenant_id,
            'Content-Type': 'application/json'
        }
        
        response = self.session.request(
            method=method,
            url=f"{self.base_url}{endpoint}",
            headers=headers,
            json=data if data else None
        )
        
        if response.status_code == 401:
            self.token = None
            raise Exception("Token expired. Please login again.")
        
        if not response.ok:
            try:
                error_data = response.json()
                raise Exception(error_data.get('message', 'Request failed'))
            except json.JSONDecodeError:
                raise Exception(f"Request failed with status {response.status_code}")
        
        return response.json()
    
    # User management methods
    def get_users(self) -> list:
        return self.request('/users')
    
    def create_user(self, user_data: Dict) -> Dict:
        return self.request('/users', 'POST', user_data)
    
    def update_user(self, user_id: str, user_data: Dict) -> Dict:
        return self.request(f'/users/{user_id}', 'PUT', user_data)
    
    # Notification methods
    def get_notifications(self, filters: Optional[Dict] = None) -> Dict:
        endpoint = '/notifications'
        if filters:
            params = '&'.join([f"{k}={v}" for k, v in filters.items()])
            endpoint += f"?{params}"
        return self.request(endpoint)
    
    def create_notification(self, notification_data: Dict) -> Dict:
        return self.request('/notifications', 'POST', notification_data)
    
    def mark_notification_read(self, notification_id: str) -> Dict:
        return self.request(f'/notifications/{notification_id}/read', 'PATCH')

# Usage example
if __name__ == "__main__":
    client = MultiTenantApiClient('http://localhost:3000/api', 'tenant_123')
    
    try:
        # Login
        client.login('user@example.com', 'password123')
        print("Logged in successfully")
        
        # Get users
        users = client.get_users()
        print(f"Found {len(users)} users")
        
        # Create notification
        notification = client.create_notification({
            'userId': 'user_123',
            'category': 'system',
            'type': 'INFO',
            'title': 'Python Integration',
            'message': 'Successfully integrated with Python!'
        })
        print(f"Created notification: {notification['id']}")
        
    except Exception as e:
        print(f"Error: {e}")
```

### React/TypeScript Client

```typescript
// types.ts
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  category: string;
  title: string;
  message: string;
  data?: any;
  readAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

// api-client.ts
class ApiClient {
  private baseUrl: string;
  private tenantId: string;
  private token: string | null = null;

  constructor(baseUrl: string, tenantId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.tenantId = tenantId;
  }

  async login(email: string, password: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.tenantId,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(Array.isArray(error.message) ? error.message[0] : error.message);
    }

    const { accessToken } = await response.json();
    this.token = accessToken;
    return accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'x-tenant-id': this.tenantId,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      this.token = null;
      throw new Error('Token expired. Please login again.');
    }

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(Array.isArray(error.message) ? error.message[0] : error.message);
    }

    return response.json();
  }

  // User methods
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async createUser(userData: Partial<User>): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Notification methods
  async getNotifications(filters?: {
    page?: number;
    limit?: number;
    type?: string;
    read?: boolean;
  }): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }

    const endpoint = `/notifications${params.toString() ? `?${params}` : ''}`;
    return this.request(endpoint);
  }

  async createNotification(notificationData: Partial<Notification>): Promise<Notification> {
    return this.request<Notification>('/notifications', {
      method: 'POST',
      body: JSON.stringify(notificationData),
    });
  }

  async markNotificationAsRead(notificationId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }
}

// React Hook
import { useState, useEffect, useCallback } from 'react';

export function useApiClient(baseUrl: string, tenantId: string) {
  const [client] = useState(() => new ApiClient(baseUrl, tenantId));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await client.login(email, password);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [client]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setError(null);
  }, []);

  return {
    client,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
  };
}

// React Component Example
import React, { useState, useEffect } from 'react';

export function NotificationList() {
  const { client, isAuthenticated } = useApiClient('http://localhost:3000/api', 'tenant_123');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
    }
  }, [isAuthenticated]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await client.getNotifications({ limit: 10 });
      setNotifications(response.notifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await client.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  if (!isAuthenticated) {
    return <div>Please login to view notifications</div>;
  }

  if (loading) {
    return <div>Loading notifications...</div>;
  }

  return (
    <div>
      <h2>Notifications</h2>
      {notifications.map(notification => (
        <div key={notification.id} className={`notification ${notification.readAt ? 'read' : 'unread'}`}>
          <h3>{notification.title}</h3>
          <p>{notification.message}</p>
          {!notification.readAt && (
            <button onClick={() => markAsRead(notification.id)}>
              Mark as Read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Common Integration Patterns

### Error Handling Pattern

```javascript
class ApiErrorHandler {
  static handle(error, context = '') {
    console.error(`API Error ${context}:`, error);
    
    if (error.message.includes('Token expired')) {
      // Redirect to login
      window.location.href = '/login';
      return;
    }
    
    if (error.message.includes('Rate limit')) {
      // Show rate limit message
      this.showRateLimitMessage();
      return;
    }
    
    if (error.message.includes('Forbidden')) {
      // Show permission error
      this.showPermissionError();
      return;
    }
    
    // Show generic error
    this.showGenericError(error.message);
  }
  
  static showRateLimitMessage() {
    alert('Too many requests. Please wait a moment and try again.');
  }
  
  static showPermissionError() {
    alert('You do not have permission to perform this action.');
  }
  
  static showGenericError(message) {
    alert(`Error: ${message}`);
  }
}

// Usage
try {
  const users = await client.getUsers();
} catch (error) {
  ApiErrorHandler.handle(error, 'fetching users');
}
```

### Retry Pattern with Exponential Backoff

```javascript
class RetryableApiClient extends MultiTenantApiClient {
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        if (error.message.includes('Rate limit') || error.message.includes('Too Many Requests')) {
          const backoffTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`Rate limited. Retrying in ${backoffTime}ms...`);
          await this.delay(backoffTime);
          continue;
        }
        
        throw error; // Don't retry for other errors
      }
    }
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Caching Pattern

```javascript
class CachedApiClient extends MultiTenantApiClient {
  constructor(baseUrl, tenantId) {
    super(baseUrl, tenantId);
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }
  
  async requestWithCache(endpoint, options = {}, cacheKey = null) {
    const key = cacheKey || `${options.method || 'GET'}:${endpoint}`;
    
    // Check cache for GET requests
    if (!options.method || options.method === 'GET') {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    
    const data = await this.request(endpoint, options);
    
    // Cache GET responses
    if (!options.method || options.method === 'GET') {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
    } else {
      // Invalidate cache for write operations
      this.invalidateCache(endpoint);
    }
    
    return data;
  }
  
  invalidateCache(endpoint) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(endpoint.split('?')[0])) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}
```

## WebSocket Integration

For real-time notifications:

```javascript
class RealtimeNotificationClient {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.socket = null;
    this.listeners = new Map();
  }
  
  connect() {
    if (!this.apiClient.token) {
      throw new Error('Must be authenticated to connect to WebSocket');
    }
    
    this.socket = new WebSocket('ws://localhost:3000', {
      headers: {
        'Authorization': `Bearer ${this.apiClient.token}`,
        'x-tenant-id': this.apiClient.tenantId
      }
    });
    
    this.socket.onopen = () => {
      console.log('WebSocket connected');
    };
    
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect
      setTimeout(() => this.connect(), 5000);
    };
  }
  
  handleMessage(data) {
    const listeners = this.listeners.get(data.type) || [];
    listeners.forEach(callback => callback(data));
  }
  
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }
  
  off(eventType, callback) {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Usage
const realtimeClient = new RealtimeNotificationClient(apiClient);

realtimeClient.on('notification', (notification) => {
  console.log('New notification:', notification);
  // Update UI with new notification
});

realtimeClient.connect();
```

## Testing Integration

### Unit Tests for API Client

```javascript
// api-client.test.js
import { jest } from '@jest/globals';
import { MultiTenantApiClient } from './api-client.js';

// Mock fetch
global.fetch = jest.fn();

describe('MultiTenantApiClient', () => {
  let client;
  
  beforeEach(() => {
    client = new MultiTenantApiClient('http://localhost:3000/api', 'tenant_123');
    fetch.mockClear();
  });
  
  describe('login', () => {
    it('should authenticate successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'test-token' })
      });
      
      const token = await client.login('user@example.com', 'password');
      
      expect(token).toBe('test-token');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-tenant-id': 'tenant_123'
          }),
          body: JSON.stringify({
            email: 'user@example.com',
            password: 'password'
          })
        })
      );
    });
    
    it('should throw error on failed authentication', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' })
      });
      
      await expect(client.login('user@example.com', 'wrong-password'))
        .rejects.toThrow('Authentication failed');
    });
  });
  
  describe('request', () => {
    beforeEach(async () => {
      // Setup authenticated client
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'test-token' })
      });
      await client.login('user@example.com', 'password');
      fetch.mockClear();
    });
    
    it('should make authenticated requests', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: 'user_1', email: 'user1@example.com' }])
      });
      
      const users = await client.getUsers();
      
      expect(users).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'x-tenant-id': 'tenant_123'
          })
        })
      );
    });
  });
});
```

## Best Practices

### Security Best Practices

1. **Store tokens securely**: Use secure storage mechanisms
2. **Implement token refresh**: Handle token expiration gracefully
3. **Validate responses**: Always validate API responses
4. **Use HTTPS**: Never use HTTP in production
5. **Implement CSRF protection**: Use appropriate CSRF tokens

### Performance Best Practices

1. **Implement caching**: Cache frequently accessed data
2. **Use pagination**: Don't load all data at once
3. **Implement retry logic**: Handle transient failures
4. **Optimize requests**: Batch operations when possible
5. **Monitor performance**: Track API response times

### Error Handling Best Practices

1. **Implement comprehensive error handling**: Handle all error scenarios
2. **Provide user-friendly messages**: Don't expose technical details
3. **Log errors appropriately**: Log for debugging without exposing sensitive data
4. **Implement fallback mechanisms**: Graceful degradation when APIs fail
5. **Test error scenarios**: Test all error conditions

This integration guide provides comprehensive examples and patterns for successfully integrating with the Multi-Tenant NestJS API across different platforms and technologies.