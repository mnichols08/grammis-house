# The family service on Railway: notes on recipes and their moderation, greeting cards, and gifts
# under the tree. It's open.blog's own service (service/ in the engine repository) at the version
# in .openblog-rev, over the Railway Postgres in the same project.
#
# Railway: Settings > Config-as-code > railway/service.railway.json. scripts/setup-railway.sh sets it up.

FROM alpine/git:2.47.2 AS engine
COPY .openblog-rev /tmp/openblog-rev
RUN git clone -q https://github.com/journey-to-code-org/open.blog /src \
    && git -C /src checkout -q "$(tr -d '[:space:]' < /tmp/openblog-rev)" \
    && test -f /src/service/Dockerfile || { echo "This engine version has no family service; move .openblog-rev past open.blog's service/ change" >&2; exit 1; }

FROM node:22-bookworm-slim
ARG POSTGREST_VERSION=12.2.3
ARG POSTGREST_SHA256=9f71269e61ac3a940281e93ff415760f5957e430e475ba4c3889f3ede7d5527c
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client ca-certificates curl xz-utils \
    && curl -fsSL -o /tmp/postgrest.tar.xz \
       "https://github.com/PostgREST/postgrest/releases/download/v${POSTGREST_VERSION}/postgrest-v${POSTGREST_VERSION}-linux-static-x64.tar.xz" \
    && echo "${POSTGREST_SHA256}  /tmp/postgrest.tar.xz" | sha256sum -c - \
    && tar -xJf /tmp/postgrest.tar.xz -C /usr/local/bin postgrest \
    && rm /tmp/postgrest.tar.xz \
    && apt-get purge -y xz-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=engine /src/netlify ./netlify
COPY --from=engine /src/supabase ./supabase
COPY --from=engine /src/service ./service
COPY --from=engine /src/web/components ./web/components
RUN chmod +x service/entrypoint.sh service/migrate.sh
USER node
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["/app/service/entrypoint.sh"]
