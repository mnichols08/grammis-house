import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:http";
import { isoTime } from "../lib/db.js";
import { readSettings } from "../lib/settings.js";
import { createSite, parseRedirects } from "../lib/site.js";
import { visitorAddress } from "../lib/http.js";
import { giftFromForm } from "../gifts.js";
import { checkGiftWithScene } from "../lib/gift-scene.js";
import { cleanPath, commentStateCondition } from "../notes.js";
import { checkGift } from "../vendor/openblog/lib/gift-card.mjs";

test("times read exactly as open.blog's tools always saw them", () => {
  assert.equal(isoTime("2026-11-20 03:51:53.012748+00"), "2026-11-20T03:51:53.012748+00:00");
  assert.equal(isoTime("2026-11-20 03:51:53+00"), "2026-11-20T03:51:53+00:00");
  assert.equal(isoTime(null), null);
});

test("each part is on only when switched on and complete, naming what's missing", () => {
  const base = {
    OPENBLOG_SITE_ID: "grammis-house", OPENBLOG_SITE_ORIGIN: "https://grammi.example", OPENBLOG_SITE_BASE_PATH: "/grammis-house/",
    OPENBLOG_ANALYTICS_SALT: "s".repeat(16), OPENBLOG_ADMIN_API_KEY: "a".repeat(32),
  };
  const all = readSettings({ ...base, OPENBLOG_GIFTS_ENABLED: "true", OPENBLOG_GIFTS_ADMIN_KEY: "g".repeat(32), OPENBLOG_GREETINGS_ENABLED: "true", OPENBLOG_GREETINGS_ADMIN_KEY: "c".repeat(32), BREVO_API_KEY: "k", OPENBLOG_GREETINGS_FROM: "Grammi <g@example.com>" });
  assert.equal(all.notes.enabled, true);
  assert.equal(all.gifts.enabled, true);
  assert.deepEqual(all.cards.from, { name: "Grammi", email: "g@example.com" });
  assert.equal(all.cards.siteUrl, "https://grammi.example/grammis-house/");
  const short = readSettings({ ...base, OPENBLOG_GIFTS_ENABLED: "true", OPENBLOG_GIFTS_ADMIN_KEY: "short" });
  assert.deepEqual(short.gifts.problems, ["OPENBLOG_GIFTS_ADMIN_KEY"]);
  assert.equal(readSettings({ ...base, OPENBLOG_SITE_ORIGIN: "http://x" }).notes.enabled, false);
  assert.equal(readSettings(base).cards.enabled, false, "off unless switched on");
  assert.equal(readSettings({ ...base, OPENBLOG_ADMIN_URL: "https://editor.example/admin/" }).adminUrl, "https://editor.example/admin/");
  assert.equal(readSettings({ ...base, OPENBLOG_ADMIN_URL: "javascript:alert(1)" }).adminUrl, "");
});

test("the visitor's address is only ever the proxy's, and only when trusted", () => {
  assert.equal(visitorAddress({ "x-real-ip": "203.0.113.9" }, true), "203.0.113.9");
  assert.equal(visitorAddress({ "x-real-ip": "203.0.113.9" }, false), "");
  assert.equal(visitorAddress(new Headers({ "x-real-ip": "1.2.3.4<x>" }), true), "");
});

test("a gift from the form's fields is what open.blog's check reads", () => {
  const form = new FormData();
  for (const [k, v] of Object.entries({ from: "Jimmy", showName: "on", kind: "card", design: "holly", message: "Love", signOff: "J", stickers: '[{"kind":"star","x":6,"y":8}]', wrap: "plaid", bow: "red", spotX: "30", spotY: "80" })) form.set(k, v);
  assert.deepEqual(checkGift(giftFromForm(form)), {
    from: "Jimmy", wrap: "plaid", bow: "red", showName: true, spot: { x: 30, y: 80 }, kind: "card", note: null,
    card: { design: "holly", message: "Love", signOff: "J", stickers: [{ kind: "star", x: 6, y: 8 }] },
  });
  form.set("stickers", "not json");
  assert.throws(() => checkGift(giftFromForm(form)), /bad-sticker/);
  form.set("spotX", "1e3");
  form.set("stickers", "[]");
  assert.equal(checkGift(giftFromForm(form)).spot, null, "a place that isn't two whole numbers is no place");
  assert.deepEqual(checkGiftWithScene(giftFromForm(form)), checkGift(giftFromForm(form)), "a card with no drawing is unchanged");
});

