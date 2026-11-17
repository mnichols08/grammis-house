#!/bin/sh
# Keeps a checkout of the site on the Railway volume, then runs Admin.
# Needs GITHUB_TOKEN (a fine-grained token with contents: write on this repo).
set -eu

: "${GITHUB_TOKEN:?set GITHUB_TOKEN in the Railway service variables}"
REPO=https://github.com/mnichols08/grammis-house.git
SITE=/data/site

if [ ! -d "$SITE/.git" ]; then
    git clone "$REPO" "$SITE"
fi
cd "$SITE"

# Keep the token in the environment, not in .git/config on the volume.
git config user.name "Mikey Nichols"
git config user.email "mnix@journeytocode.io"
git config credential.helper '!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f'
git pull --ff-only --quiet origin main || echo "warning: could not pull the latest site; serving the checkout on the volume"

# Railway serves this over HTTPS from a proxy, so sign-in cookies are marked secure.
export OPENBLOG_BEHIND_PROXY="${OPENBLOG_BEHIND_PROXY:-1}"

# Make the login (or reset its password) from the service variables, so nobody needs a shell on the volume.
if [ -n "${OPENBLOG_ADMIN_USER:-}" ] || [ -n "${OPENBLOG_ADMIN_PASSWORD:-}" ]; then
    if [ -z "${OPENBLOG_ADMIN_USER:-}" ] || [ -z "${OPENBLOG_ADMIN_PASSWORD:-}" ]; then
        echo "Set both OPENBLOG_ADMIN_USER and OPENBLOG_ADMIN_PASSWORD." >&2
        exit 1
    fi
    if openblog user list | grep -Fqx -- "$OPENBLOG_ADMIN_USER"; then
        OPENBLOG_PASSWORD="$OPENBLOG_ADMIN_PASSWORD" openblog user passwd "$OPENBLOG_ADMIN_USER"
    else
        OPENBLOG_PASSWORD="$OPENBLOG_ADMIN_PASSWORD" openblog user add "$OPENBLOG_ADMIN_USER"
    fi
fi

exec openblog serve --admin --host 0.0.0.0 --port "${PORT:-8080}"
