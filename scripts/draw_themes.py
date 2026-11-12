#!/usr/bin/env python3
"""Draw the month themes (January to October) and the series themes, then write their theme.json.

    python3 scripts/draw_themes.py          # every theme below
    python3 scripts/draw_themes.py july     # just one

November and December are Thanksgiving and Christmas, drawn by draw_decorations.py; the toy-shelf
Christmas here is another way to decorate December.
Each theme here is a short description: its colours (light and dark), the pieces it hangs,
and the weather on its home page. What makes each one look like itself beyond that (its
lettering, its welcome card, its tablecloth) is in the theme's own stylesheet and fonts, which
this script leaves alone. Colours are nudged until text reads at 7:1 and everything
else at 4.5:1, so a palette can be described loosely and still come out readable.
Run scripts/decorate.py --all afterwards to turn the pictures into tokens.
"""
import json
import sys
from pathlib import Path

from decor_library import band, bunting, corner, garland, mantel, pattern, scheme

THEMES = Path(__file__).resolve().parent.parent / "themes"

R = lambda **kw: kw  # noqa: E731  (keeps the specs below short)

MONTHS = {
    "january": dict(
        label="January: snowy morning",
        light=["#eef3f7", "#fbfdff", "#1f2d3a", "#4a5d6e", "#cddae4", "#2f5f8a"],
        dark=["#141c24", "#1c2632", "#e8eef4", "#b5c3cf", "#33414f", "#9cc6ea"],
        weather="snow",
        garland=R(items=[("snowflake", R(c="#7fa7c9")), ("mitten", R(c="#c8364a")), ("snowflake", R(c="#a9c6de")), ("mitten", R(c="#3f6f9a", cuff="#eef3f7"))],
                  rope="#8aa3b8", seam=("snowflake", R(c="#5d89b0")), seam_hang=("snowman", R())),
        banner=("WARM WISHES", ["#2f5f8a", "#c8364a", "#6f93b3"], ("snowflake", R(c="#7fa7c9"))),
        corner=[("snowman", R(), 150, 100, 4.2, 0), ("mitten", R(c="#c8364a"), 70, 130, 2.2, -20), ("mitten", R(c="#3f6f9a", cuff="#eef3f7"), 98, 138, 2, 15),
                ("snowflake", R(c="#7fa7c9"), 50, 60, 1.8, 0), ("snowflake", R(c="#a9c6de"), 100, 40, 1.2, 20)],
        mantel=[("mitten", R(c="#c8364a"), 40, 1.8), ("snowman", R(), 120, 2.6), ("teacup", R(ink="#2f5f8a"), 210, 1.8), ("snowflake", R(c="#7fa7c9"), 290, 1.6), ("mitten", R(c="#3f6f9a", cuff="#eef3f7"), 370, 1.8)],
        plank="#7a8c9c",
        pattern=("snowflake", R(c="#2f5f8a")),
    ),
    "february": dict(
        label="February: sweethearts",
        light=["#fbeff1", "#fffafb", "#3a1820", "#6e3d48", "#efd0d7", "#b0233f"],
        dark=["#22121a", "#2e1822", "#f6e6ea", "#d7b6bf", "#4d2a36", "#ff9db2"],
        weather="hearts",
        garland=R(items=[("heart", R(c="#c8243c")), ("heart", R(c="#f08aa4")), ("heart", R(c="#ffffff")), ("heart", R(c="#e0567a"))],
                  rope="#b0233f", seam=("bow", R(c="#c8243c"))),
        banner=("WITH LOVE", ["#b0233f", "#f08aa4", ("#ffffff", "#b0233f")], ("heart", R(c="#e0567a"))),
        corner=[("heart", R(c="#c8243c"), 140, 100, 5, -10), ("heart", R(c="#f08aa4"), 80, 120, 3, 15), ("heart", R(c="#ffffff"), 180, 135, 2.2, 20),
                ("envelope", R(seal="#c8243c"), 90, 60, 2, -12), ("bow", R(c="#e0567a"), 150, 50, 1.6, 0)],
        mantel=[("heart", R(c="#c8243c"), 40, 2), ("envelope", R(), 120, 2), ("cake", R(frost="#fbe3ec", layer="#e0567a"), 210, 2.3), ("teacup", R(ink="#b0233f"), 300, 1.8), ("heart", R(c="#f08aa4"), 380, 1.7)],
        plank="#7a3b48",
        pattern=("heart", R(c="#b0233f")),
    ),
    "march": dict(
        label="March: lucky clovers",
        light=["#eff5ec", "#fbfdf9", "#1d2e20", "#475c49", "#cfe0cc", "#1f7a3e"],
        dark=["#121c15", "#1a261d", "#e7f0e6", "#b6c7b6", "#2f4233", "#7fd49a"],
        weather="clover",
        garland=R(items=[("shamrock", R(c="#2e8b4a")), ("shamrock", R(c="#5fb36a")), ("coin", R()), ("shamrock", R(c="#1f6b3a"))],
                  rope="#1f6b3a", seam=("bow", R(c="#2e8b4a")), seam_hang=("coin", R())),
        banner=("LUCKY", ["#1f7a3e", "#e8b830", "#5fb36a"], None),
        corner=[("shamrock", R(c="#2e8b4a"), 140, 92, 3.6, 10), ("shamrock", R(c="#5fb36a"), 80, 120, 2.8, -15), ("coin", R(), 170, 140, 1.8, 0),
                ("coin", R(), 150, 148, 1.6, 0), ("coin", R(), 190, 150, 1.5, 0), ("pot", R(c="#2f2f2f", plant="#5fb36a"), 60, 70, 1.6, 0)],
        mantel=[("shamrock", R(c="#2e8b4a"), 40, 1.8), ("coin", R(), 110, 1.4), ("coin", R(), 128, 1.4), ("pot", R(c="#c4683a", plant="#2e8b4a"), 200, 2.2), ("teacup", R(ink="#1f7a3e"), 290, 1.8), ("shamrock", R(c="#5fb36a"), 380, 1.8)],
        plank="#55603a",
        pattern=("shamrock", R(c="#1f7a3e")),
    ),
    "april": dict(
        label="April: Easter eggs and tulips",
        light=["#f6f2fa", "#fffdff", "#2b2238", "#56496a", "#e0d6ec", "#6b3fa0"],
        dark=["#1a1622", "#241e2e", "#eee8f5", "#c3b8d3", "#3d3449", "#c8a8f0"],
        weather="petals",
        garland=R(items=[("egg", R(c="#b9a4e0")), ("egg", R(c="#9fd8cb", band="#ffffff")), ("tulip", R(c="#e8577a")), ("egg", R(c="#f7d774", band="#e8577a")), ("egg", R(c="#f6b8c8"))],
                  rope="#8fbf7a", seam=("bow", R(c="#b9a4e0")), seam_hang=("egg", R(c="#9fd8cb"))),
        banner=("HAPPY EASTER", ["#6b3fa0", "#e8577a", "#3f8f7a", "#c48a12"], ("egg", R(c="#f7d774"))),
        corner=[("tulip", R(c="#e8577a"), 60, 110, 3.6, -15), ("tulip", R(c="#f2c14e"), 90, 100, 3.8, 0), ("tulip", R(c="#b9a4e0"), 120, 112, 3.4, 15),
                ("egg", R(c="#9fd8cb", band="#ffffff"), 160, 138, 2.6, 10), ("egg", R(c="#f6b8c8"), 190, 142, 2.2, -10), ("egg", R(c="#b9a4e0"), 140, 148, 2, 25)],
        mantel=[("egg", R(c="#b9a4e0"), 40, 2), ("tulip", R(c="#e8577a"), 100, 2.2), ("bowl", R(c="#9fd8cb"), 190, 2), ("egg", R(c="#f7d774", band="#e8577a"), 270, 2), ("tulip", R(c="#f2c14e"), 330, 2.2), ("egg", R(c="#f6b8c8"), 390, 2)],
        plank="#8f7a5a",
        pattern=("egg", R(c="#6b3fa0", band="#ffffff")),
    ),
    "may": dict(
        label="May: flowers for Mom",
        light=["#fbf3f1", "#fffcfb", "#36211f", "#694a46", "#efd7d1", "#a8364e"],
        dark=["#211615", "#2c1e1c", "#f5e9e6", "#d4bcb7", "#4a3330", "#f4a2b4"],
        weather="petals",
        garland=R(items=[("daisy", R()), ("tulip", R(c="#e8577a")), ("daisy", R(petal="#f6b8c8")), ("leaf", R(c="#6f9a4a")), ("daisy", R(petal="#c9b6ea"))],
                  rope="#6f9a4a", seam=("bow", R(c="#e8577a"))),
        banner=("IN BLOOM", ["#a8364e", "#6f9a4a", "#c48a12"], ("daisy", R())),
        corner=[("pot", R(c="#c4683a", plant="#6f9a4a"), 150, 120, 3.2, 0), ("daisy", R(), 125, 72, 2.4, 0), ("daisy", R(petal="#f6b8c8"), 160, 62, 2.2, 0),
                ("tulip", R(c="#e8577a"), 185, 80, 2.4, 10), ("daisy", R(petal="#c9b6ea"), 70, 130, 2, 0), ("leaf", R(c="#6f9a4a"), 95, 145, 1.8, 60)],
        mantel=[("pot", R(c="#c4683a", plant="#6f9a4a"), 40, 2.2), ("teacup", R(ink="#a8364e"), 120, 1.8), ("cake", R(frost="#ffffff", layer="#f6b8c8"), 210, 2.3), ("daisy", R(), 290, 1.8), ("pot", R(c="#7aa6c2", plant="#6f9a4a"), 380, 2.2)],
        plank="#8a6a4e",
        pattern=("daisy", R(petal="#a8364e", center="#a8364e")),
    ),
    "june": dict(
        label="June: strawberry picking",
        light=["#fbf5ee", "#fffdf9", "#331f1c", "#634742", "#ecd9cb", "#b3262f"],
        dark=["#1f1614", "#2a1e1b", "#f5ebe6", "#d3bfb7", "#47332e", "#ff9c94"],
        weather="none",
        garland=R(items=[("strawberry", R()), ("leaf", R(c="#4f8f3a")), ("daisy", R()), ("strawberry", R(c="#e8404b"))],
                  rope="#4f8f3a", twine="#d9293a", seam=("bow", R(c="#d9293a")), seam_hang=("strawberry", R())),
        banner=("BERRY SWEET", ["#b3262f", ("#ffffff", "#b3262f"), "#4f8f3a"], ("strawberry", R())),
        corner=[("jar", R(lid="#d9293a", fill="#b32646"), 150, 110, 3.6, 0), ("strawberry", R(), 95, 140, 2.4, -20), ("strawberry", R(c="#e8404b"), 70, 120, 2, 10),
                ("strawberry", R(), 120, 150, 1.8, 30), ("daisy", R(), 190, 140, 1.6, 0), ("leaf", R(c="#4f8f3a"), 60, 150, 1.6, -70)],
        mantel=[("jar", R(), 40, 2), ("strawberry", R(), 105, 1.8), ("pie", R(fill="#b32646"), 190, 2.2), ("jar", R(lid="#3f8f3a"), 275, 2), ("bowl", R(c="#7aa6c2"), 360, 2)],
        plank="#8a5a3e",
        pattern=("strawberry", R(c="#b3262f", leaf="#b3262f")),
    ),
    "july": dict(
        label="July: Fourth of July",
        light=["#f5f3ee", "#fffefb", "#1b2340", "#47506e", "#d6d8e0", "#a3172b"],
        dark=["#121628", "#1b2036", "#ecedf3", "#bfc3d4", "#333a55", "#ff8f9c"],
        weather="confetti",
        garland=R(items=[("star", R(c="#b22234")), ("star", R(c="#2a3e7a")), ("star", R(c="#ffffff")), ("star", R(c="#f2c14e"))],
                  rope="#2a3e7a", seam_hang=("fan", R())),
        banner=("HAPPY 4TH", ["#a3172b", ("#ffffff", "#2a3e7a"), "#2a3e7a"], ("star", R(c="#2a3e7a"))),
        corner=[("fan", R(), 140, 50, 3.6, 0), ("star", R(c="#b22234"), 70, 120, 2.6, 10), ("star", R(c="#2a3e7a"), 110, 140, 2, -10), ("star", R(c="#f2c14e"), 190, 130, 1.8, 20)],
        mantel=[("star", R(c="#b22234"), 40, 1.8), ("pie", R(fill="#2a3e7a"), 120, 2.2), ("jar", R(lid="#2a3e7a", fill="#b22234"), 210, 2), ("pie", R(fill="#b32646"), 300, 2.2), ("star", R(c="#2a3e7a"), 380, 1.8)],
        plank="#5a4a3e",
        pattern=("star", R(c="#2a3e7a")),
    ),
    "august": dict(
        label="August: sunflowers and peaches",
        light=["#fbf5e6", "#fffcf2", "#33260f", "#5f4d2c", "#ecdcb5", "#9a5a00"],
        dark=["#1d170c", "#282012", "#f5eedd", "#d4c6a6", "#463a22", "#f6c25a"],
        weather="none",
        garland=R(items=[("sunflower", R()), ("leaf", R(c="#5f8f3a")), ("peach", R()), ("sunflower", R())],
                  rope="#7a5a2e", twine="#e8a90e", seam=("sunflower", R())),
        banner=("SUNNY DAYS", ["#9a5a00", "#e8a90e", ("#ffffff", "#9a5a00"), "#5f8f3a"], ("sunflower", R())),
        corner=[("sunflower", R(), 140, 70, 4.4, 10), ("sunflower", R(), 90, 100, 3, -10), ("peach", R(), 160, 140, 2.2, 0), ("peach", R(), 185, 145, 1.9, 20), ("leaf", R(c="#5f8f3a"), 60, 140, 2, -60)],
        mantel=[("sunflower", R(), 40, 2), ("peach", R(), 105, 1.6), ("peach", R(), 128, 1.4), ("pie", R(fill="#e8913a"), 210, 2.2), ("jar", R(lid="#e8a90e", fill="#f08a3a"), 290, 2), ("sunflower", R(), 380, 2)],
        plank="#7a5a2e",
        pattern=("sunflower", R()),
    ),
    "september": dict(
        label="September: apple picking",
        light=["#f7f1e6", "#fffcf5", "#2f2016", "#5e4535", "#e6d6bf", "#a3232b"],
        dark=["#1d1611", "#281e17", "#f3eadf", "#d0bfac", "#45362a", "#ff9b8a"],
        weather="leaves",
        garland=R(items=[("apple", R()), ("leaf", R(c="#5f8f3a")), ("apple", R(c="#8fb83a")), ("apple", R(c="#e8b830"))],
                  rope="#6b4a2b", twine="#c99a5e", seam=("bow", R(c="#a3232b")), seam_hang=("apple", R())),
        banner=("APPLE DAYS", ["#a3232b", "#5f8f3a", "#c48a12"], ("apple", R())),
        corner=[("bowl", R(c="#c4683a"), 150, 130, 3.4, 0), ("apple", R(), 130, 100, 2.4, -10), ("apple", R(c="#8fb83a"), 160, 96, 2.2, 10), ("apple", R(c="#e8b830"), 185, 104, 2, 0),
                ("pie", R(), 70, 140, 2.6, 0)],
        mantel=[("apple", R(), 40, 1.8), ("pie", R(), 120, 2.4), ("jar", R(lid="#a3232b", fill="#c9853a"), 205, 2), ("apple", R(c="#8fb83a"), 270, 1.8), ("teacup", R(ink="#a3232b"), 350, 1.8)],
        plank="#6b4a2b",
        pattern=("apple", R(c="#a3232b", leaf="#a3232b")),
    ),
    "october": dict(
        label="October: pumpkin patch",
        scheme="dark",
        # A night in the pumpkin patch in both modes: the moon only works in the dark.
        light=["#1f1a2b", "#2a2338", "#f3ede4", "#d2c8da", "#453a57", "#ffa865"],
        dark=["#17131f", "#211b2c", "#f3ede4", "#cfc5d8", "#3d3350", "#ffa865"],
        weather="leaves",
        garland=R(items=[("candycorn", R()), ("bat", R(c="#b3a6d4")), ("leaf", R(c="#d9661c")), ("candycorn", R()), ("leaf", R(c="#a3232b"))],
                  rope="#8f7fb0", seam=("bat", R(c="#b3a6d4")), seam_hang=("jack", R())),
        banner=("HAPPY HALLOWEEN", ["#b4470f", "#5a4a72", "#c48a12"], ("bat", R(c="#b3a6d4"))),
        corner=[("jack", R(), 150, 110, 4.2, 0), ("pumpkin", R(c="#f2a03a"), 90, 132, 2.6, -8), ("pumpkin", R(c="#efe6cf", side="#ddd2b5"), 195, 140, 2, 6),
                ("bat", R(), 70, 50, 2, -10), ("bat", R(), 120, 30, 1.4, 15), ("candycorn", R(), 60, 150, 1.4, 20)],
        mantel=[("pumpkin", R(), 40, 2.2), ("candycorn", R(), 100, 1.6), ("jack", R(), 180, 2.6), ("bowl", R(c="#6b5a8e"), 270, 2), ("pumpkin", R(c="#efe6cf", side="#ddd2b5"), 350, 1.8)],
        plank="#5a4a72",
        pattern=("bat", R(c="#d8cdf0")),
    ),
    "christmas-toyshelf": dict(
        label="Christmas: Grammi's toy shelf",
        light=["#f6efe6", "#fffaf3", "#2a1d1a", "#5e4a42", "#e6d3c3", "#b3192d"],
        dark=["#1a1422", "#241c2e", "#f5ece2", "#d3c3bf", "#433650", "#ff8f9b"],
        weather="snow",
        garland=R(items=[("block", R(letter="N", c="#b3192d")), ("spinning_top", R()), ("block", R(letter="O", c="#2f6fd0")), ("drum", R(c="#2f8a4f")),
                         ("block", R(letter="E", c="#2f8a4f")), ("spinning_top", R(c="#2f6fd0", band="#ffffff")), ("block", R(letter="L", c="#e0a12e"))],
                  rope="#b3192d", twine="#ffffff", seam=("bow", R(c="#b3192d")), seam_hang=("drum", R())),
        banner=("MERRY & BRIGHT", ["#b3192d", "#2f6fd0", "#2f8a4f", "#e0a12e"], ("spinning_top", R())),
        corner=[("rocking_horse", R(), 140, 100, 4.2, 0), ("drum", R(c="#2f6fd0"), 70, 135, 2.4, -6), ("block", R(letter="J", c="#b3192d"), 190, 148, 1.8, 8),
                ("block", R(letter="O", c="#2f8a4f"), 160, 152, 1.6, -10), ("block", R(letter="Y", c="#e0a12e"), 200, 125, 1.5, 14), ("spinning_top", R(), 55, 80, 1.8, 18)],
        mantel=[("nutcracker", R(), 30, 2.4), ("teddy", R(), 95, 2.4), ("drum", R(), 160, 2.2), ("train_car", R(), 225, 2.2), ("train_car", R(c="#b3192d"), 280, 2.2),
                ("rocking_horse", R(c="#2f6fd0"), 345, 2.4), ("spinning_top", R(c="#2f8a4f"), 400, 1.8)],
        plank="#8a5a2e",
        pattern=("spinning_top", R(c="#b3192d", band="#b3192d")),
    ),
}

