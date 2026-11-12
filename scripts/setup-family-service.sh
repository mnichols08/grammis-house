#!/usr/bin/env bash
# Turn on notes on recipes and greeting cards.
#   Notes: the family leaves a note under a recipe ("I made your stuffing!"), and Grammi approves it in
#   Admin's Moderation inbox before anyone else sees it.
#   Greeting cards: Grammi writes cards in Admin (Greeting cards) and each goes out by email on its day,
#   birthdays every year. The family's addresses stay in the private database, never in this repo.
#
# GitHub Pages can't store anything a reader sends, so the notes live in a free Supabase database
# and pass through open.blog's own Netlify function. This walks you through the parts only you can
# do (making the two free accounts) and does the rest. Run it from the repository folder:
#
#     bash scripts/setup-family-service.sh
#
# It needs: gh (signed in to GitHub), node/npx, openssl.
set -euo pipefail

REPO="mnichols08/grammis-house"
SITE_ORIGIN="https://mnichols08.github.io"
BASE_PATH="/grammis-house/"
REV=$(grep -m1 'OPENBLOG_REV:' .github/workflows/pages.yml | awk '{print $2}')
RAW="https://raw.githubusercontent.com/journey-to-code-org/open.blog/$REV/supabase"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ask()  { local v; read -r -p "$1: " v; printf '%s' "$v"; }
secret_ask() { local v; read -r -s -p "$1 (hidden): " v; echo >&2; printf '%s' "$v"; }
wait_enter() { read -r -p "Press Enter when that's done. "; }

for tool in gh npx openssl; do
  command -v "$tool" >/dev/null || { echo "Please install $tool first."; exit 1; }
done

step "1 of 5: the database (Supabase, free)"
say "Make the database the notes are kept in."
cat <<EOF
  1. Go to https://supabase.com, sign in, and click New project.
     Name it grammis-house. Pick any region near the family. Save the database password somewhere.
  2. When it's ready, open SQL Editor, click New query, paste ALL of this file, and click Run:
       $RAW/openblog.sql
  3. Do the same with this one (it gives Grammi the approve/reject inbox):
       $RAW/moderation.sql
     And this one (the address book and greeting cards):
       $RAW/greetings.sql
  4. Open Project Settings > API Keys. You'll need the Project URL and a secret key (sb_secret_...).
     The Project URL is under Project Settings > Data API.
EOF
wait_enter
SUPABASE_URL=$(ask "Project URL (https://....supabase.co)")
SUPABASE_SECRET_KEY=$(secret_ask "Secret key (sb_secret_...)")

step "2 of 5: the notes and cards service (Netlify, free)"
cat <<EOF
  1. Go to https://app.netlify.com, sign in, and choose Add new project > Deploy manually.
     Drag any small folder onto the page (it gets replaced on the next deploy).
  2. Open Project configuration > General and copy the Project ID.
  3. Open your avatar > User settings > Applications > Personal access tokens > New access token.
     Name it grammis-house, choose an expiry, and copy the token.
EOF
wait_enter
NETLIFY_SITE_ID=$(ask "Project ID")
NETLIFY_AUTH_TOKEN=$(secret_ask "Personal access token")
export NETLIFY_AUTH_TOKEN

step "3 of 5: the email service for greeting cards (Brevo, free)"
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

ADMIN_KEY=$(openssl rand -hex 32)
GREETINGS_KEY=$(openssl rand -hex 32)
SALT=$(openssl rand -hex 32)

say "Setting the service's settings on Netlify..."
setvar() { npx -y netlify-cli@17 env:set "$1" "$2" --site "$NETLIFY_SITE_ID" --force >/dev/null; echo "  set $1"; }
setvar SUPABASE_URL "$SUPABASE_URL"
setvar SUPABASE_SECRET_KEY "$SUPABASE_SECRET_KEY"
setvar OPENBLOG_SITE_ID grammis-house
setvar OPENBLOG_SITE_ORIGIN "$SITE_ORIGIN"
setvar OPENBLOG_SITE_BASE_PATH "$BASE_PATH"
setvar OPENBLOG_ADMIN_API_KEY "$ADMIN_KEY"
setvar OPENBLOG_ANALYTICS_SALT "$SALT"
setvar OPENBLOG_MODERATION_ENABLED true
setvar OPENBLOG_GREETINGS_ENABLED true
setvar OPENBLOG_GREETINGS_ADMIN_KEY "$GREETINGS_KEY"
setvar BREVO_API_KEY "$BREVO_API_KEY"
setvar OPENBLOG_GREETINGS_FROM "$SENDER_NAME <$SENDER_EMAIL>"
setvar OPENBLOG_GREETINGS_TIME_ZONE America/New_York
setvar OPENBLOG_SITE_NAME "Grammi's House"
SITE_URL=$(npx -y netlify-cli@17 api getSite --data "{\"site_id\":\"$NETLIFY_SITE_ID\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).ssl_url||JSON.parse(s).url))')

step "4 of 5: let the site's build deploy the service"
gh variable set NETLIFY_SITE_ID --repo "$REPO" --body "$NETLIFY_SITE_ID"
gh secret set NETLIFY_AUTH_TOKEN --repo "$REPO" --body "$NETLIFY_AUTH_TOKEN"
gh workflow run pages.yml --repo "$REPO"
say "The site is rebuilding; it deploys the notes service to $SITE_URL this time and every time after."

step "5 of 5: switch them on in Admin"
cat <<EOF
  Once that build finishes (a few minutes; watch it with: gh run watch --repo $REPO):

  1. Open Admin and sign in, then open Analytics.
  2. Turn on hosted engagement (comments), and set the endpoint to:
       $SITE_URL/api
  3. Paste this into the write-only moderation token box, then Save and Publish:
       $ADMIN_KEY
     (Keep a copy in your password manager. It's the key to approving notes.)

  From then on every recipe has a place for notes at the bottom. New notes wait in
  Admin > Moderation inbox until Grammi approves them.

  For greeting cards, start Admin with these two settings in its environment (wherever Admin
  runs; keep them out of the repository):
       OPENBLOG_GREETINGS_ENDPOINT=$SITE_URL/api/greetings
       OPENBLOG_GREETINGS_ADMIN_KEY=$GREETINGS_KEY
  Then Admin shows Greeting cards under Family. Try "Send me a test" first: it goes to
  $SENDER_EMAIL, not to anyone in the address book.
EOF