test("a card can hold a drawing, placed words, a turned sticker and a small photo", () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64")}`;
  const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64")}`;
  const scene = {
    bg: "#FFFDF8",
    plain: true,
    marks: [{ color: "#1f2633", size: 4, points: [[10, 20], [12, 22]] }],
    texts: [{ text: "Hi Grammi", x: 40, y: 30, size: 32, color: "#a11224" }],
    pictures: [{ src: jpeg, x: 50, y: 40, w: 80, h: 60 }],
  };
  const form = new FormData();
  for (const [k, v] of Object.entries({
    from: "Jimmy", kind: "card", design: "holly", message: "", signOff: "",
    stickers: '[{"kind":"star","x":50,"y":40,"turn":15,"size":140}]',
    scene: JSON.stringify(scene), wrap: "red",
  })) form.set(k, v);
  const card = checkGiftWithScene(giftFromForm(form)).card;
  assert.equal(card.message, "");
  assert.equal(card.bg, "#fffdf8");
  assert.equal(card.plain, true);
  assert.equal(card.stickers[0].turn, 15);
  assert.equal(card.stickers[0].size, 140);
  assert.equal(card.texts[0].text, "Hi Grammi");
  assert.equal(card.pictures[0].src, jpeg);
  assert.deepEqual(card.marks[0].points, [[10, 20], [12, 22]]);

  const classic = new FormData();
  for (const [k, v] of Object.entries({ from: "Jimmy", kind: "card", design: "holly", message: "Love", signOff: "J", stickers: "[]" })) classic.set(k, v);
  assert.deepEqual(checkGiftWithScene(giftFromForm(classic)).card, { design: "holly", message: "Love", signOff: "J", stickers: [] });

  form.set("scene", JSON.stringify({ ...scene, pictures: [{ src: png, x: 1, y: 1, w: 8, h: 8 }, { src: jpeg, x: 2, y: 2, w: 8, h: 8 }, { src: jpeg, x: 3, y: 3, w: 8, h: 8 }] }));
  assert.throws(() => checkGiftWithScene(giftFromForm(form)), /too-many-pictures/);
  form.set("scene", JSON.stringify({ pictures: [{ src: "data:image/svg+xml;base64,PHN2Zy8+", x: 1, y: 1, w: 8, h: 8 }] }));
  assert.throws(() => checkGiftWithScene(giftFromForm(form)), /bad-picture/);
  form.set("scene", JSON.stringify({ bg: "red" }));
  form.set("message", "Love");
  assert.throws(() => checkGiftWithScene(giftFromForm(form)), /bad-color/);
  form.set("scene", "{}");
  form.set("message", "");
  form.set("stickers", "[]");
  assert.throws(() => checkGiftWithScene(giftFromForm(form)), /message-length/);
  const note = new FormData();
  for (const [k, v] of Object.entries({ from: "Jimmy", kind: "note", note: "Hi", wrap: "red" })) note.set(k, v);
  assert.equal(checkGiftWithScene(giftFromForm(note)).note, "Hi");
});

test("comment states become the same rows open.blog's filter matches", () => {
  assert.deepEqual(commentStateCondition("removed", 2), { sql: "(status = $2 and moderation_state = $3)", values: ["rejected", "removed"] });
  assert.deepEqual(commentStateCondition("approved", 2), { sql: "status = $2", values: ["approved"] });
  const pending = commentStateCondition("pending", 2);
  assert.equal(pending.sql, "(status = $2 and (moderation_state is null or moderation_state <> all($3)))");
  assert.deepEqual(pending.values, ["pending", ["clarification"]]);
  assert.equal(commentStateCondition("withdrawn", 2), null);
  assert.equal(cleanPath("/posts/stuffing/"), "/posts/stuffing/");
  for (const bad of ["posts/", "/posts", "//x/", "/a/../b/", "/a?b/"]) assert.equal(cleanPath(bad), "", bad);
});

test("her site: under its base path, /admin to the editor, redirects, 404, no escape", async () => {
  const root = await mkdtemp(join(tmpdir(), "family-site-"));
  await mkdir(join(root, "posts", "pie"), { recursive: true });
  await writeFile(join(root, "index.html"), "home");
  await writeFile(join(root, "posts", "pie", "index.html"), "pie");
  await writeFile(join(root, "404.html"), "missing");
  await writeFile(join(root, "feed.json"), "{}");
  await writeFile(join(root, "_redirects"), "/grammis-house/old/ /grammis-house/posts/pie/ 301\n/x/* /y 301\n");
  assert.equal(parseRedirects("/x/* /y 301\n/a /b\n").size, 1);
  const site = await createSite({ root, basePath: "/grammis-house/", adminUrl: "https://editor.example/admin/" });
  const server = createServer((req, res) => site(req, res, new URL(req.url, "http://x")));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, init) => fetch(`${base}${path}`, { redirect: "manual", ...init });
  try {
    assert.equal((await get("/")).headers.get("location"), "/grammis-house/");
    assert.equal(await (await get("/grammis-house/")).text(), "home");
    assert.equal(await (await get("/grammis-house/posts/pie/")).text(), "pie");
    assert.equal((await get("/grammis-house/posts/pie")).headers.get("location"), "/grammis-house/posts/pie/");
    assert.equal((await get("/grammis-house/old/")).headers.get("location"), "/grammis-house/posts/pie/");
    assert.equal((await get("/admin/studio/")).headers.get("location"), "https://editor.example/admin/studio/");
    assert.equal((await get("/grammis-house/feed.json")).headers.get("access-control-allow-origin"), "*");
    const missing = await get("/grammis-house/nope/");
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), "missing");
    assert.equal((await get("/grammis-house/..%2f..%2fetc%2fpasswd")).status, 404);
    assert.equal((await get("/grammis-house/_redirects")).status, 404);
    assert.equal((await get("/elsewhere/index.html")).status, 404, "nothing outside the base path");
    const first = await get("/grammis-house/");
    assert.equal((await get("/grammis-house/", { headers: { "if-none-match": first.headers.get("etag") } })).status, 304);
    assert.equal((await get("/grammis-house/", { method: "POST" })).status, 405);
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});
