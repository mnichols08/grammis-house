#!/bin/sh
# Starts Grammi's admin panel on Railway.
#
# The site lives on the Railway volume at /data/site, a clone of this repository. The first start
# clones it; every start after catches up with GitHub when that loses nothing (fast-forward only),
# so a change Mikey pushed from his laptop shows up after a redeploy. Saving in Admin publishes
# straight back to GitHub, and Pages builds the public site from there.
#
# Settings (Railway variables):
#   OPENBLOG_SITE_REPO        https://github.com/<owner>/<repo>
#   OPENBLOG_GIT_TOKEN        a fine-grained token for that repository only (Contents: read and write)
#   OPENBLOG_ADMIN_USER       Grammi's sign-in name
#   OPENBLOG_ADMIN_PASSWORD   her password (set again on every start, so changing it here works)
#   GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL   who her saves are committed as
set -eu
: "${OPENBLOG_SITE_REPO:?Set OPENBLOG_SITE_REPO to the site repository on GitHub}"
: "${OPENBLOG_GIT_TOKEN:?Set OPENBLOG_GIT_TOKEN so Admin can publish}"
: "${OPENBLOG_ADMIN_USER:?Set OPENBLOG_ADMIN_USER}"
: "${OPENBLOG_ADMIN_PASSWORD:?Set OPENBLOG_ADMIN_PASSWORD}"
site="${OPENBLOG_SITE_DIR:-/data/site}"

case "$OPENBLOG_SITE_REPO" in
  https://github.com/*) ;;
  *) echo "[admin] OPENBLOG_SITE_REPO must be https://github.com/<owner>/<repo>" >&2; exit 1 ;;
esac

# The token is handed to git only when git asks for GitHub credentials; it's never in a remote URL.
git config --global credential.https://github.com.helper \
  '!f() { if [ "$1" = get ]; then printf "username=x-access-token\npassword=%s\n" "$OPENBLOG_GIT_TOKEN"; fi; }; f'
git config --global user.name "${GIT_AUTHOR_NAME:-Grammi}"
git config --global user.email "${GIT_AUTHOR_EMAIL:-grammi@users.noreply.github.com}"
git config --global --add safe.directory "$site"
git config --global pull.ff only

if [ ! -d "$site/.git" ]; then
  echo "[admin] first start: copying the site from GitHub"
  mkdir -p "$(dirname "$site")"
  git clone -q "$OPENBLOG_SITE_REPO" "$site"
else
  branch=$(git -C "$site" rev-parse --abbrev-ref HEAD)
  if git -C "$site" fetch -q origin "$branch" && git -C "$site" merge -q --ff-only "origin/$branch"; then
    echo "[admin] caught up with GitHub"
  else
    echo "[admin] there's work here GitHub doesn't have yet; leaving it as it is, and publishing will send it"
  fi
fi

# Her sign-in, from the variables, every start.
if openblog user list --root "$site" | grep -Fqx -- "$OPENBLOG_ADMIN_USER"; then
  printf '%s\n' "$OPENBLOG_ADMIN_PASSWORD" | openblog user passwd "$OPENBLOG_ADMIN_USER" --root "$site" --password-stdin >/dev/null
else
  printf '%s\n' "$OPENBLOG_ADMIN_PASSWORD" | openblog user add "$OPENBLOG_ADMIN_USER" --root "$site" --password-stdin >/dev/null
fi

export OPENBLOG_BEHIND_PROXY=1
exec openblog serve --admin --host 0.0.0.0 --port "${PORT:-8080}" --root "$site"
