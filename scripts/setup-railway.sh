#!/usr/bin/env bash
# Put Grammi's admin panel and her family service on Railway.
#
#   Admin panel: Studio (and the old Admin) at its own web address, so Grammi can write from any
#   computer or phone. It keeps a copy of this repository on a Railway disk and publishes back to
#   GitHub; GitHub Pages still builds the public site, hourly as now.
#   Family service: notes on recipes (Grammi approves each one first), greeting cards by email,
#   and gifts the family leaves under her tree, which she opens on Christmas morning. Kept in a
#   private Postgres database in the same Railway project, never in this repository.
#
# This replaces scripts/setup-family-service.sh (Netlify and Supabase). It walks you through the
# parts only you can do (accounts, a GitHub token, two clicks in Railway) and does the rest.
# Run it from the repository folder:
#
#     bash scripts/setup-railway.sh
#
# It needs: railway (npm install --global @railway/cli), gh (signed in to GitHub), openssl, node.
# Before running it, .openblog-rev must name an open.blog commit that has service/ (Studio slice 3b
# or later): the family service is built from that engine version.
set -euo pipefail

REPO="mnichols08/grammis-house"
SITE_ORIGIN="https://mnichols08.github.io"
BASE_PATH="/grammis-house/"
PROJECT="grammis-house"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ask()  { local v; read -r -p "$1: " v; printf '%s' "$v"; }
secret_ask() { local v; read -r -s -p "$1 (hidden): " v; echo >&2; printf '%s' "$v"; }
wait_enter() { read -r -p "Press Enter when that's done. "; }
rand() { openssl rand -hex 32; }

for tool in railway gh openssl node; do
  command -v "$tool" >/dev/null || { echo "Please install $tool first."; exit 1; }
done
REV=$(tr -d '[:space:]' < .openblog-rev)
if ! gh api "repos/journey-to-code-org/open.blog/contents/service/Dockerfile?ref=$REV" >/dev/null 2>&1; then
  echo "The engine version in .openblog-rev ($REV) has no family service yet."
  echo "Point .openblog-rev at an open.blog commit with service/ (Studio slice 3b or later), push, and run this again."
  exit 1
fi

# The domain Railway gave a service, from `railway domain`'s answer (or asked for if it can't be read).
domain_of() {
  local service=$1 out url
  out=$(railway domain --service "$service" --json 2>/dev/null || railway domain --service "$service" 2>/dev/null || true)
  url=$(printf '%s' "$out" | grep -oE 'https://[a-zA-Z0-9.-]+\.up\.railway\.app' | head -1 || true)
  if [ -z "$url" ]; then
    url=$(printf '%s' "$out" | grep -oE '[a-zA-Z0-9.-]+\.up\.railway\.app' | head -1 || true)
    [ -n "$url" ] && url="https://$url"
  fi
  if [ -z "$url" ]; then
    echo "$out" >&2
    url=$(ask "The https://... address Railway shows for $service")
  fi
  printf '%s' "${url%/}"
}

step "1 of 7: Railway"
cat <<EOF
  Railway runs both parts. The Hobby plan (\$5 a month, usage included) is plenty.
  1. Sign in at https://railway.com with your GitHub account.
  2. Under Account Settings > Integrations, make sure Railway's GitHub app can see $REPO.
EOF
wait_enter
railway whoami >/dev/null 2>&1 || railway login
railway init --name "$PROJECT"

step "2 of 7: the database"
railway add --database postgres
say "Postgres is being made. Its address stays inside Railway; only the family service uses it."

step "3 of 7: the email service for greeting cards (Brevo, free)"
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

step "4 of 7: the family service"
cat <<EOF
  The family needs a password to leave a gift under Grammi's tree, so strangers can't. Make it
  something they'll all know and can type, like a family joke or a pet's name. Capital letters
  and spaces don't matter.
EOF
FAMILY_CODE=$(ask "The family password for gifts")
while [ "${#FAMILY_CODE}" -lt 6 ]; do FAMILY_CODE=$(ask "Something at least 6 letters long"); done

ADMIN_KEY=$(rand); GREETINGS_KEY=$(rand); GIFTS_KEY=$(rand); SALT=$(rand); JWT=$(rand)
railway add --repo "$REPO" --service family \
  --variables 'DATABASE_URL=${{Postgres.DATABASE_URL}}' \
  --variables "RAILWAY_DOCKERFILE_PATH=railway/service.Dockerfile" \
  --variables "PGRST_JWT_SECRET=$JWT" \
  --variables "OPENBLOG_SITE_ID=grammis-house" \
  --variables "OPENBLOG_SITE_NAME=Grammi's House" \
  --variables "OPENBLOG_SITE_ORIGIN=$SITE_ORIGIN" \
  --variables "OPENBLOG_SITE_BASE_PATH=$BASE_PATH" \
  --variables "OPENBLOG_ADMIN_API_KEY=$ADMIN_KEY" \
  --variables "OPENBLOG_ANALYTICS_SALT=$SALT" \
  --variables "OPENBLOG_MODERATION_ENABLED=true" \
  --variables "OPENBLOG_GREETINGS_ENABLED=true" \
  --variables "OPENBLOG_GREETINGS_ADMIN_KEY=$GREETINGS_KEY" \
  --variables "BREVO_API_KEY=$BREVO_API_KEY" \
  --variables "OPENBLOG_GREETINGS_FROM=$SENDER_NAME <$SENDER_EMAIL>" \
  --variables "OPENBLOG_GREETINGS_TIME_ZONE=America/New_York" \
  --variables "OPENBLOG_GIFTS_ENABLED=true" \
  --variables "OPENBLOG_GIFTS_ADMIN_KEY=$GIFTS_KEY" \
  --variables "OPENBLOG_GIFTS_FAMILY_CODE=$FAMILY_CODE"
