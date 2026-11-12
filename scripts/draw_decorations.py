#!/usr/bin/env python3
"""Draw the decorations: writes themes/<season>/decor/*.svg.

    python3 scripts/draw_decorations.py && python3 scripts/decorate.py --all

Every piece is drawn here in code (leaves, pumpkins, pine needles, bulbs, the village), so
changing a colour or the drape of a garland is an edit and a re-run. The output is seeded,
so the same script draws the same pictures every time.
"""
import math, random, json, os
random.seed(7)
from pathlib import Path
OUT = str(Path(__file__).resolve().parent.parent / "themes")
def f(v): return f"{v:.1f}".rstrip("0").rstrip(".")
def q(t, p0, p1, p2):
    x = (1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0]
    y = (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1]
    dx = 2*(1-t)*(p1[0]-p0[0]) + 2*t*(p2[0]-p1[0]); dy = 2*(1-t)*(p1[1]-p0[1]) + 2*t*(p2[1]-p1[1])
    return x, y, math.degrees(math.atan2(dy, dx))
def svg(w, h, body, defs=""):
    return f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' viewBox='0 0 {w} {h}'>" + (f"<defs>{defs}</defs>" if defs else "") + body + "</svg>\n"
def save(season, name, s):
    os.makedirs(f"{OUT}/{season}/decor", exist_ok=True)
    open(f"{OUT}/{season}/decor/{name}.svg", "w").write(s)
    print(season, name, len(s))

# ---------------- shared harvest pieces ----------------
MAPLE = "M0-11L2.6-5.5 7.5-7.6 5.6-2.2 10.5-.4 5.2 2.4 6.2 7.2 0 4.6-6.2 7.2-5.2 2.4-10.5-.4-5.6-2.2-7.5-7.6-2.6-5.5Z"
OAK = "M0-11C3.5-10 1.8-7.4 4.6-6.6 8.4-5.6 4.6-2.8 6.6-1 9.4 1.2 4.8 2.8 5.6 4.8 6.4 7.6 2 7.4 0 10.6-2 7.4-6.4 7.6-5.6 4.8-4.8 2.8-9.4 1.2-6.6-1-4.6-2.8-8.4-5.6-4.6-6.6-1.8-7.4-3.5-10 0-11Z"
LEAFC = ["#9b1d33", "#c4561c", "#e0a12e", "#b8371f", "#7a8a3a", "#d9822b"]
harvest_defs = (
  f"<path id='m' d='{MAPLE}' stroke-linejoin='round'/>"
  f"<path id='o' d='{OAK}'/>"
  "<g id='v' fill='none' stroke='#fff' stroke-opacity='.35' stroke-width='.7'><path d='M0 4.6V-9M0 0 6-4M0 0-6-4M0 2 4.5 5M0 2-4.5 5'/></g>"
  "<g id='a'><ellipse cx='0' cy='3' rx='3.6' ry='4.6' fill='#b9813f'/><ellipse cx='-1' cy='2' rx='1' ry='2' fill='#e3b77a' opacity='.6'/>"
  "<path d='M-4.6 0C-4.6-4 4.6-4 4.6 0Z' fill='#5b3720'/><path d='M-3.5-1.5h7M-4-.3h8' stroke='#3f2414' stroke-width='.5'/><path d='M0-3.4 .8-6' stroke='#3f2414' stroke-width='1.1' stroke-linecap='round'/></g>"
  "<g id='p'><ellipse cx='-5' cy='0' rx='6' ry='7.5' fill='#d9661c'/><ellipse cx='5' cy='0' rx='6' ry='7.5' fill='#d9661c'/><ellipse cx='0' cy='0' rx='6' ry='8' fill='#ec8429'/>"
  "<path d='M0-8V8M-5-7Q-8 0-5 7M5-7Q8 0 5 7' stroke='#b4500f' stroke-width='.8' fill='none'/><path d='M0-7.5Q1-11 3-11.5' stroke='#5b6b2a' stroke-width='2' fill='none' stroke-linecap='round'/></g>"
  "<g id='w' stroke='#c99a3e' stroke-width='.9' fill='#e2bb62'><path d='M0 0V-24' fill='none'/>"
  + "".join(f"<ellipse cx='{s*1.6}' cy='{-10-i*3.4}' rx='1.3' ry='2.6' transform='rotate({s*25} {s*1.6} {-10-i*3.4})'/>" for i in range(4) for s in (-1, 1))
  + "<ellipse cx='0' cy='-25' rx='1.3' ry='2.8'/></g>"
  "<g id='b'><circle r='2.3' fill='#c0392b'/><circle cx='-.7' cy='-.8' r='.7' fill='#fff' opacity='.6'/></g>"
)
def leaf(x, y, rot, s, kind, color):
    return f"<g transform='translate({f(x)} {f(y)}) rotate({f(rot)}) scale({f(s)})' fill='{color}'><use href='#{kind}'/><use href='#v'/></g>"
