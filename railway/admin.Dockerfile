# Grammi's admin panel on Railway: open.blog's editor (Studio and the old Admin), serving a clone of
# this repository kept on a Railway volume, and publishing back to GitHub, where Pages builds the
# public site. The engine is the version in .openblog-rev, the same one Pages builds with.
#
# Railway: Settings > Config-as-code > railway/admin.railway.json. scripts/setup-railway.sh sets it up.

FROM rust:1-slim-bookworm AS engine
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY .openblog-rev /tmp/openblog-rev
RUN cargo install --locked --root /out \
      --git https://github.com/journey-to-code-org/open.blog --rev "$(tr -d '[:space:]' < /tmp/openblog-rev)" openblog-cli

FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global @zubra/compiler@5.8.0
COPY --from=engine /out/bin/openblog /usr/local/bin/openblog
COPY railway/admin-entrypoint.sh /usr/local/bin/admin-entrypoint
RUN chmod +x /usr/local/bin/admin-entrypoint && openblog help > /dev/null
ENV PORT=8080 OPENBLOG_BEHIND_PROXY=1
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/admin-entrypoint"]
