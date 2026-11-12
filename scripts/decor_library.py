"""The decoration library: small motifs drawn at the origin, and the pieces a theme hangs
(garland, banner, corner, mantel, pattern) built from them. Used by draw_themes.py.

Every motif is about 24 units across, centred on (0, 0). Every piece is a complete SVG string.
"""
import colorsys
import math
import random


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def place(svg, x=0, y=0, rot=0, s=1):
    return f"<g transform='translate({f(x)} {f(y)}) rotate({f(rot)}) scale({f(s)})'>{svg}</g>"


def svg(w, h, body):
    return f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' viewBox='0 0 {w} {h}'>{body}</svg>\n"


def quad(t, p0, p1, p2):
    x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
    y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
    dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
    dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
    return x, y, math.degrees(math.atan2(dy, dx))


HI = "<ellipse cx='-3' cy='-3' rx='2' ry='1.2' fill='#fff' opacity='.45' transform='rotate(-30 -3 -3)'/>"


# ----------------------------------------------------------------------------- motifs

def heart(c="#c8243c", **_):
    return f"<path d='M0 9C-9 3-12-3-8-7-5-10-1-9 0-5 1-9 5-10 8-7 12-3 9 3 0 9Z' fill='{c}'/>{HI}"


def shamrock(c="#2e8b4a", **_):
    leaf = "<path d='M0 0C-5-3-7-8-4-10-2-11 0-9 0-7 0-9 2-11 4-10 7-8 5-3 0 0Z' fill='{c}'/>".format(c=c)
    leaves = "".join(f"<g transform='rotate({a})'>{leaf}</g>" for a in (0, 120, 240))
    return f"<path d='M0 0Q2 6 5 10' stroke='{c}' stroke-width='1.6' fill='none' stroke-linecap='round'/>{leaves}<circle r='1.4' fill='#ffffff' opacity='.25'/>"


def egg(c="#b9a4e0", band="#fff6c9", dot="#ffffff", **_):
    return (f"<ellipse rx='7.2' ry='9.4' fill='{c}'/>"
            f"<path d='M-7 0l2.3-2.6 2.3 2.6 2.4-2.6 2.4 2.6 2.3-2.6 2.3 2.6' fill='none' stroke='{band}' stroke-width='1.8' stroke-linejoin='round'/>"
            f"<circle cx='-2.5' cy='-5' r='1' fill='{dot}'/><circle cx='2.5' cy='-5.5' r='1' fill='{dot}'/><circle cx='0' cy='5' r='1.1' fill='{dot}'/>"
            "<ellipse cx='-2.6' cy='-4' rx='1.6' ry='2.6' fill='#fff' opacity='.3'/>")


def daisy(petal="#ffffff", center="#f2b632", **_):
    petals = "".join(f"<ellipse cx='0' cy='-6' rx='2.6' ry='5' fill='{petal}' transform='rotate({a})'/>" for a in range(0, 360, 40))
    return f"{petals}<circle r='3.6' fill='{center}'/><circle cx='-1' cy='-1' r='1' fill='#fff' opacity='.4'/>"


def tulip(c="#e8577a", stem="#4f8a3c", **_):
    return (f"<path d='M0 12V0' stroke='{stem}' stroke-width='1.8'/><path d='M0 9C-6 6-8 2-7 0 -3 2-1 5 0 9Z' fill='{stem}'/>"
            f"<path d='M-6-10C-7-4-5 1 0 1 5 1 7-4 6-10 4-6 2-7 0-11-2-7-4-6-6-10Z' fill='{c}'/>"
            "<path d='M-3-7C-3-4-2-2 0-1' stroke='#fff' stroke-opacity='.35' fill='none'/>")


def strawberry(c="#d9293a", leaf="#3f8f3a", **_):
    seeds = "".join(f"<ellipse cx='{x}' cy='{y}' rx='.5' ry='.8' fill='#f7d774'/>" for x, y in ((-3, -1), (0, 0), (3, -1), (-2, 3), (2, 3), (0, 6), (-4, 2.5), (4, 2.5)))
    return (f"<path d='M-8-4C-8 4-3 10 0 11 3 10 8 4 8-4 4-7-4-7-8-4Z' fill='{c}'/>{seeds}"
            f"<path d='M0-6L-5-9-2-5-6-4-1-4 0-1 1-4 6-4 2-5 5-9Z' fill='{leaf}'/><path d='M0-7V-11' stroke='{leaf}' stroke-width='1.4' stroke-linecap='round'/>")


