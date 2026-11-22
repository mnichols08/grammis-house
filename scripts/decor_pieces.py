"""Declare every look's decorations as pieces (open.blog Studio slice 3b).

Studio's "What's hanging" lets Grammi take one decoration down in any look. The Christmas looks
also offer each other's version of a piece. This writes the `decorations` manifest into each
theme.json from the tokens `decorate.py` already made, so run it after that script:

    python3 scripts/decorate.py --all && python3 scripts/decor_pieces.py

Each piece owns its picture and size tokens; "off" is the house's empty value for each (from
themes/grammis). Only the looks in LOOKS swap versions: a version carries its whole picture, so
offering every look's to every other would put a dozen copies of each picture in every theme.
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
    "pattern": ("Wallpaper", ["decorPattern", "decorPatternDark", "decorPatternSize"]),
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
}

# What falls on the home page. Most looks use the house weather (the `weather` token); christmas
# draws its own snow (snow.js, ghSnow) and thanksgiving its own leaves (leaves.js, ghLeaves).
OWN_WEATHER = {
    "christmas": ("snow", "Snow", "ghSnow"),
    "thanksgiving": ("leaves", "Falling leaves", "ghLeaves"),
}
WEATHER = {
    "snow": "Snow", "leaves": "Falling leaves", "hearts": "Falling hearts",
    "petals": "Falling petals", "clover": "Falling clovers", "confetti": "Confetti",
}
# Never offered: the engine's plain theme and the bare house have nothing hanging.
SKIP = {"base", "grammis"}


def load(name):
    return json.loads((THEMES / name / "theme.json").read_text())


def main():
    house = load("grammis")["tokens"]
    names = sorted(p.name for p in THEMES.iterdir() if (p / "theme.json").is_file() and p.name not in SKIP)
    themes = {name: load(name) for name in names}
    for name, theme in themes.items():
        tokens = theme.setdefault("tokens", {})
        pieces = {}
        for piece, (label, owned) in PIECES.items():
            if tokens.get(owned[0], "none") == "none":
                continue
            variants = {}
            for other, words in LOOKS.items():
                if other == name or name not in LOOKS:
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
        if name in OWN_WEATHER:
            piece, label, token = OWN_WEATHER[name]
            tokens.setdefault(token, "on")
            pieces[piece] = {"label": label, "tokens": [token], "off": {token: "none"}, "variants": {}}
        elif tokens.get("weather", "none") in WEATHER:
            kind = tokens["weather"]
            piece = "snow" if kind == "snow" else "weather"
            pieces[piece] = {"label": WEATHER[kind], "tokens": ["weather"], "off": {"weather": "none"}, "variants": {}}
        if not pieces:
            continue
        theme["decorations"] = pieces
        (THEMES / name / "theme.json").write_text(json.dumps(theme, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"{name}: {', '.join(pieces)}")


if __name__ == "__main__":
    main()
