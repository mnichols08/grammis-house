// The fridge on The Fridge page: one box of letter magnets everybody shares, and drawings the family
// makes for Grammi. Pure: no database. The family service (family/fridge.js) stores where everything
// is; the page (themes/grammis/components/magnet-fridge.zb) draws it.
//
// Places are percents of the fridge door (x across, y down), so the same fridge fits a phone and a
// desk. A drawing is pen strokes on a square of paper, never a picture file: it can only ever show
// lines in the colors below.

/**
 * The one box of letters. A magnet's id is its place in this string, so new letters only ever go on the
 * end (the second part: two more A, three E, two I, two O, a U, and an R, S, T and N to spell with them).
 */
export const BOX = "AAABCCDDEEEEEFGGHHIIIJKLLMMNNNOOOOPQRRRSSSTTTUUVWXYYZ♥♥!?" + "AAEEEIIOOURSTN";
export const MAGNET_COLORS = Object.freeze(["#d7263d", "#1b6fd1", "#f2b600", "#1f9d55", "#f47b20", "#8e44c9"]);
export const STARTER = "WE ♥ GRAMMI";

/**
 * The fridge is two doors: the freezer on top (Grammi's notes hang there) and the fridge below it. The
 * seam is this far down, as a percent of the whole door; the page draws it at the same place.
 */
export const SEAM = 40;
/** How the door looks, as Grammi chooses it in Studio. The first is what a new fridge starts with. */
export const FINISHES = Object.freeze(["classic", "stainless"]);

/** The crayons and pen sizes the drawing pad offers; a stroke in anything else is refused. */
export const INKS = Object.freeze(["#1f2633", "#d7263d", "#1b6fd1", "#1f9d55", "#f2b600", "#f47b20", "#8e44c9", "#8b5a2b"]);
export const PEN_SIZES = Object.freeze([3, 7, 14]);
/** The drawing paper, in its own units. */
export const PAPER = 300;
export const LIMITS = Object.freeze({ strokes: 150, pointsPerStroke: 500, points: 9000, by: 40, drawingsUp: 8 });