def star(c="#f2c14e", points=5, r1=10, r2=4.2, **_):
    pts = []
    for i in range(points * 2):
        r = r1 if i % 2 == 0 else r2
        a = math.pi / points * i - math.pi / 2
        pts.append(f"{f(r * math.cos(a))} {f(r * math.sin(a))}")
    return f"<path d='M{'L'.join(pts)}Z' fill='{c}' stroke-linejoin='round'/>"


def sunflower(**_):
    petals = "".join(f"<ellipse cx='0' cy='-7.5' rx='2.4' ry='4.6' fill='{'#f6c218' if a % 40 == 0 else '#e8a90e'}' transform='rotate({a})'/>" for a in range(0, 360, 20))
    seeds = "".join(f"<circle cx='{f(2.5 * math.cos(a))}' cy='{f(2.5 * math.sin(a))}' r='.6' fill='#2a1a0e'/>" for a in [i * 0.9 for i in range(7)])
    return f"{petals}<circle r='5' fill='#5a3518'/>{seeds}"


def apple(c="#c62c2c", leaf="#4c8a2e", **_):
    return (f"<path d='M0-6C-4-9-10-7-10 0-10 7-5 11 0 9 5 11 10 7 10 0 10-7 4-9 0-6Z' fill='{c}'/>"
            f"<path d='M0-6Q1-10 3-11' stroke='#5b3a1e' stroke-width='1.5' fill='none' stroke-linecap='round'/>"
            f"<path d='M2-9C6-12 9-10 9-8 6-7 4-7 2-9Z' fill='{leaf}'/>{HI}")


def pumpkin(c="#ec8429", side="#d9661c", **_):
    return (f"<ellipse cx='-5' cy='0' rx='6' ry='7.5' fill='{side}'/><ellipse cx='5' cy='0' rx='6' ry='7.5' fill='{side}'/>"
            f"<ellipse cx='0' cy='0' rx='6' ry='8' fill='{c}'/>"
            "<path d='M0-8V8M-5-7Q-8 0-5 7M5-7Q8 0 5 7' stroke='#000' stroke-opacity='.15' stroke-width='.8' fill='none'/>"
            "<path d='M0-7.5Q1-11 3-11.5' stroke='#5b6b2a' stroke-width='2' fill='none' stroke-linecap='round'/>")


def jack(**_):
    face = ("<path d='M-6-2L-3-5-1-2Z M6-2L3-5 1-2Z' fill='#3a1d0a'/>"
            "<path d='M-6 2Q0 8 6 2Q3 4.5 0 4.5-3 4.5-6 2Z' fill='#3a1d0a'/>")
    return pumpkin() + face


def bat(c="#3b2a4a", **_):
    return (f"<path d='M0-2C-2-5-5-5-6-3-8-6-11-5-12-2-10-2-9 0-9 2-7 0-5 1-4 3-2 1 0 1 0 1 2 1 4 3 5 1 7 0 9 2 9 0 10-2 12-2 11-5 8-6 6-3 5-5 2-5 0-2Z' fill='{c}'/>"
            "<circle cx='-1' cy='-1' r='.5' fill='#ffd36b'/><circle cx='1' cy='-1' r='.5' fill='#ffd36b'/>")


def candycorn(**_):
    return ("<path d='M-6 8L0-10 6 8Q0 10-6 8Z' fill='#f7f1e3'/><path d='M-4.3 3L-1.5-4.5 1.5-4.5 4.3 3Z' fill='#f2a10e'/>"
            "<path d='M-6 8Q0 10 6 8L4.3 3H-4.3Z' fill='#e2671a'/>")


def snowflake(c="#ffffff", **_):
    arm = f"<path d='M0 0V-10M0-6L-3-9M0-6L3-9M0-3L-2-5M0-3L2-5' stroke='{c}' stroke-width='1.4' stroke-linecap='round' fill='none'/>"
    return "".join(f"<g transform='rotate({a})'>{arm}</g>" for a in range(0, 360, 60))


