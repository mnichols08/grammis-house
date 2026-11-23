// The fridge on The Fridge page: the box of letters, where things may be set down, what a drawing may hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BOX, FINISHES, FridgeError, INKS, LIMITS, MAGNETS, SEAM, STARTER, checkBy, checkDrawing, checkFinish, checkMagnet, checkSpot, shuffleLayout, starterLayout } from "../lib/fridge.js";
import { readSettings } from "../lib/settings.js";

test("one box of letters, laid out the same way every time Grammi tidies", () => {
  assert.equal(MAGNETS.length, [...BOX].length);
  const count = (ch) => MAGNETS.filter((m) => m.ch === ch).length;
  assert.deepEqual(["A", "E", "I", "O", "U"].map(count), [5, 8, 5, 6, 3], "more of the popular vowels");
  assert.equal(MAGNETS.length, 71);
  // New letters only ever go on the end, so every magnet already on a door keeps its id.
  assert.ok(BOX.startsWith("AAABCCDDEEEEEFGGHHIIIJKLLMMNNNOOOOPQRRRSSSTTTUUVWXYYZ♥♥!?"));
  const layout = starterLayout();
  assert.deepEqual(layout, starterLayout(), "the same every time");
  assert.equal(layout.length, MAGNETS.length);
  // The starter phrase reads across the middle, left to right.
  const middle = layout.filter((spot) => spot.y > 55 && spot.y < 65).sort((a, b) => a.x - b.x).map((spot) => MAGNETS[spot.id].ch).join("");
  assert.equal(middle, STARTER.replace(/ /g, ""));
  // The rest lie in the pile along the bottom, on the fridge door below the seam and Grammi's notes.
  assert.ok(layout.every((spot) => spot.y > SEAM && spot.x >= 2 && spot.x <= 98 && spot.y <= 98 && Math.abs(spot.r) <= 45));
});

test("a magnet is set down on the door, turned a little at most", () => {
  assert.deepEqual(checkSpot({ x: "12.345", y: "90", r: "-7.26" }), { x: 12.3, y: 90, r: -7.3 });
  assert.deepEqual(checkSpot({ x: "50", y: "50" }), { x: 50, y: 50, r: 0 });
  for (const bad of [{ x: "1", y: "50" }, { x: "50", y: "99" }, { x: "50", y: "50", r: "90" }, { x: "1e2", y: "50" }, { x: "", y: "50" }, { x: "NaN", y: "50" }]) {
    assert.throws(() => checkSpot(bad), FridgeError, JSON.stringify(bad));
  }
  assert.equal(checkMagnet("0"), 0);
  assert.equal(checkMagnet(String(MAGNETS.length - 1)), MAGNETS.length - 1);
  for (const bad of [String(MAGNETS.length), "-1", "a", "", "1.5"]) assert.throws(() => checkMagnet(bad), FridgeError, bad);
});

test("a drawing is pen strokes in the crayons' colors, and nothing else", () => {
  const ok = { strokes: [{ c: INKS[1], s: 7, p: [10, 10, 20, 30, 300, 0] }, { c: INKS[0], s: 3, p: [5, 5] }] };
  assert.deepEqual(checkDrawing(JSON.stringify(ok)), ok);
  assert.deepEqual(checkDrawing({ strokes: [{ c: INKS[2], s: 14, p: [1, 2], extra: "<script>" }], onload: "x" }), { strokes: [{ c: INKS[2], s: 14, p: [1, 2] }] }, "only known fields are kept");
  const fails = (value, code) => assert.throws(() => checkDrawing(value), (error) => error instanceof FridgeError && error.code === code, JSON.stringify(value).slice(0, 80));
  fails("not json", "drawing");
  fails({ strokes: [] }, "drawing-empty");
  fails({ strokes: [{ c: "url(javascript:alert(1))", s: 7, p: [1, 1] }] }, "drawing");
  fails({ strokes: [{ c: INKS[0], s: 8, p: [1, 1] }] }, "drawing");
  fails({ strokes: [{ c: INKS[0], s: 7, p: [1, 1, 2] }] }, "drawing");
  fails({ strokes: [{ c: INKS[0], s: 7, p: [1, 301] }] }, "drawing");
  fails({ strokes: [{ c: INKS[0], s: 7, p: [1.5, 1] }] }, "drawing");
  fails({ strokes: Array(LIMITS.strokes + 1).fill({ c: INKS[0], s: 3, p: [1, 1] }) }, "drawing-full");
  fails({ strokes: Array(30).fill({ c: INKS[0], s: 3, p: Array(LIMITS.pointsPerStroke * 2).fill(1) }) }, "drawing-full");
  assert.equal(checkBy("  Jimmy\n  B. "), "Jimmy B.");
  assert.throws(() => checkBy("x".repeat(41)), FridgeError);
});