def use(id, x, y, rot=0, s=1):
    return f"<use href='#{id}' transform='translate({f(x)} {f(y)}) rotate({f(rot)}) scale({f(s)})'/>"

# ---------------- Thanksgiving garland ----------------
W, H = 340, 124
P0, P1, P2 = (0, 22), (170, 122), (340, 22)
b = [f"<path d='M0 22Q170 122 340 22' fill='none' stroke='#6b4a2b' stroke-width='3'/>",
     f"<path d='M0 25Q170 125 340 25' fill='none' stroke='#b08a52' stroke-width='1' stroke-dasharray='3 2'/>"]
items = []
for i in range(1, 30):
    t = i / 30
    x, y, a = q(t, P0, P1, P2)
    side = -1 if i % 2 else 1
    kind = "m" if i % 3 else "o"
    items.append((random.random(), leaf(x + random.uniform(-2, 2), y + side * random.uniform(4, 9), a + side * random.uniform(40, 80) + (90 if side > 0 else -90), random.uniform(.85, 1.2), kind, random.choice(LEAFC))))
    if i % 4 == 2: items.append((2, use("a", x + 3, y + 9, random.uniform(-20, 20), 1)))
    if i % 5 == 0: items.append((2, use("b", x - 4, y + 12)))
b += [s for _, s in sorted(items)]
# drop-point cluster at both seams: a burlap bow, wheat, a pumpkin
for cx in (0, W):
    c = [use("w", cx + dx, 30, r) for dx, r in ((-6, -28), (-2, -10), (2, 10), (6, 28))]
    c += [leaf(cx - 12, 30, -50, 1.3, "m", "#9b1d33"), leaf(cx + 12, 31, 50, 1.3, "m", "#e0a12e"), leaf(cx, 36, 180, 1.1, "o", "#7a8a3a")]
    c += [f"<path d='M{cx} 22c-14-12-20 2-11 6 4 2 8-2 11-6zm0 0c14-12 20 2 11 6-4 2-8-2-11-6z' fill='#c7a26b' stroke='#8a6a3e' stroke-width='.8'/>",
          f"<path d='M{cx} 23l-7 16 4-1 3 4zm0 0 7 16-4-1-3 4z' fill='#b8925a' stroke='#8a6a3e' stroke-width='.7'/><circle cx='{cx}' cy='22' r='3.2' fill='#a8834c'/>"]
    c += [use("p", cx, 50, 0, 1.35)]
    b += c
save("thanksgiving", "garland", svg(W, H, "".join(b), harvest_defs))

# Give thanks bunting: pennants on twine
words = "GIVE THANKS"
PW, gap = 34, 6
n = len(words)
BW = n * (PW + gap) + 20
pen_colors = ["#9b1d33", "#e0a12e", "#6f7d4f", "#c4561c"]
bb = [f"<path d='M0 10Q{BW/2} 30 {BW} 10' fill='none' stroke='#8a6a3e' stroke-width='1.6'/>"]
k = 0
for i, ch in enumerate(words):
    t = (i + .5) / n
    x, y, a = q(t, (0, 10), (BW / 2, 30), (BW, 10))
    if ch == " ":
        bb.append(use("m", x, y + 6, 20, .9).replace("<use", f"<use fill='#c4561c'"))
        continue
    col = pen_colors[k % 4]; k += 1
    bb.append(f"<g transform='translate({f(x)} {f(y)}) rotate({f(a*.6)})'><path d='M-15 0H15L0 34Z' fill='{col}'/><path d='M-15 0H15V3H-15Z' fill='#000' opacity='.15'/>"
              f"<text x='0' y='17' text-anchor='middle' font-family='Georgia,serif' font-weight='700' font-size='15' fill='#fbf3e3'>{ch}</text></g>")
