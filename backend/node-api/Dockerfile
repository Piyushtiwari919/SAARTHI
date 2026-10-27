# ==============================================================================
# Saarthi Node API - Multi-Stage Production Dockerfile
# ==============================================================================

# Stage 1: Build & TypeScript Compilation
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# Prune dev dependencies to prepare production node_modules
RUN npm prune --omit=dev

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for container health check
RUN apk add --no-cache curl

# Copy production dependencies and compiled artifacts from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create storage upload directory with appropriate permissions
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads /app

# Run as non-root node user
USER node

EXPOSE 5000

# Container healthcheck targeting readiness check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health/ready || exit 1

CMD ["node", "dist/server.js"]