test("the fridge is on only with Studio's key for it", () => {
  const base = { OPENBLOG_SITE_ID: "grammis-house", OPENBLOG_SITE_ORIGIN: "https://grammi.example", OPENBLOG_ANALYTICS_SALT: "s".repeat(16) };
  assert.equal(readSettings(base).fridge.enabled, false);
  assert.deepEqual(readSettings({ ...base, OPENBLOG_FRIDGE_ENABLED: "true" }).fridge.problems, ["OPENBLOG_FRIDGE_ADMIN_KEY"]);
  assert.deepEqual(readSettings({ ...base, OPENBLOG_FRIDGE_ENABLED: "true", OPENBLOG_FRIDGE_ADMIN_KEY: "short" }).fridge.problems, ["OPENBLOG_FRIDGE_ADMIN_KEY"]);
  const on = readSettings({ ...base, OPENBLOG_FRIDGE_ENABLED: "true", OPENBLOG_FRIDGE_ADMIN_KEY: "f".repeat(32) });
  assert.equal(on.fridge.enabled, true);
  assert.equal(on.fridge.adminKey, "f".repeat(32));
});

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("shuffling puts every letter somewhere new on the fridge door, none on top of another", () => {
  const before = starterLayout();
  for (const seed of [1, 2, 3, 42, 2026]) {
    const layout = shuffleLayout(seeded(seed));
    assert.equal(layout.length, MAGNETS.length);
    assert.deepEqual(layout.map((spot) => spot.id).sort((a, b) => a - b), MAGNETS.map((m) => m.id), "every letter once");
    for (const spot of layout) {
      assert.ok(spot.x >= 3 && spot.x <= 97 && spot.y > SEAM && spot.y <= 97 && Math.abs(spot.r) <= 45, JSON.stringify(spot));
      assert.doesNotThrow(() => checkSpot({ x: String(spot.x), y: String(spot.y), r: String(spot.r) }), "a spot the service itself would accept");
    }
    // A letter is about 6% of the door wide and 5% tall: two are clear of each other when either gap is bigger.
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const dx = Math.abs(layout[i].x - layout[j].x);
        const dy = Math.abs(layout[i].y - layout[j].y);
        assert.ok(dx >= 7 || dy >= 5.2, `letters ${layout[i].id} and ${layout[j].id} touch (seed ${seed}): ${dx.toFixed(1)} across, ${dy.toFixed(1)} down`);
      }
    }
    assert.notDeepEqual(layout, before);
  }
  assert.notDeepEqual(shuffleLayout(seeded(1)), shuffleLayout(seeded(2)), "a different shuffle each time");
  assert.deepEqual(shuffleLayout(seeded(5)), shuffleLayout(seeded(5)));
});

test("the door's finish is one Grammi can choose, and a new fridge starts classic", () => {
  assert.deepEqual([...FINISHES], ["classic", "stainless"]);
  assert.equal(checkFinish("stainless"), "stainless");
  for (const bad of ["", "gold", "Classic", undefined, "classic;"]) assert.throws(() => checkFinish(bad), FridgeError, String(bad));
});