save("thanksgiving", "banner", svg(BW, 52, "".join(bb), harvest_defs))

# corner cluster: heirloom pumpkins, gourds, wheat, leaves
cc = []
cc += [use("w", 40 + i * 9, 120, -35 + i * 12, 1.5) for i in range(7)]
cc += [leaf(30, 118, -60, 2, "m", "#9b1d33"), leaf(150, 112, 40, 2.1, "o", "#7a8a3a"), leaf(120, 128, 70, 1.9, "m", "#e0a12e")]
cc += ["<g transform='translate(92 108) scale(4.2)'><use href='#p'/></g>",
       "<g transform='translate(146 132) scale(2.4)' ><ellipse cx='-5' cy='0' rx='6' ry='6.5' fill='#efe6cf'/><ellipse cx='5' cy='0' rx='6' ry='6.5' fill='#efe6cf'/><ellipse cx='0' cy='0' rx='6' ry='7' fill='#f8f1de'/><path d='M0-7V7M-5-6Q-8 0-5 6M5-6Q8 0 5 6' stroke='#cfc1a0' stroke-width='.8' fill='none'/><path d='M0-6.5Q1-10 3-10' stroke='#5b6b2a' stroke-width='2' fill='none' stroke-linecap='round'/></g>",
       "<g transform='translate(44 138) rotate(-18)'><path d='M0 0C-4-14 4-22 8-16 12-10 20-4 18 6 16 14 2 12 0 0Z' fill='#e9b93a'/><path d='M2 0C0-10 5-16 8-14' stroke='#5b8a3a' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M6 0c4 4 8 6 12 6' stroke='#c99528' fill='none'/></g>",
       "<g transform='translate(184 146) rotate(14)'><ellipse rx='13' ry='8' fill='#6f8a3a'/><path d='M-12 0H12M-10-4H10M-10 4H10' stroke='#e6d58a' stroke-width='1.2'/><path d='M12-2q5-3 6-8' stroke='#5b3720' stroke-width='2' fill='none'/></g>"]
cc += [use("a", 70, 150, -10, 1.6), use("a", 120, 154, 25, 1.5), use("b", 60, 126, 0, 1.3), use("b", 66, 131, 0, 1.2)]
save("thanksgiving", "corner", svg(210, 165, "".join(cc), harvest_defs))

# mantel: gourds and pumpkins on a plank, repeating
MW = 420
mm = ["<rect x='0' y='78' width='420' height='12' fill='#6b4a2b'/><rect x='0' y='78' width='420' height='3' fill='#8b6640'/>",
      "<path d='M0 84h420' stroke='#5a3c22' stroke-width='.6' stroke-dasharray='40 6 90 4'/>"]
def pump(x, y, s, body="#ec8429", side="#d9661c"):
    return (f"<g transform='translate({x} {y}) scale({s})'><ellipse cx='-5' cy='0' rx='6' ry='7.5' fill='{side}'/><ellipse cx='5' cy='0' rx='6' ry='7.5' fill='{side}'/><ellipse cx='0' cy='0' rx='6' ry='8' fill='{body}'/>"
            "<path d='M0-8V8M-5-7Q-8 0-5 7M5-7Q8 0 5 7' stroke='#000' stroke-opacity='.18' stroke-width='.8' fill='none'/><path d='M0-7.5Q1-11 3-11.5' stroke='#5b6b2a' stroke-width='2' fill='none' stroke-linecap='round'/></g>")
