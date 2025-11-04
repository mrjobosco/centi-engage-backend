# Docker Environment Variables Guide

## 🔧 Environment Variable Configuration

All Docker Compose files now use environment variables from `.env` files instead of hardcoded values. This provides better flexibility and security.

## 📁 Environment Files

| File | Purpose | Usage |
|------|---------|-------|
| `.env` | Development configuration | `docker-compose up` |
| `.env.production` | Production configuration | `docker-compose -f docker-compose.prod.yml --env-file .env.production up` |
| `.env.example` | Template with all variables | Copy to `.env` and customize |
| `.env.production.example` | Production template | Copy to `.env.production` and customize |

## 🚀 Quick Setup

### 1. Development Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your values (optional - defaults work for development)
nano .env

# Start services
docker-compose up -d
```

### 2. Production Setup
```bash
# Copy production template
cp .env.production.example .env.production

# Edit with production values (REQUIRED)
nano .env.production

# Start production services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 📋 Key Environment Variables

### Database Configuration
```env
# PostgreSQL
POSTGRES_DB=multitenant_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multitenant_db
```

### Redis Configuration
```env
# Redis
REDIS_PASSWORD=redis_password
REDIS_PORT=6379
REDIS_URL=redis://:redis_password@localhost:6379
```

### Application Configuration
```env
# Application
NODE_ENV=development
PORT=3000
APP_PORT=3000
JWT_SECRET=your-secret-key
```

### Development Tools
```env
# pgAdmin
PGADMIN_DEFAULT_EMAIL=admin@localhost.com
PGADMIN_DEFAULT_PASSWORD=admin
PGADMIN_PORT=8080

# Redis Commander
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASSWORD=admin
REDIS_COMMANDER_PORT=8081

# MailHog
MAILHOG_SMTP_PORT=1025
MAILHOG_WEB_PORT=8025
```

## 🔒 Security Best Practices

### Development
- Use the provided defaults for quick setup
- Change default passwords if exposing services externally
- Keep `.env` file in `.gitignore`

### Production
- **ALWAYS** use strong, unique passwords
- **NEVER** commit `.env.production` to version control
- Use environment-specific secrets management
- Regularly rotate passwords and API keys

## 🛠️ Customization Examples

### Change Default Ports
```env
# Use different ports to avoid conflicts
APP_PORT=3001
POSTGRES_PORT=5433
REDIS_PORT=6380
PGADMIN_PORT=8082
```

### Use External Services
```env
# Use external PostgreSQL
DATABASE_URL=postgresql://user:pass@external-db:5432/mydb

# Use external Redis
REDIS_URL=redis://:password@external-redis:6379
```

### Email Configuration
```env
# Use real email service instead of MailHog
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your-resend-api-key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
```

## 🔍 Variable Precedence

Docker Compose uses this precedence order:
1. **Environment variables** set in the shell
2. **Environment variables** from `.env` file
3. **Default values** specified in docker-compose.yml (using `${VAR:-default}`)

### Example:
```bash
# Shell variable takes precedence
export APP_PORT=4000
docker-compose up  # App will run on port 4000

# .env file variable
echo "APP_PORT=3001" >> .env
docker-compose up  # App will run on port 3001

# Default value (if no .env or shell variable)
# App will run on port 3000 (default)
```

## 🐛 Troubleshooting

### Variables Not Loading
```bash
# Check if .env file exists
ls -la .env

# Verify Docker Compose can read variables
docker-compose config

# Check specific service configuration
docker-compose config app
```

### Port Conflicts
```bash
# Check what's using a port
lsof -i :3000

# Change port in .env
echo "APP_PORT=3001" >> .env
```

### Database Connection Issues
```bash
# Verify database URL format
echo $DATABASE_URL

# Test connection
docker-compose exec postgres psql $DATABASE_URL
```

## 📚 Advanced Usage

### Multiple Environment Files
```bash
# Use specific environment file
docker-compose --env-file .env.staging up

# Override with multiple files
docker-compose --env-file .env --env-file .env.local up
```

### Environment Variable Substitution
```yaml
# In docker-compose.yml
environment:
  - DATABASE_URL=${DATABASE_URL}
  - API_KEY=${API_KEY:-default-key}
  - DEBUG=${DEBUG:-false}
```

### Conditional Configuration
```yaml
# Different configs based on environment
services:
  app:
    image: myapp:${NODE_ENV:-development}
    ports:
      - "${APP_PORT:-3000}:3000"
    environment:
      - NODE_ENV=${NODE_ENV:-development}
```

## ✅ Validation

### Check Configuration
```bash
# Validate docker-compose.yml syntax
docker-compose config

# Check environment variables
docker-compose config --services
docker-compose config --volumes

# Verify specific service config
docker-compose config app
```

### Test Environment
```bash
# Start with specific environment
docker-compose --env-file .env.test up -d

# Check running services
docker-compose ps

# Verify environment variables in container
docker-compose exec app env | grep DATABASE_URL
```

---

This guide ensures all Docker configurations use environment variables properly, providing flexibility for different deployment scenarios while maintaining security best practices.