# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps for build
COPY package*.json ./
RUN npm ci

# Copy source and build frontend + server
COPY . .
RUN npm run build:all

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend and compiled server
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist

# Ensure data directory exists (will be mounted as volume in practice)
RUN mkdir -p ./data ./data/backups

EXPOSE 8080

# Start the API server
CMD ["node", "dist/server/server.js"]