mm += [pump(46, 60, 2.3), pump(92, 68, 1.3, "#f8f1de", "#efe6cf"),
       "<g transform='translate(150 40)'><rect x='-10' y='0' width='20' height='38' rx='3' fill='#d8e4e6' opacity='.55' stroke='#9fb3b6'/><rect x='-7' y='10' width='14' height='26' rx='2' fill='#f6ead0'/><path d='M0 10V5' stroke='#3a2a1a'/><path d='M0 5C-3 0 0-6 0-9 0-6 3 0 0 5Z' fill='#f5b53a'/><path d='M0 4C-1.4 1 0-2 0-4 0-2 1.4 1 0 4Z' fill='#fff3b0'/><path d='M-10 8h20' stroke='#b08a52' stroke-width='2'/></g>",
       pump(214, 58, 2.6, "#d9661c", "#c25412"),
       "<g transform='translate(262 70) rotate(-8)'><path d='M0 0C-4-14 4-22 8-16 12-10 20-4 18 6 16 14 2 12 0 0Z' fill='#e9b93a'/><path d='M2 0C0-10 5-16 8-14' stroke='#5b8a3a' stroke-width='3' fill='none' stroke-linecap='round'/></g>",
       "<g transform='translate(306 70)'><ellipse rx='15' ry='8' fill='#6f8a3a'/><path d='M-14 0H14M-12-4H12M-12 4H12' stroke='#e6d58a' stroke-width='1.2'/></g>",
       pump(362, 64, 1.8, "#f0a03a", "#d98a26")]
mm += [leaf(120, 76, 80, 1.4, "m", "#9b1d33"), leaf(250, 76, -70, 1.3, "o", "#7a8a3a"), leaf(395, 75, 100, 1.4, "m", "#e0a12e"), leaf(10, 76, -100, 1.2, "o", "#c4561c")]
save("thanksgiving", "mantel", svg(MW, 92, "".join(mm), harvest_defs))

# tablecloth plaid
pl = ("<rect width='48' height='48' fill='none'/>"
      "<rect x='0' y='0' width='24' height='48' fill='#9b1d33' opacity='.028'/>"
      "<rect x='0' y='0' width='48' height='24' fill='#9b1d33' opacity='.028'/>"
      "<rect x='34' y='0' width='3' height='48' fill='#e0a12e' opacity='.05'/><rect x='0' y='34' width='48' height='3' fill='#e0a12e' opacity='.05'/>")
save("thanksgiving", "pattern", svg(48, 48, pl))

# ---------------- Christmas ----------------
xmas_defs = (
  "<g id='bow'><path d='M0 0C-16-14-28-2-17 5-10 9-4 4 0 0ZM0 0C16-14 28-2 17 5 10 9 4 4 0 0Z' fill='#b3202e'/>"
  "<path d='M-3-1C-9-6-15-3-14 1M3-1C9-6 15-3 14 1' stroke='#7c1220' stroke-width='1.2' fill='none'/>"
  "<path d='M-1 2-8 22-3 19 1 24ZM1 2 8 22 3 19-1 24Z' fill='#9c1a27'/><rect x='-4' y='-4' width='8' height='8' rx='2.5' fill='#c92a39'/>"
  "<path d='M-14-6C-10-9-6-6-4-3' stroke='#fff' stroke-opacity='.35' stroke-width='1.4' fill='none' stroke-linecap='round'/></g>"
  "<g id='orn'><path d='M0-15V-9' stroke='#a8873a' stroke-width='.8'/><rect x='-3.5' y='-11' width='7' height='4.5' rx='1' fill='#c9a24a'/>"
  "<circle r='9' cy='1' fill='#d4a841'/><path d='M-9 1a9 3 0 0 0 18 0' fill='none' stroke='#a8873a' stroke-width='1'/>"
  "<ellipse cx='-3.5' cy='-3' rx='2.5' ry='3.5' fill='#fff' opacity='.55'/></g>"
)
def needles(points, density, rng, length=(6, 10)):
    d1, d2 = [], []
    for (x, y, a) in points:
        for _ in range(density):
            ang = math.radians(a + rng.uniform(-75, 75) + (180 if rng.random() < .5 else 0))
            L = rng.uniform(*length)
            sx, sy = x + rng.uniform(-3, 3), y + rng.uniform(-3, 3)
            (d1 if rng.random() < .55 else d2).append(f"M{sx:.0f} {sy:.0f}l{L*math.cos(ang):.0f} {L*math.sin(ang):.0f}")
    return d1, d2
