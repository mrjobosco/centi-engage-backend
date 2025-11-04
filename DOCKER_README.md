# Docker Setup for Multi-Tenant NestJS Backend

This document provides comprehensive instructions for running the Multi-Tenant NestJS Backend using Docker and Docker Compose.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Configurations](#docker-configurations)
- [Environment Setup](#environment-setup)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Testing](#testing)
- [Monitoring & Management](#monitoring--management)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### Required Software
- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Git**

### System Requirements
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 10GB free space
- **Network**: Internet connection for pulling images

### Installation

#### macOS
```bash
# Install Docker Desktop
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop
```

#### Ubuntu/Debian
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

#### Windows
Download and install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)

## 🚀 Quick Start

### 1. Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd nestjs-multi-tenant-backend

# Run initial setup
./docker/setup.sh setup

# Build Docker images
./docker/setup.sh build
```

### 2. Start Development Environment
```bash
# Start all development services
./docker/setup.sh dev

# Or manually with docker-compose
docker-compose up -d
```

### 3. Access Services
- **API**: http://localhost:3000/api
- **API Documentation**: http://localhost:3000/api/docs
- **MailHog (Email Testing)**: http://localhost:8025
- **pgAdmin (Database)**: http://localhost:8080
- **Redis Commander**: http://localhost:8081

### 4. Default Credentials
- **pgAdmin**: `admin@localhost.com` / `admin`
- **Redis Commander**: `admin` / `admin`
- **Database**: `postgres` / `postgres`

## 🐳 Docker Configurations

### Available Docker Compose Files

| File | Purpose | Usage |
|------|---------|-------|
| `docker-compose.yml` | Development environment | `docker-compose up` |
| `docker-compose.prod.yml` | Production environment | `docker-compose -f docker-compose.prod.yml up` |
| `docker-compose.test.yml` | Testing environment | `docker-compose -f docker-compose.yml -f docker-compose.test.yml up` |

### Docker Stages

| Stage | Purpose | Target |
|-------|---------|--------|
| `development` | Hot reload, debugging | Local development |
| `production` | Optimized, secure | Production deployment |
| `testing` | Test execution | CI/CD pipelines |

## 🔧 Environment Setup

### Development Environment

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your configuration**:
   ```env
   # Database
   DATABASE_URL="postgresql://postgres:postgres@postgres:5432/multitenant_db"
   
   # JWT
   JWT_SECRET="your-secret-key-change-in-production"
   
   # Google OAuth
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   
   # Redis
   REDIS_URL="redis://:redis_password@redis:6379"
   
   # Email (using MailHog for development)
   EMAIL_PROVIDER="smtp"
   SMTP_HOST="mailhog"
   SMTP_PORT=1025
   ```

### Production Environment

1. **Create production environment file**:
   ```bash
   cp .env.example .env.production
   ```

2. **Configure production values**:
   ```env
   # Use strong passwords and real credentials
   DATABASE_URL="postgresql://user:strong_password@postgres:5432/multitenant_prod"
   JWT_SECRET="very-strong-secret-key-for-production"
   REDIS_URL="redis://:strong_redis_password@redis:6379"
   
   # Real email provider
   EMAIL_PROVIDER="resend"
   EMAIL_API_KEY="your-resend-api-key"
   
   # Production domain
   CORS_ORIGIN="https://yourdomain.com"
   ```

## 💻 Development Workflow

### Starting Development
```bash
# Start all services
./docker/setup.sh dev

# View logs
./docker/setup.sh logs

# Stop services
./docker/setup.sh stop
```

### Development Commands
```bash
# Access application container
docker-compose exec app bash

# Run database migrations
docker-compose exec app npx prisma migrate dev

# Generate Prisma client
docker-compose exec app npx prisma generate

# Seed database
docker-compose exec app npx prisma db seed

# View database with Prisma Studio
docker-compose exec app npx prisma studio
```

### Hot Reload
The development setup includes hot reload:
- Code changes are automatically detected
- Application restarts automatically
- No need to rebuild images for code changes

### Database Management
```bash
# Access PostgreSQL directly
docker-compose exec postgres psql -U postgres -d multitenant_db

# Backup database
docker-compose exec postgres pg_dump -U postgres multitenant_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres multitenant_db < backup.sql
```

## 🚀 Production Deployment

### 1. Prepare Production Environment
```bash
# Create production environment file
cp .env.example .env.production

# Edit with production values
nano .env.production
```

### 2. Deploy with Docker Compose
```bash
# Start production services
./docker/setup.sh prod

# Or manually
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 3. Production Features
- **Nginx reverse proxy** with SSL support
- **Optimized Docker images** (multi-stage builds)
- **Health checks** for all services
- **Resource limits** and reservations
- **Security hardening** (non-root users, minimal attack surface)

### 4. SSL Configuration (Optional)
```bash
# Create SSL directory
mkdir -p docker/nginx/ssl

# Copy your SSL certificates
cp your-cert.pem docker/nginx/ssl/cert.pem
cp your-key.pem docker/nginx/ssl/key.pem

# Uncomment HTTPS server block in docker/nginx/nginx.conf
```

### 5. Production Monitoring
```bash
# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Check service health
docker-compose -f docker-compose.prod.yml ps

# Monitor resource usage
docker stats
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
./docker/setup.sh test

# Or run specific test types
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm app-test npm run test
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm app-test npm run test:integration
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm app-test npm run test:e2e
```

### Test Environment Features
- **Isolated test databases** (separate from development)
- **Fast test execution** with optimized configuration
- **Automatic cleanup** after test completion
- **Parallel test support**

### Continuous Integration
```yaml
# Example GitHub Actions workflow
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: ./docker/setup.sh test
```

## 📊 Monitoring & Management

### Available Management Tools

#### pgAdmin (Database Management)
- **URL**: http://localhost:8080
- **Credentials**: `admin@localhost.com` / `admin`
- **Features**: Query editor, database browser, performance monitoring

#### Redis Commander (Redis Management)
- **URL**: http://localhost:8081
- **Credentials**: `admin` / `admin`
- **Features**: Key browser, memory usage, command execution

#### MailHog (Email Testing)
- **URL**: http://localhost:8025
- **Features**: Email capture, SMTP testing, email preview

### Health Checks
```bash
# Check application health
curl http://localhost:3000/api/

# Check Google OAuth health
curl http://localhost:3000/api/health/google-oauth

# Check OTP system health
curl http://localhost:3000/api/auth/otp/monitoring/health
```

### Logs and Debugging
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f redis

# Follow logs with timestamps
docker-compose logs -f -t

# View last 100 lines
docker-compose logs --tail=100
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3001:3000"  # Use port 3001 instead
```

#### 2. Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

#### 3. Redis Connection Issues
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Clear Redis data
docker-compose exec redis redis-cli FLUSHALL
```

#### 4. Application Won't Start
```bash
# Check application logs
docker-compose logs app

# Rebuild application image
docker-compose build app

# Start with fresh containers
docker-compose down
docker-compose up --build
```

#### 5. Permission Issues
```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Fix Docker socket permissions (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

### Performance Issues

#### 1. Slow Database Queries
```bash
# Enable query logging in PostgreSQL
docker-compose exec postgres psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all';"
docker-compose restart postgres
```

#### 2. High Memory Usage
```bash
# Check memory usage
docker stats

# Limit container memory
# Add to docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 512M
```

#### 3. Slow Build Times
```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1
docker-compose build

# Clean up build cache
docker builder prune
```

### Cleanup and Reset

#### Complete Reset
```bash
# Stop all services and remove everything
./docker/setup.sh cleanup

# Or manually
docker-compose down -v --remove-orphans
docker system prune -a --volumes
```

#### Partial Reset
```bash
# Reset only data (keep images)
docker-compose down -v
docker-compose up -d

# Reset only application (keep databases)
docker-compose stop app
docker-compose rm -f app
docker-compose up -d app
```

## 📚 Additional Resources

### Docker Commands Reference
```bash
# Container management
docker-compose up -d          # Start services in background
docker-compose down           # Stop and remove containers
docker-compose restart app    # Restart specific service
docker-compose exec app bash  # Access container shell

# Image management
docker-compose build          # Build images
docker-compose pull           # Pull latest images
docker images                 # List images
docker rmi <image>           # Remove image

# Volume management
docker volume ls              # List volumes
docker volume rm <volume>     # Remove volume
docker-compose down -v        # Remove volumes with containers

# System cleanup
docker system prune           # Remove unused resources
docker system prune -a        # Remove all unused resources
docker system df              # Show disk usage
```

### Environment Variables Reference
See `.env.example` for complete list of available environment variables.

### Networking
- All services communicate through the `nestjs-network` bridge network
- Services can reach each other using service names (e.g., `postgres`, `redis`)
- External access is controlled through port mappings

### Security Best Practices
- Use strong passwords in production
- Don't expose database ports in production
- Use SSL certificates for HTTPS
- Regularly update Docker images
- Use non-root users in containers
- Implement proper firewall rules

---

For more information, see the main [DEVELOPER_WIKI.md](./DEVELOPER_WIKI.md) or contact the development team.