SERIES = {
    "recipe-box": dict(
        label="Series: recipe box",
        light=["#fbf6ec", "#fffefa", "#2e2219", "#5e4c3e", "#e8dccb", "#a62a2a"],
        dark=["#1d1712", "#28201a", "#f3ece2", "#d0c2b2", "#463a2f", "#ff9a8a"],
        band=("gingham", ["#c8343a", "#ffffff", "#9e2026"], ("jar", R())),
        mantel=[("jar", R(), 40, 2), ("rolling_pin", R(), 125, 2), ("bowl", R(), 215, 2.2), ("pie", R(), 305, 2.2), ("jar", R(lid="#3f8f3a", fill="#e8b830"), 385, 2)],
        plank="#8a5a3e",
        pattern=("jar", R(lid="#a62a2a", fill="#a62a2a")),
    ),
    "family-stories": dict(
        label="Series: family stories",
        light=["#f4eee3", "#fdfaf3", "#2e251c", "#5f5243", "#ddd1bd", "#7a4a26"],
        dark=["#1b1713", "#25201a", "#f0e9de", "#cdc0ae", "#423a2f", "#e8b98a"],
        band=("photos", ["#d9c7a6", "#9a8a6a", "#8a7a5e"], None),
        mantel=[("photo", R(sky="#d9c7a6", hill="#9a8a6a"), 50, 2.4), ("teacup", R(ink="#7a4a26"), 130, 1.8), ("photo", R(sky="#cfe0ea", hill="#7da36a"), 210, 2.8), ("envelope", R(seal="#7a4a26"), 300, 1.8), ("photo", R(sky="#e8d2b5", hill="#a8875a"), 375, 2.2)],
        plank="#5a4130",
        pattern=("photo", R(sky="#7a4a26", hill="#7a4a26")),
    ),
    "garden-journal": dict(
        label="Series: garden journal",
        light=["#f1f3ea", "#fcfdf8", "#20271c", "#4b5643", "#d5dccb", "#3f6b2e"],
        dark=["#151a12", "#1e251a", "#e9eee4", "#bac6b2", "#36412f", "#a6d58a"],
        garland=R(items=[("leaf", R(c="#5f8f3a")), ("leaf", R(c="#8fb86a")), ("daisy", R()), ("leaf", R(c="#3f6b2e"))],
                  rope="#a8875a", twine="#d9c7a6", seam_hang=("pot", R()), H=96, sag=50, count=14),
        mantel=[("pot", R(), 40, 2.2), ("pot", R(c="#a8875a", plant="#8fb86a"), 110, 1.8), ("leaf", R(c="#5f8f3a"), 180, 1.6), ("pot", R(c="#c4683a", plant="#3f6b2e"), 250, 2.6), ("teacup", R(ink="#3f6b2e"), 340, 1.8), ("pot", R(), 395, 1.8)],
        plank="#8a6a4e",
        pattern=("leaf", R(c="#3f6b2e")),
    ),
    "baking-day": dict(
        label="Series: baking day",
        light=["#fbf3f4", "#fffcfc", "#33232a", "#634c55", "#ecd9de", "#9e3a5c"],
        dark=["#1e1519", "#291d22", "#f5eaee", "#d4bfc7", "#47343c", "#f4a6c2"],
        band=("awning", ["#f6b8c8", "#ffffff", "#8fc7c0"], ("cupcake", R())),
        mantel=[("cupcake", R(), 40, 2), ("cake", R(), 125, 2.6), ("cupcake", R(frost="#fff3c4", wrap="#f6b8c8"), 210, 2), ("rolling_pin", R(), 290, 1.8), ("cupcake", R(frost="#c9b6ea"), 380, 2)],
        plank="#b89a8a",
        pattern=("cupcake", R(frost="#9e3a5c", wrap="#9e3a5c")),
    ),
    "letters": dict(
        label="Series: letters to the grandkids",
        light=["#f5f2ea", "#fffdf8", "#1f2633", "#4c5566", "#d9d6cc", "#2b4f8a"],
        dark=["#14171d", "#1c2028", "#ebedf2", "#bcc2ce", "#353b48", "#9dbcf0"],
        band=("airmail", ["#c8343a", "#2b4f8a", "#8a8678"], ("envelope", R())),
        mantel=[("envelope", R(), 50, 2), ("teacup", R(ink="#2b4f8a"), 135, 1.8), ("envelope", R(seal="#2b4f8a"), 215, 2.4), ("photo", R(), 300, 2), ("envelope", R(), 380, 1.8)],
        plank="#5a5040",
        pattern=("envelope", R(c="#2b4f8a", seal="#2b4f8a")),
    ),
    "sunday-dinner": dict(
        label="Series: Sunday dinner",
        light=["#f2f4f8", "#fdfdff", "#1a2233", "#465066", "#d3d9e6", "#2f56a3"],
        dark=["#12161f", "#1a1f2b", "#e8ecf4", "#b8c0d2", "#323a4c", "#a0bcf5"],
        band=("lace", ["#ffffff", "#2f56a3", "#2f56a3"], ("teacup", R())),
        mantel=[("teacup", R(), 40, 2), ("pie", R(fill="#8e2a2a"), 125, 2.4), ("bowl", R(c="#2f56a3"), 215, 2.2), ("teacup", R(), 295, 2), ("cake", R(frost="#ffffff", layer="#2f56a3"), 380, 2.2)],
        plank="#4a3a2e",
        pattern=("teacup", R(c="#2f56a3", ink="#2f56a3")),
    ),
}


