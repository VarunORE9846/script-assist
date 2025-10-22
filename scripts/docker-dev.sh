#!/bin/bash

# Docker Development Helper Script for TaskFlow API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Command handlers
case "$1" in
    start)
        print_info "Starting TaskFlow API in development mode..."
        docker-compose up --build
        ;;
    
    start-detached)
        print_info "Starting TaskFlow API in detached mode..."
        docker-compose up -d --build
        print_success "Services started!"
        print_info "View logs with: ./scripts/docker-dev.sh logs"
        ;;
    
    stop)
        print_info "Stopping TaskFlow API..."
        docker-compose down
        print_success "Services stopped!"
        ;;
    
    restart)
        print_info "Restarting TaskFlow API..."
        docker-compose restart
        print_success "Services restarted!"
        ;;
    
    logs)
        docker-compose logs -f
        ;;
    
    logs-app)
        docker-compose logs -f app
        ;;
    
    migrate)
        print_info "Running database migrations..."
        docker-compose exec app bun run migration:custom
        print_success "Migrations completed!"
        ;;
    
    seed)
        print_info "Seeding database..."
        docker-compose exec app bun run seed
        print_success "Database seeded!"
        ;;
    
    shell)
        print_info "Opening shell in app container..."
        docker-compose exec app sh
        ;;
    
    db-shell)
        print_info "Opening PostgreSQL shell..."
        docker-compose exec postgres psql -U postgres -d taskflow
        ;;
    
    redis-shell)
        print_info "Opening Redis CLI..."
        docker-compose exec redis redis-cli
        ;;
    
    test)
        print_info "Running tests..."
        docker-compose exec app bun test
        ;;
    
    clean)
        print_info "Cleaning up Docker resources..."
        docker-compose down -v
        print_success "Cleanup completed!"
        ;;
    
    rebuild)
        print_info "Rebuilding containers from scratch..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up
        ;;
    
    status)
        docker-compose ps
        ;;
    
    *)
        echo "TaskFlow API - Docker Development Helper"
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  start            - Start services (attached mode)"
        echo "  start-detached   - Start services (background mode)"
        echo "  stop             - Stop all services"
        echo "  restart          - Restart all services"
        echo "  logs             - View logs (all services)"
        echo "  logs-app         - View application logs only"
        echo "  migrate          - Run database migrations"
        echo "  seed             - Seed the database"
        echo "  shell            - Open shell in app container"
        echo "  db-shell         - Open PostgreSQL shell"
        echo "  redis-shell      - Open Redis CLI"
        echo "  test             - Run tests"
        echo "  clean            - Stop services and remove volumes"
        echo "  rebuild          - Rebuild containers from scratch"
        echo "  status           - Show service status"
        echo ""
        exit 1
        ;;
esac

