#!/bin/sh
# Keeps a checkout of the site on the Railway volume, then runs Admin.
# Needs GITHUB_TOKEN (a fine-grained token with contents: write on this repo).
set -eu

: "${GITHUB_TOKEN:?set GITHUB_TOKEN in the Railway service variables}"
REPO=https://github.com/mnichols08/grammis-house.git
SITE=/data/site

if [ ! -d "$SITE/.git" ]; then
    # The folder may already exist without a checkout (a partial earlier run), so initialize it in place.
    # Admin's private files live in .openblog/, which is gitignored and left alone.
    mkdir -p "$SITE"
    cd "$SITE"
    git init -q
    git remote add origin "$REPO"
    git fetch -q origin main
    git checkout -q -f -B main origin/main
fi
cd "$SITE"

# Keep the token in the environment, not in .git/config on the volume.
git config user.name "Mikey Nichols"
git config user.email "mnix@journeytocode.io"
git config credential.helper '!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f'
git pull --ff-only --quiet origin main || echo "warning: could not pull the latest site; serving the checkout on the volume"

exec openblog serve --admin --host 0.0.0.0 --port "${PORT:-8080}"