def mitten(c="#c8364a", cuff="#ffffff", **_):
    return (f"<path d='M-5 6V-4C-5-9 5-9 5-4V2L8-1C10-3 12-1 10 1L5 6Z' fill='{c}'/>"
            f"<rect x='-6' y='5' width='12' height='5' rx='1.5' fill='{cuff}'/>"
            "<path d='M-3-2h6M-3 1h6' stroke='#fff' stroke-opacity='.4' stroke-dasharray='1.5 1.5'/>")


def snowman(scarf="#c8364a", **_):
    return ("<circle cy='5' r='7' fill='#ffffff' stroke='#c9d6e3'/><circle cy='-5' r='5' fill='#ffffff' stroke='#c9d6e3'/>"
            "<rect x='-4.5' y='-14' width='9' height='5' fill='#26303a'/><rect x='-6.5' y='-10' width='13' height='1.6' fill='#26303a'/>"
            "<circle cx='-1.8' cy='-6' r='.7' fill='#26303a'/><circle cx='1.8' cy='-6' r='.7' fill='#26303a'/>"
            "<path d='M0-4.5L4-3.5 0-3Z' fill='#f08a24'/>"
            f"<path d='M-5-1.5Q0 1 5-1.5V0Q0 2.5-5 0Z' fill='{scarf}'/><path d='M3 0L5 5H3Z' fill='{scarf}'/>"
            "<circle cy='3' r='.7' fill='#26303a'/><circle cy='6' r='.7' fill='#26303a'/>")


def peach(c="#f7a46b", blush="#e9655a", leaf="#5a9a3a", **_):
    return (f"<circle r='9' fill='{c}'/><path d='M0-9C4-3 4 3 0 9' stroke='{blush}' stroke-width='1.2' fill='none' opacity='.6'/>"
            f"<circle cx='3' cy='2' r='6' fill='{blush}' opacity='.35'/>"
            f"<path d='M0-9C2-13 7-13 8-11 5-9 2-9 0-9Z' fill='{leaf}'/>{HI}")


def coin(**_):
    return "<circle r='7' fill='#e8b830'/><circle r='5.2' fill='none' stroke='#b88a10' stroke-width='1'/><circle cx='-2' cy='-2' r='1.6' fill='#fff' opacity='.45'/>"


def leaf(c="#5f8f3a", **_):
    return f"<path d='M0 10C-7 4-7-6 0-10 7-6 7 4 0 10Z' fill='{c}'/><path d='M0 10V-8M0 2L-3-1M0-2L3-5' stroke='#fff' stroke-opacity='.35' fill='none'/>"


def envelope(c="#f7efe0", seal="#c8243c", **_):
    return (f"<rect x='-11' y='-7' width='22' height='15' rx='1.5' fill='{c}' stroke='#b9a98a'/>"
            "<path d='M-11-6L0 2 11-6' fill='none' stroke='#b9a98a'/>"
            f"<path d='M0 4C-3 2-4 0-2.5-1-1.5-1.7-.4-1.3 0-.4.4-1.3 1.5-1.7 2.5-1 4 0 3 2 0 4Z' fill='{seal}'/>")


def cupcake(frost="#f6b8c8", wrap="#8fc7c0", **_):
    return (f"<path d='M-7 1H7L5 11H-5Z' fill='{wrap}'/><path d='M-4 1L-3 11M0 1V11M4 1L3 11' stroke='#fff' stroke-opacity='.45'/>"
            f"<path d='M-8 2C-10-3-5-5-4-6-4-10 4-10 4-6 5-5 10-3 8 2Z' fill='{frost}'/>"
            "<circle cy='-10' r='2.4' fill='#d9293a'/><path d='M0-12Q2-15 4-15' stroke='#3f8f3a' fill='none'/>"
            "<path d='M-5-2h1M1-4h1M4 0h1M-2 0h1' stroke='#fff' stroke-width='1.2' stroke-linecap='round'/>")


def teacup(c="#ffffff", ink="#2f56a3", **_):
    return (f"<ellipse cy='8' rx='12' ry='2.6' fill='{c}' stroke='{ink}' stroke-width='.8'/>"
            f"<path d='M-8-3H8C8 4 4 7 0 7-4 7-8 4-8-3Z' fill='{c}' stroke='{ink}' stroke-width='.8'/>"
            f"<path d='M8-1C12-1 12 4 7 4' stroke='{ink}' stroke-width='1.2' fill='none'/>"
            f"<path d='M-6 0Q-3 2 0 0T6 0' stroke='{ink}' stroke-width='1' fill='none'/><circle cx='-4' cy='3' r='.8' fill='{ink}'/><circle cx='3' cy='3' r='.8' fill='{ink}'/>")


