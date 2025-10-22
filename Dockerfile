# Development Dockerfile with hot reload support
FROM oven/bun:1.1-alpine AS development

# Install necessary packages for native dependencies
RUN apk add --no-cache python3 make g++ postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* bunfig.toml* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start application in watch mode for hot reload
CMD ["bun", "run", "start:dev"]

# Production stage
FROM oven/bun:1.1-alpine AS production

# Install necessary packages
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy package files
COPY package.json bun.lock* bunfig.toml* ./

# Install only production dependencies
RUN bun install --production

# Copy built application from development stage
COPY --from=development /app/dist ./dist
COPY --from=development /app/src ./src

# Build the application
RUN bun run build

# Expose port
EXPOSE 3000

# Start application in production mode
CMD ["bun", "run", "start:prod"]

