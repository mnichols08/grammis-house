# Grammi's House on Railway: her site and the family service (notes on recipes, greeting cards,
# gifts under the tree) from one Zubra server, with Railway's Postgres. See family/server.js.
# Pins the same open.blog revision and Zubra compiler as .github/workflows/pages.yml.

FROM rust:1-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*
RUN npm install --global @zubra/compiler@5.8.0
RUN cargo install --git https://github.com/journey-to-code-org/open.blog \
    --rev 718c91393a72a2e282c2585a3ba7cfa763f7c410 openblog-cli
WORKDIR /site
COPY . .
RUN openblog build

FROM node:22-bookworm-slim
WORKDIR /app/family
COPY family/package.json family/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY family/ ./
# The components' server functions are compiled from their .zb files when the server starts.
COPY themes/grammis/components /app/themes/grammis/components
COPY --from=build /site/dist /app/site
RUN chown -R node:node /app/family/node_modules
USER node
ENV NODE_ENV=production PORT=8080 FAMILY_SITE_DIR=/app/site
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