def pot(c="#c4683a", plant="#5f8f3a", **_):
    return (f"<path d='M-7 0H7L5 10H-5Z' fill='{c}'/><rect x='-8' y='-2' width='16' height='3' rx='.8' fill='{c}'/>"
            "<rect x='-8' y='-2' width='16' height='3' rx='.8' fill='#000' opacity='.12'/>"
            f"<path d='M0-2V-12' stroke='{plant}' stroke-width='1.3'/>"
            + "".join(f"<ellipse cx='{s * 3}' cy='{y}' rx='3' ry='1.6' fill='{plant}' transform='rotate({s * -30} {s * 3} {y})'/>" for s, y in ((1, -5), (-1, -8), (1, -11))))


def photo(sky="#cfe0ea", hill="#7da36a", **_):
    return ("<rect x='-9' y='-11' width='18' height='21' fill='#fffdf7' stroke='#d6ccb8' stroke-width='.6'/>"
            f"<rect x='-7' y='-9' width='14' height='13' fill='{sky}'/>"
            f"<path d='M-7 4V0Q-3-4 1-1 4-3 7 0V4Z' fill='{hill}'/><circle cx='4' cy='-5' r='1.8' fill='#f2c14e'/>"
            "<rect x='-1.5' y='-14' width='3' height='5' rx='.5' fill='#b88a5c'/>")


def jar(lid="#c8243c", fill="#b32646", **_):
    checks = "".join(f"<rect x='{-7 + i * 3.5}' y='-11' width='1.75' height='4' fill='#fff' opacity='.7'/>" for i in range(4))
    return (f"<rect x='-6' y='-6' width='12' height='16' rx='2.5' fill='{fill}'/><rect x='-6' y='-6' width='12' height='16' rx='2.5' fill='#fff' opacity='.12'/>"
            f"<path d='M-8-7C-8-12 8-12 8-7L7-6H-7Z' fill='{lid}'/>{checks}"
            "<rect x='-4' y='0' width='8' height='5' rx='.8' fill='#fffaf0'/><rect x='-4.5' y='-4' width='2' height='12' rx='1' fill='#fff' opacity='.3'/>")


def pie(crust="#d9a05b", fill="#8e2a2a", **_):
    lattice = "".join(f"<path d='M{x} -3V3' stroke='{crust}' stroke-width='1.6'/>" for x in (-6, -2, 2, 6))
    return (f"<ellipse cy='3' rx='12' ry='4' fill='#c9d4dc'/><ellipse cy='0' rx='11' ry='3.6' fill='{fill}'/>{lattice}"
            f"<path d='M-10-1H10M-9 1.5H9' stroke='{crust}' stroke-width='1.4'/><ellipse cy='0' rx='11' ry='3.6' fill='none' stroke='{crust}' stroke-width='1.8'/>")


def cake(frost="#fbe3ec", layer="#f2a7bd", **_):
    return (f"<rect x='-10' y='-4' width='20' height='13' rx='1.5' fill='{layer}'/><rect x='-10' y='1' width='20' height='2' fill='{frost}'/>"
            f"<path d='M-10-4H10V-1C8 1 7-1 5 1 3-1 2 1 0-1-2 1-3-1-5 1-7-1-8 1-10-1Z' fill='{frost}'/>"
            "<rect x='-.8' y='-11' width='1.6' height='7' fill='#8fc7c0'/><path d='M0-11C-1.5-13 0-15 0-15 0-15 1.5-13 0-11Z' fill='#f6c218'/>"
            "<ellipse cy='10' rx='13' ry='1.6' fill='#d6ccb8'/>")


def rolling_pin(**_):
    return ("<rect x='-9' y='-3' width='18' height='6' rx='3' fill='#d6a76a'/><rect x='-14' y='-1.2' width='5' height='2.4' rx='1.2' fill='#a8763e'/>"
            "<rect x='9' y='-1.2' width='5' height='2.4' rx='1.2' fill='#a8763e'/><rect x='-8' y='-2' width='16' height='1' fill='#fff' opacity='.3'/>")


