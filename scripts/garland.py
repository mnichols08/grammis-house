#!/usr/bin/env python3
"""Hang a garland: put themes/<season>/garland.svg into that theme's "garland" token.

    python3 scripts/garland.py thanksgiving

The SVG is drawn once and repeats across the page under the header; set its width and
height on the <svg> and match them in the theme's garlandSize / garlandHeight tokens.
"""
import json, sys, urllib.parse
from pathlib import Path

season = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
folder = Path(__file__).resolve().parent.parent / "themes" / season
svg = " ".join((folder / "garland.svg").read_text().split()).replace('"', "'")
theme_path = folder / "theme.json"
theme = json.loads(theme_path.read_text())
theme.setdefault("tokens", {})["garland"] = 'url("data:image/svg+xml,' + urllib.parse.quote(svg, safe=" =:/,;'") + '")'
theme_path.write_text(json.dumps(theme, indent=2) + "\n")
print(f"garland hung on {season}")
