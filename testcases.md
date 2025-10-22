Test 1: Security Fixes
A. Test Generic Error Messages (No Email Enumeration)
# Try login with non-existent user
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"doesnotexist@example.com","password":"wrong"}'

# Try login with existing user but wrong password
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrongpassword"}'

# ✅ EXPECTED: Both should return the same generic error message
# "Invalid credentials" - no hint about whether user exists
===============================================================================================================

B. Test Token Refresh & Rotation
# 1. Login and get tokens
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Save the refreshToken from response

# 2. Use refresh token to get new access token
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'

# ✅ EXPECTED: New tokens returned, old refresh token is invalidated

# 3. Try using the old refresh token again
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"SAME_OLD_REFRESH_TOKEN"}'

# ✅ EXPECTED: Error - token already used (one-time use enforced)
===============================================================================================================
C. Test Ownership Protection

# 1. Login as user1
USER1_TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"user123"}' \
  | jq -r '.access_token')

# 2. Login as admin
ADMIN_TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.access_token')

# 3. Get admin's tasks
ADMIN_TASKS=$(curl http://localhost:3000/tasks \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# 4. Try to access admin's task using user1's token
curl http://localhost:3000/tasks/1 \
  -H "Authorization: Bearer $USER1_TOKEN"

# ✅ EXPECTED: 403 Forbidden - ownership check blocks access
===============================================================================================================
D. Test Rate Limiting
# Rapid-fire 20 requests to login endpoint (limit is 10/min)
for i in {1..20}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}'
  echo "Request $i"
done

# ✅ EXPECTED: After ~10 requests, you should get 429 Too Many Requests
===============================================================================================================
E. Test Token Expiration
# Trigger an error (e.g., invalid task ID)
curl http://localhost:3000/tasks/99999 \
  -H "Authorization: Bearer YOUR_TOKEN"

# ✅ EXPECTED: Clean error message, NO stack traces or database details
===============================================================================================================
Test 2: Performance ImprovementsTest 2: Performance ImprovementsTest 2: Performance Improvements
A. Test Pagination (Database-level)
# Get first page (20 items)
curl "http://localhost:3000/tasks?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get page 100 (previously would load ALL records first)
curl "http://localhost:3000/tasks?page=100&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# ✅ EXPECTED: Fast response (~50ms) even for high page numbers
# Check Docker logs - should see only 1 SQL query with LIMIT/OFFSET
===============================================================================================================
B. Test Database-level Filtering
# Filter by status
curl "http://localhost:3000/tasks?status=IN_PROGRESS" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by priority
curl "http://localhost:3000/tasks?priority=HIGH" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Combined filters
curl "http://localhost:3000/tasks?status=PENDING&priority=HIGH&search=urgent" \
  -H "Authorization: Bearer YOUR_TOKEN"

# ✅ EXPECTED: Fast responses, check logs for WHERE clauses in SQL
===============================================================================================================
C. Test Bulk Operations
# Bulk update 50 tasks at once
curl -X POST http://localhost:3000/tasks/batch/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskIds": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50],
    "updateData": {"status": "IN_PROGRESS"}
  }'

# ✅ EXPECTED: Fast response (~100ms), single UPDATE query in logs
===============================================================================================================
D. Test Caching
# First request (cache miss)
time curl http://localhost:3000/tasks \
  -H "Authorization: Bearer YOUR_TOKEN"

# Second request (cache hit)
time curl http://localhost:3000/tasks \
  -H "Authorization: Bearer YOUR_TOKEN"

# ✅ EXPECTED: Second request much faster (cached)
===============================================================================================================
Test 3: Observability Features
A. Test Health Endpoints
# Overall health
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/db

# Redis health
curl http://localhost:3000/health/redis

# System metrics
curl http://localhost:3000/health/metrics

# ✅ EXPECTED: JSON responses with system status and metrics
===============================================================================================================
B. Test Correlation IDs
# Make a request and check response headers
curl -i http://localhost:3000/tasks \
  -H "Authorization: Bearer YOUR_TOKEN"

# ✅ EXPECTED: Response includes X-Correlation-ID header
# Check Docker logs - same ID appears in all log entries for that request
===============================================================================================================