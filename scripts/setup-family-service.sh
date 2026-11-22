#!/usr/bin/env bash
# Turn on notes on recipes, greeting cards and gifts under the tree.
#   Notes: the family leaves a note under a recipe ("I made your stuffing!"), and Grammi approves it in
#   the Moderation inbox before anyone else sees it.
#   Greeting cards: Grammi writes cards (Greeting cards) and each goes out by email on its day,
#   birthdays every year. The family's addresses stay in the private database, never in this repo.
#   Gifts: anyone can leave Grammi a wrapped note or card under her tree, opened on Christmas morning.
#   Recipes from the family: the family sends Grammi recipes of their own, which arrive in her editor's
#   Posts as drafts with their name on them; nothing is on the site until she publishes one.
#   The fridge: letter magnets anyone moves on The Family Wall, and drawings Grammi puts up in her editor (Fridge).
#
# They live in the family service (family/, on Zubra), which the site's own Railway service runs next
# to her pages (Dockerfile), with Railway's Postgres. This walks you through the clicks only you can
# do in Railway and Brevo, makes every key, and prints exactly what to paste where. Run it from the
# repository folder:
#
#     bash scripts/setup-family-service.sh
#
# It needs: openssl and node. Nothing it makes is written anywhere but your screen and openblog.json
# (the site's public address for notes, which isn't secret).
set -euo pipefail

EDITOR="https://grammis-house-admin.up.railway.app/admin/"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ask()  { local v; read -r -p "$1: " v; printf '%s' "$v"; }
secret_ask() { local v; read -r -s -p "$1 (hidden): " v; echo >&2; printf '%s' "$v"; }
wait_enter() { read -r -p "Press Enter when that's done. "; }

for tool in openssl node; do
  command -v "$tool" >/dev/null || { echo "Please install $tool first."; exit 1; }
done
[ -f openblog.json ] && [ -f family/server.js ] || { echo "Run this from the grammis-house folder."; exit 1; }

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
NOTIFY_EMAIL=$(ask "Grammi's own email address, for notes from the family and emails when something comes in (kept only in Railway)")

key() { openssl rand -hex 32; }
ADMIN_KEY=$(key)
GREETINGS_KEY=$(key)
GIFTS_KEY=$(key)
RECIPES_KEY=$(key)
FRIDGE_KEY=$(key)
SALT=$(key)

step "2 of 4: the database (Railway, in the project with her site and editor)"
cat <<EOF
  1. In the Railway project, click Create > Database > PostgreSQL. Leave its name as Postgres.
  2. Open the service that runs her site (the one that builds Dockerfile). In Settings > Networking,
     copy its public domain (Generate domain if it has none; port 8080).
EOF
wait_enter
DOMAIN=$(ask "The site service's domain (like grammis-house-production.up.railway.app)")
DOMAIN=${DOMAIN#https://}
DOMAIN=${DOMAIN%%/*}
SITE="https://$DOMAIN"

step "3 of 4: switch the family service on"
cat <<EOF
  In the site service > Variables > Raw editor, paste ALL of this and click Update variables. It
  rebuilds and starts; the first start sets up the database. $SITE/health then answers
  {"ok":true,"notes":true,"cards":true,"gifts":true,"recipes":true,"fridge":true,"letters":true}.

DATABASE_URL=\${{Postgres.DATABASE_URL}}
OPENBLOG_SITE_ID=grammis-house
OPENBLOG_SITE_ORIGIN=$SITE
OPENBLOG_SITE_NAME="Grammi's House"
OPENBLOG_ADMIN_URL=$EDITOR
OPENBLOG_ADMIN_API_KEY=$ADMIN_KEY
OPENBLOG_ANALYTICS_SALT=$SALT
OPENBLOG_GREETINGS_ENABLED=true
OPENBLOG_GREETINGS_ADMIN_KEY=$GREETINGS_KEY
OPENBLOG_GREETINGS_FROM="$SENDER_NAME <$SENDER_EMAIL>"
OPENBLOG_GREETINGS_TIME_ZONE=America/New_York
BREVO_API_KEY=$BREVO_API_KEY
OPENBLOG_GIFTS_ENABLED=true
OPENBLOG_GIFTS_ADMIN_KEY=$GIFTS_KEY
OPENBLOG_RECIPES_ENABLED=true
OPENBLOG_RECIPES_ADMIN_KEY=$RECIPES_KEY
OPENBLOG_FRIDGE_ENABLED=true
OPENBLOG_FRIDGE_ADMIN_KEY=$FRIDGE_KEY
OPENBLOG_NOTIFY_EMAIL=$NOTIFY_EMAIL

  Then, in her editor's service > Variables > Raw editor, add these and click Update variables:

OPENBLOG_GREETINGS_ENDPOINT=$SITE/api/greetings
OPENBLOG_GREETINGS_ADMIN_KEY=$GREETINGS_KEY
OPENBLOG_GIFTS_ENDPOINT=$SITE/api/gifts
OPENBLOG_GIFTS_ADMIN_KEY=$GIFTS_KEY
OPENBLOG_RECIPES_ENDPOINT=$SITE/api/recipes
OPENBLOG_RECIPES_ADMIN_KEY=$RECIPES_KEY
OPENBLOG_FRIDGE_ENDPOINT=$SITE/api/fridge
OPENBLOG_FRIDGE_ADMIN_KEY=$FRIDGE_KEY
EOF
wait_enter

step "4 of 4: switch notes on"
node -e '
  const fs = require("fs");
  const site = JSON.parse(fs.readFileSync("openblog.json", "utf8"));
  site.engagement = { ...site.engagement, enabled: true, endpoint: process.argv[1] };
  fs.writeFileSync("openblog.json", JSON.stringify(site, null, 2) + "\n");
' "$SITE/api"
say "openblog.json now sends notes to $SITE/api."
cat <<EOF
  1. Commit and push openblog.json (the site rebuilds with notes at the bottom of each recipe):
       git commit -am "Notes on recipes go to the family service" && git push
  2. In her editor, open Readers > How readers reach you, then For Mikey at the bottom. Under
     Connection: switch on Use the comments service, set Service address to $SITE/api, paste this
     into Replace the key, and click Save connection:
       $ADMIN_KEY
     (Keep a copy in your password manager. It's the key to approving notes.) Then switch on
     Let readers leave comments at the top of that page.
  3. In Front page, add Christmas tree, then Gifts under the tree right after it. Share a recipe with
     Grammi is already on the front page; recipes sent there arrive in Posts as drafts within a minute.

  New notes wait in the Moderation inbox until Grammi approves them. Greeting cards shows under
  Family: try "Send me a test" first, it goes to $SENDER_EMAIL, not to anyone in the address book.
  Gifts stay hidden until she turns on "My tree is ready for gifts" in Gifts. All of it works at
  $SITE (the GitHub Pages copy shows the pages without them).
EOF