rng = random.Random(3)
W, H = 240, 96
P0, P1, P2 = (0, 22), (120, 86), (240, 22)
pts = [q(i / 110, P0, P1, P2) for i in range(111)]
pts += [(x, y + 5, a) for (x, y, a) in pts[::2]]
d1, d2 = needles(pts, 11, rng, (7, 12))
g = [f"<path d='M0 22Q120 86 240 22' stroke='#3b2a1c' stroke-width='3' fill='none'/>",
     f"<path d='{''.join(d2)}' stroke='#1d4d33' stroke-width='2' stroke-linecap='round'/>",
     f"<path d='{''.join(d1)}' stroke='#2f6b45' stroke-width='1.7' stroke-linecap='round'/>",
     f"<path d='{''.join(d for d in d1[::5])}' stroke='#5c9a68' stroke-width='1' stroke-linecap='round'/>"]
BULB = ["#e8384d", "#f2c14e", "#3fae6a", "#4a8fe0", "#f2913d"]
bulbs = []
wire = [f"<path d='M8 30Q120 98 232 30' stroke='#14301f' stroke-width='1.2' fill='none'/>"]
for i in range(7):
    t = (i + 1) / 8
    x, y, a = q(t, (8, 30), (120, 98), (232, 30))
    col = BULB[i % 5]
    bulbs.append((round(x, 1), round(y + 10, 1), col))
    g_b = (f"<g transform='translate({f(x)} {f(y)}) rotate({f(a*.4)})'><rect x='-2.6' y='0' width='5.2' height='5' rx='1' fill='#1f3326'/>"
           f"<path d='M0 4C-5 8-5 15 0 19 5 15 5 8 0 4Z' fill='{col}'/><ellipse cx='-1.5' cy='10' rx='1' ry='2.6' fill='#fff' opacity='.5'/></g>")
    wire.append(g_b)
g += wire
for cx in (0, W):
    g += [f"<g transform='translate({cx} 20)'><use href='#bow'/></g>", f"<g transform='translate({cx} 58)'><use href='#orn'/></g>"]
save("christmas", "garland", svg(W, H, "".join(g), xmas_defs))
print("christmas bulbs (paste into themes/christmas/snow.js if the garland changes):", json.dumps({"width": W, "bulbs": bulbs}))

# wreath
rng = random.Random(11)
R = 58; cx, cy = 85, 92
ring = [(cx + R * math.cos(math.radians(d)), cy + R * math.sin(math.radians(d)), d + 90) for d in range(0, 360, 4)]
d1, d2 = needles(ring, 12, rng, (8, 15))
wr = [f"<circle cx='{cx}' cy='{cy}' r='{R}' stroke='#3b2a1c' stroke-width='10' fill='none'/>",
      f"<path d='{''.join(d2)}' stroke='#1d4d33' stroke-width='2' stroke-linecap='round'/>",
      f"<path d='{''.join(d1)}' stroke='#2f6b45' stroke-width='1.8' stroke-linecap='round'/>",
      f"<path d='{''.join(d1[::4])}' stroke='#6aa574' stroke-width='1.1' stroke-linecap='round'/>"]
for d in range(15, 360, 40):
    bx, by = cx + R * math.cos(math.radians(d)), cy + R * math.sin(math.radians(d))
    wr += [f"<circle cx='{f(bx+dx)}' cy='{f(by+dy)}' r='3.4' fill='#c0182b'/><circle cx='{f(bx+dx-1)}' cy='{f(by+dy-1)}' r='1' fill='#fff' opacity='.6'/>" for dx, dy in ((0, 0), (5, 3), (-2, 6))]
for d in (200, 330):
    wr.append(f"<g transform='translate({f(cx + R*math.cos(math.radians(d)))} {f(cy + R*math.sin(math.radians(d)))}) scale(.85)'><use href='#orn'/></g>")
