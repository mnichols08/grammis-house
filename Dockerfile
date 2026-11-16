# Builds the blog with open.blog and serves the static site on Railway.
# Pins the same open.blog revision and Zubra compiler as .github/workflows/pages.yml.
# The site is served under /grammis-house/ so its links match openblog.json (no URL change needed).

FROM rust:1-bookworm AS build
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
RUN npm install --global @zubra/compiler@5.8.0
RUN cargo install --git https://github.com/journey-to-code-org/open.blog \
    --rev df8e3f5e673929864a846ed300496b4881bbb951 openblog-cli
WORKDIR /site
COPY . .
RUN openblog build

FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/dist /usr/share/nginx/html/grammis-house
EXPOSE 80
