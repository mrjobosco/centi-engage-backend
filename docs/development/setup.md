# Development Setup Guide

This guide will help you set up the multi-tenant NestJS application for local development. Follow these steps to get your development environment up and running.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

- **Node.js** (v18.0.0 or higher)
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`

- **npm** (v8.0.0 or higher) or **yarn** (v1.22.0 or higher)
  - npm comes with Node.js
  - For yarn: `npm install -g yarn`

- **PostgreSQL** (v13.0 or higher)
  - Download from [postgresql.org](https://www.postgresql.org/downloads/)
  - Verify installation: `psql --version`

- **Redis** (v6.0 or higher)
  - Download from [redis.io](https://redis.io/download)
  - For macOS: `brew install redis`
  - For Ubuntu: `sudo apt install redis-server`
  - Verify installation: `redis-cli --version`

### Optional Tools

- **Docker** and **Docker Compose** (for containerized development)
  - Download from [docker.com](https://www.docker.com/get-started)

- **pgAdmin** or **DBeaver** (for database management)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nestjs-multi-tenant-starter-project-backend
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit the `.env` file with your local configuration (see [Environment Variables](#environment-variables) section below).

### 4. Set Up the Database

#### Option A: Local PostgreSQL

1. Create a new database:
```bash
createdb multitenant_db
```

2. Update the `DATABASE_URL` in your `.env` file:
```
DATABASE_URL="postgresql://username:password@localhost:5432/multitenant_db"
```

#### Option B: Docker PostgreSQL

```bash
docker run --name postgres-dev \
  -e POSTGRES_DB=multitenant_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:13
```

### 5. Set Up Redis

#### Option A: Local Redis

Start Redis server:
```bash
redis-server
```

#### Option B: Docker Redis

```bash
docker run --name redis-dev \
  -p 6379:6379 \
  -d redis:6-alpine
```

### 6. Run Database Migrations

```bash
npx prisma migrate dev
```

### 7. Seed the Database (Optional)

```bash
npx prisma db seed
```

## Environment Variables

### Core Application Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Application environment | `development` | Yes |
| `PORT` | Application port | `3000` | Yes |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | - | Yes |
| `JWT_EXPIRATION` | JWT token expiration time | `15m` | Yes |

### Tenant Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TENANT_HEADER_NAME` | Header name for tenant identification | `x-tenant-id` | Yes |
| `ENABLE_SUBDOMAIN_ROUTING` | Enable subdomain-based tenant routing | `true` | No |

### Google OAuth Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - | For OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - | For OAuth |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | `http://localhost:3000/auth/google/callback` | For OAuth |
| `GOOGLE_LINK_CALLBACK_URL` | OAuth link callback URL | `http://localhost:3000/auth/google/link/callback` | For OAuth |

### Redis Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Yes |

### Notification System Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `EMAIL_PROVIDER` | Email provider (resend, ses, onesignal, smtp) | `smtp` | Yes |
| `EMAIL_FROM_ADDRESS` | Default sender email | - | Yes |
| `EMAIL_FROM_NAME` | Default sender name | - | Yes |
| `SMS_PROVIDER` | SMS provider (twilio, termii) | `twilio` | For SMS |

### Rate Limiting Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TENANT_RATE_LIMIT_WINDOW_MS` | Tenant rate limit window (ms) | `60000` | No |
| `TENANT_RATE_LIMIT_MAX_REQUESTS` | Max requests per tenant | `100` | No |
| `USER_RATE_LIMIT_WINDOW_MS` | User rate limit window (ms) | `60000` | No |
| `USER_RATE_LIMIT_MAX_REQUESTS` | Max requests per user | `50` | No |

## Running the Application

### Development Mode

Start the application in development mode with hot reload:

```bash
npm run start:dev
# or
yarn start:dev
```

The application will be available at `http://localhost:3000`.

### Debug Mode

Start the application in debug mode:

```bash
npm run start:debug
# or
yarn start:debug
```

Connect your debugger to port `9229`.

### Production Mode

Build and start the application in production mode:

```bash
npm run build
npm run start:prod
# or
yarn build
yarn start:prod
```

## IDE Setup Recommendations

### Visual Studio Code

Recommended extensions:

1. **TypeScript and JavaScript Language Features** (built-in)
2. **Prisma** - Syntax highlighting for Prisma schema
3. **ESLint** - Code linting
4. **Prettier** - Code formatting
5. **REST Client** - API testing
6. **GitLens** - Git integration
7. **Auto Rename Tag** - HTML/JSX tag renaming
8. **Bracket Pair Colorizer** - Bracket highlighting

#### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```

#### Launch Configuration

Create `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    }
  ]
}
```

### IntelliJ IDEA / WebStorm

1. Enable TypeScript support
2. Configure ESLint and Prettier
3. Set up Node.js run configurations
4. Install Prisma plugin

## Debugging Tips

### Common Issues and Solutions

#### Database Connection Issues

1. **Error: `ECONNREFUSED`**
   - Ensure PostgreSQL is running
   - Check the `DATABASE_URL` in your `.env` file
   - Verify database credentials

2. **Error: `database does not exist`**
   - Create the database: `createdb multitenant_db`
   - Run migrations: `npx prisma migrate dev`

#### Redis Connection Issues

1. **Error: `Redis connection failed`**
   - Ensure Redis is running: `redis-cli ping`
   - Check the `REDIS_URL` in your `.env` file

#### JWT Token Issues

1. **Error: `Invalid token`**
   - Ensure `JWT_SECRET` is set in your `.env` file
   - Check token expiration settings

### Debugging Tools

#### Database Debugging

```bash
# Connect to database
npx prisma studio

# View database schema
npx prisma db pull

# Reset database
npx prisma migrate reset
```

#### Redis Debugging

```bash
# Connect to Redis CLI
redis-cli

# Monitor Redis commands
redis-cli monitor

# Check Redis info
redis-cli info
```

#### Application Debugging

```bash
# View application logs with debug info
DEBUG=* npm run start:dev

# Run with Node.js inspector
node --inspect-brk dist/main.js
```

### Performance Debugging

#### Memory Usage

```bash
# Monitor memory usage
node --inspect --max-old-space-size=4096 dist/main.js
```

#### Database Query Debugging

Enable Prisma query logging in your `.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public&logging=true"
```

## Next Steps

After completing the setup:

1. Read the [API Documentation](../api/overview.md)
2. Review the [Architecture Overview](../architecture/overview.md)
3. Check out the [Testing Guide](./testing.md)
4. Explore the [Module Documentation](../modules/)

## Troubleshooting

If you encounter issues during setup:

1. Check the [Common Issues](#common-issues-and-solutions) section above
2. Review the application logs for error messages
3. Ensure all prerequisites are properly installed
4. Verify environment variable configuration
5. Check database and Redis connectivity

For additional help, refer to the module-specific troubleshooting guides in the [modules documentation](../modules/).