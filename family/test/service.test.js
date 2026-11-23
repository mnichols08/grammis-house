// The whole service against a real Postgres: set FAMILY_TEST_DATABASE_URL to a server it may make a
// throwaway database on (postgres://user@host:port/postgres). Skipped without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import pg from "pg";
import { createActions } from "@zubra/actions";
import { COMPONENTS, MAX_FORM, createFamily } from "../server.js";
import { createDatabase } from "../lib/db.js";
import { migrate } from "../lib/migrate.js";
import { readSettings } from "../lib/settings.js";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collect } from "../../docker/recipe-inbox.mjs";
import { JPEG } from "./recipes.test.js";

const admin = process.env.FAMILY_TEST_DATABASE_URL;
const KEYS = { notes: "n".repeat(40), cards: "c".repeat(40), gifts: "g".repeat(40), recipes: "r".repeat(40), fridge: "f".repeat(40) };

test("the family service, end to end", { skip: !admin && "set FAMILY_TEST_DATABASE_URL to run" }, async (t) => {
  const name = `family_test_${process.pid}`;
  const root = new pg.Client({ connectionString: admin });
  await root.connect();
  await root.query(`drop database if exists ${name}`);
  await root.query(`create database ${name}`);
  const url = new URL(admin);
  url.pathname = `/${name}`;
  const db = createDatabase(url.href);
  let clock = Date.parse("2026-12-01T15:00:00Z");
  const sent = [];
  const settings = readSettings({
    OPENBLOG_SITE_ID: "grammis-house", OPENBLOG_SITE_ORIGIN: "https://grammi.example", OPENBLOG_SITE_BASE_PATH: "/grammis-house/",
    OPENBLOG_ANALYTICS_SALT: "s".repeat(32), OPENBLOG_ADMIN_API_KEY: KEYS.notes,
    OPENBLOG_GREETINGS_ENABLED: "true", OPENBLOG_GREETINGS_ADMIN_KEY: KEYS.cards, BREVO_API_KEY: "test", OPENBLOG_GREETINGS_FROM: "Grammi <g@example.com>",
    OPENBLOG_GIFTS_ENABLED: "true", OPENBLOG_GIFTS_ADMIN_KEY: KEYS.gifts,
    OPENBLOG_RECIPES_ENABLED: "true", OPENBLOG_RECIPES_ADMIN_KEY: KEYS.recipes, OPENBLOG_RECIPES_FAMILY_CODE: "Sunday Dinner",
    OPENBLOG_FRIDGE_ENABLED: "true", OPENBLOG_FRIDGE_ADMIN_KEY: KEYS.fridge,
    OPENBLOG_NOTIFY_EMAIL: "grammi@example.org", OPENBLOG_ADMIN_URL: "https://editor.example/admin/",
  });
  await migrate(db);
  await migrate(db); // a second start changes nothing
  const actions = await createActions({ components: COMPONENTS, maxBytes: MAX_FORM });
  const family = createFamily({ settings, db, actions, now: () => clock, transport: async (mail) => { sent.push(mail); return { ok: true, id: "m1" }; } });
  family.server.listen(0, "127.0.0.1");
  await once(family.server, "listening");
  const base = `http://127.0.0.1:${family.server.address().port}`;
  const call = async (fn, fields = {}, component = "gift-maker") => {
    const form = fields instanceof FormData ? fields : new FormData();
    if (!(fields instanceof FormData)) for (const [key, value] of Object.entries(fields)) form.set(key, value);
    const response = await fetch(`${base}/_zb/action/${component}/${fn}`, { method: "POST", body: form, headers: { accept: "application/json", "sec-fetch-site": "same-origin", "x-real-ip": "203.0.113.7" } });
    assert.equal(response.status, 200, `${fn} answers`);
    return response.json();
  };
  const owner = (path, key, init = {}) => fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers || {}) } }).then(async (r) => ({ status: r.status, body: await r.json() }));

  try {
    await t.test("gifts: hidden until ready, then taken through the form's server function", async () => {
      assert.equal((await call("look")).ready, false);
      assert.equal((await call("leave", { from: "Jimmy", kind: "note", note: "Hi", token: (await call("look")).token })).error, "token", "a token straight away is too quick");
      await owner("/api/gifts/admin/settings", KEYS.gifts, { method: "POST", body: JSON.stringify({ ready: true }) });
      const { token } = await call("look");
      clock += 5000;
      const left = await call("leave", { token, from: "Jimmy", showName: "on", kind: "note", note: "Merry Christmas", wrap: "plaid", bow: "red", spotX: "30", spotY: "80" });
      assert.equal(left.ok, true);
      assert.deepEqual(left.gift.spot, { x: 30, y: 80 });
      const tree = await call("look");
      assert.deepEqual(tree.gifts.map((gift) => [gift.from, gift.wrap, gift.bow]), [["Jimmy", "plaid", "red"]]);
      assert.equal(tree.gifts[0].note, undefined, "what a gift says is never public");
      const list = await owner("/api/gifts/admin/list", KEYS.gifts);
      assert.equal(list.body.gifts[0].note, undefined, "not even to Studio until it's opened");
      assert.equal((await owner(`/api/gifts/admin/${left.gift.id}/open`, KEYS.gifts, { method: "POST" })).status, 423);
      clock = Date.parse("2026-12-25T12:00:00Z");
      const opened = await owner(`/api/gifts/admin/${left.gift.id}/open`, KEYS.gifts, { method: "POST" });
      assert.equal(opened.body.gift.note, "Merry Christmas");
      assert.equal((await owner("/api/gifts/admin/list", "wrong".repeat(10))).status, 401);
    });

    await t.test("recipes: sent from the form with photos, collected by her editor as a draft", async () => {
      const look = await call("look", {}, "recipe-share");
      assert.deepEqual([look.open, look.asks], [true, true]);
      const form = () => {
        const fields = new FormData();
        for (const [key, value] of Object.entries({ token: look.token, name: "Aunt Linda", link: "instagram.com/lindabakes", title: "Peanut Butter Fudge", course: "Dessert", story: "Every Christmas Eve.", notes: "Don't double it." })) fields.set(key, value);
        for (const line of ["2 cups sugar", "1 cup peanut butter"]) fields.append("ingredient", line);
        fields.append("step", "Boil for 5 minutes.");
        fields.append("photo", new Blob([JPEG], { type: "image/jpeg" }), "fudge.jpg");
        return fields;
      };
      clock += 5000;
      const wrong = form();
      wrong.set("code", "apple pie");
      assert.deepEqual(await call("share", wrong, "recipe-share"), { error: "family-code", field: "code" });
      const right = form();
      right.set("code", "sunday-DINNER");
      assert.deepEqual(await call("share", right, "recipe-share"), { ok: true });
      const robot = form();
      robot.set("code", "Sunday Dinner");
      robot.set("website", "https://spam.example");
      assert.deepEqual(await call("share", robot, "recipe-share"), { ok: true }, "a robot is thanked and nothing is kept");

      assert.equal((await owner("/api/recipes/admin/pending", KEYS.gifts)).status, 401, "another part's key opens nothing here");
      const pending = await owner("/api/recipes/admin/pending", KEYS.recipes);
      assert.equal(pending.body.recipes.length, 1);
      const [shared] = pending.body.recipes;
      assert.deepEqual(shared.author, { name: "Aunt Linda", link: "https://instagram.com/lindabakes" });
      assert.equal(shared.recipe.title, "Peanut Butter Fudge");
      assert.equal(Buffer.from(shared.photos[0], "base64").includes(Buffer.from("GPS")), false, "stored without where it was taken");

      const site = await mkdtemp(join(tmpdir(), "recipe-site-"));
      try {
        const written = await collect({ endpoint: `${base}/api/recipes`, key: KEYS.recipes, site, stateFile: join(site, "inbox.json"), today: "2026-12-01" });
        assert.equal(written, 1);
        const day = new Date(clock).toISOString().slice(0, 10); // the day it was sent, by the service's clock
        const posts = await readdir(join(site, "content", "posts"));
        assert.deepEqual(posts.sort(), [`${day}-peanut-butter-fudge.credits.json`, `${day}-peanut-butter-fudge.md`]);
        assert.match(await readFile(join(site, "content", "posts", `${day}-peanut-butter-fudge.md`), "utf8"), /draft: true/);
        assert.deepEqual((await owner("/api/recipes/admin/pending", KEYS.recipes)).body.recipes, [], "delivered: it isn't offered again");
        const row = await db.one("select delivered_as, (select count(*)::int from public.grammis_recipe_photos p where p.submission_id = s.id) as photos from public.grammis_recipe_submissions s");
        assert.deepEqual(row, { delivered_as: `content/posts/${day}-peanut-butter-fudge.md`, photos: 0 }, "the service's copy of the photos is gone");
      } finally {
        await rm(site, { recursive: true, force: true });
      }
    });

    await t.test("recipe requests: asked for through the same form, collected as one draft for her to write", async () => {
      const { token } = await call("look", {}, "recipe-share");
      clock += 5000;
      const ask = (name, details = "") => {
        const fields = new FormData();
        for (const [key, value] of Object.entries({ token, kind: "request", name, title: "Pecan Pie", details, code: "Sunday Dinner" })) fields.set(key, value);
        return call("share", fields, "recipe-share");
      };
      assert.deepEqual(await ask("Jimmy", "the one with the crumble top"), { ok: true });
      assert.deepEqual(await ask("Linda"), { ok: true });
      const noTitle = new FormData();
      for (const [key, value] of Object.entries({ token, kind: "request", name: "Ricky", code: "Sunday Dinner" })) noTitle.set(key, value);
      assert.deepEqual(await call("share", noTitle, "recipe-share"), { error: "title", field: "title" });

      const pending = (await owner("/api/recipes/admin/pending", KEYS.recipes)).body.recipes;
      assert.deepEqual(pending.map((r) => [r.kind, r.author.name, r.recipe.title, r.photos.length]), [["request", "Jimmy", "Pecan Pie", 0], ["request", "Linda", "Pecan Pie", 0]]);
      const site = await mkdtemp(join(tmpdir(), "request-site-"));
      try {
        assert.equal(await collect({ endpoint: `${base}/api/recipes`, key: KEYS.recipes, site, stateFile: join(site, "inbox.json"), today: "2026-12-01" }), 2);
        const posts = await readdir(join(site, "content", "posts"));
        assert.equal(posts.length, 1, "both asked for the same recipe: one draft");
        const text = await readFile(join(site, "content", "posts", posts[0]), "utf8");
        assert.match(text, /tags: \[requested\]/);
        assert.match(text, /Asked for by Jimmy\./);
        assert.match(text, /Also asked for by Linda\./);
        assert.deepEqual((await owner("/api/recipes/admin/pending", KEYS.recipes)).body.recipes, []);
      } finally {
        await rm(site, { recursive: true, force: true });
      }
    });

    await t.test("the fridge: letters anyone moves, drawings Grammi puts up and tidying from Studio, with its key", async () => {
      const fridge = (fn, fields = {}) => call(fn, fields, "magnet-fridge");
      const first = await fridge("look");
      assert.equal(first.magnets.length, 71, "the box is set out the first time anyone looks");
      assert.equal(first.finish, "classic", "a new fridge starts with the classic door");
      assert.deepEqual(first.drawings, []);
      const w = first.magnets.find((m) => m.ch === "W");

      assert.deepEqual(await fridge("move", { kind: "magnet", id: String(w.id), x: "20.5", y: "80", r: "5" }), { ok: true });
      const moved = (await fridge("look")).magnets;
      assert.deepEqual(moved.at(-1), { ...w, x: 20.5, y: 80, r: 5 }, "where it was set down, and on top of the rest");
      assert.deepEqual(await fridge("move", { kind: "magnet", id: "999", x: "20", y: "80" }), { error: "magnet", field: "id" });
      assert.deepEqual(await fridge("move", { kind: "magnet", id: String(w.id), x: "120", y: "80" }), { error: "spot", field: "spot" });

      const strokes = JSON.stringify({ strokes: [{ c: "#d7263d", s: 7, p: [10, 10, 200, 200] }] });
      assert.deepEqual(await fridge("draw", { token: first.token, drawing: strokes, by: "Jimmy" }), { error: "token", field: "token" }, "too quick");
      clock += 5000;
      assert.deepEqual(await fridge("draw", { token: first.token, drawing: strokes, by: "Jimmy" }), { ok: true });
      assert.deepEqual((await fridge("look")).drawings, [], "nothing is up until Grammi says so");

      // The page has no way in: only Studio, with the fridge key.
      assert.equal((await fetch(`${base}/_zb/action/magnet-fridge/grammi`, { method: "POST", body: new FormData(), headers: { accept: "application/json", "sec-fetch-site": "same-origin" } })).status, 404);
      assert.equal((await owner("/api/fridge/admin/list", KEYS.gifts)).status, 401, "another part's key opens nothing here");
      const corner = (await owner("/api/fridge/admin/list", KEYS.fridge)).body;
      assert.equal(corner.waiting.length, 1);
      assert.equal(corner.waiting[0].by, "Jimmy");
      const put = (await owner(`/api/fridge/admin/${corner.waiting[0].id}/up`, KEYS.fridge, { method: "POST", body: "{}" })).body;
      assert.deepEqual([put.waiting.length, put.up.length], [0, 1]);
      const up = (await fridge("look")).drawings;
      assert.deepEqual(up.map((d) => [d.by, d.drawing]), [["Jimmy", JSON.parse(strokes)]]);
      assert.deepEqual(await fridge("move", { kind: "drawing", id: up[0].id, x: "70", y: "30", r: "-3" }), { ok: true }, "a drawing that's up moves like a magnet");

      assert.equal((await owner("/api/fridge/admin/finish/stainless", KEYS.gifts, { method: "POST", body: "{}" })).status, 401);
      assert.equal((await owner("/api/fridge/admin/finish/gold", KEYS.fridge, { method: "POST", body: "{}" })).status, 422, "only the doors there are");
      assert.deepEqual((await owner("/api/fridge/admin/finish/stainless", KEYS.fridge, { method: "POST", body: "{}" })).body, { finish: "stainless" });
      assert.equal((await fridge("look")).finish, "stainless", "the page shows what she chose");
      assert.equal((await owner("/api/fridge/admin/list", KEYS.fridge)).body.finish, "stainless");

      const tidied = (await owner("/api/fridge/admin/tidy", KEYS.fridge, { method: "POST", body: "{}" })).body;
      assert.equal(tidied.ok, true);
      const shuffled = (await fridge("look")).magnets;
      assert.equal(shuffled.length, 71);
      assert.ok(shuffled.every((m) => m.y > 40), "every letter is on the fridge door, none in the freezer");
      for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) assert.ok(Math.abs(shuffled[i].x - shuffled[j].x) >= 7 || Math.abs(shuffled[i].y - shuffled[j].y) >= 5.2, "none touching");
      }
      const back = shuffled.find((m) => m.id === w.id);
      assert.notDeepEqual([back.x, back.y], [20.5, 80], "the W has moved");
      const down = (await owner(`/api/fridge/admin/${up[0].id}/down`, KEYS.fridge, { method: "POST", body: "{}" })).body;
      assert.equal(down.up.length, 0);
      assert.deepEqual(await fridge("move", { kind: "drawing", id: up[0].id, x: "70", y: "30" }), { error: "gone", field: "id" }, "one taken down can't be moved");
    });

    await t.test("greeting cards: written in Studio, sent when due, a yearly one moved to next year", async () => {
      clock = Date.parse("2027-04-10T15:00:00Z");
      const contact = (await owner("/api/greetings/contacts", KEYS.cards, { method: "POST", body: JSON.stringify({ name: "Jimmy", email: "jimmy@example.com", birthday: "1980-04-11" }) })).body.contact;
      const card = (await owner("/api/greetings/cards", KEYS.cards, { method: "POST", body: JSON.stringify({ contactId: contact.id, design: "birthday", subject: "Happy birthday, {name}!", message: "Love, Mom", sendOn: "2027-04-11", hour: 8, timeZone: "America/New_York", yearly: true }) })).body.card;
      assert.equal(card.nextSendAt, "2027-04-11T12:00:00+00:00");
      assert.equal((await family.cards.sendCards()).sent, 0, "not before its time");
      clock = Date.parse("2027-04-11T12:05:00Z");
      const report = await family.cards.sendCards();
      assert.equal(report.sent, 1);
      assert.equal(sent[0].to.email, "jimmy@example.com");
      assert.equal(sent[0].subject, "Happy birthday, Jimmy!");
      const after = (await owner("/api/greetings/cards", KEYS.cards)).body.cards[0];
      assert.equal(after.status, "scheduled");
      assert.match(after.nextSendAt, /^2028-04-11T12:00:00/);
      assert.equal((await family.cards.sendCards()).sent, 0, "never twice");
    });

    await t.test("letters: a note goes to her by email; what comes in, she's told once, in one email", async () => {
      const mailbox = (fn, fields = {}) => call(fn, fields, "family-mailbox");
      const before = sent.length;
      const { open, token } = await mailbox("look");
      assert.equal(open, true);
      clock += 5000;
      assert.deepEqual(await mailbox("write", { token, name: "Ricky", note: "Made your stuffing <3", email: "ricky@example.org" }), { ok: true });
      assert.deepEqual(await mailbox("write", { token, name: "", note: "Hi" }), { error: "name", field: "name" });
      const letter = sent[before];
      assert.deepEqual([letter.to, letter.replyTo, letter.subject], [{ email: "grammi@example.org" }, { email: "ricky@example.org", name: "Ricky" }, "A note from Ricky"]);
      assert.match(letter.text, /Made your stuffing <3/);
      assert.match(letter.html, /Made your stuffing &lt;3/);
      assert.equal((await db.one("select count(*)::int as n from public.grammis_letters where mailed_at is not null")).n, 1, "kept, and marked sent");

      // The first ping only marks the time: she isn't told about everything from before.
      assert.equal((await family.letters.ping()).told, false);
      const at = new Date(clock + 1000).toISOString();
      await db.rows("insert into public.grammis_recipe_submissions (site_id, kind, author_name, recipe, sender_digest, created_at) values ('grammis-house', 'request', 'Linda', '{\"title\":\"Pie\"}', 'x', $1), ('grammis-house', 'recipe', 'Linda', '{\"title\":\"Fudge\"}', 'x', $1)", [at]);
      await db.rows("insert into public.openblog_comments (site_id, path, author_name, body, created_at) values ('grammis-house', '/posts/stuffing/', 'Ricky', 'Yum', $1)", [at]);
      clock += 10 * 60 * 1000;
      const sentBefore = sent.length;
      const pinged = await family.letters.ping();
      assert.equal(pinged.told, true);
      assert.deepEqual(pinged.counts, { recipes: 1, requests: 1, drawings: 0, comments: 1 });
      const ping = sent[sentBefore];
      assert.equal(sent.length, sentBefore + 1, "one email for all of it");
      assert.equal(ping.to.email, "grammi@example.org");
      assert.match(ping.text, /1 recipe from the family[\s\S]*1 request[\s\S]*1 note on your recipes[\s\S]*https:\/\/editor\.example\/admin\/#\/readers/);
      clock += 10 * 60 * 1000;
      assert.equal((await family.letters.ping()).told, false, "nothing new: no email");
      assert.equal(sent.length, sentBefore + 1);
    });

    await t.test("notes: left on a page, approved in the inbox, then shown", async () => {
      const siteNotes = family.notes;
      assert.ok(siteNotes);
      // No built site here: the posts' modes come from the site's address, which a test can't reach,
      // so the inbox is checked from a stored note.
      await db.rows("insert into public.openblog_comments (site_id, path, author_name, body) values ('grammis-house', '/posts/stuffing/', 'Ricky', 'Yum')");
      const inbox = await owner("/api/admin/moderation?state=pending", KEYS.notes);
      assert.equal(inbox.body.protocol, "full");
      const item = inbox.body.items[0];
      assert.equal(item.comment.authorName, "Ricky");
      const approved = await owner("/api/admin/moderation", KEYS.notes, { method: "PATCH", body: JSON.stringify({ source: "comment", id: item.id, expectedVersion: 1, from: "pending", action: "approve", actor: "grammi" }) });
      assert.equal(approved.body.item.status, "approved");
      assert.equal(approved.body.item.version, 2);
      const stale = await owner("/api/admin/moderation", KEYS.notes, { method: "PATCH", body: JSON.stringify({ source: "comment", id: item.id, expectedVersion: 1, from: "pending", action: "approve" }) });
      assert.equal(stale.status, 409);
      assert.equal((await owner("/api/admin/moderation", "x".repeat(40))).status, 401);
    });
  } finally {
    family.server.close();
    await db.close();
    await root.query(`drop database if exists ${name}`);
    await root.end();
  }
});
