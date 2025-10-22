# Docker Development Helper Script for TaskFlow API (PowerShell)

param(
    [Parameter(Position=0)]
    [string]$Command
)

function Print-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Yellow
}

switch ($Command) {
    "start" {
        Print-Info "Starting TaskFlow API in development mode..."
        docker-compose up --build
    }
    
    "start-detached" {
        Print-Info "Starting TaskFlow API in detached mode..."
        docker-compose up -d --build
        Print-Success "Services started!"
        Print-Info "View logs with: .\scripts\docker-dev.ps1 logs"
    }
    
    "stop" {
        Print-Info "Stopping TaskFlow API..."
        docker-compose down
        Print-Success "Services stopped!"
    }
    
    "restart" {
        Print-Info "Restarting TaskFlow API..."
        docker-compose restart
        Print-Success "Services restarted!"
    }
    
    "logs" {
        docker-compose logs -f
    }
    
    "logs-app" {
        docker-compose logs -f app
    }
    
    "migrate" {
        Print-Info "Running database migrations..."
        docker-compose exec app bun run migration:custom
        Print-Success "Migrations completed!"
    }
    
    "seed" {
        Print-Info "Seeding database..."
        docker-compose exec app bun run seed
        Print-Success "Database seeded!"
    }
    
    "shell" {
        Print-Info "Opening shell in app container..."
        docker-compose exec app sh
    }
    
    "db-shell" {
        Print-Info "Opening PostgreSQL shell..."
        docker-compose exec postgres psql -U postgres -d taskflow
    }
    
    "redis-shell" {
        Print-Info "Opening Redis CLI..."
        docker-compose exec redis redis-cli
    }
    
    "test" {
        Print-Info "Running tests..."
        docker-compose exec app bun test
    }
    
    "clean" {
        Print-Info "Cleaning up Docker resources..."
        docker-compose down -v
        Print-Success "Cleanup completed!"
    }
    
    "rebuild" {
        Print-Info "Rebuilding containers from scratch..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up
    }
    
    "status" {
        docker-compose ps
    }
    
    default {
        Write-Host "TaskFlow API - Docker Development Helper"
        Write-Host ""
        Write-Host "Usage: .\scripts\docker-dev.ps1 {command}"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  start            - Start services (attached mode)"
        Write-Host "  start-detached   - Start services (background mode)"
        Write-Host "  stop             - Stop all services"
        Write-Host "  restart          - Restart all services"
        Write-Host "  logs             - View logs (all services)"
        Write-Host "  logs-app         - View application logs only"
        Write-Host "  migrate          - Run database migrations"
        Write-Host "  seed             - Seed the database"
        Write-Host "  shell            - Open shell in app container"
        Write-Host "  db-shell         - Open PostgreSQL shell"
        Write-Host "  redis-shell      - Open Redis CLI"
        Write-Host "  test             - Run tests"
        Write-Host "  clean            - Stop services and remove volumes"
        Write-Host "  rebuild          - Rebuild containers from scratch"
        Write-Host "  status           - Show service status"
        Write-Host ""
        exit 1
    }
}

