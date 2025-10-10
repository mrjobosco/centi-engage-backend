# Database Troubleshooting Guide

## Overview

This guide provides solutions for common database-related issues in the multi-tenant NestJS application using Prisma ORM.

## Common Issues and Solutions

### 1. Tenant Isolation Problems

#### Issue: Cross-Tenant Data Leakage

**Symptoms**:
- Users seeing data from other tenants
- Queries returning more data than expected
- Tenant context errors in logs

**Diagnosis**:
```typescript
// Check if tenant context is properly set
const tenantId = this.tenantContext.getTenantId();
console.log('Current tenant ID:', tenantId);

// Verify middleware is working
const users = await this.prisma.user.findMany();
console.log('Users returned:', users.map(u => ({ id: u.id, tenantId: u.tenantId })));
```

**Solutions**:

1. **Verify Tenant Context Service**:
```typescript
// src/tenant/tenant-context.service.ts
@Injectable()
export class TenantContextService implements ITenantContext {
  private tenantId: string | undefined;

  setTenantId(tenantId: string) {
    this.tenantId = tenantId;
  }

  getTenantId(): string | undefined {
    if (!this.tenantId) {
      throw new Error('Tenant context not set');
    }
    return this.tenantId;
  }
}
```

2. **Check Middleware Registration**:
```typescript
// src/database/prisma.service.ts
async onModuleInit() {
  await this.$connect();
  
  // Ensure middleware is registered
  if (this.tenantContext) {
    (this as any).$use(createTenantScopingMiddleware(this.tenantContext));
    console.log('✅ Tenant middleware registered');
  } else {
    console.warn('⚠️ Tenant context not available - middleware not registered');
  }
}
```

3. **Verify Tenant Identification Middleware**:
```typescript
// src/tenant/tenant-identification.middleware.ts
export class TenantIdentificationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    
    this.tenantContext.setTenantId(tenantId);
    next();
  }
}
```

#### Issue: Tenant Context Not Available

**Symptoms**:
- "Tenant context not available" errors
- Middleware not applying tenant scoping
- All data returned regardless of tenant

**Solutions**:

1. **Check Module Dependencies**:
```typescript
// Ensure TenantModule is imported before DatabaseModule
@Module({
  imports: [
    TenantModule,
    DatabaseModule,
    // ... other modules
  ],
})
export class AppModule {}
```

2. **Verify Middleware Order**:
```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Tenant identification must come before other middleware
  app.use('/api/*', TenantIdentificationMiddleware);
  
  await app.listen(3000);
}
```

### 2. Connection Issues

#### Issue: Database Connection Failures

**Symptoms**:
- "Connection refused" errors
- Timeout errors during startup
- Intermittent connection drops

**Diagnosis**:
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool status
npx prisma studio
```

**Solutions**:

1. **Verify Database URL**:
```bash
# Check environment variables
echo $DATABASE_URL

# Test connection string format
# postgresql://username:password@host:port/database
```

2. **Configure Connection Pool**:
```typescript
// src/database/prisma.service.ts
constructor() {
  super({
    log: ['error', 'warn'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}
```

3. **Handle Connection Errors**:
```typescript
async onModuleInit() {
  try {
    await this.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}
```

#### Issue: Connection Pool Exhaustion

**Symptoms**:
- "Too many connections" errors
- Slow query performance
- Application hanging on database operations

**Solutions**:

1. **Configure Connection Limits**:
```env
# .env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
```

2. **Implement Connection Monitoring**:
```typescript
// src/database/prisma.service.ts
async getConnectionInfo() {
  const result = await this.$queryRaw`
    SELECT 
      count(*) as total_connections,
      count(*) FILTER (WHERE state = 'active') as active_connections,
      count(*) FILTER (WHERE state = 'idle') as idle_connections
    FROM pg_stat_activity 
    WHERE datname = current_database()
  `;
  
  return result[0];
}
```

3. **Proper Connection Cleanup**:
```typescript
async onModuleDestroy() {
  await this.$disconnect();
  console.log('✅ Database disconnected');
}
```

### 3. Query Performance Issues

#### Issue: Slow Queries

**Symptoms**:
- Long response times
- High CPU usage
- Query timeouts

**Diagnosis**:

1. **Enable Query Logging**:
```typescript
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
  ],
});

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Duration: ' + e.duration + 'ms');
});
```

2. **Analyze Query Plans**:
```sql
-- In PostgreSQL
EXPLAIN ANALYZE SELECT * FROM users WHERE tenant_id = 'tenant_id';
```

**Solutions**:

1. **Add Missing Indexes**:
```sql
-- Critical indexes for tenant isolation
CREATE INDEX CONCURRENTLY idx_users_tenant_id ON users(tenant_id);
CREATE INDEX CONCURRENTLY idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX CONCURRENTLY idx_notifications_user_tenant ON notifications(user_id, tenant_id);
```

2. **Optimize Queries**:
```typescript
// ❌ N+1 Query Problem
const users = await prisma.user.findMany();
for (const user of users) {
  const projects = await prisma.project.findMany({
    where: { ownerId: user.id }
  });
}