def colors(light, dark):
    lit, drk = scheme(*light), scheme(*dark)
    drk["ink"] = dark[0]
    return {"light": lit, "dark": drk}


def write_theme(name, spec, pieces, tokens):
    folder = THEMES / name
    decor = folder / "decor"
    decor.mkdir(parents=True, exist_ok=True)
    for old in decor.glob("*.svg"):
        old.unlink()
    for piece, text in pieces.items():
        (decor / f"{piece}.svg").write_text(text)
    path = folder / "theme.json"
    theme = json.loads(path.read_text()) if path.exists() else {}
    theme.update({"label": spec["label"], "extends": "grammis", "colorScheme": spec.get("scheme", "light"), "colors": colors(spec["light"], spec["dark"])})
    kept = {k: v for k, v in theme.get("tokens", {}).items() if not k.startswith("decor") and k not in ("season", "weather")}
    theme["tokens"] = {**kept, **tokens}
    path.write_text(json.dumps(theme, indent=2) + "\n")


def month(name, spec):
    g = spec["garland"]
    words, colours, gap = spec["banner"]
    pieces = {
        "garland": garland(**g),
        "banner": bunting(words, colours, gap),
        "corner": corner(spec["corner"]),
        "mantel": mantel(spec["mantel"], plank=spec["plank"]),
        "pattern": pattern(*spec["pattern"]),
    }
    banner_w = len(words) * 40 + 20
    tokens = {
        "season": json.dumps(spec["label"].split(":")[0]),  # "Christmas", "July"
        "weather": spec["weather"],
        "decorGarlandHeight": f"{g.get('H', 110)}px",
        "decorBannerSize": f"min(100%, {round(banner_w * 1.25)}px) auto",
        "decorBannerHeight": "88px",
        "decorBannerRepeat": "no-repeat",
        "decorCornerWidth": "250px",
        "decorCornerHeight": "196px",
        "decorCornerInset": "auto -30px -46px auto",
        "decorMantelSize": "420px 92px",
        "decorMantelHeight": "92px",
        "decorPatternSize": "96px 96px",
    }
    write_theme(name, spec, pieces, tokens)


def series(name, spec):
    if "band" in spec:
        kind, colours, hang = spec["band"]
        top, height = band(kind, colours, hang), 72
    else:
        top, height = garland(**spec["garland"]), spec["garland"].get("H", 110)
    pieces = {"garland": top, "mantel": mantel(spec["mantel"], plank=spec["plank"]), "pattern": pattern(*spec["pattern"])}
    tokens = {
        "season": json.dumps(spec["label"].split(": ", 1)[1].capitalize()),
        "weather": "none",
        "decorGarlandHeight": f"{height}px",
        "decorMantelSize": "420px 92px",
        "decorMantelHeight": "92px",
        "decorPatternSize": "96px 96px",
    }
    write_theme(name, spec, pieces, tokens)


if __name__ == "__main__":
    wanted = sys.argv[1:] or [*MONTHS, *SERIES]
    for name in wanted:
        (month if name in MONTHS else series)(name, (MONTHS | SERIES)[name])
        print("drew", name)
