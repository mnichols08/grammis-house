#!/usr/bin/env python3
"""Hang a season's decorations: turn every themes/<season>/decor/<name>.svg into the
theme's "decor<Name>" token (garland.svg -> decorGarland -> --ob-decor-garland).

    python3 scripts/decorate.py thanksgiving
    python3 scripts/decorate.py --all

Pieces the house knows how to hang (themes/grammis/house.css):
  garland  across the bottom of the header, repeating      (decorGarlandHeight = the SVG height)
  banner   across the top of the welcome card              (decorBannerSize, decorBannerRepeat)
  corner   on a corner of the welcome card                 (decorCornerSize, decorCornerInset)
  mantel   along the top of the footer, repeating          (decorMantelSize, decorMantelHeight)
  pattern  the page's background texture, repeating       (decorPatternSize)
Leave a piece out and the house simply doesn't hang it.
"""
import json, sys, urllib.parse
from pathlib import Path

themes = Path(__file__).resolve().parent.parent / "themes"
args = sys.argv[1:] or sys.exit(__doc__)
seasons = [p.name for p in themes.iterdir() if (p / "decor").is_dir()] if args == ["--all"] else args

for season in seasons:
    folder = themes / season
    theme = json.loads((folder / "theme.json").read_text())
    tokens = theme.setdefault("tokens", {})
    for svg in sorted((folder / "decor").glob("*.svg")):
        text = " ".join(svg.read_text().split()).replace('"', "'")
        tokens["decor" + svg.stem[:1].upper() + svg.stem[1:]] = (
            'url("data:image/svg+xml,' + urllib.parse.quote(text, safe=" =:/,;'") + '")')
    (folder / "theme.json").write_text(json.dumps(theme, indent=2) + "\n")
    print(f"decorated {season}: {', '.join(p.stem for p in sorted((folder / 'decor').glob('*.svg')))}")