FAMILY_URL=$(domain_of family)
say "The family service will be at $FAMILY_URL"

step "5 of 7: a GitHub token, so Admin can publish"
cat <<EOF
  1. Open https://github.com/settings/personal-access-tokens/new
  2. Name it "Grammi's admin on Railway". Expiration: a year (set yourself a reminder).
  3. Repository access: Only select repositories > $REPO.
  4. Permissions > Repository permissions > Contents: Read and write. Nothing else.
  5. Generate it and copy it.
EOF
GIT_TOKEN=$(secret_ask "The token (github_pat_...)")

step "6 of 7: the admin panel"
ADMIN_USER=$(ask "Grammi's sign-in name [grammi]")
ADMIN_USER=${ADMIN_USER:-grammi}
ADMIN_PASSWORD=$(secret_ask "Her password (at least 12 characters; write it down for her)")
while [ "${#ADMIN_PASSWORD}" -lt 12 ]; do ADMIN_PASSWORD=$(secret_ask "At least 12 characters, please"); done
railway add --repo "$REPO" --service admin \
  --variables "RAILWAY_DOCKERFILE_PATH=railway/admin.Dockerfile" \
  --variables "OPENBLOG_SITE_REPO=https://github.com/$REPO" \
  --variables "OPENBLOG_GIT_TOKEN=$GIT_TOKEN" \
  --variables "OPENBLOG_ADMIN_USER=$ADMIN_USER" \
  --variables "OPENBLOG_ADMIN_PASSWORD=$ADMIN_PASSWORD" \
  --variables "GIT_AUTHOR_NAME=Grammi" \
  --variables "GIT_AUTHOR_EMAIL=grammi@users.noreply.github.com" \
  --variables "OPENBLOG_ENGAGEMENT_API_KEY=$ADMIN_KEY" \
  --variables "OPENBLOG_ENGAGEMENT_API_ORIGIN=$FAMILY_URL" \
  --variables "OPENBLOG_GREETINGS_ENDPOINT=$FAMILY_URL/api/greetings" \
  --variables "OPENBLOG_GREETINGS_ADMIN_KEY=$GREETINGS_KEY" \
  --variables "OPENBLOG_GIFTS_ENDPOINT=$FAMILY_URL/api/gifts" \
  --variables "OPENBLOG_GIFTS_ADMIN_KEY=$GIFTS_KEY"
railway volume add --service admin --mount-path /data
ADMIN_URL=$(domain_of admin)

step "7 of 7: two clicks in Railway, then switch notes on"
cat <<EOF
  In the Railway project ($PROJECT), for each of the two services, "family" and "admin":
    Settings > Config-as-code > Railway config file:
      family:  railway/service.railway.json
      admin:   railway/admin.railway.json
  That keeps each one from rebuilding every time Grammi saves a recipe: they rebuild only when
  their own files or .openblog-rev change.
EOF
wait_enter

say "Turning on notes in the site settings..."
node - "$FAMILY_URL" <<'EOF'
const fs = require("fs");
const [url] = process.argv.slice(2);
const text = fs.readFileSync("openblog.json", "utf8");
const next = text
  .replace(/("engagement"\s*:\s*\{[^}]*?"enabled"\s*:\s*)false/, "$1true")
  .replace(/("engagement"\s*:\s*\{[^}]*?"endpoint"\s*:\s*)""/, `$1"${url}/api"`);
if (next === text) { console.error("openblog.json: engagement was already set; left as it is"); process.exit(0); }
fs.writeFileSync("openblog.json", next);
EOF
git add openblog.json
git commit -q -m "Turn on notes, through the family service on Railway" && git push -q || true

cat <<EOF

All set.

  Grammi's admin panel:   $ADMIN_URL/admin/studio/
      sign in as "$ADMIN_USER" with the password you chose. Bookmark it on her phone too.
  The family service:     $FAMILY_URL

  Notes: every recipe has a place for notes at the bottom. New ones wait in Admin's Moderation
  inbox until Grammi approves them.
  Greeting cards: in Admin under Family. Try "Send me a test" first (it goes to $SENDER_EMAIL).
  Gifts: tell the family the gift password. It's in Railway (family > Variables >
  OPENBLOG_GIFTS_FAMILY_CODE) if anyone forgets it.

  The first deploy of each takes a few minutes (the admin panel builds the engine). Watch with:
      railway logs --service admin
      railway logs --service family

  Keep these somewhere safe (they're also in Railway's variables):
      moderation key  $ADMIN_KEY
EOF
