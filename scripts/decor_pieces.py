"""Declare each Christmas look's decorations as pieces (open.blog Studio slice 3b).

Studio's "What's hanging" lets Grammi take one decoration down, or swap it for the same piece from
another Christmas look. This writes the `decorations` manifest into each Christmas theme.json from
the tokens `decorate.py` already made, so run it after that script:

    python3 scripts/decorate.py && python3 scripts/decor_pieces.py

Each piece owns its picture and size tokens; "off" is the house's empty value for each (from
themes/grammis), and every other Christmas look's version of the piece is offered as a variant.
"""

import json
from pathlib import Path

THEMES = Path(__file__).resolve().parent.parent / "themes"

# Piece id -> (label, tokens it owns). Order is the order she sees them in.
PIECES = {
    "garland": ("Garland", ["decorGarland", "decorGarlandHeight"]),
    "banner": ("Banner", ["decorBanner", "decorBannerSize", "decorBannerHeight", "decorBannerRepeat"]),
    "corner": ("Corner piece", ["decorCorner", "decorCornerWidth", "decorCornerHeight", "decorCornerInset"]),
    "mantel": ("Mantel", ["decorMantel", "decorMantelSize", "decorMantelHeight"]),
    "pattern": ("Wallpaper", ["decorPattern", "decorPatternSize"]),
}

# The Christmas looks, and what to call each one's version of a piece when another look offers it.
LOOKS = {
    "christmas": {
        "garland": "Lights", "banner": "Ribbon", "corner": "Bows and ornaments",
        "mantel": "Stockings and greens", "pattern": "Snowflakes",
    },
    "christmas-toyshelf": {
        "garland": "Toy blocks", "banner": "Merry and Bright sign", "corner": "Rocking horse and blocks",
        "mantel": "Toys in a row", "pattern": "Little toys",
    },
    "christmas-florida": {
        "garland": "Shells and starfish", "banner": "Season's Beachings sign", "corner": "Palm tree and sand snowman",
        "mantel": "Beach things on the shelf", "pattern": "Little starfish",
    },
}

# Snow: christmas draws it in snow.js (the ghSnow token); the toy shelf and Florida use the house
# weather (in Florida the joke is that it snows anyway).
SNOW = {
    "christmas": ("ghSnow", "on"),
    "christmas-toyshelf": ("weather", "snow"),
    "christmas-florida": ("weather", "snow"),
}


def load(name):
    return json.loads((THEMES / name / "theme.json").read_text())


def main():
    house = load("grammis")["tokens"]
    themes = {name: load(name) for name in LOOKS}
    for name, theme in themes.items():
        tokens = theme.setdefault("tokens", {})
        pieces = {}
        for piece, (label, owned) in PIECES.items():
            if tokens.get(owned[0], "none") == "none":
                continue
            variants = {}
            for other, words in LOOKS.items():
                if other == name:
                    continue
                theirs = themes[other]["tokens"]
                if theirs.get(owned[0], "none") == "none":
                    continue
                variants[other] = {"label": words[piece], "tokens": {t: theirs[t] for t in owned if t in theirs}}
            pieces[piece] = {
                "label": label,
                "tokens": owned,
                "off": {t: house[t] for t in owned},
                "variants": variants,
            }
        token, on = SNOW[name]
        tokens.setdefault(token, on)
        pieces["snow"] = {"label": "Snow", "tokens": [token], "off": {token: "none"}, "variants": {}}
        theme["decorations"] = pieces
        (THEMES / name / "theme.json").write_text(json.dumps(theme, indent=2) + "\n")
        print(f"{name}: {', '.join(pieces)}")


if __name__ == "__main__":
    main()