// ✅ Optimized with Include
const users = await prisma.user.findMany({
  include: {
    projects: true
  }
});
```

3. **Use Pagination**:
```typescript
// ✅ Cursor-based pagination
async findUsers(cursor?: string, take = 10) {
  return this.prisma.user.findMany({
    take,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}
```

#### Issue: Memory Issues with Large Datasets

**Symptoms**:
- Out of memory errors
- Application crashes during large queries
- Slow garbage collection

**Solutions**:

1. **Use Streaming for Large Datasets**:
```typescript
async processLargeDataset() {
  const batchSize = 1000;
  let cursor: string | undefined;
  
  do {
    const batch = await this.prisma.notification.findMany({
      take: batchSize,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });
    
    // Process batch
    await this.processBatch(batch);
    
    cursor = batch.length === batchSize ? batch[batch.length - 1].id : undefined;
  } while (cursor);
}
```

2. **Implement Query Limits**:
```typescript
// Add global query limits
const MAX_QUERY_LIMIT = 1000;

async findMany(args: any) {
  if (args.take && args.take > MAX_QUERY_LIMIT) {
    throw new BadRequestException(`Query limit exceeded. Maximum: ${MAX_QUERY_LIMIT}`);
  }
  
  return this.prisma.model.findMany(args);
}
```

### 4. Migration Issues

#### Issue: Migration Failures

**Symptoms**:
- Migration commands fail
- Database schema out of sync
- "Migration already applied" errors

**Diagnosis**:
```bash
# Check migration status
npx prisma migrate status

# Check database schema
npx prisma db pull
```

**Solutions**:

1. **Resolve Migration Conflicts**:
```bash
# Mark migration as applied (if manually applied)
npx prisma migrate resolve --applied 20231001000000_migration_name

# Reset and reapply (development only)
npx prisma migrate reset
```

2. **Handle Schema Drift**:
```bash
# Pull current schema from database
npx prisma db pull

# Compare with schema.prisma and resolve differences
# Generate new migration
npx prisma migrate dev --name fix_schema_drift
```

3. **Backup Before Migrations**:
```bash
# Create backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migration
npx prisma migrate deploy
```

### 5. Data Integrity Issues

#### Issue: Constraint Violations

**Symptoms**:
- Foreign key constraint errors
- Unique constraint violations
- Check constraint failures

**Solutions**:

1. **Handle Unique Constraint Violations**:
```typescript
try {
  const user = await this.prisma.user.create({ data });
} catch (error) {
  if (error.code === 'P2002') {
    // Unique constraint violation
    const field = error.meta?.target?.[0];
    throw new ConflictException(`${field} already exists`);
  }
  throw error;
}
```

2. **Validate Foreign Key Relationships**:
```typescript
async createProject(data: CreateProjectDto, userId: string) {
  // Verify user exists and belongs to current tenant
  const user = await this.prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    throw new NotFoundException('User not found');
  }
  
  return this.prisma.project.create({
    data: {
      ...data,
      ownerId: userId,
    },
  });
}
```

3. **Use Transactions for Related Operations**:
```typescript
async createUserWithRole(userData: CreateUserDto, roleId: string) {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: userData });
    
    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId,
      },
    });
    
    return user;
  });
}
```

### 6. Authentication and Authorization Issues

#### Issue: Permission Resolution Failures

**Symptoms**:
- Users can't access resources they should have access to
- Permission checks failing unexpectedly
- Role assignments not working

**Diagnosis**:
```typescript
// Debug user permissions
async debugUserPermissions(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
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
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });
  
  console.log('User roles and permissions:', JSON.stringify(user, null, 2));
}
```

**Solutions**:

1. **Verify Role Assignments**:
```typescript
async assignRoleToUser(userId: string, roleId: string) {
  // Check if role exists in same tenant
  const role = await this.prisma.role.findUnique({
    where: { id: roleId },
  });
  
  if (!role) {
    throw new NotFoundException('Role not found');
  }
  
  // Create role assignment
  return this.prisma.userRole.create({
    data: { userId, roleId },
  });
}
```

2. **Fix Permission Inheritance**:
```typescript
async getUserPermissions(userId: string): Promise<string[]> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
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
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });
  
  // Combine role permissions and direct permissions
  const rolePermissions = user.roles.flatMap(ur => 
    ur.role.permissions.map(rp => `${rp.permission.action}:${rp.permission.subject}`)
  );
  
  const directPermissions = user.permissions.map(up => 
    `${up.permission.action}:${up.permission.subject}`
  );
  
  return [...new Set([...rolePermissions, ...directPermissions])];
}
```

### 7. Notification System Issues

#### Issue: Notification Delivery Failures

**Symptoms**:
- Notifications not being sent
- Delivery logs showing failures
- Provider errors

**Diagnosis**:
```typescript
// Check notification delivery logs
async checkDeliveryStatus(notificationId: string) {
  const logs = await this.prisma.notificationDeliveryLog.findMany({
    where: { notificationId },
    orderBy: { createdAt: 'desc' },
  });
  
  console.log('Delivery logs:', logs);
}
```

**Solutions**:

1. **Verify Provider Configuration**:
```typescript
async validateProviderConfig(tenantId: string) {
  const config = await this.prisma.tenantNotificationConfig.findUnique({
    where: { tenantId },
  });
  
  if (!config?.emailProvider || !config?.emailApiKey) {
    throw new Error('Email provider not configured');
  }
  
  return config;
}
```

2. **Handle Delivery Failures**:
```typescript
async handleDeliveryFailure(notificationId: string, error: any) {
  await this.prisma.notificationDeliveryLog.create({
    data: {
      notificationId,
      channel: 'EMAIL',
      status: 'FAILED',
      errorMessage: error.message,
      createdAt: new Date(),
    },
  });
  
  // Implement retry logic or fallback channel
}
```

## Performance Monitoring

### Database Metrics

```typescript
// src/database/monitoring.service.ts
@Injectable()
export class DatabaseMonitoringService {
  constructor(private prisma: PrismaService) {}
  
