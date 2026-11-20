#!/usr/bin/env bash
# Turn on notes on recipes, greeting cards and gifts under the tree.
#   Notes: the family leaves a note under a recipe ("I made your stuffing!"), and Grammi approves it in
#   the Moderation inbox before anyone else sees it.
#   Greeting cards: Grammi writes cards (Greeting cards) and each goes out by email on its day,
#   birthdays every year. The family's addresses stay in the private database, never in this repo.
#   Gifts: anyone can leave Grammi a wrapped note or card under her tree, opened on Christmas morning.
#
# The site itself can't store anything a reader sends, so these live in a small service on Railway,
# next to her editor, with Railway's own Postgres (Dockerfile.service: open.blog's service at the same
# version as the rest of the site). This walks you through the clicks only you can do in Railway and
# Brevo, makes every key, and prints exactly what to paste where. Run it from the repository folder:
#
#     bash scripts/setup-family-service.sh
#
# It needs: openssl and node. Nothing it makes is written anywhere but your screen and openblog.json
# (the service's public address, which isn't secret).
set -euo pipefail

SITE_ORIGIN="https://mnichols08.github.io"
BASE_PATH="/grammis-house/"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ask()  { local v; read -r -p "$1: " v; printf '%s' "$v"; }
secret_ask() { local v; read -r -s -p "$1 (hidden): " v; echo >&2; printf '%s' "$v"; }
wait_enter() { read -r -p "Press Enter when that's done. "; }

for tool in openssl node; do
  command -v "$tool" >/dev/null || { echo "Please install $tool first."; exit 1; }
done
[ -f openblog.json ] && [ -f Dockerfile.service ] || { echo "Run this from the grammis-house folder."; exit 1; }

step "1 of 4: the email service for greeting cards (Brevo, free)"
cat <<EOF
  1. Go to https://www.brevo.com and make a free account (300 emails a day, no card needed).
  2. Open Senders, domains & dedicated IPs > Senders, and add the address cards should come from
     (Grammi's own email is fine). Brevo emails it a link: click it to verify.
  3. Open SMTP & API > API keys, make a key named grammis-house, and copy it.
EOF
wait_enter
BREVO_API_KEY=$(secret_ask "Brevo API key")
SENDER_EMAIL=$(ask "The verified sender address")
SENDER_NAME=$(ask "The name cards come from [Grammi]")
SENDER_NAME=${SENDER_NAME:-Grammi}

key() { openssl rand -hex 32; }
JWT_SECRET=$(key)
ADMIN_KEY=$(key)
GREETINGS_KEY=$(key)
GIFTS_KEY=$(key)
SALT=$(key)

step "2 of 4: the database and the service (Railway, in the project with her editor)"
cat <<EOF
  1. In the Railway project, click Create > Database > PostgreSQL. Leave its name as Postgres.
  2. Click Create > GitHub Repo > mnichols08/grammis-house. Rename the new service family-service.
  3. In family-service > Settings:
       - Build > Dockerfile path: Dockerfile.service   (or add the variable RAILWAY_DOCKERFILE_PATH below)
       - Build > Watch paths: /Dockerfile.service
       - Networking > Generate domain (port 8080)
  4. In family-service > Variables > Raw editor, paste ALL of this and click Update variables:

RAILWAY_DOCKERFILE_PATH=Dockerfile.service
DATABASE_URL=\${{Postgres.DATABASE_URL}}
PGRST_JWT_SECRET=$JWT_SECRET
OPENBLOG_SITE_ID=grammis-house
OPENBLOG_SITE_ORIGIN=$SITE_ORIGIN
OPENBLOG_SITE_BASE_PATH=$BASE_PATH
OPENBLOG_SITE_NAME="Grammi's House"
OPENBLOG_ADMIN_API_KEY=$ADMIN_KEY
OPENBLOG_ANALYTICS_SALT=$SALT
OPENBLOG_MODERATION_ENABLED=true
OPENBLOG_GREETINGS_ENABLED=true
OPENBLOG_GREETINGS_ADMIN_KEY=$GREETINGS_KEY
OPENBLOG_GREETINGS_FROM="$SENDER_NAME <$SENDER_EMAIL>"
OPENBLOG_GREETINGS_TIME_ZONE=America/New_York
BREVO_API_KEY=$BREVO_API_KEY
OPENBLOG_GIFTS_ENABLED=true
OPENBLOG_GIFTS_ADMIN_KEY=$GIFTS_KEY

  It builds and starts by itself. Its log ends with "listening on 8080" when it's ready, and
  https://<its domain>/health answers {"ok":true}. The first start sets up the database.
EOF
wait_enter
DOMAIN=$(ask "The service's domain (like family-service-production.up.railway.app)")
DOMAIN=${DOMAIN#https://}
DOMAIN=${DOMAIN%%/*}
SERVICE="https://$DOMAIN"

step "3 of 4: tell her editor where the service is"
cat <<EOF
  In the editor's Railway service > Variables > Raw editor, add these and click Update variables
  (the editor restarts):

OPENBLOG_GREETINGS_ENDPOINT=$SERVICE/api/greetings
OPENBLOG_GREETINGS_ADMIN_KEY=$GREETINGS_KEY
OPENBLOG_GIFTS_ENDPOINT=$SERVICE/api/gifts
OPENBLOG_GIFTS_ADMIN_KEY=$GIFTS_KEY
EOF
wait_enter

step "4 of 4: switch notes on"
node -e '
  const fs = require("fs");
  const site = JSON.parse(fs.readFileSync("openblog.json", "utf8"));
  site.engagement = { ...site.engagement, enabled: true, endpoint: process.argv[1] };
  fs.writeFileSync("openblog.json", JSON.stringify(site, null, 2) + "\n");
' "$SERVICE/api"
say "openblog.json now sends notes to $SERVICE/api."
cat <<EOF
  1. Commit and push openblog.json:
       git commit -am "Notes on recipes go to the family service" && git push
  2. Sign in to her editor, open Analytics, and paste this into the write-only moderation token
     box, then Save:
       $ADMIN_KEY
     (Keep a copy in your password manager. It's the key to approving notes.)
  3. In Front page, add Christmas tree, then Gifts under the tree right after it, and put this in
     Where gifts go:
       $SERVICE/api/gifts

  From then on every recipe has a place for notes at the bottom; new notes wait in the Moderation
  inbox until Grammi approves them. Greeting cards shows under Family: try "Send me a test" first,
  it goes to $SENDER_EMAIL, not to anyone in the address book. Gifts stay hidden until she turns on
  "My tree is ready for gifts" in Gifts.
EOF
