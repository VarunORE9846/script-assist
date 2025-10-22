# 🐳 Docker Commands Summary

## Essential Commands for Daily Development

### Start/Stop Services

```bash
# Start services (see logs in terminal)
docker-compose up --build

# Start services in background (detached mode) - RECOMMENDED
docker-compose up -d --build

# Stop services
docker-compose down

# Stop services and remove all data (WARNING: deletes database)
docker-compose down -v

# Restart services
docker-compose restart

# Restart only the app
docker-compose restart app
```

### View Logs

```bash
# View all logs (follow mode)
docker-compose logs -f

# View only app logs
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app

# View PostgreSQL logs
docker-compose logs postgres

# View Redis logs
docker-compose logs redis
```

### Database Operations

```bash
# Run migrations
docker-compose exec app bun run migration:custom

# Seed database
docker-compose exec app bun run seed

# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d taskflow

# Backup database
docker-compose exec postgres pg_dump -U postgres taskflow > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres taskflow < backup.sql
```

### Development Commands

```bash
# Access app container shell
docker-compose exec app sh

# Run tests
docker-compose exec app bun test

# Run tests in watch mode
docker-compose exec app bun test --watch

# Check service status
docker-compose ps

# View container resource usage
docker stats
```

### Redis Operations

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Monitor Redis commands
docker-compose exec redis redis-cli MONITOR

# Clear all Redis data
docker-compose exec redis redis-cli FLUSHALL
```

### Rebuild/Clean Operations

```bash
# Rebuild without cache
docker-compose build --no-cache

# Rebuild and restart
docker-compose up --build --force-recreate

# Remove unused Docker resources
docker system prune

# Remove unused Docker resources including volumes
docker system prune -a --volumes
```

## npm Script Shortcuts

```bash
# Start services
npm run docker:up                # Attached mode
npm run docker:up:detached      # Detached mode (background)

# Stop services
npm run docker:down

# View logs
npm run docker:logs

# Database operations
npm run docker:migrate          # Run migrations
npm run docker:seed            # Seed database

# Access shell
npm run docker:shell

# Clean everything
npm run docker:clean
```

## Helper Scripts

### Windows (PowerShell)

```powershell
.\scripts\docker-dev.ps1 start              # Start (attached)
.\scripts\docker-dev.ps1 start-detached    # Start (background)
.\scripts\docker-dev.ps1 stop              # Stop
.\scripts\docker-dev.ps1 restart           # Restart
.\scripts\docker-dev.ps1 logs              # View logs
.\scripts\docker-dev.ps1 logs-app          # View app logs only
.\scripts\docker-dev.ps1 migrate           # Run migrations
.\scripts\docker-dev.ps1 seed              # Seed database
.\scripts\docker-dev.ps1 shell             # App shell
.\scripts\docker-dev.ps1 db-shell          # PostgreSQL shell
.\scripts\docker-dev.ps1 redis-shell       # Redis CLI
.\scripts\docker-dev.ps1 test              # Run tests
.\scripts\docker-dev.ps1 clean             # Clean everything
.\scripts\docker-dev.ps1 rebuild           # Rebuild from scratch
.\scripts\docker-dev.ps1 status            # Service status
```

### Linux/Mac

```bash
# Make executable (first time only)
chmod +x scripts/docker-dev.sh

./scripts/docker-dev.sh start              # Start (attached)
./scripts/docker-dev.sh start-detached    # Start (background)
./scripts/docker-dev.sh stop              # Stop
./scripts/docker-dev.sh restart           # Restart
./scripts/docker-dev.sh logs              # View logs
./scripts/docker-dev.sh logs-app          # View app logs only
./scripts/docker-dev.sh migrate           # Run migrations
./scripts/docker-dev.sh seed              # Seed database
./scripts/docker-dev.sh shell             # App shell
./scripts/docker-dev.sh db-shell          # PostgreSQL shell
./scripts/docker-dev.sh redis-shell       # Redis CLI
./scripts/docker-dev.sh test              # Run tests
./scripts/docker-dev.sh clean             # Clean everything
./scripts/docker-dev.sh rebuild           # Rebuild from scratch
./scripts/docker-dev.sh status            # Service status
```

## Complete Development Workflow

### First Time Setup

```bash
# 1. Start services
docker-compose up -d --build

# 2. Wait for services to be ready (check logs)
docker-compose logs -f

# 3. Run migrations (in new terminal)
docker-compose exec app bun run migration:custom

# 4. Seed database
docker-compose exec app bun run seed

# 5. Access application
# Open http://localhost:3000/api in browser
```

### Daily Development

```bash
# Start services (background)
docker-compose up -d

# View logs if needed
docker-compose logs -f app

# Edit code in src/ - hot reload is automatic!

# When done for the day
docker-compose down
```

### After Package Changes

```bash
# When you modify package.json
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Troubleshooting

```bash
# Check service status
docker-compose ps

# View all logs
docker-compose logs

# Restart specific service
docker-compose restart app

# Nuclear option - start fresh
docker-compose down -v
docker-compose up --build

# Clean Docker system
docker system prune -a --volumes
```

## Production Deployment

```bash
# Start production services
docker-compose -f docker-compose.prod.yml up -d --build

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop production services
docker-compose -f docker-compose.prod.yml down
```

## Port Mappings

- **Application**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Swagger**: http://localhost:3000/api

## Environment Variables

The following environment variables are configured in docker-compose.yml:

- `NODE_ENV`: development
- `PORT`: 3000
- `DB_HOST`: postgres (container name)
- `DB_PORT`: 5432
- `DB_USERNAME`: postgres
- `DB_PASSWORD`: postgres
- `DB_DATABASE`: taskflow
- `REDIS_HOST`: redis (container name)
- `REDIS_PORT`: 6379
- `JWT_SECRET`: (set in .env file)
- `JWT_EXPIRATION`: 1h

## Hot Reloading Details

Hot reloading is enabled through:
1. Volume mounting of `src/` directory
2. NestJS `--watch` flag in development mode
3. Changes trigger automatic recompilation and restart

**What triggers hot reload:**
- Any `.ts` file changes in `src/`
- Configuration changes in `.json` files

**What requires rebuild:**
- Changes to `package.json`
- Changes to `Dockerfile`
- Changes to environment variables in docker-compose.yml

## Tips

1. Use detached mode (`-d`) for daily development
2. Use `docker-compose logs -f app` to monitor the application
3. Database data persists between restarts (unless you use `docker-compose down -v`)
4. Hot reload works immediately after saving files
5. Use helper scripts for common tasks to save typing

## Quick Reference Card

| Task | Command |
|------|---------|
| Start | `docker-compose up -d` |
| Stop | `docker-compose down` |
| Logs | `docker-compose logs -f app` |
| Migrate | `docker-compose exec app bun run migration:custom` |
| Seed | `docker-compose exec app bun run seed` |
| Shell | `docker-compose exec app sh` |
| Restart | `docker-compose restart app` |
| Status | `docker-compose ps` |
| Clean | `docker-compose down -v` |

---

**Remember**: Hot reloading means you rarely need to restart containers! Just save your code and it updates automatically. 🔥

