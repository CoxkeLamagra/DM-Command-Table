FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm rebuild sharp
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DM_COMMAND_TABLE_V6_DB_PATH=/data/dm-command-table-v6.sqlite
ENV DM_COMMAND_TABLE_V6_UPLOAD_PATH=/data/uploads-v6
RUN apk add --no-cache dumb-init \
  && mkdir -p /data /app/.next/cache \
  && chown -R node:node /data /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
VOLUME ["/data"]
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
