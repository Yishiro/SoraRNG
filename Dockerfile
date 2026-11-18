FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
ENV SORA_STANDALONE=1
RUN pnpm db:generate && pnpm build

# Separate maintenance image; never served by the reverse proxy.
FROM builder AS tools
CMD ["pnpm", "db:deploy"]

# Independent Discord process; no website or OAuth secrets are copied here.
FROM dependencies AS discord-bot
COPY --chown=node:node bot ./bot
# Le bot exécute les mêmes actions que le site (src/server/play.ts) : il reçoit
# donc toute la logique de jeu et serveur, sans les secrets OAuth du site.
COPY --chown=node:node src/game ./src/game
COPY --chown=node:node src/server ./src/server
COPY --chown=node:node card-assets.json ./card-assets.json
COPY --chown=node:node data/card-legends.fr.json ./data/card-legends.fr.json
USER node
CMD ["pnpm", "exec", "tsx", "bot/index.ts"]

FROM node:24-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

