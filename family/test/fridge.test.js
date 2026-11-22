// The fridge on The Family Wall: the box of letters, where things may be set down, what a drawing may hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BOX, FridgeError, INKS, LIMITS, MAGNETS, STARTER, checkBy, checkDrawing, checkMagnet, checkSpot, starterLayout } from "../lib/fridge.js";
import { readSettings } from "../lib/settings.js";

test("one box of letters, laid out the same way every time Grammi tidies", () => {
  assert.equal(MAGNETS.length, [...BOX].length);
  assert.equal(MAGNETS.filter((m) => m.ch === "E").length, 5);
  const layout = starterLayout();
  assert.deepEqual(layout, starterLayout(), "the same every time");
  assert.equal(layout.length, MAGNETS.length);
  // The starter phrase reads across the middle, left to right.
  const middle = layout.filter((spot) => spot.y > 40 && spot.y < 50).sort((a, b) => a.x - b.x).map((spot) => MAGNETS[spot.id].ch).join("");
  assert.equal(middle, STARTER.replace(/ /g, ""));
  // The rest lie in the pile along the bottom, clear of Grammi's notes at the top.
  assert.ok(layout.every((spot) => spot.y > 40 && spot.x >= 2 && spot.x <= 98 && spot.y <= 98 && Math.abs(spot.r) <= 45));
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

test("the fridge is on only with Grammi's word", () => {
  const base = { OPENBLOG_SITE_ID: "grammis-house", OPENBLOG_SITE_ORIGIN: "https://grammi.example", OPENBLOG_ANALYTICS_SALT: "s".repeat(16) };
  assert.equal(readSettings(base).fridge.enabled, false);
  assert.deepEqual(readSettings({ ...base, OPENBLOG_FRIDGE_ENABLED: "true" }).fridge.problems, ["OPENBLOG_FRIDGE_WORD"]);
  assert.deepEqual(readSettings({ ...base, OPENBLOG_FRIDGE_ENABLED: "true", OPENBLOG_FRIDGE_WORD: "pie" }).fridge.problems, ["OPENBLOG_FRIDGE_WORD"]);
  assert.equal(readSettings({ ...base, OPENBLOG_FRIDGE_ENABLED: "true", OPENBLOG_FRIDGE_WORD: "Pumpkin Pie" }).fridge.enabled, true);
});
