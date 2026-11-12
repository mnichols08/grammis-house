#!/usr/bin/env python3
"""Put up the decorations for today's date.

Sets "theme" in openblog.json, choosing in this order:
  1. the Theme Grammi picked on the Decorations page in Admin (content/pages/decorations.md);
  2. "pin" in seasons.json;
  3. the season in seasons.json whose window holds today;
  4. "default" in seasons.json. The deploy workflow runs this before every build,
and it builds hourly, so the house redecorates itself within an hour of a season starting.

    python3 scripts/season.py              # today
    python3 scripts/season.py --date 12-10 # pretend it's December 10 (for testing)
    python3 scripts/season.py --dry-run    # say what it would do, change nothing
"""
import datetime, json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
args = sys.argv[1:]
dry = "--dry-run" in args
today = datetime.date.today().strftime("%m-%d")
if "--date" in args:
    today = args[args.index("--date") + 1]

cfg = json.loads((root / "seasons.json").read_text())
themes = {p.name for p in (root / "themes").iterdir() if (p / "theme.json").exists()}

def holds(start, end, day):
    return start <= day <= end if start <= end else day >= start or day <= end

def picked_in_admin():
    page = root / "content" / "pages" / "decorations.md"
    if not page.exists():
        return ""
    front = page.read_text().split("---")
    match = re.search(r"^theme:\s*['\"]?([a-z0-9-]+)", front[1] if len(front) > 2 else "", re.M)
    return match.group(1) if match else ""

theme = picked_in_admin() or cfg.get("pin") or next(
    (s["theme"] for s in cfg.get("seasons", []) if holds(s["start"], s["end"], today)),
    cfg.get("default", "grammis"),
)
if theme not in themes:
    sys.exit(f"season.py: theme '{theme}' is not in themes/ ({', '.join(sorted(themes))})")

path = root / "openblog.json"
text = path.read_text()
# Edit the one value as text, so every other key keeps its place and spelling.
new, n = re.subn(r'("theme"\s*:\s*)"[^"]*"', rf'\g<1>"{theme}"', text, count=1)
if n != 1:
    sys.exit('season.py: no top-level "theme" in openblog.json')
print(f"{today}: decorating for {theme}" + (" (dry run)" if dry else ""))
if not dry and new != text:
    path.write_text(new)
