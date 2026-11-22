// The fridge on The Family Wall: one box of letter magnets everybody shares, and drawings the family
// makes for Grammi. Pure: no database. The family service (family/fridge.js) stores where everything
// is; the page (themes/grammis/components/magnet-fridge.zb) draws it.
//
// Places are percents of the fridge door (x across, y down), so the same fridge fits a phone and a
// desk. A drawing is pen strokes on a square of paper, never a picture file: it can only ever show
// lines in the colors below.

/** The one box of letters. A magnet's id is its place in this string. */
export const BOX = "AAABCCDDEEEEEFGGHHIIIJKLLMMNNNOOOOPQRRRSSSTTTUUVWXYYZ♥♥!?";
export const MAGNET_COLORS = Object.freeze(["#d7263d", "#1b6fd1", "#f2b600", "#1f9d55", "#f47b20", "#8e44c9"]);
export const STARTER = "WE ♥ GRAMMI";

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
 * The fridge as Grammi starts it, and as tidying puts it back: "WE ♥ GRAMMI" across the middle, the
 * rest tipped out in a pile along the bottom. The top third is left for her notes. The same every time.
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
    if (magnet) spots.set(magnet.id, { x: round(start + i * gap), y: round(46 + (rand() - 0.5) * 1.5), r: round((rand() - 0.5) * 10) });
  });
  for (const magnet of MAGNETS) {
    if (spots.has(magnet.id)) continue;
    spots.set(magnet.id, { x: round(8 + rand() * 84), y: round(64 + rand() * 28), r: round((rand() - 0.5) * 40) });
  }
  return MAGNETS.map((magnet) => ({ id: magnet.id, ...spots.get(magnet.id) }));
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
