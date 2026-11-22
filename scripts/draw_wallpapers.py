#!/usr/bin/env python3
"""The wallpapers Grammi can ask for in words ("Look > Describe a new look": "blue gingham behind
everything", "little hearts", "plain"). Writes themes/grammis/wallpapers.json:

    python3 scripts/draw_wallpapers.py

Each wallpaper is a repeating tile drawn in one ink, written `{ink}`. The editor never draws one
from words: the writing helper only picks an `id` from this list, and the editor fills `{ink}` with
the new look's own accent colour, once for a light page and once for a dark one, and lays it on
faintly (docker/openblog-wallpapers.patch). So a wallpaper always matches the look's colours and
never fights the words.

Every look extends the house (themes/grammis), so this one list serves them all. A tile is plain
SVG shapes: no scripts, links, images or styles (the editor refuses a list that has any).
"""
import json
import re
from pathlib import Path

from decor_library import m, place, svg

OUT = Path(__file__).resolve().parent.parent / "themes" / "grammis" / "wallpapers.json"
INK = "{ink}"
HEX = re.compile(r"#[0-9a-fA-F]{3,6}\b")


def one_ink(markup):
    """A motif in a single ink: every colour it was drawn in becomes `{ink}`."""
    return HEX.sub(INK, markup)


def scatter(name, size=96, spots=((18, 20, 1, 0), (66, 54, .75, 30), (36, 82, .85, -20), (84, 14, .6, 15)), scale=.6):
    body = "".join(place(one_ink(m(name)), x, y, r, s * scale) for x, y, s, r in spots)
    return svg(size, size, body).strip()


def tile(size, body):
    return svg(size, size, body).strip()


GEOMETRIC = [
    ("gingham", "Gingham", "a picnic-blanket check of soft squares", tile(32,
        f"<rect width='16' height='32' fill='{INK}' opacity='.5'/><rect width='32' height='16' fill='{INK}' opacity='.5'/>")),
    ("plaid", "Plaid", "a tablecloth tartan of crossing bands and thin lines", tile(64,
        f"<rect y='8' width='64' height='14' fill='{INK}' opacity='.5'/><rect x='8' width='14' height='64' fill='{INK}' opacity='.5'/>"
        f"<path d='M0 40H64M40 0V64' stroke='{INK}' stroke-width='2'/><path d='M0 50H64M50 0V64' stroke='{INK}' stroke-width='1' opacity='.6'/>")),
    ("ticking", "Ticking stripes", "old mattress-ticking stripes, a wide band and two thin ones", tile(40,
        f"<rect x='4' width='10' height='40' fill='{INK}' opacity='.8'/><rect x='20' width='2' height='40' fill='{INK}'/><rect x='26' width='2' height='40' fill='{INK}'/>")),
    ("pinstripe", "Pinstripes", "fine upright pinstripes", tile(16, f"<rect x='7' width='2' height='16' fill='{INK}'/>")),
    ("polka-dots", "Polka dots", "big friendly polka dots", tile(48,
        f"<circle cx='12' cy='12' r='6' fill='{INK}'/><circle cx='36' cy='36' r='6' fill='{INK}'/>")),
    ("pin-dots", "Tiny dots", "a quiet sprinkle of tiny dots", tile(24,
        f"<circle cx='6' cy='6' r='1.6' fill='{INK}'/><circle cx='18' cy='18' r='1.6' fill='{INK}'/>")),
    ("kitchen-tiles", "Kitchen tiles", "square kitchen wall tiles with thin grout lines", tile(48,
        f"<path d='M0 .5H48M.5 0V48' stroke='{INK}' stroke-width='1.5'/><rect x='4' y='4' width='40' height='40' rx='3' fill='{INK}' opacity='.18'/>")),
    ("subway-tiles", "Subway tiles", "long brick-laid subway tiles", tile(64,
        f"<path d='M0 .5H64M0 16.5H64M.5 0V16M32.5 16V32' stroke='{INK}' stroke-width='1.5'/>").replace("height='64' viewBox='0 0 64 64'", "height='32' viewBox='0 0 64 32'")),
    ("diamonds", "Diamonds", "a harlequin pattern of diamonds", tile(40,
        f"<path d='M20 0 40 20 20 40 0 20Z' fill='{INK}' opacity='.55'/>")),
    ("scallops", "Scallops", "rows of scallop shells, like fish scales", tile(32,
        f"<path d='M0 16a16 16 0 0 1 32 0M-16 32a16 16 0 0 1 32 0M16 32a16 16 0 0 1 32 0' fill='none' stroke='{INK}' stroke-width='1.6'/>")),
    ("waves", "Waves", "gentle wavy lines, like ribbon candy", tile(48,
        f"<path d='M0 12q12-10 24 0t24 0M0 36q12-10 24 0t24 0' fill='none' stroke='{INK}' stroke-width='2'/>")),
    ("trellis", "Garden trellis", "a garden trellis of crossing diagonal lattice", tile(40,
        f"<path d='M0 0 40 40M40 0 0 40' stroke='{INK}' stroke-width='2'/>")),
    ("stitches", "Stitches", "little running stitches, like a quilt", tile(32,
        f"<path d='M4 8h8M20 8h8M12 24h8' stroke='{INK}' stroke-width='2' stroke-linecap='round'/>")),
]

MOTIFS = [
    ("hearts", "Little hearts", "small hearts scattered about", "heart"),
    ("stars", "Stars", "little stars scattered about", "star"),
    ("snowflakes", "Snowflakes", "snowflakes scattered about, for winter", "snowflake"),
    ("leaves", "Leaves", "fallen leaves scattered about, for autumn", "leaf"),
    ("daisies", "Daisies", "little daisies scattered about, for spring and summer", "daisy"),
    ("tulips", "Tulips", "tulips scattered about, for spring", "tulip"),
    ("apples", "Apples", "apples scattered about, for September", "apple"),
    ("strawberries", "Strawberries", "strawberries scattered about, for summer", "strawberry"),
    ("teacups", "Teacups", "teacups scattered about", "teacup"),
    ("cupcakes", "Cupcakes", "cupcakes scattered about, for birthdays and baking", "cupcake"),
    ("envelopes", "Letters", "little envelopes scattered about", "envelope"),
    ("shamrocks", "Shamrocks", "shamrocks scattered about, for March", "shamrock"),
    ("pumpkins", "Pumpkins", "small pumpkins scattered about, for fall", "pumpkin"),
]


def main():
    wallpapers = [{"id": i, "label": label, "about": about, "svg": art} for i, label, about, art in GEOMETRIC]
    wallpapers += [{"id": i, "label": label, "about": about, "svg": scatter(motif)} for i, label, about, motif in MOTIFS]
    for paper in wallpapers:
        assert '"' not in paper["svg"] and INK in paper["svg"], paper["id"]
    OUT.write_text(json.dumps({"version": 1, "wallpapers": wallpapers}, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(wallpapers)} wallpapers to {OUT.relative_to(OUT.parents[2])}")


if __name__ == "__main__":
    main()
