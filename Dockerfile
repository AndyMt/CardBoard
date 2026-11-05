# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps for build
COPY package*.json ./
RUN npm ci

# Copy source and build frontend
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend
COPY --from=build /app/build ./build

# Copy server source and persistence code
COPY src ./src

# Ensure data directory exists (will be mounted as volume in practice)
RUN mkdir -p ./data ./data/backups

EXPOSE 8080

# Start the API server
CMD ["node", "src/server/server.cjs"]
