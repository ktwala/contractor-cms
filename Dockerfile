# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]

# Development stage (for docker-compose)
FROM node:20-alpine AS development

WORKDIR /app

# Install build dependencies for bcrypt first (python3, make, g++)
RUN apk add --no-cache python3 make g++

# Install dependencies (including dev) - this will include bcrypt
COPY package*.json ./
RUN npm ci

# Rebuild bcrypt to ensure it's compiled for Alpine
RUN npm rebuild bcrypt --build-from-source

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source (will be overwritten by volume mount in docker-compose)
COPY . .

ENV NODE_ENV=development
ENV PORT=4000

EXPOSE 4000

CMD ["npm", "run", "start:dev"]