wr.append(f"<path d='M{cx} 0V30' stroke='#9c1a27' stroke-width='3'/>")
wr.append(f"<g transform='translate({cx} {cy + R}) scale(1.6)'><use href='#bow'/></g>")
save("christmas", "corner", svg(170, 190, "".join(wr), xmas_defs))

# snow drift along the top of a card
sw = "<path d='M0 14C10 2 22 4 30 10 38 0 54 2 62 11 70 5 82 6 90 12 98 2 112 4 120 14V0H0Z' fill='#fff'/><path d='M0 14C10 2 22 4 30 10 38 0 54 2 62 11 70 5 82 6 90 12 98 2 112 4 120 14' fill='none' stroke='#cfdde3' stroke-width='1.2'/>"
save("christmas", "banner", svg(120, 16, sw))

# village tree line
rng = random.Random(5)
VW = 480
vv = ["<path d='M0 80Q120 70 240 78T480 76V110H0Z' fill='#ffffff'/>"]
def tree(x, base, h, col):
    w = h * .55
    s = f"<g><rect x='{f(x-2)}' y='{f(base-4)}' width='4' height='6' fill='#4a3324'/>"
    for k in range(3):
        top = base - h + k * h * .28
        bw = w * (.55 + k * .25)
        bot = top + h * .45
        s += f"<path d='M{f(x)} {f(top)}L{f(x+bw/2)} {f(bot)}H{f(x-bw/2)}Z' fill='{col}'/>"
        s += f"<path d='M{f(x)} {f(top)}L{f(x+bw*.18)} {f(top+h*.1)}L{f(x)} {f(top+h*.07)}L{f(x-bw*.18)} {f(top+h*.1)}Z' fill='#fff'/>"
    return s + "</g>"
house = ("<g transform='translate(250 46)'><rect x='0' y='12' width='46' height='26' fill='#7a3a2c'/><path d='M-6 14 23-6 52 14Z' fill='#4b2a24'/>"
         "<path d='M-6 14 23-6 52 14 48 15 23-2-2 15Z' fill='#fff'/><rect x='36' y='-4' width='6' height='12' fill='#5c3a30'/><rect x='35' y='-6' width='8' height='3' fill='#fff'/>"
         "<rect x='6' y='18' width='10' height='9' fill='#ffd36b'/><rect x='6' y='18' width='10' height='9' fill='none' stroke='#3a1f18' stroke-width='1.2'/><path d='M11 18v9M6 22.5h10' stroke='#3a1f18' stroke-width='.8'/>"
         "<rect x='28' y='22' width='9' height='16' fill='#2f1a14'/><circle cx='32.5' cy='29' r='3.4' fill='#2f6b45' stroke='#b3202e' stroke-width='1'/>"
         "<rect x='6' y='18' width='10' height='9' fill='#ffd36b' opacity='.35' filter='url(#glow)'/></g>")
for x, hgt, col in ((22, 46, "#1f4a33"), (52, 64, "#2b5e40"), (88, 40, "#1f4a33"), (130, 56, "#2f6b45"), (170, 70, "#1d4430"), (208, 44, "#2b5e40"),
                   (330, 60, "#1f4a33"), (366, 42, "#2f6b45"), (404, 72, "#2b5e40"), (446, 50, "#1d4430")):
    vv.append(tree(x, 84 + rng.uniform(-2, 2), hgt, col))
vv.append(house)
vv.append("<path d='M0 86Q120 78 240 86T480 84V110H0Z' fill='#f4f8fa'/>")
save("christmas", "mantel", svg(VW, 110, "".join(vv), "<filter id='glow'><feGaussianBlur stdDeviation='3'/></filter>"))

# faint scattered stars/snowflakes for the page
fl = "".join(f"<g transform='translate({x} {y}) scale({s})' stroke='#c9a24a' stroke-opacity='.22' stroke-width='1.2' stroke-linecap='round'><path d='M0-5V5M-4.3-2.5 4.3 2.5M-4.3 2.5 4.3-2.5'/></g>" for x, y, s in ((14, 18, 1), (70, 52, .7), (40, 92, .9), (100, 104, .6), (96, 14, .8)))
save("christmas", "pattern", svg(120, 120, fl))
