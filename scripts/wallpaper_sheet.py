#!/usr/bin/env python3
"""A contact sheet of every look's wallpaper, on its own page colour, in light and in dark, so a
change to the wallpapers can be judged all at once. Writes one HTML file (nothing in the site):

    python3 scripts/wallpaper_sheet.py out.html

Each tile shows what a reader sees behind the page: the look's `page` colour with its wallpaper
on top (decorPatternDark in dark, when the look has one), and a sample of body text on the
`surface` colour, so a wallpaper that fights the words shows up.
"""
import json
import sys
from pathlib import Path

THEMES = Path(__file__).resolve().parent.parent / "themes"


def resolved(name, seen=()):
    theme = json.loads((THEMES / name / "theme.json").read_text(encoding="utf-8"))
    parent = theme.get("extends")
    if parent and parent != "base" and parent not in seen:
        base = resolved(parent, (*seen, name))
        merged = {**base, **theme}
        merged["tokens"] = {**base.get("tokens", {}), **theme.get("tokens", {})}
        merged["colors"] = {mode: {**base.get("colors", {}).get(mode, {}), **theme.get("colors", {}).get(mode, {})} for mode in ("light", "dark")}
        return merged
    return theme


def tile(name, theme, mode):
    colors = theme.get("colors", {}).get(mode, {})
    tokens = theme.get("tokens", {})
    paper = tokens.get("decorPatternDark") if mode == "dark" and tokens.get("decorPatternDark") else tokens.get("decorPattern", "none")
    size = tokens.get("decorPatternSize", "auto")
    page, surface, text = colors.get("page", "#fff"), colors.get("surface", "#fff"), colors.get("text", "#000")
    style = f"background-color:{page};background-image:{paper};background-size:{size}".replace("&", "&amp;").replace('"', "&quot;")
    return f"""<figure style="{style}">
  <figcaption style="background:{surface};color:{text}"><b>{theme.get('label', name)}</b><br>{mode}: the words sit on the page like this.</figcaption>
</figure>"""


def main(out):
    names = sorted(p.name for p in THEMES.iterdir() if (p / "theme.json").exists() and p.name not in ("base",))
    rows = []
    for name in names:
        theme = resolved(name)
        rows.append(f"<section><h2>{name}</h2>{tile(name, theme, 'light')}{tile(name, theme, 'dark')}</section>")
    Path(out).write_text(f"""<!doctype html><meta charset="utf-8"><title>Wallpapers</title>
<style>
  body {{ margin: 0; padding: 1rem; font: 15px/1.4 Georgia, serif; background: #888; }}
  section {{ display: grid; grid-template-columns: 9rem 1fr 1fr; gap: 0.6rem; align-items: stretch; margin-bottom: 0.6rem; }}
  h2 {{ margin: 0; font: 600 14px system-ui; color: #fff; align-self: center; }}
  figure {{ margin: 0; height: 9rem; display: grid; place-items: center; border-radius: 6px; }}
  figcaption {{ padding: 0.5rem 0.8rem; border-radius: 6px; max-width: 70%; }}
</style>
{''.join(rows)}
""", encoding="utf-8")
    print("wrote", out, "with", len(names), "looks")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "wallpapers.html")