def bowl(c="#7aa6c2", **_):
    return (f"<path d='M-11-2H11C11 6 5 10 0 10-5 10-11 6-11-2Z' fill='{c}'/><ellipse cy='-2' rx='11' ry='2.5' fill='#fff8ec'/>"
            "<path d='M-8 3H8' stroke='#fff' stroke-opacity='.5' stroke-width='1.4'/><path d='M4-3L10-12' stroke='#b88a5c' stroke-width='2' stroke-linecap='round'/>")


def bow(c="#c8243c", **_):
    return (f"<path d='M0 0C-7-7-12-1-7 2-4 4-2 2 0 0ZM0 0C7-7 12-1 7 2 4 4 2 2 0 0Z' fill='{c}'/>"
            f"<path d='M-1 1-5 10-2 9 0 12ZM1 1 5 10 2 9 0 12Z' fill='{c}'/><rect x='-2' y='-2' width='4' height='4' rx='1.4' fill='{c}'/>"
            "<rect x='-2' y='-2' width='4' height='4' rx='1.4' fill='#000' opacity='.15'/>")


def fan(**_):
    """A pleated Fourth of July bunting fan, hanging from its top edge."""
    out = []
    for i in range(9):
        a0 = math.pi * i / 9
        a1 = math.pi * (i + 1) / 9
        col = ("#b22234", "#ffffff", "#2a3e7a")[i % 3] if i not in (3, 4, 5) else "#2a3e7a"
        out.append(f"<path d='M0 0L{f(-14 * math.cos(a0))} {f(14 * math.sin(a0))}A14 14 0 0 0 {f(-14 * math.cos(a1))} {f(14 * math.sin(a1))}Z' fill='{col}' stroke='#e4e0d8' stroke-width='.4'/>")
    stars = "".join(place(star('#ffffff', r1=1.6, r2=.7), 4 * math.cos(a), 6 + 4 * math.sin(a)) for a in (0.6, 1.57, 2.5))
    return "".join(out) + stars + "<circle r='2.2' fill='#f2c14e'/>"


MOTIFS = {
    "heart": heart, "shamrock": shamrock, "egg": egg, "daisy": daisy, "tulip": tulip,
    "strawberry": strawberry, "star": star, "sunflower": sunflower, "apple": apple,
    "pumpkin": pumpkin, "jack": jack, "bat": bat, "candycorn": candycorn, "snowflake": snowflake,
    "mitten": mitten, "snowman": snowman, "peach": peach, "coin": coin, "leaf": leaf,
    "envelope": envelope, "cupcake": cupcake, "teacup": teacup, "pot": pot, "photo": photo,
    "jar": jar, "pie": pie, "cake": cake, "rolling_pin": rolling_pin, "bowl": bowl, "bow": bow,
    "fan": fan,
}


def m(name, **kw):
    return MOTIFS[name](**kw)


# ----------------------------------------------------------------------------- pieces

def garland(items, rope="#6b4a2b", seam=None, seam_hang=None, W=320, H=110, sag=78, count=18, seed=1, twine=None):
    """A swag of motifs along a rope; `seam` (a motif) sits where two swags meet, with `seam_hang` below it."""
    rng = random.Random(seed)
    top = 20
    p0, p1, p2 = (0, top), (W / 2, top + sag), (W, top)
    out = [f"<path d='M0 {top}Q{W / 2} {top + sag} {W} {top}' fill='none' stroke='{rope}' stroke-width='2.4'/>"]
    if twine:
        out.append(f"<path d='M0 {top + 3}Q{W / 2} {top + sag + 3} {W} {top + 3}' fill='none' stroke='{twine}' stroke-width='.9' stroke-dasharray='3 2'/>")
    for i in range(1, count):
        x, y, a = quad(i / count, p0, p1, p2)
        name, kw = items[i % len(items)]
        side = -1 if i % 2 else 1
        out.append(place(m(name, **kw), x + rng.uniform(-1.5, 1.5), y + side * rng.uniform(1, 5) + 6, a * 0.5 + rng.uniform(-18, 18), rng.uniform(.75, .95)))
    for cx in (0, W):
        if seam_hang:
            name, kw = seam_hang
            out.append(f"<path d='M{cx} {top}V{top + 22}' stroke='{rope}' stroke-width='1'/>")
            out.append(place(m(name, **kw), cx, top + 32, 0, 1.1))
        if seam:
            name, kw = seam
            out.append(place(m(name, **kw), cx, top + 2, 0, 1.25))
    return svg(W, H, "".join(out))


