# ==============================================================================
# Course Project Management System — backend Dockerfile for Docker Compose (server + migrate)
# ==============================================================================
# Used by docker-compose.yml (`server` and `migrate` services).
# Cloud Run does NOT use this file — Cloud Run uses the root `Dockerfile`.
# Ref: https://docs.docker.com/reference/dockerfile/
#
# ⭐ CHANGE ME (groups using another tech stack):
#   # CHANGE ME: base image (node:24-alpine), install/build commands,
#   #            copied folders (prisma, src), PORT and CMD.
# ==============================================================================

# CHANGE ME: base image for your backend runtime.
FROM node:24-alpine
WORKDIR /app
# Prisma requires openssl on alpine.
RUN apk add --no-cache openssl

# --- Install dependencies and generate the Prisma client ---------------------
# The schema is copied first because package.json's postinstall runs
# `prisma generate` during `npm ci` (cached until package*.json or prisma/ change).
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# --- Copy source and build TypeScript -> dist/ --------------------------------
COPY tsconfig.json ./
COPY src ./src/
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN npm run build && chmod +x ./docker-entrypoint.sh

# --- Runtime settings ---------------------------------------------------------
ENV NODE_ENV=production
ENV TZ=Asia/Bangkok
# CHANGE ME: port your backend listens on (must match docker-compose.yml).
ENV PORT=3000
EXPOSE 3000

# Run as non-root user.
USER node

# CHANGE ME: start command for your backend.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