export class FridgeError extends Error {
  constructor(code, field = null, status = 422) {
    super(code);
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

const characters = [...BOX];
/** Every magnet: its letter and color. */
export const MAGNETS = Object.freeze(characters.map((ch, id) => Object.freeze({ id, ch, color: MAGNET_COLORS[(id * 5 + ch.charCodeAt(0)) % MAGNET_COLORS.length] })));

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (value) => Math.round(value * 10) / 10;

/**
 * Letters set close together in a block, like a box of them tipped out and squared up: a grid whose
 * cells are just bigger than a letter, the letters dealt into cells at random, each nudged a hair and
 * turned a little. Close, but none touching. `random` gives a number from 0 up to (not including) 1.
 */
export const CELL = Object.freeze({ wide: 6.4, tall: 3.9, nudge: 0.06, turn: 20 });
function packed(ids, random, { columns, top }) {
  const rows = Math.ceil(ids.length / columns);
  const left = 50 - (columns * CELL.wide) / 2;
  const cells = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) cells.push([column, row]);
  const deal = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  deal(cells);
  return deal(ids.slice()).map((id, n) => {
    const [column, row] = cells[n];
    return {
      id,
      x: round(left + (column + 0.5) * CELL.wide + (random() - 0.5) * CELL.wide * CELL.nudge),
      y: round(top + (row + 0.5) * CELL.tall + (random() - 0.5) * CELL.tall * CELL.nudge),
      r: round((random() - 0.5) * CELL.turn),
    };
  });
}

/**
 * The fridge as Grammi starts it: "WE ♥ GRAMMI" across the fridge door, and the rest of the box set close
 * together in a block under it, none touching. The freezer door above the seam is left for her notes.
 * The same every time.
 */
export function starterLayout() {
  const rand = seeded(7);
  const spots = new Map();
  const letters = [...STARTER];
  const gap = 7.5;
  const start = 50 - ((letters.length - 1) * gap) / 2;
  letters.forEach((ch, i) => {
    if (ch === " ") return;
    const magnet = MAGNETS.find((m) => m.ch === ch && !spots.has(m.id));
    if (magnet) spots.set(magnet.id, { x: round(start + i * gap), y: round(55 + (rand() - 0.5) * 1.5), r: round((rand() - 0.5) * 10) });
  });
  const rest = MAGNETS.filter((magnet) => !spots.has(magnet.id)).map((magnet) => magnet.id);
  for (const spot of packed(rest, rand, { columns: 11, top: 62 })) spots.set(spot.id, { x: spot.x, y: spot.y, r: spot.r });
  return MAGNETS.map((magnet) => ({ id: magnet.id, ...spots.get(magnet.id) }));
}

/**
 * Every letter somewhere new on the fridge door (below the seam), in a few tight clumps with bare door
 * between them, the way letters end up after a lot of hands, none touching another. Two to four clump
 * centres are picked at random, apart from each other; each letter goes to one of them and is tried in a
 * few random spots near it, keeping the closest one that touches nothing, so a clump grows outward from
 * its middle with ragged edges. `random` is any function giving a number from 0 up to (not including) 1;
 * the tests hand it a seeded one.
 */
export const SHUFFLE_AREA = Object.freeze({ left: 7, right: 88, top: SEAM + 6, bottom: 86 });
/** How much door one letter takes, turned a little, as a percent across and down: closer than this, two touch. */
export const LETTER = Object.freeze({ wide: 5.2, tall: 3.6 });
export function shuffleLayout(random = Math.random) {
  const { left, right, top, bottom } = SHUFFLE_AREA;
  const clear = (a, b) => Math.abs(a.x - b.x) >= LETTER.wide || Math.abs(a.y - b.y) >= LETTER.tall;
  const inside = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const count = 2 + Math.floor(random() * 3);
  const clumps = [];
  for (let tries = 0; clumps.length < count && tries < 400; tries++) {
    const at = { x: left + 10 + random() * (right - left - 20), y: top + 7 + random() * (bottom - top - 14), weight: 0.6 + random() };
    if (clumps.every((c) => Math.hypot(c.x - at.x, (c.y - at.y) * 1.4) > 34 - tries / 20)) clumps.push(at);
  }
  const total = clumps.reduce((sum, clump) => sum + clump.weight, 0);
  const pick = () => {
    let at = random() * total;
    for (const clump of clumps) if ((at -= clump.weight) <= 0) return clump;
    return clumps[clumps.length - 1];
  };
  const ids = MAGNETS.map((magnet) => magnet.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const placed = [];
  for (const id of ids) {
    const clump = pick();
    let best = null;
    // Rings outward from the clump's middle: the first ring with any free spot wins, and among a few free
    // spots in it the nearest. Each ring tries spots at random angles, so the clump's edge stays ragged.
    for (let reach = 0; !best && reach < 200; reach += 0.8) {
      for (let k = 0; k < 14; k++) {
        const turn = random() * Math.PI * 2;
        const far = reach + random() * 1.2;
        const at = {
          x: round(inside(clump.x + Math.cos(turn) * far * 1.2, left, right)),
          y: round(inside(clump.y + Math.sin(turn) * far, top, bottom)),
        };
        if (!placed.every((other) => clear(at, other))) continue;
        const d = Math.hypot((at.x - clump.x) / 1.2, at.y - clump.y);
        if (!best || d < best.d) best = { ...at, d };
      }
    }
    placed.push({ id, x: best.x, y: best.y, r: round((random() - 0.5) * 34) });
  }
  return placed;
}

/** How the door looks: one of FINISHES. */
export function checkFinish(value) {
  const finish = String(value ?? "");
  if (!FINISHES.includes(finish)) throw new FridgeError("finish", "finish");
  return finish;
}

const number = (value) => (typeof value === "string" && /^-?\d{1,3}(\.\d{1,3})?$/.test(value.trim()) ? Number(value) : NaN);

/** Where something was set down: on the door, turned at most 45 degrees either way. */
export function checkSpot(fields) {
  const get = (name) => (typeof fields.get === "function" ? fields.get(name) : fields[name]);
  const x = number(String(get("x") ?? ""));
  const y = number(String(get("y") ?? ""));
  const r = get("r") === undefined || get("r") === null || get("r") === "" ? 0 : number(String(get("r")));
  if (!(x >= 2 && x <= 98) || !(y >= 2 && y <= 98) || !(r >= -45 && r <= 45)) throw new FridgeError("spot", "spot");
  return { x: round(x), y: round(y), r: round(r) };
}

/** Which magnet: one of the box's ids. */
export function checkMagnet(value) {
  const id = /^\d{1,3}$/.test(String(value ?? "")) ? Number(value) : -1;
  if (id < 0 || id >= MAGNETS.length) throw new FridgeError("magnet", "id");
  return id;
}

/**
 * A drawing, checked and rebuilt from known fields: { strokes: [{ c, s, p: [x, y, x, y, ...] }] },
 * every color one of INKS, every size one of PEN_SIZES, every point a whole number on the paper.
 * Throws FridgeError when it isn't one, or is empty, or holds more than the paper can.
 */
export function checkDrawing(input) {
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new FridgeError("drawing", "drawing");
    }
  }
  const strokes = value && typeof value === "object" && Array.isArray(value.strokes) ? value.strokes : null;
  if (!strokes || !strokes.length) throw new FridgeError("drawing-empty", "drawing");
  if (strokes.length > LIMITS.strokes) throw new FridgeError("drawing-full", "drawing");
  let total = 0;
  const clean = strokes.map((stroke) => {
    const c = INKS.includes(stroke?.c) ? stroke.c : null;
    const s = PEN_SIZES.includes(stroke?.s) ? stroke.s : null;
    const p = Array.isArray(stroke?.p) ? stroke.p : null;
    if (!c || !s || !p || p.length < 2 || p.length % 2 || p.length / 2 > LIMITS.pointsPerStroke) throw new FridgeError("drawing", "drawing");
    if (!p.every((n) => Number.isInteger(n) && n >= 0 && n <= PAPER)) throw new FridgeError("drawing", "drawing");
    total += p.length / 2;
    return { c, s, p: p.slice() };
  });
  if (total > LIMITS.points) throw new FridgeError("drawing-full", "drawing");
  return { strokes: clean };
}

/** Who drew it, one line, as they wrote it (or nothing). */
export function checkBy(value) {
  const by = String(value ?? "").replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]+/g, " ").replace(/\s+/g, " ").trim();
  if (by.length > LIMITS.by) throw new FridgeError("by", "by");
  return by;
}
