#!/bin/bash
set -e

# Multi-Tenant NestJS Backend Docker Setup Script
# This script helps set up the Docker environment for development, testing, or production

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to check if Docker is installed and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    print_status "Docker and Docker Compose are available"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p docker/postgres
    mkdir -p docker/nginx/ssl
    mkdir -p logs
    
    print_status "Directories created successfully"
}

# Function to copy environment file
setup_environment() {
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            print_status "Copying .env.example to .env..."
            cp .env.example .env
            print_warning "Please edit .env file with your configuration before starting services"
        else
            print_error ".env.example file not found. Please create .env file manually."
            exit 1
        fi
    else
        print_status ".env file already exists"
    fi
}

# Function to build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Build development image
    docker build --target development -t nestjs-multitenant:dev .
    
    # Build production image
    docker build --target production -t nestjs-multitenant:prod .
    
    # Build testing image
    docker build --target testing -t nestjs-multitenant:test .
    
    print_status "Docker images built successfully"
}

# Function to start development environment
start_development() {
    print_header "Starting Development Environment"
    
    print_status "Starting services..."
    docker-compose up -d
    
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are healthy
    if docker-compose ps | grep -q "Up (healthy)"; then
        print_status "Development environment started successfully!"
        echo ""
        print_status "Available services:"
        echo "  - API: http://localhost:3000/api"
        echo "  - API Docs: http://localhost:3000/api/docs"
        echo "  - MailHog (Email testing): http://localhost:8025"
        echo "  - pgAdmin (Database): http://localhost:8080"
        echo "  - Redis Commander: http://localhost:8081"
        echo ""
        print_status "Default credentials:"
        echo "  - pgAdmin: admin@localhost.com / admin"
        echo "  - Redis Commander: admin / admin"
    else
        print_error "Some services failed to start. Check logs with: docker-compose logs"
        exit 1
    fi
}

# Function to start production environment
start_production() {
    print_header "Starting Production Environment"
    
    # Check if production environment file exists
    if [ ! -f .env.production ]; then
        print_error ".env.production file not found. Please create it with production configuration."
        exit 1
    fi
    
    print_status "Starting production services..."
    docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
    
    print_status "Waiting for services to be ready..."
    sleep 15
    
    print_status "Production environment started successfully!"
    echo ""
    print_status "Available services:"
    echo "  - API: http://localhost:3000/api (or your configured domain)"
    echo "  - Health Check: http://localhost/health"
}

# Function to run tests
run_tests() {
    print_header "Running Tests"
    
    print_status "Starting test environment..."
    docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d postgres-test redis-test
    
    print_status "Waiting for test databases to be ready..."
    sleep 10
    
    print_status "Running unit tests..."
    docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm app-test npm run test
    
    print_status "Running integration tests..."
    docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm app-test npm run test:integration
    
    print_status "Running E2E tests..."
    docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d app-e2e
    sleep 10
    docker-compose -f docker-compose.yml -f docker-compose.test.yml exec app-e2e npm run test:e2e
    
    print_status "Cleaning up test environment..."
    docker-compose -f docker-compose.yml -f docker-compose.test.yml down -v
    
    print_status "Tests completed successfully!"
}

# Function to stop all services
stop_services() {
    print_header "Stopping Services"
    
    print_status "Stopping development services..."
    docker-compose down
    
    print_status "Stopping production services..."
    docker-compose -f docker-compose.prod.yml down
    
    print_status "Stopping test services..."
    docker-compose -f docker-compose.yml -f docker-compose.test.yml down -v
    
    print_status "All services stopped"
}

# Function to clean up Docker resources
cleanup() {
    print_header "Cleaning Up Docker Resources"
    
    print_warning "This will remove all containers, images, and volumes related to this project"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Stopping all services..."
        stop_services
        
        print_status "Removing containers..."
        docker-compose down --remove-orphans
        docker-compose -f docker-compose.prod.yml down --remove-orphans
        docker-compose -f docker-compose.yml -f docker-compose.test.yml down --remove-orphans
        
        print_status "Removing images..."
        docker rmi nestjs-multitenant:dev nestjs-multitenant:prod nestjs-multitenant:test 2>/dev/null || true
        
        print_status "Removing volumes..."
        docker volume rm nestjs-postgres-data nestjs-redis-data nestjs-pgadmin-data 2>/dev/null || true
        docker volume rm nestjs-postgres-prod-data nestjs-redis-prod-data 2>/dev/null || true
        docker volume rm nestjs-postgres-test-data nestjs-redis-test-data 2>/dev/null || true
        
        print_status "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show logs
show_logs() {
    print_header "Showing Logs"
    
    case $2 in
        "prod"|"production")
            docker-compose -f docker-compose.prod.yml logs -f
            ;;
        "test")
            docker-compose -f docker-compose.yml -f docker-compose.test.yml logs -f
            ;;
        *)
            docker-compose logs -f
            ;;
    esac
}

# Function to show help
show_help() {
    echo "Multi-Tenant NestJS Backend Docker Setup Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup       - Initial setup (create directories, copy env file)"
    echo "  build       - Build Docker images"
    echo "  dev         - Start development environment"
    echo "  prod        - Start production environment"
    echo "  test        - Run all tests"
    echo "  stop        - Stop all services"
    echo "  logs [env]  - Show logs (env: dev, prod, test)"
    echo "  cleanup     - Remove all Docker resources"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup    # Initial setup"
    echo "  $0 dev      # Start development environment"
    echo "  $0 logs     # Show development logs"
    echo "  $0 logs prod # Show production logs"
    echo "  $0 test     # Run tests"
    echo "  $0 cleanup  # Clean up everything"
}

# Main script logic
main() {
    case $1 in
        "setup")
            print_header "Initial Setup"
            check_docker
            create_directories
            setup_environment
            print_status "Setup completed! Run '$0 build' to build images, then '$0 dev' to start development environment."
            ;;
        "build")
            print_header "Building Images"
            check_docker
            build_images
            ;;
        "dev"|"development")
            check_docker
            start_development
            ;;
        "prod"|"production")
            check_docker
            start_production
            ;;
        "test")
            check_docker
            run_tests
            ;;
        "stop")
            stop_services
            ;;
        "logs")
            show_logs $@
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main $@