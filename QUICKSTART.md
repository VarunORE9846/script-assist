# 🚀 Quick Start Guide - TaskFlow API with Docker

This is the fastest way to get TaskFlow API running on your machine with hot reloading enabled.

## ⚡ 3-Minute Setup

### Step 1: Start Docker Desktop
Make sure Docker Desktop is running on your machine.

### Step 2: Run These Commands

**Option A: Using npm scripts (Simplest)**
```bash
# Start everything
npm run docker:up

# In a new terminal, run migrations and seed
npm run docker:migrate
npm run docker:seed
```

**Option B: Using docker-compose directly**
```bash
# Start everything
docker-compose up --build

# In a new terminal, run migrations and seed
docker-compose exec app bun run migration:custom
docker-compose exec app bun run seed
```

**Option C: Using helper scripts (Most features)**

*Windows (PowerShell):*
```powershell
.\scripts\docker-dev.ps1 start-detached
.\scripts\docker-dev.ps1 migrate
.\scripts\docker-dev.ps1 seed
```

*Linux/Mac:*
```bash
chmod +x scripts/docker-dev.sh
./scripts/docker-dev.sh start-detached
./scripts/docker-dev.sh migrate
./scripts/docker-dev.sh seed
```

### Step 3: Access the Application

- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api

## 🔐 Default Login Credentials

**Admin User:**
```
Email: admin@example.com
Password: admin123
```

**Regular User:**
```
Email: user@example.com
Password: user123
```

## 🔥 Hot Reloading is Active!

Just edit any file in the `src/` folder and save - the app will automatically restart within seconds!

**No need to restart the Docker container!**

## 📝 Common Commands

### View Logs
```bash
# Using npm
npm run docker:logs

# Using docker-compose
docker-compose logs -f app

# Using helper script
.\scripts\docker-dev.ps1 logs-app
```

### Stop Services
```bash
# Using npm
npm run docker:down

# Using docker-compose
docker-compose down

# Using helper script
.\scripts\docker-dev.ps1 stop
```

### Restart Services
```bash
# Using docker-compose
docker-compose restart

# Using helper script
.\scripts\docker-dev.ps1 restart
```

### Access Container Shell
```bash
# Using npm
npm run docker:shell

# Using docker-compose
docker-compose exec app sh

# Using helper script
.\scripts\docker-dev.ps1 shell
```

## 🧪 Testing the API

### Using Swagger UI
1. Open http://localhost:3000/api
2. Click "Authorize" button
3. Login using the auth endpoints
4. Copy the JWT token
5. Paste in the authorization field
6. Try different endpoints!

### Using curl

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

**Get Tasks (with token):**
```bash
curl http://localhost:3000/tasks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Using PowerShell (Windows)
```powershell
# Login
$response = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@example.com","password":"admin123"}'
$token = $response.access_token

# Get tasks
Invoke-RestMethod -Uri "http://localhost:3000/tasks" -Headers @{Authorization="Bearer $token"}
```

## 🛠️ Troubleshooting

### Port 3000 Already in Use
```bash
# Stop the conflicting service or change the port in docker-compose.yml
ports:
  - "3001:3000"  # Use 3001 instead
```

### Database Connection Errors
```bash
# Wait a few seconds for PostgreSQL to fully start
# Check logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Hot Reload Not Working
```bash
# Restart the app container
docker-compose restart app

# Or rebuild
docker-compose down
docker-compose up --build
```

### Clean Start (Delete All Data)
```bash
# Stop and remove all data
npm run docker:clean

# Or
docker-compose down -v

# Then start fresh
npm run docker:up
```

## 📚 More Information

- **Full Docker Guide**: See [DOCKER_README.md](./DOCKER_README.md)
- **Project README**: See [README.md](./README.md)
- **API Documentation**: http://localhost:3000/api (when running)

## 💡 Tips

1. **Keep Docker Desktop running** - It needs to be active for containers to work
2. **Use detached mode** for daily work - `npm run docker:up:detached`
3. **View logs separately** - `npm run docker:logs` to see what's happening
4. **Database persists** - Your data survives container restarts
5. **Hot reload works** - Edit code and see changes automatically!

## 🎯 Next Steps

1. Explore the Swagger documentation
2. Try different API endpoints
3. Edit code in `src/` and watch it reload
4. Review the codebase and identify improvements
5. Implement solutions to the challenges mentioned in README.md

Happy coding! 🚀