  async getConnectionMetrics() {
    const result = await this.prisma.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        max(now() - query_start) as longest_query_duration
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    return result[0];
  }
  
  async getSlowQueries() {
    return this.prisma.$queryRaw`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows
      FROM pg_stat_statements 
      WHERE mean_time > 1000 -- queries taking more than 1 second
      ORDER BY mean_time DESC 
      LIMIT 10
    `;
  }
  
  async getTableSizes() {
    return this.prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY size_bytes DESC
    `;
  }
}
```

### Health Checks

```typescript
// src/health/database.health.ts
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private prisma: PrismaService) {
    super();
  }
  
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Test tenant middleware
      const tenantCount = await this.prisma.tenant.count();
      
      // Check connection pool
      const connections = await this.getConnectionCount();
      
      if (connections > 80) { // 80% of max connections
        throw new Error('Connection pool near capacity');
      }
      
      return this.getStatus(key, true, {
        tenants: tenantCount,
        connections,
      });
    } catch (error) {
      return this.getStatus(key, false, {
        error: error.message,
      });
    }
  }
  
  private async getConnectionCount(): Promise<number> {
    const result = await this.prisma.$queryRaw`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    return result[0].count;
  }
}
```

## Debugging Tools

### Query Analysis

```typescript
// src/database/query-analyzer.ts
export class QueryAnalyzer {
  private queryLog: Array<{ query: string; duration: number; timestamp: Date }> = [];
  
  logQuery(query: string, duration: number) {
    this.queryLog.push({
      query,
      duration,
      timestamp: new Date(),
    });
    
    // Keep only last 100 queries
    if (this.queryLog.length > 100) {
      this.queryLog.shift();
    }
  }
  
  getSlowQueries(threshold = 1000): Array<any> {
    return this.queryLog
      .filter(log => log.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }
  
  getQueryStats() {
    const totalQueries = this.queryLog.length;
    const avgDuration = this.queryLog.reduce((sum, log) => sum + log.duration, 0) / totalQueries;
    const maxDuration = Math.max(...this.queryLog.map(log => log.duration));
    
    return {
      totalQueries,
      avgDuration,
      maxDuration,
      slowQueries: this.getSlowQueries().length,
    };
  }
}
```

### Development Tools

```bash
# Useful development commands

# Open Prisma Studio for visual database inspection
npx prisma studio

# Generate ERD diagram
npx prisma-erd-generator

# Validate schema
npx prisma validate

# Format schema file
npx prisma format

# Reset database (development only)
npx prisma migrate reset --force

# Seed database
npx prisma db seed
```

This comprehensive troubleshooting guide covers the most common database issues and their solutions, providing both diagnostic tools and practical fixes for the multi-tenant NestJS application.