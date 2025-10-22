# Docker Setup Guide for TaskFlow API

This guide explains how to run the TaskFlow API using Docker with hot reloading enabled.

## Prerequisites

- Docker Desktop (for Windows/Mac) or Docker Engine + Docker Compose (for Linux)
- At least 4GB of available RAM
- Ports 3000, 5432, and 6379 available

## Quick Start

### 1. Start the Development Environment

```bash
# Build and start all services (NestJS app, PostgreSQL, Redis)
docker-compose up --build
```

This command will:
- Build the Docker image for the NestJS application
- Start PostgreSQL database on port 5432
- Start Redis on port 6379
- Start the NestJS application on port 3000
- Enable hot reloading (changes in `src/` will automatically restart the app)

### 2. Run Database Migrations

Open a new terminal and run:

```bash
# Run migrations
docker-compose exec app bun run migration:custom

# Or if you prefer the standard migration command
docker-compose exec app bun run migration:run
```

### 3. Seed the Database

```bash
docker-compose exec app bun run seed
```

### 4. Access the Application

- **API**: http://localhost:3000
- **Swagger Documentation**: http://localhost:3000/api

## Common Commands

### Starting and Stopping Services

```bash
# Start services in detached mode (background)
docker-compose up -d

# Stop services
docker-compose down

# Stop services and remove volumes (WARNING: deletes all data)
docker-compose down -v

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f app
```

### Development Workflow

```bash
# Restart a specific service
docker-compose restart app

# Rebuild and restart (after package.json changes)
docker-compose up --build app

# Execute commands in the container
docker-compose exec app bun run <command>

# Open shell in the container
docker-compose exec app sh

# Run tests
docker-compose exec app bun test

# Run migrations
docker-compose exec app bun run migration:run
```

### Database Operations

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d taskflow

# View PostgreSQL logs
docker-compose logs postgres

# Backup database
docker-compose exec postgres pg_dump -U postgres taskflow > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres taskflow < backup.sql
```

### Redis Operations

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Monitor Redis commands
docker-compose exec redis redis-cli MONITOR

# View Redis logs
docker-compose logs redis
```

## Hot Reloading

Hot reloading is **enabled by default** in development mode. Here's how it works:

1. Your `src/` directory is mounted as a volume in the container
2. NestJS watches for file changes using the `--watch` flag
3. When you save a file, NestJS automatically recompiles and restarts the application

**You don't need to restart the container** - just save your files and wait a few seconds!

### What triggers hot reload:
- Changes to `.ts` files in `src/`
- Changes to `.json` configuration files

### What requires a rebuild:
- Changes to `package.json` (new dependencies)
- Changes to `Dockerfile`
- Changes to environment variables in `docker-compose.yml`

To rebuild after these changes:
```bash
docker-compose down
docker-compose up --build
```

## Production Deployment

For production, use the production docker-compose file:

```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up --build -d

# View production logs
docker-compose -f docker-compose.prod.yml logs -f
```

Production mode differences:
- No source code mounting (volumes)
- No hot reloading
- Optimized build
- Auto-restart on failure

## Environment Variables

Create a `.env` file for Docker-specific configuration:

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=taskflow

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=1h
```

**Note**: When running in Docker, use service names (`postgres`, `redis`) instead of `localhost`.

## Troubleshooting

### Port Already in Use

If you get a port conflict error:

```bash
# For Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# For Mac/Linux
lsof -i :3000
kill -9 <PID>
```

Or change the port in docker-compose.yml:

```yaml
ports:
  - "3001:3000"  # Use port 3001 instead
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# Check PostgreSQL logs
docker-compose logs postgres

# Verify database exists
docker-compose exec postgres psql -U postgres -l
```

### Hot Reload Not Working

```bash
# Restart the app service
docker-compose restart app

# Check if volumes are mounted correctly
docker-compose exec app ls -la /app/src

# Rebuild with no cache
docker-compose build --no-cache app
docker-compose up app
```

### Container Keeps Restarting

```bash
# View recent logs
docker-compose logs --tail=100 app

# Common causes:
# 1. Database not ready - wait a few seconds
# 2. Missing dependencies - run docker-compose build --no-cache
# 3. Port conflict - change the port mapping
```

### Permission Issues (Linux)

If you encounter permission issues on Linux:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Apply changes
newgrp docker

# Or run with sudo
sudo docker-compose up
```

## Performance Tips

### Speed Up Builds

```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build
```

### Clean Up Resources

```bash
# Remove unused containers, networks, images
docker system prune -a

# Remove all volumes (WARNING: deletes data)
docker volume prune
```

## Default Users

After seeding, you can login with:

**Admin User:**
- Email: admin@example.com
- Password: admin123
- Role: admin

**Regular User:**
- Email: user@example.com
- Password: user123
- Role: user

## Architecture

```
┌─────────────────────────────────────────┐
│         Docker Compose Network          │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐│
│  │ NestJS   │  │PostgreSQL│  │ Redis ││
│  │   App    │──│          │  │       ││
│  │  :3000   │  │  :5432   │  │ :6379 ││
│  └──────────┘  └──────────┘  └───────┘│
│       │                                 │
└───────┼─────────────────────────────────┘
        │
    Host Machine
  (http://localhost:3000)
```

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Bun Documentation](https://bun.sh/docs)

