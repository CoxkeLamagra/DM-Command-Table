FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g corepack@0.34.6 && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS builder
COPY . .
RUN pnpm rebuild sharp && pnpm build && node scripts/package-runtime.mjs /runtime

FROM node:24.21.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
ENV DM_COMMAND_TABLE_DB_PATH=/data/dm-command-table.sqlite DM_COMMAND_TABLE_UPLOAD_PATH=/data/uploads
RUN mkdir -p /data /app && chown node:node /data /app
COPY --from=builder --chown=node:node /runtime ./
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
