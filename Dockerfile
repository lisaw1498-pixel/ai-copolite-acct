# Container image for hosting AI Interview Copilot.
#
# Deliberately a single long-running Node process rather than a serverless
# build. Two things in this app need that:
#
#   1. The database is SQLite on disk. It lives on a mounted volume at
#      /data, so it survives redeploys and restarts.
#   2. Resume analysis and post-interview reports run as in-process
#      background jobs that take one to two minutes. Serverless functions are
#      killed long before that.
#
# Works on Render, Railway, Fly.io, or any host that can run a container with
# a persistent disk.

FROM node:22-bookworm-slim AS base

# better-sqlite3 is a native addon. If no prebuilt binary matches this
# platform, npm compiles it here, which needs a toolchain.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a code-only change reuses this layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build with a throwaway database path. The build runs page code that opens
# the database, and it must not touch the real one on the mounted volume.
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_PATH=/tmp/build.db npm run build && rm -f /tmp/build.db*

# The volume mounts here. The app creates the file and bootstraps the schema
# on first start, so an empty disk is fine.
ENV DATABASE_PATH=/data/app.db
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Next reads PORT, so the host can assign one.
CMD ["npm", "run", "start"]
