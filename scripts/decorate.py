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

The wallpaper comes in two: `pattern` for a light page and `patternDark` for a dark one. A
pattern drawn for a light page is dark marks on pale paper, which on a dark page either vanish
or glare, so the dark one is made from it here: every colour lifted toward white, laid on more
faintly. A theme that draws its own decor/pattern-dark.svg keeps that one instead. Both are laid
on a little more quietly than drawn (LIGHT_STRENGTH, DARK_STRENGTH), so the words always win.
"""
import json, re, sys, urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decor_library import mix  # noqa: E402

themes = Path(__file__).resolve().parent.parent / "themes"
LIGHT_STRENGTH = 0.75
DARK_STRENGTH = 0.55
LIFT = 0.5  # how far each colour moves toward white for a dark page

HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
OPEN = re.compile(r"(<svg\b[^>]*>)(.*)(</svg>)", re.S)


def full(code):
    return "#" + ("".join(ch * 2 for ch in code) if len(code) == 3 else code)


def strength(svg, amount):
    """The same picture, laid on at `amount` of its strength."""
    match = OPEN.search(svg)
    if not match:
        return svg
    return f"{match[1]}<g opacity='{amount}'>{match[2]}</g>{match[3]}"


def for_dark(svg):
    """A light page's pattern, for a dark page: its colours lifted toward white, laid on faintly."""
    lifted = HEX.sub(lambda m: mix(full(m[1]), "#ffffff", LIFT), svg)
    return strength(lifted, DARK_STRENGTH)


def token(text):
    text = " ".join(text.split()).replace('"', "'")
    return 'url("data:image/svg+xml,' + urllib.parse.quote(text, safe=" =:/,;'") + '")'


def name_of(stem):
    camel = re.sub(r"-([a-z])", lambda m: m[1].upper(), stem)
    return "decor" + camel[:1].upper() + camel[1:]


def decorate(season):
    folder = themes / season
    theme = json.loads((folder / "theme.json").read_text(encoding="utf-8"))
    tokens = theme.setdefault("tokens", {})
    drawn = {svg.stem: svg.read_text(encoding="utf-8") for svg in sorted((folder / "decor").glob("*.svg"))}
    if "pattern" in drawn:
        dark = drawn.get("pattern-dark") or for_dark(drawn["pattern"])
        drawn["pattern"] = strength(drawn["pattern"], LIGHT_STRENGTH)
        drawn["pattern-dark"] = dark
    for stem, text in drawn.items():
        tokens[name_of(stem)] = token(text)
    (folder / "theme.json").write_text(json.dumps(theme, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"decorated {season}: {', '.join(drawn)}")


if __name__ == "__main__":
    args = sys.argv[1:] or sys.exit(__doc__)
    for season in ([p.name for p in themes.iterdir() if (p / "decor").is_dir()] if args == ["--all"] else args):
        decorate(season)