def band(kind, colors, hang=None, W=120, H=72):
    """A straight band across the top of the page instead of a swag: an awning, gingham ribbon,
    airmail stripes, lace, or a string of photographs; `hang` (a motif) dangles from each repeat."""
    a, b, c = (colors + ["#ffffff"] * 3)[:3]
    out = []
    if kind == "awning":
        stripe = W / 6
        for i in range(6):
            col = a if i % 2 == 0 else b
            out.append(f"<rect x='{f(i * stripe)}' y='0' width='{f(stripe)}' height='24' fill='{col}'/>")
            out.append(f"<path d='M{f(i * stripe)} 24A{f(stripe / 2)} {f(stripe / 2)} 0 0 0 {f((i + 1) * stripe)} 24Z' fill='{col}'/>")
        out.append(f"<rect x='0' y='0' width='{W}' height='4' fill='{c}'/>")
    elif kind == "gingham":
        sq = 6
        for row in range(4):
            for col in range(W // sq):
                tone = (row % 2) + (col % 2)
                fill = [b, a, c][tone] if tone != 1 else a
                op = [".95", ".55", ".95"][tone]
                out.append(f"<rect x='{col * sq}' y='{row * sq + 4}' width='{sq}' height='{sq}' fill='{fill}' opacity='{op}'/>")
        out.append(f"<rect x='0' y='4' width='{W}' height='24' fill='none'/>")
        out.append("".join(f"<path d='M{x} 28A6 6 0 0 0 {x + 12} 28Z' fill='{c}'/>" for x in range(0, W, 12)))
    elif kind == "airmail":
        out.append(f"<rect x='0' y='0' width='{W}' height='16' fill='#ffffff'/>")
        for i, x in enumerate(range(-20, W + 20, 12)):
            out.append(f"<path d='M{x} 16L{x + 8} 0H{x + 14}L{x + 6} 16Z' fill='{a if i % 2 == 0 else b}'/>")
        out.append(f"<rect x='0' y='16' width='{W}' height='1.5' fill='{c}'/>")
    elif kind == "lace":
        out.append(f"<rect x='0' y='0' width='{W}' height='14' fill='{a}'/>")
        for x in range(0, W, 20):
            out.append(f"<path d='M{x} 14A10 10 0 0 0 {x + 20} 14Z' fill='{a}'/>")
            out.append(f"<circle cx='{x + 10}' cy='17' r='2.6' fill='{b}'/><circle cx='{x + 4}' cy='12' r='1.3' fill='{b}'/><circle cx='{x + 16}' cy='12' r='1.3' fill='{b}'/>")
            out.append(f"<path d='M{x + 10} 2l3 4-3 4-3-4Z' fill='{b}'/>")
    elif kind == "photos":
        top = 10
        out.append(f"<path d='M0 {top}Q{W / 2} {top + 10} {W} {top}' fill='none' stroke='{c}' stroke-width='1.2'/>")
        for i, x in enumerate((30, 90)):
            y = top + 6
            out.append(place(m("photo", sky=a, hill=b), x, y + 18, -6 if i else 5, 1.6))
    if hang:
        name, kw = hang
        drop = {"awning": 30, "gingham": 34, "airmail": 18, "lace": 20}.get(kind, 30)
        out.append(f"<path d='M{W / 2} {drop}V{drop + 10}' stroke='{c}' stroke-width='1'/>")
        out.append(place(m(name, **kw), W / 2, drop + 26, 0, 1.5))
    return svg(W, H, "".join(out))


def bunting(words, colors, gap_motif=None, letter="#fffaf0"):
    """Pennants with a letter each, on a sagging string. A space becomes a small motif."""
    n = len(words)
    W = n * 40 + 20
    p0, p1, p2 = (0, 10), (W / 2, 30), (W, 10)
    out = [f"<path d='M0 10Q{W / 2} 30 {W} 10' fill='none' stroke='#8a6a3e' stroke-width='1.6'/>"]
    k = 0
    for i, ch in enumerate(words):
        x, y, a = quad((i + .5) / n, p0, p1, p2)
        if ch == " ":
            if gap_motif:
                name, kw = gap_motif
                out.append(place(m(name, **kw), x, y + 8, 0, .7))
            continue
        col = colors[k % len(colors)]
        k += 1
        ink = letter if not isinstance(col, tuple) else col[1]
        col = col[0] if isinstance(col, tuple) else col
        out.append(f"<g transform='translate({f(x)} {f(y)}) rotate({f(a * .6)})'><path d='M-15 0H15L0 34Z' fill='{col}'/>"
                   f"<path d='M-15 0H15V3H-15Z' fill='#000' opacity='.15'/>"
                   f"<text x='0' y='17' text-anchor='middle' font-family='Georgia,serif' font-weight='700' font-size='15' fill='{ink}'>{ch}</text></g>")
    return svg(W, 70, "".join(out))


def corner(parts, W=210, H=165):
    """A cluster: (motif, kwargs, x, y, scale, rotation) in drawing order."""
    return svg(W, H, "".join(place(m(name, **kw), x, y, r, s) for name, kw, x, y, s, r in parts))


def mantel(parts, plank="#6b4a2b", W=420, H=92):
    """A shelf along the footer with motifs standing on it: (motif, kwargs, x, scale)."""
    out = [f"<rect x='0' y='{H - 14}' width='{W}' height='12' fill='{plank}'/><rect x='0' y='{H - 14}' width='{W}' height='3' fill='#fff' opacity='.18'/>"]
    for name, kw, x, s in parts:
        out.append(place(m(name, **kw), x, H - 14 - 11 * s, 0, s))
    return svg(W, H, "".join(out))


def pattern(name, kw, size=96, opacity=.16, spots=((18, 20, 1, 0), (66, 54, .75, 30), (36, 82, .85, -20), (84, 14, .6, 15))):
    body = "".join(place(m(name, **kw), x, y, r, s * .55) for x, y, s, r in spots)
    return svg(size, size, f"<g opacity='{opacity}'>{body}</g>")


# ----------------------------------------------------------------------------- colours

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgb_hex(c):
    return "#" + "".join(f"{round(max(0, min(1, v)) * 255):02x}" for v in c)


def lum(c):
    def ch(v):
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in hex_rgb(c))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def mix(a, b, t):
    return rgb_hex(tuple(x + (y - x) * t for x, y in zip(hex_rgb(a), hex_rgb(b))))


