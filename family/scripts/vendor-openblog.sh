#!/bin/sh
# Copies the open.blog pieces the family service reuses, at the revision the site is pinned to
# (OPENBLOG_REV in .github/workflows/pages.yml), into family/vendor/openblog/. They are plain
# JavaScript rules (gift and card checks, card emails, the moderation state machine) and the
# database's SQL, so the data stays the shape open.blog's own tools read. Never edit the copies:
# change open.blog, bump the pin, and run this again.
#
#   sh family/scripts/vendor-openblog.sh            (from the repository folder)
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
rev=$(grep -m1 'OPENBLOG_REV:' "$root/.github/workflows/pages.yml" | awk '{print $2}')
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git -C "$work" init -q
git -C "$work" fetch -q --depth 1 https://github.com/journey-to-code-org/open.blog "$rev"
git -C "$work" checkout -q FETCH_HEAD
out="$root/family/vendor/openblog"
rm -rf "$out"
mkdir -p "$out/lib" "$out/sql"
for name in gift-card greeting-card greeting-send participation-moderation feedback-moderation; do
  cp "$work/netlify/lib/$name.mjs" "$out/lib/$name.mjs"
done
for name in openblog moderation greetings gifts; do
  cp "$work/supabase/$name.sql" "$out/sql/$name.sql"
done
cp "$work/service/roles.sql" "$out/sql/roles.sql"
printf '%s\n' "$rev" > "$out/REVISION"
echo "open.blog $rev copied to family/vendor/openblog"
