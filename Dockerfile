FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.title="@serversareup/mcp-server" \
      org.opencontainers.image.description="Official Model Context Protocol (MCP) server for Servers Are Up cloud & hybrid infrastructure" \
      org.opencontainers.image.source="https://github.com/lostprotocol212/serversareup-mcp-server" \
      org.opencontainers.image.url="https://serversareup.com/containers" \
      org.opencontainers.image.documentation="https://serversareup.com/docs/mcp" \
      org.opencontainers.image.licenses="MIT"
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY LICENSE README.md server.json smithery.yaml glama.json ./
USER node
ENTRYPOINT ["node", "dist/index.js"]