def readable(color, grounds, target):
    """Move `color`'s lightness the least that reaches `target` on every ground."""
    if min(contrast(color, g) for g in grounds) >= target:
        return color
    h, l, s = colorsys.rgb_to_hls(*hex_rgb(color))
    best = None
    for step in range(1, 201):
        for direction in (-1, 1):
            nl = l + direction * step * 0.005
            if 0 <= nl <= 1:
                cand = rgb_hex(colorsys.hls_to_rgb(h, nl, s))
                if min(contrast(cand, g) for g in grounds) >= target:
                    return cand
    return best or ("#000000" if lum(grounds[0]) > .4 else "#ffffff")


def scheme(page, surface, text, muted, border, accent):
    """A full colour set from six, with text at 7:1 and the rest at 4.5:1 (as open.blog's engine does)."""
    grounds = [page, surface]
    raised = mix(mix(surface, page, .5), border, .25)
    text = readable(text, grounds, 7)
    muted = readable(muted, grounds, 4.5)
    accent = readable(accent, grounds + [raised], 4.5)
    ink = text
    on_accent = "#ffffff" if contrast("#ffffff", accent) >= contrast(ink, accent) else ink
    if contrast(on_accent, accent) < 4.5:
        on_accent = "#ffffff" if contrast("#ffffff", accent) >= contrast("#000000", accent) else "#000000"
    accent_border = next((mix(page, accent, t / 20) for t in range(9, 21) if min(contrast(mix(page, accent, t / 20), g) for g in grounds) >= 3), accent)
    glow = next((mix(page, accent, s * .02) for s in range(6, 0, -1) if contrast(text, mix(page, accent, s * .02)) >= 4.5 and contrast(accent, mix(page, accent, s * .02)) >= 4.5), page)
    out = {"page": page, "outer": mix(page, text, .04), "surface": surface, "surfaceRaised": raised, "text": text,
           "muted": muted, "subtle": muted, "border": border, "accent": accent, "accentSoft": accent,
           "accentBorder": accent_border, "accentContrast": on_accent, "link": accent, "glow": glow,
           "codeBg": raised, "codeText": text, "ink": text}
    assert contrast(out["text"], page) >= 7 - 1e-6 and contrast(out["accent"], page) >= 4.5 - 1e-6, out
    return out
